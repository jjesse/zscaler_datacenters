# TODO - Zscaler Datacenter Lookup Tool

**Current version:** 1.4.1  
**Last reviewed:** 2026-09-01

The core app (lookup, map, trace route, Docker, CI, security hardening, IPv6) is complete. Use the **Open backlog** below for what to work on next.

---

## Open backlog

### Medium priority

**Infrastructure / reliability**
- [ ] Add HTTP → HTTPS redirect when HTTPS certificates are configured, so clients that connect on the HTTP port are automatically redirected

**Code quality**
- [ ] Add ESLint coverage for `public/app.js` (currently excluded via `--ignore-pattern public/`) – or add a separate browser-targeted ESLint config so frontend JS quality is enforced in CI

**Testing**
- [ ] Add unit tests for the Python scripts (`zdx_geo_path.py`, `zdx_oneapi_geopath.py`) covering the `get_country()` helper and argument parsing (use `pytest` + `unittest.mock`)
- [ ] Add a CI step for the Python scripts: install dependencies from `requirements.txt` and run `pytest`
- [ ] Add frontend unit/E2E tests for `public/app.js` (e.g., with Playwright or Puppeteer) – the frontend has zero automated test coverage today

**Features**
- [ ] Add a per-cloud cache-refresh endpoint (e.g., `POST /api/cache/flush`) protected by a configurable admin token, so operators can force a data refresh without restarting the container
- [ ] Add shareable/bookmarkable URLs – push lookup parameters into the browser's query string (`history.pushState`) so results pages can be bookmarked or shared as links

### Low priority

- [ ] Add a CI step to upload test coverage reports to a coverage service (e.g., Codecov or Coveralls) so coverage trends are visible on PRs

### Future / optional

- [ ] Add reverse lookup (show all datacenters for a cloud)
- [ ] Add latency testing to datacenters
- [ ] Add datacenter status/availability monitoring
- [ ] Add history of recent lookups (local storage)
- [ ] Add metrics/analytics
- [ ] Add dark mode toggle (partial work exists on `origin/feature/darkmode`)
- [ ] Add multi-language support
- [ ] Add keyboard shortcuts

**Suggested next implementation order:** shareable URLs → admin cache flush → HTTP→HTTPS redirect → ESLint for `public/app.js` → Python tests + CI → resume dark mode branch.

---

## Completed work

### Phase 1–4 (initial product)
- [x] Project structure, Express API, CENR fetch/parse, IP lookup, caching
- [x] Client IP detection, geolocation (ip-api.com), Haversine distance
- [x] Responsive UI, cloud selector, map (Leaflet), traffic flow, trace route, export
- [x] Docker / Compose, health check, README and feature docs

### Enhancements and hardening
- [x] Programmatic API, bulk trace, copy/JSON/CSV/PNG export
- [x] Rate limiting, Helmet CSP, CORS allowlist, sanitized errors
- [x] RFC 1918 / private-IP fixes, CORS callback fix, IP util validation, CIDR validation
- [x] Extract `utils/distance.js`, cloud allowlist in `fetchZscalerData`, lint-staged cleanup
- [x] Unit + integration tests, coverage (c8), GitHub Actions CI, husky + lint-staged
- [x] CONTRIBUTING.md, CHANGELOG.md, OpenAPI spec
- [x] Compression, Cache-Control for static assets
- [x] Non-root Docker user, resource limits, `.env.example`, `.nvmrc`
- [x] Optional HTTPS (`SSL_KEY_PATH` / `SSL_CERT_PATH`), ZDX `/api/zdx/userpath`, Python helpers
- [x] SRI on CDN assets, stricter ZDX rate limit, Permissions-Policy header
- [x] Node.js 20 alignment (Dockerfile, CI, engines), localhost Docker bind, graceful shutdown
- [x] Cache stampede protection, input length guards, health `version` field
- [x] IPv6 support end-to-end; OpenAPI nested `datacenter` schema; `requirements.txt`; README_PYTHON OneAPI docs
- [x] Docs: ALLOWED_ORIGINS, TRUST_PROXY, ZDX userpath in OpenAPI/README; ZDX_Geo_Tracker typos fixed
