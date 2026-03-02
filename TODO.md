# TODO - Zscaler Datacenter Lookup Tool

## Phase 1: Initial Setup ✅
- [x] Project structure and documentation
- [x] Basic requirements defined

## Phase 2: Core Development ✅
- [x] Backend API Development
  - [x] Create Express server
  - [x] Implement API endpoint to fetch Zscaler CENR data
  - [x] Parse JSON data from Zscaler config API
  - [x] Implement IP address lookup logic (check if IP is in range)
  - [x] Add caching mechanism for Zscaler data
  - [x] Add client IP detection from request headers
  - [x] Implement IP geolocation using ip-api.com
  - [x] Add distance calculation (Haversine formula)

- [x] Frontend Development
  - [x] Design responsive UI
  - [x] Create cloud selector dropdown (all 8 Zscaler clouds)
  - [x] Create IP address input field with validation
  - [x] Add optional source IP input field
  - [x] Display results (datacenter name, location, IP range)
  - [x] Add error handling and user feedback
  - [x] Add loading states
  - [x] Implement interactive map with Leaflet.js
  - [x] Add dual markers (client and datacenter)
  - [x] Show traffic flow line with animation
  - [x] Display distance on map and in results
  - [x] Show client location information

## Phase 3: Docker & Deployment ✅
- [x] Create Dockerfile
- [x] Create docker-compose.yml
- [x] Add environment configuration
- [x] Test Docker build and deployment
- [x] Add health check endpoint

## Phase 4: Testing & Documentation ✅
- [x] Test with various IP addresses
- [x] Test each Zscaler cloud
- [x] Complete README.md with setup instructions
- [x] Update documentation with new features

## Completed Enhancements ✅
- [x] Add API endpoint for programmatic access
- [x] Add health check endpoint
- [x] Add interactive map visualization
- [x] Add traffic flow visualization
- [x] Add distance calculation
- [x] Add geolocation support
- [x] Add client IP tracking
- [x] Add bulk IP lookup feature (Trace Route)
- [x] Add export results functionality (Copy/JSON/CSV/PNG)

## Completed Improvements ✅
- [x] Limit maximum number of IPs in trace route to prevent DoS (server.js)
- [x] Validate x-forwarded-for IP address before trusting it (server.js)
- [x] Run Docker container as non-root user (Dockerfile)
- [x] Add `.env.example` file documenting all environment variables

## Open Code Review Feedback (from PR #2 review — unresolved)

These items were flagged during automated code review but have not yet been addressed:

### Bug Fixes
- [ ] Fix RFC 1918 `172.x.x.x` private-IP check in `getIpGeolocation` (`server.js` line 248) — currently matches any `172.*` address but the private range is `172.16.0.0/12` (second octet 16–31 only); public IPs like `172.1.0.1` are incorrectly treated as private
- [ ] Fix CORS origin callback to call `callback(null, false)` instead of `throw new Error(…)` (`server.js` line 28) — throwing causes a 500 response rather than the expected CORS rejection

### Code Quality
- [ ] Add input validation to IP utility functions in `utils/ip.js` (null, undefined, or empty-string inputs currently produce uncaught errors)
- [ ] Validate CIDR format inside `parseCidr` (`utils/ip.js` line 32) — missing `/` separator or prefix length outside `0–32` produces incorrect results silently
- [ ] Extract `calculateDistance` from `server.js` to a dedicated `utils/distance.js` module and import it in both `server.js` and `tests/unit/distance.test.js`; currently the test duplicates the implementation, so regressions in `server.js` won't be caught
- [ ] Add cloud allowlist check inside `fetchZscalerData` as a defence-in-depth guard (`server.js` line 114) — today the function trusts callers to pre-validate `cloud`
- [ ] Remove deprecated `git add` line from `lint-staged` config in `package.json` (lint-staged v10+ stages changes automatically)

### Test Coverage
- [ ] Add null / undefined / empty-string edge-case tests to `tests/unit/ip.test.js` (currently only valid and obviously-invalid inputs are tested)
- [ ] Add happy-path integration tests for `/api/lookup` and `/api/trace` (`tests/integration/api.test.js`) — current suite only exercises error paths; successful responses with expected data shapes are untested

## Documentation Gaps
- [ ] Add `/api/zdx/userpath` endpoint to `openapi.yaml` (endpoint exists in `server.js` but is absent from the spec)
- [ ] Add `/api/zdx/userpath` usage to `README.md` API Endpoints section
- [ ] Document `ALLOWED_ORIGINS` environment variable in the `README.md` Configuration section (it is in `.env.example` but not in the README)
- [ ] Add `CHANGELOG.md` entries for PR #3 (optional HTTPS / HTTP fallback, `SSL_KEY_PATH`/`SSL_CERT_PATH` env vars) and PR #4 (SSRF fix for `/api/zdx/userpath`, ZDX credentials in `.env.example`, Python bug fixes in `zdx_geo_path.py`)
- [ ] Fix typos in `ZDX_Geo_Tracker.md` (e.g. "Environment", "scrip", "perofrm", "login" → "logic")

## Future Enhancements (Optional)
- [ ] Add reverse lookup (show all datacenters for a cloud)
- [ ] Add history of recent lookups (local storage)
- [ ] Add dark mode toggle
- [ ] Add metrics/analytics
- [ ] Add latency testing to datacenters
- [ ] Add datacenter status/availability monitoring
- [ ] Add multi-language support
- [ ] Add keyboard shortcuts
- [ ] Add sharing results via URL

## Security Improvements
- [x] Add rate limiting middleware (express-rate-limit) to all API endpoints
- [x] Add security headers using helmet.js
- [x] Add Content Security Policy (CSP) headers
- [x] Restrict CORS to known origins instead of allowing all origins
- [x] Sanitize internal error details from API error responses

## Code Quality Improvements
- [x] Add ESLint configuration for consistent code style
- [x] Extract IP utility functions (ipToInt, parseCidr, isValidIp) to a separate `utils/ip.js` module
- [x] Remove duplicate cloud list between frontend (index.html) and backend (server.js); populate the dropdown dynamically from `/api/clouds`
- [x] Add JSDoc type annotations to all functions
- [x] Use `const` consistently and avoid implicit globals

## Testing
- [x] Add unit tests for IP validation (`isValidIp`)
- [x] Add unit tests for CIDR parsing (`parseCidr`) and range checking (`isIpInRange`)
- [x] Add unit tests for the Haversine distance calculation (`calculateDistance`)
- [x] Add integration tests for all API endpoints (`/api/lookup`, `/api/trace`, `/api/clouds`, `/api/health`)
- [x] Add test coverage reporting (e.g., nyc/c8)
- [x] Set up automated test runs in CI (GitHub Actions)

## Developer Experience
- [x] Add GitHub Actions CI workflow to lint and test on pull requests
- [x] Add pre-commit hooks with husky + lint-staged
- [x] Add CONTRIBUTING.md with development setup and contribution guidelines
- [x] Add CHANGELOG.md to track version history
- [x] Add OpenAPI/Swagger specification for the REST API

## Performance
- [x] Add response compression middleware (`compression` npm package)
- [x] Add `Cache-Control` headers for static assets served from `/public`
- [x] Consider bundling/minifying frontend JS and CSS for production (decided not to bundle for this simple app)

## Infrastructure
- [x] Pin base Docker image to a specific digest instead of a floating tag (e.g., `node:18-alpine@sha256:...`) – comment added to Dockerfile; tag kept as `node:18-alpine` since registry is not accessible from this environment
- [x] Add resource limits (CPU/memory) to `docker-compose.yml`
- [x] Add a `docker-compose.override.yml` example for local development overrides
