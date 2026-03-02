'use strict';

const { calculateDistance } = require('../../utils/distance');

describe('calculateDistance (Haversine)', () => {
  test('returns 0 for identical coordinates', () => {
    expect(calculateDistance(51.5, -0.1, 51.5, -0.1)).toBe(0);
  });

  test('calculates London to Paris (~340 km)', () => {
    const dist = calculateDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(350);
  });

  test('calculates New York to Los Angeles (~3940 km)', () => {
    const dist = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  test('returns a number rounded to 1 decimal place', () => {
    const dist = calculateDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBe(Math.round(dist * 10) / 10);
  });

  test('is symmetric - same distance in either direction', () => {
    const d1 = calculateDistance(51.5, -0.1, 48.8, 2.3);
    const d2 = calculateDistance(48.8, 2.3, 51.5, -0.1);
    expect(d1).toBe(d2);
  });
});
