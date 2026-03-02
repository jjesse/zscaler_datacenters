'use strict';

const { ipToInt, parseCidr, isIpInRange, isValidIp } = require('../../utils/ip');

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
