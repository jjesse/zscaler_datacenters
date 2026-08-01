# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.1] - 2026-08-01

### Added
- `version` field on `/api/health` (from `package.json`) so operators can confirm the running build.
- Cache stampede protection: concurrent cold-cache fetches for the same cloud share one in-flight promise.
- Input length guards (`MAX_PARAM_LENGTH`) on `/api/lookup` and `/api/trace` query/body parameters.
- `.nvmrc` pinning Node.js 20 for local development.

### Changed
- User-Agent for Zscaler CENR fetches now includes the app version (`Zscaler-Datacenter-Lookup/<version>`).
- `package.json` `author` set; `engines.node` aligned to `>=20.0.0` (matches Docker/CI).
- `MAX_TRACE_IPS` promoted to a top-level named constant.
- OpenAPI version bumped to 1.4.1; health schema documents `version`.
- CONTRIBUTING project tree includes `utils/distance.js`; `.env.example` documents `ALLOWED_ORIGINS`.

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
