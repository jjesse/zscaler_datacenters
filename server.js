'use strict';

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { isValidIp, parseCidr, isIpInRange } = require('./utils/ip');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DURATION = process.env.CACHE_DURATION || 3600000; // 1 hour default

// CORS configuration - restrict to known origins if ALLOWED_ORIGINS env var is set
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;

const corsOptions = allowedOrigins
  ? {
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    }
  : {}; // Empty options = allow all (default, backward-compatible)

// Rate limiter for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});

// Middleware
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://unpkg.com',
        'https://cdnjs.cloudflare.com',
        "'unsafe-eval'" // required by Leaflet
      ],
      styleSrc: [
        "'self'",
        'https://unpkg.com',
        "'unsafe-inline'" // required by Leaflet inline styles
      ],
      imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
      connectSrc: ["'self'", 'http://ip-api.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Apply rate limiting to all /api routes
app.use('/api', apiLimiter);

// List of supported Zscaler clouds
const ZSCALER_CLOUDS = [
  'zscaler.net',
  'zscalerone.net',
  'zscalertwo.net',
  'zscalerthree.net',
  'zscloud.net',
  'zscalerbeta.net',
  'zscalergov.net',
  'zscalerten.net'
];

// Cache for Zscaler data
const dataCache = new Map();

/**
 * Fetch Zscaler CENR data for a specific cloud
 * @param {string} cloud - Cloud hostname (e.g., "zscaler.net")
 * @returns {Promise<object>} Parsed CENR JSON data
 */
async function fetchZscalerData(cloud) {
  const cacheKey = cloud;
  const cached = dataCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached data for ${cloud}`);
    return cached.data;
  }

  try {
    const url = `https://config.zscaler.com/api/${cloud}/cenr/json`;
    console.log(`Fetching data from ${url}`);

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Zscaler-Datacenter-Lookup/1.0'
      }
    });

    dataCache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now()
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching data for ${cloud}:`, error.message);

    if (cached) {
      console.log(`Using expired cache for ${cloud}`);
      return cached.data;
    }

    throw error;
  }
}

/**
 * Lookup an IP address in Zscaler CENR data
 * @param {string} ip - IPv4 address to look up
 * @param {object} zscalerData - Parsed CENR data from fetchZscalerData()
 * @returns {object|null} Match result or null if not found
 */
function lookupIp(ip, zscalerData) {
  const cloudKeys = Object.keys(zscalerData);
  if (cloudKeys.length === 0) return null;

  const cloudData = zscalerData[cloudKeys[0]];

  for (const [continentKey, cities] of Object.entries(cloudData)) {
    if (typeof cities !== 'object' || Array.isArray(cities)) continue;

    const continent = continentKey.replace('continent : ', '').trim();

    for (const [cityKey, ranges] of Object.entries(cities)) {
      if (!Array.isArray(ranges)) continue;

      const datacenter = cityKey.replace('city : ', '').trim();

      for (const rangeItem of ranges) {
        try {
          let cidr;
          if (typeof rangeItem === 'object' && rangeItem.range) {
            cidr = rangeItem.range;
          } else if (typeof rangeItem === 'string') {
            cidr = rangeItem;
          } else {
            continue;
          }

          if (cidr.includes(':')) continue;

          const range = parseCidr(cidr);
          if (isIpInRange(ip, range)) {
            return {
              datacenter,
              city: datacenter,
              continent,
              range: cidr,
              latitude: rangeItem.latitude || null,
              longitude: rangeItem.longitude || null
            };
          }
        } catch (error) {
          console.error('Error parsing range:', error.message);
        }
      }
    }
  }

  return null;
}

/**
 * Get client IP address from request, handling proxy headers
 * @param {import('express').Request} req - Express request object
 * @returns {string} Client IPv4 address
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const candidate = forwarded.split(',')[0].trim();
    if (isValidIp(candidate)) {
      return candidate;
    }
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp && isValidIp(realIp.trim())) {
    return realIp.trim();
  }

  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Calculate distance between two coordinates using the Haversine formula
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in kilometres, rounded to 1 decimal place
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Get geolocation for a public IP address using ip-api.com
 * @param {string} ip - IPv4 address to geolocate
 * @returns {Promise<object|null>} Geolocation data or null
 */
async function getIpGeolocation(ip) {
  if (ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') ||
      ip.startsWith('10.') || ip.startsWith('172.')) {
    return null;
  }

  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 3000,
      params: {
        fields: 'status,message,country,city,lat,lon,query'
      }
    });

    if (response.data.status === 'success') {
      return {
        ip: response.data.query,
        city: response.data.city,
        country: response.data.country,
        latitude: response.data.lat,
        longitude: response.data.lon
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching geolocation:', error.message);
    return null;
  }
}

// API Routes

/**
 * GET /api/clouds - List all supported Zscaler clouds
 */
app.get('/api/clouds', (req, res) => {
  res.json({
    success: true,
    clouds: ZSCALER_CLOUDS
  });
});

/**
 * GET /api/lookup - Lookup an IP address
 * Query params: cloud, ip, sourceIp (optional)
 */
app.get('/api/lookup', async (req, res) => {
  const { cloud, ip, sourceIp } = req.query;

  if (!cloud || !ip) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: cloud and ip'
    });
  }

  if (!ZSCALER_CLOUDS.includes(cloud)) {
    return res.status(400).json({
      success: false,
      error: `Invalid cloud. Supported clouds: ${ZSCALER_CLOUDS.join(', ')}`
    });
  }

  if (!isValidIp(ip)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid IP address format'
    });
  }

  if (sourceIp && !isValidIp(sourceIp)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid source IP address format'
    });
  }

  try {
    const data = await fetchZscalerData(cloud);
    const result = lookupIp(ip, data);
    const clientIp = sourceIp || getClientIp(req);
    const clientLocation = await getIpGeolocation(clientIp);

    if (result) {
      const response = {
        success: true,
        ip,
        cloud,
        datacenter: result.datacenter,
        city: result.city,
        continent: result.continent,
        range: result.range,
        latitude: result.latitude,
        longitude: result.longitude
      };

      if (clientLocation) {
        response.clientIp = clientLocation.ip;
        response.clientCity = clientLocation.city;
        response.clientCountry = clientLocation.country;
        response.clientLatitude = clientLocation.latitude;
        response.clientLongitude = clientLocation.longitude;

        if (result.latitude && result.longitude) {
          const distanceKm = calculateDistance(
            clientLocation.latitude,
            clientLocation.longitude,
            parseFloat(result.latitude),
            parseFloat(result.longitude)
          );
          response.distanceKm = distanceKm;
          response.distanceMiles = Math.round(distanceKm * 0.621371 * 10) / 10;
        }
      }

      res.json(response);
    } else {
      res.json({
        success: false,
        ip,
        cloud,
        error: 'IP address not found in any datacenter for this cloud'
      });
    }
  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Zscaler data',
      ...(process.env.NODE_ENV !== 'production' && { message: error.message })
    });
  }
});

/**
 * POST /api/trace - Trace route through multiple IPs
 * Body: { cloud, ips: string[] }
 */
app.post('/api/trace', async (req, res) => {
  const { cloud, ips } = req.body;

  if (!cloud || !ips || !Array.isArray(ips)) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: cloud and ips (array)'
    });
  }

  const MAX_TRACE_IPS = 50;
  if (ips.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one IP address is required'
    });
  }
  if (ips.length > MAX_TRACE_IPS) {
    return res.status(400).json({
      success: false,
      error: `Too many IP addresses. Maximum allowed is ${MAX_TRACE_IPS}`
    });
  }

  if (!ZSCALER_CLOUDS.includes(cloud)) {
    return res.status(400).json({
      success: false,
      error: `Invalid cloud. Supported clouds: ${ZSCALER_CLOUDS.join(', ')}`
    });
  }

  const invalidIps = ips.filter(ip => !isValidIp(ip));
  if (invalidIps.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Invalid IP address(es): ${invalidIps.join(', ')}`
    });
  }

  try {
    const zscalerData = await fetchZscalerData(cloud);

    const hops = [];
    let totalDistance = 0;
    let previousHop = null;

    for (const ip of ips) {
      const zscalerResult = lookupIp(ip, zscalerData);
      const geoLocation = await getIpGeolocation(ip);

      const hop = { ip, found: false };

      if (zscalerResult) {
        hop.found = true;
        hop.datacenter = zscalerResult.datacenter;
        hop.city = zscalerResult.city;
        hop.continent = zscalerResult.continent;
        hop.range = zscalerResult.range;
        hop.latitude = zscalerResult.latitude;
        hop.longitude = zscalerResult.longitude;
      } else if (geoLocation) {
        hop.found = true;
        hop.city = geoLocation.city;
        hop.country = geoLocation.country;
        hop.latitude = geoLocation.latitude;
        hop.longitude = geoLocation.longitude;
      }

      if (previousHop && previousHop.latitude && previousHop.longitude &&
          hop.latitude && hop.longitude) {
        const distance = calculateDistance(
          parseFloat(previousHop.latitude),
          parseFloat(previousHop.longitude),
          parseFloat(hop.latitude),
          parseFloat(hop.longitude)
        );
        hop.distanceFromPrevious = distance;
        totalDistance += distance;
      }

      hops.push(hop);
      previousHop = hop;
    }

    res.json({
      success: true,
      cloud,
      hops,
      totalHops: hops.length,
      totalDistance: totalDistance > 0 ? totalDistance : null,
      totalDistanceMiles: totalDistance > 0 ? Math.round(totalDistance * 0.621371 * 10) / 10 : null,
      foundHops: hops.filter(h => h.found).length
    });
  } catch (error) {
    console.error('Trace route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process trace route',
      ...(process.env.NODE_ENV !== 'production' && { message: error.message })
    });
  }
});

/**
 * GET /api/health - Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cacheSize: dataCache.size
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Zscaler Datacenter Lookup running on http://localhost:${PORT}`);
  console.log(`📊 Cache duration: ${CACHE_DURATION / 1000}s`);
  console.log(`🌍 Supported clouds: ${ZSCALER_CLOUDS.length}`);
});

module.exports = app; // Export for testing
