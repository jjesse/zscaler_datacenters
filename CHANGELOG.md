# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Refreshed `README.md` and `TODO.md` for v1.4.1 accuracy (Node 20 prerequisites, health `version` example, project tree, localhost Docker bind note, open backlog at top of TODO).
- Expanded `CONTRIBUTING.md` project structure to include CI, OpenAPI, and Python ZDX scripts.

## [1.4.1] - 2026-08-01

### Added
- `/api/health` response now includes a `version` field (read from `package.json`) so operators can confirm which build is running.
- Cache stampede protection in `fetchZscalerData`: concurrent requests for the same un-cached cloud now share a single in-flight promise via `pendingFetches` map (promise coalescing).
- Input length guards on `/api/lookup` query parameters (`cloud`, `ip`, `sourceIp`) and `/api/trace` `cloud` field – requests exceeding 256 characters receive a `400` response.
- `.nvmrc` pinning Node.js version for local development consistency.
- `User-Agent` header on CENR requests now includes the app version (e.g. `Zscaler-Datacenter-Lookup/1.4.1`).
- `author` and `engines` fields set in `package.json`.
- `MAX_TRACE_IPS` promoted to a top-level named constant (was inline in the `/api/trace` handler).
- `ALLOWED_ORIGINS` documented in `.env.example`.
- `utils/distance.js` added to the project tree in `CONTRIBUTING.md`.

## [1.4.0] - 2026-08-01

### Added
- IPv6 support end-to-end: `lookupIp()` matches IPv6 CIDRs for IPv6 queries; `getIpGeolocation()` skips IPv6 private/link-local addresses (`::1`, `fc00::/7`, `fe80::/10`); frontend `validateIp` accepts both families.
- OpenAPI 1.4.0: nested `DatacenterInfo` schema (`name`, `city`, `country`, `latitude`, `longitude`, `ipRanges`); `LookupFound` uses `datacenter` object; `TraceResult` uses `results[]` with `totalResults`/`foundResults`; `/api/zdx/userpath` response updated to match actual implementation.
- `requirements.txt` listing `zscaler-sdk-python` and `requests` for reproducible Python dependency installation.
- `zdx_oneapi_geopath.py` OneAPI usage documented in `README_PYTHON.md`.
- `TRUST_PROXY` documented in README Configuration section.

### Fixed
- Private-IP detection in `getIpGeolocation()` now covers IPv6 loopback (`::1`), IPv4 link-local (`169.254.x.x`), and IPv6 unique-local/link-local ranges in addition to existing RFC 1918 IPv4 ranges.
- Frontend `showSuccess()` now reads from the nested `data.datacenter` object returned by the API (was reading flat top-level fields).
- Incomplete private-IP prefix list in `zdx_oneapi_geopath.py` — full RFC 1918 `172.16.0.0/12` coverage.
- Bare `except:` in `zdx_oneapi_geopath.py` replaced with `except Exception:`.

## [1.3.0-beta] - 2024-01-01

### Added
- Bulk IP lookup / Trace Route feature.
- Export results as JSON, CSV, PNG.
- Map route visualisation with animated polylines.
- Rate limiting, Helmet CSP, compression, configurable CORS.
- Unit/integration tests, ESLint, GitHub Actions CI, Husky.
- OpenAPI 3.0 specification, Docker improvements, optional HTTPS.
- `/api/zdx/userpath` endpoint and ZDX credentials support.

### Fixed
- RFC 1918 private IP check for `172.16.0.0/12`.
- SSRF hardening via ZDX cloud allowlist.
- CIDR prefix-length validation in `parseCidr`.

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
