'use strict';

/**
 * Convert IPv4 address string to unsigned 32-bit integer for range comparison
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
 * Expand a possibly compressed IPv6 address to 8 hextets
 * @param {string} ip - IPv6 address (may contain ::)
 * @returns {string[]} Array of 8 hextet strings
 * @throws {Error} If the address cannot be expanded
 */
function expandIpv6(ip) {
  // Strip zone id if present (e.g. fe80::1%eth0)
  const bare = ip.split('%')[0];
  const sides = bare.split('::');
  if (sides.length > 2) {
    throw new Error(`Invalid IPv6 address: multiple "::" in "${ip}"`);
  }

  let head = sides[0] ? sides[0].split(':') : [];
  let tail = sides.length === 2 && sides[1] ? sides[1].split(':') : [];

  // Handle IPv4-mapped / IPv4-compatible tail (e.g. ::ffff:192.0.2.1)
  const convertIpv4Hextet = (parts) => {
    const out = [];
    for (const p of parts) {
      if (p.includes('.')) {
        const octets = p.split('.');
        if (octets.length !== 4) {
          throw new Error(`Invalid IPv4-mapped segment in IPv6 address: "${p}"`);
        }
        const nums = octets.map((o) => {
          const n = parseInt(o, 10);
          if (isNaN(n) || n < 0 || n > 255) {
            throw new Error(`Invalid IPv4 octet in IPv6 address: "${p}"`);
          }
          return n;
        });
        out.push(((nums[0] << 8) | nums[1]).toString(16));
        out.push(((nums[2] << 8) | nums[3]).toString(16));
      } else {
        out.push(p);
      }
    }
    return out;
  };

  head = convertIpv4Hextet(head);
  tail = convertIpv4Hextet(tail);

  if (sides.length === 1) {
    if (head.length !== 8) {
      throw new Error(`Invalid IPv6 address: expected 8 hextets, got ${head.length}`);
    }
    return head.map((h) => h.toLowerCase());
  }

  const missing = 8 - head.length - tail.length;
  if (missing < 0) {
    throw new Error(`Invalid IPv6 address: too many hextets in "${ip}"`);
  }
  const zeros = Array(missing).fill('0');
  return [...head, ...zeros, ...tail].map((h) => h.toLowerCase());
}

/**
 * Convert IPv6 address string to a BigInt (128-bit)
 * @param {string} ip - IPv6 address string
 * @returns {bigint} 128-bit integer representation
 * @throws {TypeError|Error} On invalid input
 */
function ipv6ToBigInt(ip) {
  if (ip === null || ip === undefined || typeof ip !== 'string' || ip === '') {
    throw new TypeError('IP address must be a non-empty string');
  }
  const hextets = expandIpv6(ip);
  let value = 0n;
  for (const h of hextets) {
    if (!/^[0-9a-f]{1,4}$/i.test(h)) {
      throw new Error(`Invalid IPv6 hextet: "${h}"`);
    }
    value = (value << 16n) + BigInt(parseInt(h, 16));
  }
  return value;
}

/**
 * Parse CIDR notation (IPv4 or IPv6) to a range object
 * @param {string} cidr - CIDR notation string (e.g., "192.168.1.0/24" or "2001:db8::/32")
 * @returns {{ family: 'ipv4'|'ipv6', start: number|bigint, end: number|bigint, cidr: string }}
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

  const slashIdx = cidr.lastIndexOf('/');
  const addr = cidr.slice(0, slashIdx);
  const bits = cidr.slice(slashIdx + 1);
  const prefixLength = parseInt(bits, 10);

  const isIpv6 = addr.includes(':');

  if (isIpv6) {
    if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 128) {
      throw new Error(`Invalid IPv6 CIDR prefix length: must be 0-128, got "${bits}"`);
    }
    const ipInt = ipv6ToBigInt(addr);
    const hostBits = 128n - BigInt(prefixLength);
    // Mask off host bits
    const mask = prefixLength === 0
      ? 0n
      : ((1n << 128n) - 1n) ^ ((1n << hostBits) - 1n);
    const start = ipInt & mask;
    const end = start | ((1n << hostBits) - 1n);
    return { family: 'ipv6', start, end, cidr };
  }

  // IPv4
  if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    throw new Error(`Invalid CIDR prefix length: must be 0-32, got "${bits}"`);
  }

  // Special case: prefixLength=0 means match-all (mask=0). JavaScript's bitwise
  // shift is mod-32, so (-1 << 32) === -1 (not 0), producing the wrong mask.
  const mask = prefixLength === 0 ? 0 : ((-1 << (32 - prefixLength)) >>> 0);
  const ipInt = ipToInt(addr);
  const start = (ipInt & mask) >>> 0;
  const hostMask = ~mask >>> 0;
  const end = (start | hostMask) >>> 0;

  return { family: 'ipv4', start, end, cidr };
}

/**
 * Check whether an IP address falls within a parsed CIDR range
 * @param {string} ip - IPv4 or IPv6 address string
 * @param {{ family: string, start: number|bigint, end: number|bigint }} range - Parsed range from parseCidr()
 * @returns {boolean} True if the IP is within the range
 */
function isIpInRange(ip, range) {
  if (range.family === 'ipv6') {
    if (!isValidIpv6(ip)) return false;
    const ipInt = ipv6ToBigInt(ip);
    return ipInt >= range.start && ipInt <= range.end;
  }
  if (!isValidIpv4(ip)) return false;
  const ipInt = ipToInt(ip);
  return ipInt >= range.start && ipInt <= range.end;
}

/**
 * Validate an IPv4 address string
 * @param {string} ip - String to validate
 * @returns {boolean} True if the string is a valid IPv4 address
 */
function isValidIpv4(ip) {
  if (ip === null || ip === undefined || typeof ip !== 'string' || ip === '') {
    return false;
  }

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);

  if (!match) return false;

  for (let i = 1; i <= 4; i++) {
    const octet = parseInt(match[i], 10);
    if (octet < 0 || octet > 255) return false;
  }

  return true;
}

/**
 * Validate an IPv6 address string (including compressed and IPv4-mapped forms)
 * @param {string} ip - String to validate
 * @returns {boolean} True if the string is a valid IPv6 address
 */
function isValidIpv6(ip) {
  if (ip === null || ip === undefined || typeof ip !== 'string' || ip === '') {
    return false;
  }

  try {
    expandIpv6(ip);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate an IP address string (IPv4 or IPv6)
 * @param {string} ip - String to validate
 * @returns {boolean} True if the string is a valid IPv4 or IPv6 address
 */
function isValidIp(ip) {
  return isValidIpv4(ip) || isValidIpv6(ip);
}

/**
 * Return the address family of a validated IP, or null if invalid
 * @param {string} ip
 * @returns {'ipv4'|'ipv6'|null}
 */
function getIpFamily(ip) {
  if (isValidIpv4(ip)) return 'ipv4';
  if (isValidIpv6(ip)) return 'ipv6';
  return null;
}

module.exports = {
  ipToInt,
  ipv6ToBigInt,
  expandIpv6,
  parseCidr,
  isIpInRange,
  isValidIp,
  isValidIpv4,
  isValidIpv6,
  getIpFamily
};
