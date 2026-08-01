'use strict';

const { ipToInt, ipv6ToBigInt, parseCidr, isIpInRange, isValidIp, isValidIpv4, isValidIpv6, getIpFamily } = require('../../utils/ip');

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

  test('returns true for valid IPv6 addresses', () => {
    expect(isValidIp('::1')).toBe(true);
    expect(isValidIp('2001:db8::1')).toBe(true);
    expect(isValidIp('2605:4300:e800::1')).toBe(true);
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

describe('ipv6ToBigInt', () => {
  test('converts ::1 to 1n', () => {
    expect(ipv6ToBigInt('::1')).toBe(1n);
  });

  test('converts :: to 0n', () => {
    expect(ipv6ToBigInt('::')).toBe(0n);
  });

  test('converts 2001:db8:: correctly', () => {
    const result = ipv6ToBigInt('2001:db8::');
    expect(result).toBe(BigInt('0x20010db8000000000000000000000000'));
  });

  test('throws TypeError for null input', () => {
    expect(() => ipv6ToBigInt(null)).toThrow(TypeError);
  });

  test('throws TypeError for empty string', () => {
    expect(() => ipv6ToBigInt('')).toThrow(TypeError);
  });
});

describe('isValidIpv4', () => {
  test('returns true for valid IPv4 addresses', () => {
    expect(isValidIpv4('192.168.1.1')).toBe(true);
    expect(isValidIpv4('0.0.0.0')).toBe(true);
    expect(isValidIpv4('255.255.255.255')).toBe(true);
  });

  test('returns false for IPv6 addresses', () => {
    expect(isValidIpv4('::1')).toBe(false);
    expect(isValidIpv4('2001:db8::1')).toBe(false);
  });

  test('returns false for invalid addresses', () => {
    expect(isValidIpv4('256.0.0.0')).toBe(false);
    expect(isValidIpv4('not-an-ip')).toBe(false);
    expect(isValidIpv4('')).toBe(false);
    expect(isValidIpv4(null)).toBe(false);
  });
});

describe('isValidIpv6', () => {
  test('returns true for valid IPv6 addresses', () => {
    expect(isValidIpv6('::1')).toBe(true);
    expect(isValidIpv6('::')).toBe(true);
    expect(isValidIpv6('2001:db8::1')).toBe(true);
    expect(isValidIpv6('2605:4300:e800::')).toBe(true);
    expect(isValidIpv6('fe80::1')).toBe(true);
  });

  test('returns false for IPv4 addresses', () => {
    expect(isValidIpv6('192.168.1.1')).toBe(false);
    expect(isValidIpv6('0.0.0.0')).toBe(false);
  });

  test('returns false for invalid addresses', () => {
    expect(isValidIpv6('')).toBe(false);
    expect(isValidIpv6(null)).toBe(false);
    expect(isValidIpv6('not-valid')).toBe(false);
    // multiple :: is invalid
    expect(isValidIpv6('::1::2')).toBe(false);
  });
});

describe('getIpFamily', () => {
  test('returns ipv4 for IPv4 addresses', () => {
    expect(getIpFamily('192.168.1.1')).toBe('ipv4');
    expect(getIpFamily('10.0.0.1')).toBe('ipv4');
  });

  test('returns ipv6 for IPv6 addresses', () => {
    expect(getIpFamily('::1')).toBe('ipv6');
    expect(getIpFamily('2001:db8::1')).toBe('ipv6');
  });

  test('returns null for invalid addresses', () => {
    expect(getIpFamily('not-an-ip')).toBe(null);
    expect(getIpFamily('')).toBe(null);
    expect(getIpFamily(null)).toBe(null);
  });
});

describe('parseCidr IPv6', () => {
  test('parses 2001:db8::/32', () => {
    const result = parseCidr('2001:db8::/32');
    expect(result.family).toBe('ipv6');
    expect(result.start).toBe(ipv6ToBigInt('2001:db8::'));
    expect(result.end).toBe(ipv6ToBigInt('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff'));
  });

  test('parses 2605:4300:e800::/40', () => {
    const result = parseCidr('2605:4300:e800::/40');
    expect(result.family).toBe('ipv6');
    expect(result.start).toBe(ipv6ToBigInt('2605:4300:e800::'));
  });

  test('throws Error for invalid IPv6 prefix length', () => {
    expect(() => parseCidr('2001:db8::/129')).toThrow('Invalid IPv6 CIDR prefix length');
  });
});

describe('isIpInRange IPv6', () => {
  const range = parseCidr('2001:db8::/32');

  test('returns true for IP within range', () => {
    expect(isIpInRange('2001:db8::1', range)).toBe(true);
    expect(isIpInRange('2001:db8:1::1', range)).toBe(true);
  });

  test('returns true for first IP in range', () => {
    expect(isIpInRange('2001:db8::', range)).toBe(true);
  });

  test('returns false for IP outside range', () => {
    expect(isIpInRange('2001:db9::1', range)).toBe(false);
    expect(isIpInRange('::1', range)).toBe(false);
  });

  test('returns false for IPv4 address against IPv6 range', () => {
    expect(isIpInRange('192.168.1.1', range)).toBe(false);
  });
});
