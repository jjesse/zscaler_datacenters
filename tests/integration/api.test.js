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

  it('returns 200 with datacenter info for a valid IP lookup', async () => {
    // Use a common public IP that should be in one of the Zscaler ranges
    const res = await request(app).get('/api/lookup?cloud=zscaler.net&ip=165.225.0.1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    if (res.body.datacenter) {
      expect(typeof res.body.datacenter.name).toBe('string');
      expect(typeof res.body.datacenter.city).toBe('string');
      expect(typeof res.body.datacenter.country).toBe('string');
      expect(typeof res.body.datacenter.latitude).toBe('number');
      expect(typeof res.body.datacenter.longitude).toBe('number');
      expect(Array.isArray(res.body.datacenter.ipRanges)).toBe(true);
      expect(typeof res.body.matchedRange).toBe('string');
    }
  }, 15000); // Increase timeout for API call

  it('returns 200 but no match for an IP not in Zscaler ranges', async () => {
    // Use a public IP that's unlikely to be in Zscaler ranges (e.g., Google DNS)
    const res = await request(app).get('/api/lookup?cloud=zscaler.net&ip=8.8.8.8');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.datacenter).toBeNull();
    expect(res.body.matchedRange).toBeNull();
  }, 15000);
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

  it('returns 200 with trace results for valid IPs', async () => {
    const res = await request(app)
      .post('/api/trace')
      .send({ 
        cloud: 'zscaler.net', 
        ips: ['165.225.0.1', '8.8.8.8', '1.1.1.1'] 
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBe(3);
    
    // Check structure of each result
    res.body.results.forEach(result => {
      expect(typeof result.ip).toBe('string');
      expect(typeof result.hop).toBe('number');
      // datacenter can be null or an object
      if (result.datacenter) {
        expect(typeof result.datacenter.name).toBe('string');
        expect(typeof result.datacenter.city).toBe('string');
        expect(typeof result.datacenter.country).toBe('string');
      }
    });
  }, 15000); // Increase timeout for API call

  it('returns 200 with empty matches for IPs not in Zscaler ranges', async () => {
    const res = await request(app)
      .post('/api/trace')
      .send({ 
        cloud: 'zscaler.net', 
        ips: ['8.8.8.8', '1.1.1.1'] 
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBe(2);
    
    // These IPs should not match Zscaler ranges
    res.body.results.forEach(result => {
      expect(result.datacenter).toBeNull();
      expect(result.matchedRange).toBeNull();
    });
  }, 15000);
});

describe('POST /api/zdx/userpath', () => {
  it('returns 400 when required parameters are missing', async () => {
    const res = await request(app)
      .post('/api/zdx/userpath')
      .send({ userEmail: 'user@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Missing required parameters/);
  });

  it('returns 400 for an invalid ZDX cloud', async () => {
    const res = await request(app)
      .post('/api/zdx/userpath')
      .send({ cloud: 'notacloud', userEmail: 'user@example.com', appName: 'MyApp' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid ZDX cloud/);
  });

  it('returns 500 when ZDX credentials are not configured', async () => {
    const origClientId = process.env.ZDX_CLIENT_ID;
    const origClientSecret = process.env.ZDX_CLIENT_SECRET;
    delete process.env.ZDX_CLIENT_ID;
    delete process.env.ZDX_CLIENT_SECRET;

    let res;
    try {
      res = await request(app)
        .post('/api/zdx/userpath')
        .send({ cloud: 'zdxcloud', userEmail: 'user@example.com', appName: 'MyApp' });
    } finally {
      if (origClientId !== undefined) process.env.ZDX_CLIENT_ID = origClientId;
      if (origClientSecret !== undefined) process.env.ZDX_CLIENT_SECRET = origClientSecret;
    }

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.needsConfig).toBe(true);
  });
});
