# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Rate limiting middleware (`express-rate-limit`) – 100 req / 15 min per IP on all `/api` routes.
- Security headers via `helmet.js` including Content Security Policy (CSP).
- Response compression via `compression` middleware.
- Configurable CORS via `ALLOWED_ORIGINS` environment variable (default: allow all).
- Cache-Control headers for static assets served from `/public`.
- `utils/ip.js` module extracting `ipToInt`, `parseCidr`, `isIpInRange`, `isValidIp`.
- Dynamic population of cloud dropdowns in the frontend from `/api/clouds`.
- Unit tests for IP utilities (`tests/unit/ip.test.js`).
- Unit tests for Haversine distance calculation (`tests/unit/distance.test.js`).
- Integration tests for all API endpoints (`tests/integration/api.test.js`).
- Test coverage reporting via `c8`.
- ESLint configuration (`eslint.config.js`).
- GitHub Actions CI workflow (`.github/workflows/ci.yml`).
- Husky pre-commit hooks with `lint-staged`.
- `CONTRIBUTING.md` with development setup and guidelines.
- `openapi.yaml` – OpenAPI 3.0 specification for the REST API.
- `docker-compose.override.yml` example for local development.
- Resource limits (CPU/memory) in `docker-compose.yml`.
- Comment in `Dockerfile` recommending digest pinning for production.
- Optional HTTPS support via `SSL_KEY_PATH` and `SSL_CERT_PATH` environment variables (PR #3).
- HTTP fallback when HTTPS certificates are not configured (PR #3).
- `/api/zdx/userpath` endpoint for ZDX user path tracing (PR #4).
- ZDX API credentials support via `ZDX_CLIENT_ID` and `ZDX_CLIENT_SECRET` environment variables (PR #4).
- Input validation improvements for IP utility functions with proper error handling (PR #5).
- Edge-case tests for null/undefined/empty inputs in IP utilities (PR #5).
- Happy-path integration tests for `/api/lookup` and `/api/trace` endpoints (PR #5).
- Extracted `calculateDistance` to dedicated `utils/distance.js` module (PR #5).

### Changed
- Error responses in production no longer expose internal `error.message` details.
- Cloud dropdown options are now populated dynamically from the backend.
- CORS error handling now returns proper 403 response instead of 500 (PR #5).
- RFC 1918 private IP check now correctly identifies `172.16.0.0/12` range only (PR #5).

### Fixed
- SSRF vulnerability in `/api/zdx/userpath` endpoint by validating ZDX cloud parameter against allowlist (PR #4).
- Python script bugs in `zdx_geo_path.py` including proper error handling and geolocation lookups (PR #4).
- CIDR format validation in `parseCidr` now properly rejects invalid prefix lengths (PR #5).
- `fetchZscalerData` now validates cloud parameter against allowlist for defense-in-depth (PR #5).

### Removed
- Deprecated `git add` command from `lint-staged` configuration (PR #5).

## [1.3.0-beta] - 2024-01-01

### Added
- Bulk IP lookup / Trace Route feature.
- Export results as JSON, CSV, PNG.
- Map route visualisation with animated polylines.

## [1.2.0] - 2023-12-01

### Added
- Interactive Leaflet.js map with traffic flow visualisation.
- Distance calculation (Haversine formula).
- Client IP geolocation via ip-api.com.

## [1.1.0] - 2023-11-01

### Added
- Health check endpoint `/api/health`.
- Docker Compose support.
- Non-root Docker user.

## [1.0.0] - 2023-10-01

### Added
- Initial release with single IP lookup against all 8 Zscaler clouds.
