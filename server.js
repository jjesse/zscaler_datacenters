'use strict';

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { isValidIp, parseCidr, isIpInRange } = require('./utils/ip');
const { calculateDistance } = require('./utils/distance');

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
          callback(null, false);
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

// List of supported ZDX clouds
const ZDX_CLOUDS = [
  'zdxcloud',
  'zdxbeta',
  'zdxgov'
];

// Cache for Zscaler data
const dataCache = new Map();

/**
 * Fetch Zscaler CENR data for a specific cloud
 * @param {string} cloud - Cloud hostname (e.g., "zscaler.net")
 * @returns {Promise<object>} Parsed CENR JSON data
 * @throws {Error} If cloud is not in the allowlist
 */
async function fetchZscalerData(cloud) {
  // Defence-in-depth: validate cloud against allowlist
  if (!ZSCALER_CLOUDS.includes(cloud)) {
    throw new Error(`Invalid cloud: ${cloud} is not in the allowed list`);
  }
  
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
 * Get geolocation for a public IP address using ip-api.com
 * @param {string} ip - IPv4 address to geolocate
 * @returns {Promise<object|null>} Geolocation data or null
 */
async function getIpGeolocation(ip) {
  // Check for private IP ranges (RFC 1918)
  if (ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }
  // RFC 1918: 172.16.0.0/12 (second octet 16-31 only)
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    const secondOctet = parseInt(parts[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return null;
    }
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
 * POST /api/zdx/userpath - Get ZDX user path to application
 * Body: { cloud, userEmail, appName }
 */
app.post('/api/zdx/userpath', async (req, res) => {
  const { cloud, userEmail, appName } = req.body;

  // Validate required parameters
  if (!cloud || !userEmail || !appName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: cloud, userEmail, and appName'
    });
  }

  if (!ZDX_CLOUDS.includes(cloud)) {
    return res.status(400).json({
      success: false,
      error: `Invalid ZDX cloud. Supported clouds: ${ZDX_CLOUDS.join(', ')}`
    });
  }

  // Check for ZDX credentials
  const zdxClientId = process.env.ZDX_CLIENT_ID;
  const zdxClientSecret = process.env.ZDX_CLIENT_SECRET;

  if (!zdxClientId || !zdxClientSecret) {
    return res.status(500).json({
      success: false,
      error: 'ZDX API credentials not configured. Set ZDX_CLIENT_ID and ZDX_CLIENT_SECRET environment variables.',
      needsConfig: true
    });
  }

  try {
    // 1. Get authentication token
    const authUrl = `https://api.${cloud}.net/v1/oauth/token`;
    const authResponse = await axios.post(authUrl, 
      `grant_type=client_credentials&client_id=${zdxClientId}&client_secret=${zdxClientSecret}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const authToken = authResponse.data.access_token;
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // 2. Get device list for user
    const devicesUrl = `https://api.${cloud}.net/v1/devices?search=${encodeURIComponent(userEmail)}`;
    const devicesResponse = await axios.get(devicesUrl, { headers });
    
    if (!devicesResponse.data || !devicesResponse.data.devices || devicesResponse.data.devices.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No devices found for user: ${userEmail}`
      });
    }

    const device = devicesResponse.data.devices[0];
    const deviceId = device.id;

    // 3. Get apps list
    const appsUrl = `https://api.${cloud}.net/v1/apps`;
    const appsResponse = await axios.get(appsUrl, { headers });
    
    const targetApp = appsResponse.data.find(app => 
      app.name.toLowerCase().includes(appName.toLowerCase())
    );

    if (!targetApp) {
      return res.status(404).json({
        success: false,
        error: `Application not found: ${appName}`,
        availableApps: appsResponse.data.map(a => a.name).slice(0, 10)
      });
    }

    // 4. Get cloud path probes
    const probesUrl = `https://api.${cloud}.net/v1/devices/${deviceId}/apps/${targetApp.id}/cloudpath-probes`;
    const probesResponse = await axios.get(probesUrl, { headers });

    if (!probesResponse.data || probesResponse.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No Cloud Path Probes configured for application: ${targetApp.name}`,
        hint: 'Please configure a Cloud Path Probe for this app in ZDX Admin Portal'
      });
    }

    const probe = probesResponse.data[0];

    // 5. Get cloud path data
    const cloudpathUrl = `https://api.${cloud}.net/v1/devices/${deviceId}/apps/${targetApp.id}/cloudpath-probes/${probe.id}/cloudpath`;
    const cloudpathResponse = await axios.get(cloudpathUrl, { headers });

    if (!cloudpathResponse.data || cloudpathResponse.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No cloud path data available'
      });
    }

    const pathData = cloudpathResponse.data[0];

    // 6. Extract and enrich IPs with geolocation
    const hops = [];
    for (const leg of pathData.cloudpath) {
      for (const hop of leg.hops) {
        if (hop.ip) {
          hops.push({
            ip: hop.ip,
            latency: hop.latency_avg || null,
            segment: `${leg.src} → ${leg.dst}`
          });
        }
      }
    }

    // 7. Get geolocation for all IPs
    const enrichedHops = await Promise.all(
      hops.map(async (hop) => {
        try {
          const geoData = await getIpGeolocation(hop.ip);
          return { ...hop, ...geoData };
        } catch {
          return { ...hop, country: 'Unknown', city: null, lat: null, lon: null };
        }
      })
    );

    res.json({
      success: true,
      data: {
        user: userEmail,
        device: device.name,
        application: targetApp.name,
        probe: probe.name,
        timestamp: pathData.timestamp,
        hops: enrichedHops
      }
    });

  } catch (error) {
    console.error('ZDX API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch ZDX user path data'
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

// Start server - use HTTPS if certificates exist, otherwise HTTP
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'key.pem');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'cert.pem');

let server;
if (fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
  const sslOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH)
  };
  server = https.createServer(sslOptions, app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Zscaler Datacenter Lookup running on https://localhost:${PORT}`);
    console.log(`📊 Cache duration: ${CACHE_DURATION / 1000}s`);
    console.log(`🌍 Supported clouds: ${ZSCALER_CLOUDS.length}`);
  });
} else {
  server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Zscaler Datacenter Lookup running on http://localhost:${PORT}`);
    console.log('⚠️  No SSL certificates found – running in HTTP mode.');
    console.log('   Set SSL_KEY_PATH and SSL_CERT_PATH env vars to enable HTTPS.');
    console.log(`📊 Cache duration: ${CACHE_DURATION / 1000}s`);
    console.log(`🌍 Supported clouds: ${ZSCALER_CLOUDS.length}`);
  });
}

module.exports = app; // Export for testing
