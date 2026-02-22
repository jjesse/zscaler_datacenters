const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DURATION = process.env.CACHE_DURATION || 3600000; // 1 hour default

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
 * Convert IP address string to integer for range comparison
 */
function ipToInt(ip) {
  const parts = ip.split('.');
  return ((parseInt(parts[0]) << 24) +
         (parseInt(parts[1]) << 16) +
         (parseInt(parts[2]) << 8) +
         parseInt(parts[3])) >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Parse CIDR notation to IP range
 */
function parseCidr(cidr) {
  const [ip, bits] = cidr.split('/');
  const prefixLength = parseInt(bits);
  
  // Calculate network mask
  const mask = (-1 << (32 - prefixLength)) >>> 0;
  
  // Get network address (start of range)
  const ipInt = ipToInt(ip);
  const start = (ipInt & mask) >>> 0;
  
  // Calculate broadcast address (end of range)
  const hostMask = ~mask >>> 0;
  const end = (start | hostMask) >>> 0;
  
  return {
    start,
    end,
    cidr
  };
}

/**
 * Check if an IP is within a range
 */
function isIpInRange(ip, range) {
  const ipInt = ipToInt(ip);
  return ipInt >= range.start && ipInt <= range.end;
}

/**
 * Fetch Zscaler CENR data for a specific cloud
 */
async function fetchZscalerData(cloud) {
  const cacheKey = cloud;
  const cached = dataCache.get(cacheKey);
  
  // Return cached data if still valid
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

    // Cache the data
    dataCache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now()
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching data for ${cloud}:`, error.message);
    
    // If we have expired cache, return it anyway
    if (cached) {
      console.log(`Using expired cache for ${cloud}`);
      return cached.data;
    }
    
    throw error;
  }
}

/**
 * Lookup an IP address in Zscaler data
 */
function lookupIp(ip, zscalerData) {
  // Get the cloud data - structure is: data[cloudName][continent][city][rangeArray]
  // Find the first cloud key (there should only be one)
  const cloudKeys = Object.keys(zscalerData);
  if (cloudKeys.length === 0) return null;
  
  const cloudData = zscalerData[cloudKeys[0]];
  
  // Iterate through all continents
  for (const [continentKey, cities] of Object.entries(cloudData)) {
    if (typeof cities !== 'object' || Array.isArray(cities)) continue;
    
    // Extract continent name (format is "continent : NAME")
    const continent = continentKey.replace('continent : ', '').trim();
    
    // Iterate through all cities
    for (const [cityKey, ranges] of Object.entries(cities)) {
      if (!Array.isArray(ranges)) continue;
      
      // Extract city/datacenter name (format is "city : NAME")
      const datacenter = cityKey.replace('city : ', '').trim();
      
      // Check each range
      for (const rangeItem of ranges) {
        try {
          // Handle both object format {range: "..."} and string format
          let cidr;
          if (typeof rangeItem === 'object' && rangeItem.range) {
            cidr = rangeItem.range;
          } else if (typeof rangeItem === 'string') {
            cidr = rangeItem;
          } else {
            continue; // Skip invalid formats
          }
          
          // Skip IPv6 ranges (contain :)
          if (cidr.includes(':')) continue;
          
          const range = parseCidr(cidr);
          if (isIpInRange(ip, range)) {
            return {
              datacenter,
              city: datacenter, // City and datacenter are the same in this API
              continent,
              range: cidr,
              latitude: rangeItem.latitude || null,
              longitude: rangeItem.longitude || null
            };
          }
        } catch (error) {
          console.error(`Error parsing range:`, error.message);
        }
      }
    }
  }
  
  return null;
}

/**
 * Validate IP address format
 */
function isValidIp(ip) {
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  
  if (!match) return false;
  
  // Check each octet is 0-255
  for (let i = 1; i <= 4; i++) {
    const octet = parseInt(match[i]);
    if (octet < 0 || octet > 255) return false;
  }
  
  return true;
}

/**
 * Get client IP address from request
 * Handles various proxy headers
 */
function getClientIp(req) {
  // Try various headers that might contain the real IP
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const candidate = forwarded.split(',')[0].trim();
    // Only trust the header value if it is a valid IPv4 address (prevents spoofing with non-IP values)
    if (isValidIp(candidate)) {
      return candidate;
    }
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp && isValidIp(realIp.trim())) {
    return realIp.trim();
  }

  // req.socket.remoteAddress is the authoritative source when no proxy headers are present
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Get geolocation for an IP address using ip-api.com
 * Free for non-commercial use, no API key required
 */
async function getIpGeolocation(ip) {
  // Don't lookup local/private IPs
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

  // Validate parameters
  if (!cloud || !ip) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: cloud and ip'
    });
  }

  // Validate cloud
  if (!ZSCALER_CLOUDS.includes(cloud)) {
    return res.status(400).json({
      success: false,
      error: `Invalid cloud. Supported clouds: ${ZSCALER_CLOUDS.join(', ')}`
    });
  }

  // Validate IP address
  if (!isValidIp(ip)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid IP address format'
    });
  }

  // Validate source IP if provided
  if (sourceIp && !isValidIp(sourceIp)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid source IP address format'
    });
  }

  try {
    // Fetch Zscaler data
    const data = await fetchZscalerData(cloud);
    
    // Lookup the IP
    const result = lookupIp(ip, data);
    
    // Get client's IP and location for traffic flow visualization
    // Use sourceIp if provided, otherwise detect from request
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
      
      // Add client location if available
      if (clientLocation) {
        response.clientIp = clientLocation.ip;
        response.clientCity = clientLocation.city;
        response.clientCountry = clientLocation.country;
        response.clientLatitude = clientLocation.latitude;
        response.clientLongitude = clientLocation.longitude;
        
        // Calculate distance if both locations have coordinates
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
      message: error.message
    });
  }
});

/**
 * POST /api/trace - Trace route through multiple IPs
 * Body: { cloud, ips: [] }
 */
app.post('/api/trace', async (req, res) => {
  const { cloud, ips } = req.body;

  // Validate parameters
  if (!cloud || !ips || !Array.isArray(ips)) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: cloud and ips (array)'
    });
  }

  // Limit the number of IPs to prevent abuse
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

  // Validate cloud
  if (!ZSCALER_CLOUDS.includes(cloud)) {
    return res.status(400).json({
      success: false,
      error: `Invalid cloud. Supported clouds: ${ZSCALER_CLOUDS.join(', ')}`
    });
  }

  // Validate IP addresses
  const invalidIps = ips.filter(ip => !isValidIp(ip));
  if (invalidIps.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Invalid IP address(es): ${invalidIps.join(', ')}`
    });
  }

  try {
    // Fetch Zscaler data
    const zscalerData = await fetchZscalerData(cloud);
    
    // Process each hop
    const hops = [];
    let totalDistance = 0;
    let previousHop = null;

    for (const ip of ips) {
      // Lookup in Zscaler data
      const zscalerResult = lookupIp(ip, zscalerData);
      
      // Get geolocation
      const geoLocation = await getIpGeolocation(ip);
      
      const hop = {
        ip: ip,
        found: false
      };

      // Prefer Zscaler data if found
      if (zscalerResult) {
        hop.found = true;
        hop.datacenter = zscalerResult.datacenter;
        hop.city = zscalerResult.city;
        hop.continent = zscalerResult.continent;
        hop.range = zscalerResult.range;
        hop.latitude = zscalerResult.latitude;
        hop.longitude = zscalerResult.longitude;
      } else if (geoLocation) {
        // Use geolocation data
        hop.found = true;
        hop.city = geoLocation.city;
        hop.country = geoLocation.country;
        hop.latitude = geoLocation.latitude;
        hop.longitude = geoLocation.longitude;
      }

      // Calculate distance from previous hop
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
      message: error.message
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
app.listen(PORT, () => {
  console.log(`🚀 Zscaler Datacenter Lookup running on http://localhost:${PORT}`);
  console.log(`📊 Cache duration: ${CACHE_DURATION / 1000}s`);
  console.log(`🌍 Supported clouds: ${ZSCALER_CLOUDS.length}`);
});
