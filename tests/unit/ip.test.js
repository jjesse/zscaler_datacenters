'use strict';

const { ipToInt, parseCidr, isIpInRange, isValidIp, isValidIpv6, isValidAddress, ipv6ToBigInt, parseIpv6Cidr, isIpv6InRange } = require('../../utils/ip');

describe('ipToInt', () => {
  test('converts 0.0.0.0 to 0', () => {
    expect(ipToInt('0.0.0.0')).toBe(0);
  });

  test('converts 255.255.255.255 to 4294967295', () => {
    expect(ipToInt('255.255.255.255')).toBe(4294967295);
  });

  test('converts 192.168.1.1 correctly', () => {
    expect(ipToInt('192.168.1.1')).toBe((192 << 24 | 168 << 16 | 1 << 8 | 1) >>> 0);
  });

  test('converts 10.0.0.1 correctly', () => {
    expect(ipToInt('10.0.0.1')).toBe((10 << 24 | 0 << 16 | 0 << 8 | 1) >>> 0);
  });

  test('throws TypeError for null input', () => {
    expect(() => ipToInt(null)).toThrow(TypeError);
    expect(() => ipToInt(null)).toThrow('IP address must be a non-empty string');
  });

  test('throws TypeError for undefined input', () => {
    expect(() => ipToInt(undefined)).toThrow(TypeError);
    expect(() => ipToInt(undefined)).toThrow('IP address must be a non-empty string');
  });

  test('throws TypeError for empty string', () => {
    expect(() => ipToInt('')).toThrow(TypeError);
    expect(() => ipToInt('')).toThrow('IP address must be a non-empty string');
  });

  test('throws TypeError for non-string input', () => {
    expect(() => ipToInt(12345)).toThrow(TypeError);
    expect(() => ipToInt({})).toThrow(TypeError);
    expect(() => ipToInt([])).toThrow(TypeError);
  });
});

describe('parseCidr', () => {
  test('parses /24 network', () => {
    const result = parseCidr('192.168.1.0/24');
    expect(result.start).toBe(ipToInt('192.168.1.0'));
    expect(result.end).toBe(ipToInt('192.168.1.255'));
    expect(result.cidr).toBe('192.168.1.0/24');
  });

  test('parses /32 host route', () => {
    const result = parseCidr('10.0.0.1/32');
    expect(result.start).toBe(ipToInt('10.0.0.1'));
    expect(result.end).toBe(ipToInt('10.0.0.1'));
  });

  test('parses /8 network', () => {
    const result = parseCidr('10.0.0.0/8');
    expect(result.start).toBe(ipToInt('10.0.0.0'));
    expect(result.end).toBe(ipToInt('10.255.255.255'));
  });

  test('parses /16 network', () => {
    const result = parseCidr('172.16.0.0/16');
    expect(result.start).toBe(ipToInt('172.16.0.0'));
    expect(result.end).toBe(ipToInt('172.16.255.255'));
  });

  test('throws TypeError for null input', () => {
    expect(() => parseCidr(null)).toThrow(TypeError);
    expect(() => parseCidr(null)).toThrow('CIDR must be a non-empty string');
  });

  test('throws TypeError for undefined input', () => {
    expect(() => parseCidr(undefined)).toThrow(TypeError);
    expect(() => parseCidr(undefined)).toThrow('CIDR must be a non-empty string');
  });

  test('throws TypeError for empty string', () => {
    expect(() => parseCidr('')).toThrow(TypeError);
    expect(() => parseCidr('')).toThrow('CIDR must be a non-empty string');
  });

  test('throws Error for missing "/" separator', () => {
    expect(() => parseCidr('192.168.1.0')).toThrow('Invalid CIDR format: missing "/" separator');
  });

  test('throws Error for invalid prefix length (negative)', () => {
    expect(() => parseCidr('192.168.1.0/-1')).toThrow('Invalid CIDR prefix length: must be 0-32');
  });

  test('throws Error for invalid prefix length (> 32)', () => {
    expect(() => parseCidr('192.168.1.0/33')).toThrow('Invalid CIDR prefix length: must be 0-32');
    expect(() => parseCidr('192.168.1.0/64')).toThrow('Invalid CIDR prefix length: must be 0-32');
  });

  test('throws Error for non-numeric prefix length', () => {
    expect(() => parseCidr('192.168.1.0/abc')).toThrow('Invalid CIDR prefix length');
  });

  test('parses edge case /0 network', () => {
    const result = parseCidr('0.0.0.0/0');
    expect(result.start).toBe(0);
    expect(result.end).toBe(4294967295);
  });
});

describe('isIpInRange', () => {
  const range = parseCidr('192.168.1.0/24');

  test('returns true for IP within range', () => {
    expect(isIpInRange('192.168.1.50', range)).toBe(true);
  });

  test('returns true for first IP in range', () => {
    expect(isIpInRange('192.168.1.0', range)).toBe(true);
  });

  test('returns true for last IP in range', () => {
    expect(isIpInRange('192.168.1.255', range)).toBe(true);
  });

  test('returns false for IP outside range', () => {
    expect(isIpInRange('192.168.2.1', range)).toBe(false);
  });

  test('returns false for completely different subnet', () => {
    expect(isIpInRange('10.0.0.1', range)).toBe(false);
  });
});

describe('isValidIp', () => {
  test('returns true for valid IPs', () => {
    expect(isValidIp('192.168.1.1')).toBe(true);
    expect(isValidIp('0.0.0.0')).toBe(true);
    expect(isValidIp('255.255.255.255')).toBe(true);
    expect(isValidIp('10.0.0.1')).toBe(true);
  });

  test('returns false for octets out of range', () => {
    expect(isValidIp('256.0.0.0')).toBe(false);
    expect(isValidIp('192.168.1.999')).toBe(false);
  });

  test('returns false for non-IP strings', () => {
    expect(isValidIp('not-an-ip')).toBe(false);
    expect(isValidIp('')).toBe(false);
    expect(isValidIp('192.168.1')).toBe(false);
    expect(isValidIp('192.168.1.1.1')).toBe(false);
  });

  test('returns false for IPv6', () => {
    expect(isValidIp('::1')).toBe(false);
    expect(isValidIp('2001:db8::1')).toBe(false);
  });

  test('returns false for null input', () => {
    expect(isValidIp(null)).toBe(false);
  });

  test('returns false for undefined input', () => {
    expect(isValidIp(undefined)).toBe(false);
  });

  test('returns false for non-string input', () => {
    expect(isValidIp(12345)).toBe(false);
    expect(isValidIp({})).toBe(false);
    expect(isValidIp([])).toBe(false);
  });
});

describe('isValidIpv6', () => {
  test('returns true for valid IPv6 addresses', () => {
    expect(isValidIpv6('::1')).toBe(true);
    expect(isValidIpv6('2001:db8::1')).toBe(true);
    expect(isValidIpv6('2a04:4e40::')).toBe(true);
    expect(isValidIpv6('fe80::1')).toBe(true);
    expect(isValidIpv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(true);
  });

  test('returns false for IPv4 addresses', () => {
    expect(isValidIpv6('192.168.1.1')).toBe(false);
    expect(isValidIpv6('0.0.0.0')).toBe(false);
  });

  test('returns false for invalid strings', () => {
    expect(isValidIpv6('not-an-ip')).toBe(false);
    expect(isValidIpv6('')).toBe(false);
    expect(isValidIpv6(':::1')).toBe(false);
  });

  test('returns false for null/undefined', () => {
    expect(isValidIpv6(null)).toBe(false);
    expect(isValidIpv6(undefined)).toBe(false);
  });
});

describe('isValidAddress', () => {
  test('returns true for valid IPv4 addresses', () => {
    expect(isValidAddress('192.168.1.1')).toBe(true);
    expect(isValidAddress('8.8.8.8')).toBe(true);
  });

  test('returns true for valid IPv6 addresses', () => {
    expect(isValidAddress('::1')).toBe(true);
    expect(isValidAddress('2001:db8::1')).toBe(true);
    expect(isValidAddress('2a04:4e40::')).toBe(true);
  });

  test('returns false for invalid strings', () => {
    expect(isValidAddress('not-an-ip')).toBe(false);
    expect(isValidAddress('')).toBe(false);
    expect(isValidAddress('999.999.999.999')).toBe(false);
  });

  test('returns false for null/undefined', () => {
    expect(isValidAddress(null)).toBe(false);
    expect(isValidAddress(undefined)).toBe(false);
  });
});

describe('ipv6ToBigInt', () => {
  test('converts loopback to 1n', () => {
    expect(ipv6ToBigInt('::1')).toBe(1n);
  });

  test('converts :: to 0n', () => {
    expect(ipv6ToBigInt('::')).toBe(0n);
  });

  test('converts full address correctly', () => {
    expect(ipv6ToBigInt('2001:db8::1')).toBe(BigInt('0x20010db8000000000000000000000001'));
  });
});

describe('parseIpv6Cidr', () => {
  test('parses /128 host route', () => {
    const result = parseIpv6Cidr('::1/128');
    expect(result.start).toBe(1n);
    expect(result.end).toBe(1n);
  });

  test('parses /0 match-all route', () => {
    const result = parseIpv6Cidr('::/0');
    expect(result.start).toBe(0n);
    expect(result.end).toBe((1n << 128n) - 1n);
  });

  test('parses /32 network', () => {
    const result = parseIpv6Cidr('2a04:4e40::/32');
    expect(result.start).toBe(ipv6ToBigInt('2a04:4e40::'));
    // /32 means the first 32 bits are fixed; last 96 bits are host bits
    const expectedEnd = ipv6ToBigInt('2a04:4e40:ffff:ffff:ffff:ffff:ffff:ffff');
    expect(result.end).toBe(expectedEnd);
  });

  test('throws for missing "/" separator', () => {
    expect(() => parseIpv6Cidr('::1')).toThrow('Invalid CIDR format: missing "/" separator');
  });

  test('throws for prefix length > 128', () => {
    expect(() => parseIpv6Cidr('::1/129')).toThrow('Invalid IPv6 CIDR prefix length: must be 0-128');
  });

  test('throws for null input', () => {
    expect(() => parseIpv6Cidr(null)).toThrow(TypeError);
  });
});

describe('isIpv6InRange', () => {
  test('returns true for IP within range', () => {
    const range = parseIpv6Cidr('2a04:4e40::/32');
    expect(isIpv6InRange('2a04:4e40::1', range)).toBe(true);
    expect(isIpv6InRange('2a04:4e40:0000:0000:0000:0000:0000:0001', range)).toBe(true);
  });

  test('returns false for IP outside range', () => {
    const range = parseIpv6Cidr('2a04:4e40::/32');
    expect(isIpv6InRange('2001:db8::1', range)).toBe(false);
  });

  test('returns true for loopback in /128 range', () => {
    const range = parseIpv6Cidr('::1/128');
    expect(isIpv6InRange('::1', range)).toBe(true);
    expect(isIpv6InRange('::2', range)).toBe(false);
  });
});
