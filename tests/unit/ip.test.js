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
});
