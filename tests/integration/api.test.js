'use strict';

const request = require('supertest');
const app = require('../../server');

describe('GET /api/health', () => {
  it('returns 200 with healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(typeof res.body.timestamp).toBe('string');
    expect(typeof res.body.cacheSize).toBe('number');
  });
});

describe('GET /api/clouds', () => {
  it('returns list of supported clouds', async () => {
    const res = await request(app).get('/api/clouds');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.clouds)).toBe(true);
    expect(res.body.clouds).toContain('zscaler.net');
    expect(res.body.clouds.length).toBe(8);
  });
});

describe('GET /api/lookup', () => {
  it('returns 400 when cloud is missing', async () => {
    const res = await request(app).get('/api/lookup?ip=1.2.3.4');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Missing required parameters/);
  });

  it('returns 400 when ip is missing', async () => {
    const res = await request(app).get('/api/lookup?cloud=zscaler.net');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid cloud', async () => {
    const res = await request(app).get('/api/lookup?cloud=invalid.net&ip=1.2.3.4');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid cloud/);
  });

  it('returns 400 for invalid IP address', async () => {
    const res = await request(app).get('/api/lookup?cloud=zscaler.net&ip=999.999.999.999');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid IP address format/);
  });

  it('returns 400 for invalid source IP address', async () => {
    const res = await request(app).get('/api/lookup?cloud=zscaler.net&ip=1.2.3.4&sourceIp=not-an-ip');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid source IP/);
  });
});

describe('POST /api/trace', () => {
  it('returns 400 when cloud is missing', async () => {
    const res = await request(app)
      .post('/api/trace')
      .send({ ips: ['1.2.3.4'] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when ips is not an array', async () => {
    const res = await request(app)
      .post('/api/trace')
      .send({ cloud: 'zscaler.net', ips: '1.2.3.4' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when ips is empty', async () => {
    const res = await request(app)
      .post('/api/trace')
      .send({ cloud: 'zscaler.net', ips: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/At least one IP/);
  });

  it('returns 400 when too many IPs provided', async () => {
    const ips = Array.from({ length: 51 }, (_, i) => `1.2.3.${i % 255}`);
    const res = await request(app)
      .post('/api/trace')
      .send({ cloud: 'zscaler.net', ips });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Too many IP addresses/);
  });

  it('returns 400 for invalid cloud', async () => {
    const res = await request(app)
      .post('/api/trace')
      .send({ cloud: 'invalid.net', ips: ['1.2.3.4'] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid cloud/);
  });

  it('returns 400 when an IP in the list is invalid', async () => {
    const res = await request(app)
      .post('/api/trace')
      .send({ cloud: 'zscaler.net', ips: ['1.2.3.4', 'bad-ip'] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid IP address/);
  });
});
