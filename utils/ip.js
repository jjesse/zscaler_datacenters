'use strict';

const net = require('net');

/**
 * Convert IP address string to unsigned 32-bit integer for range comparison
 * @param {string} ip - IPv4 address string (e.g., "192.168.1.1")
 * @returns {number} Unsigned 32-bit integer representation
 * @throws {TypeError} If ip is null, undefined, or not a string
 */
function ipToInt(ip) {
  if (ip === null || ip === undefined || typeof ip !== 'string' || ip === '') {
    throw new TypeError('IP address must be a non-empty string');
  }
  const parts = ip.split('.');
  return ((parseInt(parts[0]) << 24) +
         (parseInt(parts[1]) << 16) +
         (parseInt(parts[2]) << 8) +
         parseInt(parts[3])) >>> 0;
}

/**
 * Expand a compressed IPv6 address to a 32-character hex string (no colons)
 * @param {string} ip - IPv6 address (possibly compressed with ::)
 * @returns {string} 32-character lowercase hex string
 */
function expandIpv6(ip) {
  // Strip zone identifier (e.g. fe80::1%eth0)
  const stripped = ip.split('%')[0];
  const halves = stripped.split('::');
  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    const full = [...left, ...Array(missing).fill('0'), ...right];
    return full.map(h => h.padStart(4, '0')).join('');
  }
  return stripped.split(':').map(h => h.padStart(4, '0')).join('');
}

/**
 * Convert IPv6 address string to BigInt for range comparison
 * @param {string} ip - IPv6 address string
 * @returns {bigint} 128-bit BigInt representation
 */
function ipv6ToBigInt(ip) {
  return BigInt('0x' + expandIpv6(ip));
}

/**
 * Parse IPv6 CIDR notation to an IP range object
 * @param {string} cidr - IPv6 CIDR notation string (e.g., "2001:db8::/32")
 * @returns {{ start: bigint, end: bigint, cidr: string }} IP range with start/end as BigInts
 * @throws {TypeError} If cidr is null, undefined, or not a string
 * @throws {Error} If CIDR format is invalid or prefix length is out of range
 */
function parseIpv6Cidr(cidr) {
  if (cidr === null || cidr === undefined || typeof cidr !== 'string' || cidr === '') {
    throw new TypeError('CIDR must be a non-empty string');
  }
  if (!cidr.includes('/')) {
    throw new Error('Invalid CIDR format: missing "/" separator');
  }
  const [ip, bits] = cidr.split('/');
  const prefixLength = parseInt(bits, 10);
  if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 128) {
    throw new Error(`Invalid IPv6 CIDR prefix length: must be 0-128, got "${bits}"`);
  }
  const BITS_128 = (1n << 128n) - 1n;
  const mask = prefixLength === 0 ? 0n : (BITS_128 ^ ((1n << BigInt(128 - prefixLength)) - 1n));
  const ipInt = ipv6ToBigInt(ip);
  const start = ipInt & mask;
  const end = start | (BITS_128 ^ mask);
  return { start, end, cidr };
}

/**
 * Check whether an IPv6 address falls within a parsed IPv6 CIDR range
 * @param {string} ip - IPv6 address string
 * @param {{ start: bigint, end: bigint }} range - Parsed range from parseIpv6Cidr()
 * @returns {boolean} True if the IP is within the range
 */
function isIpv6InRange(ip, range) {
  const ipInt = ipv6ToBigInt(ip);
  return ipInt >= range.start && ipInt <= range.end;
}

/**
 * Validate an IPv6 address string
 * @param {string} ip - String to validate
 * @returns {boolean} True if the string is a valid IPv6 address
 */
function isValidIpv6(ip) {
  if (ip === null || ip === undefined || typeof ip !== 'string' || ip === '') {
    return false;
  }
  return net.isIP(ip) === 6;
}

/**
 * Validate an IP address (IPv4 or IPv6)
 * @param {string} ip - String to validate
 * @returns {boolean} True if the string is a valid IPv4 or IPv6 address
 */
function isValidAddress(ip) {
  if (ip === null || ip === undefined || typeof ip !== 'string' || ip === '') {
    return false;
  }
  return net.isIP(ip) !== 0;
}

/**
 * Parse CIDR notation to an IP range object
 * @param {string} cidr - CIDR notation string (e.g., "192.168.1.0/24")
 * @returns {{ start: number, end: number, cidr: string }} IP range with start/end as unsigned ints
 * @throws {TypeError} If cidr is null, undefined, or not a string
 * @throws {Error} If CIDR format is invalid or prefix length is out of range
 */
function parseCidr(cidr) {
  if (cidr === null || cidr === undefined || typeof cidr !== 'string' || cidr === '') {
    throw new TypeError('CIDR must be a non-empty string');
  }
  
  if (!cidr.includes('/')) {
    throw new Error('Invalid CIDR format: missing "/" separator');
  }
  
  const [ip, bits] = cidr.split('/');
  const prefixLength = parseInt(bits);
  
  if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    throw new Error(`Invalid CIDR prefix length: must be 0-32, got "${bits}"`);
  }

  // Special case: prefixLength=0 means match-all (mask=0). JavaScript's bitwise
  // shift is mod-32, so (-1 << 32) === -1 (not 0), producing the wrong mask.
  const mask = prefixLength === 0 ? 0 : ((-1 << (32 - prefixLength)) >>> 0);
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
  if (ip === null || ip === undefined || typeof ip !== 'string' || ip === '') {
    return false;
  }
  
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);

  if (!match) return false;

  for (let i = 1; i <= 4; i++) {
    const octet = parseInt(match[i]);
    if (octet < 0 || octet > 255) return false;
  }

  return true;
}

module.exports = { ipToInt, parseCidr, isIpInRange, isValidIp, isValidIpv6, isValidAddress, ipv6ToBigInt, parseIpv6Cidr, isIpv6InRange };
