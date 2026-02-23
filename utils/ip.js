'use strict';

/**
 * Convert IP address string to unsigned 32-bit integer for range comparison
 * @param {string} ip - IPv4 address string (e.g., "192.168.1.1")
 * @returns {number} Unsigned 32-bit integer representation
 */
function ipToInt(ip) {
  const parts = ip.split('.');
  return ((parseInt(parts[0]) << 24) +
         (parseInt(parts[1]) << 16) +
         (parseInt(parts[2]) << 8) +
         parseInt(parts[3])) >>> 0;
}

/**
 * Parse CIDR notation to an IP range object
 * @param {string} cidr - CIDR notation string (e.g., "192.168.1.0/24")
 * @returns {{ start: number, end: number, cidr: string }} IP range with start/end as unsigned ints
 */
function parseCidr(cidr) {
  const [ip, bits] = cidr.split('/');
  const prefixLength = parseInt(bits);

  const mask = (-1 << (32 - prefixLength)) >>> 0;
  const ipInt = ipToInt(ip);
  const start = (ipInt & mask) >>> 0;
  const hostMask = ~mask >>> 0;
  const end = (start | hostMask) >>> 0;

  return { start, end, cidr };
}

/**
 * Check whether an IP address falls within a parsed CIDR range
 * @param {string} ip - IPv4 address string
 * @param {{ start: number, end: number }} range - Parsed range from parseCidr()
 * @returns {boolean} True if the IP is within the range
 */
function isIpInRange(ip, range) {
  const ipInt = ipToInt(ip);
  return ipInt >= range.start && ipInt <= range.end;
}

/**
 * Validate an IPv4 address string
 * @param {string} ip - String to validate
 * @returns {boolean} True if the string is a valid IPv4 address
 */
function isValidIp(ip) {
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);

  if (!match) return false;

  for (let i = 1; i <= 4; i++) {
    const octet = parseInt(match[i]);
    if (octet < 0 || octet > 255) return false;
  }

  return true;
}

module.exports = { ipToInt, parseCidr, isIpInRange, isValidIp };
