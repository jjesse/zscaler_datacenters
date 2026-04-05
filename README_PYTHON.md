# ZDX Geo Path Tracker

A Python script that traces network paths from Zscaler Digital Experience (ZDX) monitored devices to applications, displaying hop-by-hop IP addresses with geolocation information.

## Features

- Retrieves Cloud Path Probe data from ZDX for any user/device and application
- Displays the client's external (ISP) IP address
- Shows hop-by-hop network path with IP addresses and latency
- Enriches each IP with geolocation (country) information
- Supports both internal network path (client → egress) and internet path (egress → server)

## Prerequisites

- Python 3.8 or higher
- ZDX Admin Portal access with Legacy API credentials
- Cloud Path Probes configured in ZDX for the target applications
- ZDX Client installed on monitored devices

## Installation

1. **Clone or download this repository**

2. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Linux/Mac
   # or
   venv\Scripts\activate  # On Windows
   ```

3. **Install required dependencies**:
   ```bash
   pip install zscaler-sdk-python requests
   ```

## Configuration

### ZDX API Credentials

You need Legacy ZDX API credentials from the ZDX Admin Portal:

1. Log in to **ZDX Admin Portal** → **Administration** → **API Keys**
2. Create a new **Legacy ZDX API Key**
3. Copy the **Key ID** and **Secret**

### Set Environment Variables

```bash
export ZDX_CLIENT_ID="your-key-id-here"
export ZDX_CLIENT_SECRET="your-secret-here"
```

**Note**: The credentials are for the Legacy ZDX API, not ZIdentity/OneAPI.

## Usage

```bash
python zdx_geo_path.py --user <user_email> --app <app_name>
```

### Examples

```bash
# Trace path to Outlook Online
python zdx_geo_path.py --user jonathan@jessefamily.cloud --app "Outlook Online"

# Trace path to Microsoft Login
python zdx_geo_path.py --user jonathan@jessefamily.cloud --app "Microsoft Login"
```

## Sample Output

```
Tracing Path for jonathan@jessefamily.cloud to Microsoft Login...
Device: phobos(10MR0047US Microsoft Windows 11 Pro;64 bit;amd64)
Probe: Microsoft Login CloudPath Probe

Client External (ISP) IP: 107.207.39.169 | United States

Hop   IP Address         RTT (ms)   Country             
------------------------------------------------------------

--- Client → Egress ---
1     192.168.4.1        9          Local Network       
2     192.168.21.1       7          Local Network       

--- Egress → Server ---
3     20.190.157.12      56         United States       
4     40.126.28.21       62         United States       
```

## How It Works

1. **User Lookup**: Queries ZDX API to find the user and their active device
2. **App Lookup**: Searches for the specified application in ZDX
3. **Probe Discovery**: Retrieves configured Cloud Path Probes for the app/device
4. **Path Data**: Fetches the most recent cloudpath trace data
5. **Geolocation**: Enriches each IP address with country information using ipapi.co
6. **External IP**: Detects the client's public ISP IP address using ipify.org

## API Endpoints Used

- `GET /v1/users` - Find user by email
- `GET /v1/users/{userId}/devices` - Get user's devices
- `GET /v1/apps` - List all applications
- `GET /v1/devices/{deviceId}/apps/{appId}/cloudpath-probes` - Get probe list
- `GET /v1/devices/{deviceId}/apps/{appId}/cloudpath-probes/{probeId}/cloudpath` - Get trace data

## Notes

- **External IP**: The client's public ISP IP is shown at the top but doesn't appear in hop traces because it's a NAT gateway, not a routing hop
- **Local IPs**: Internal network hops (192.168.x.x, 10.x.x.x) are identified as "Local Network"
- **Rate Limiting**: The geolocation service (ipapi.co) has a free tier limit of 1,000 requests/day
- **Multiple Devices**: If a user has multiple devices, the script uses the first one returned by the API

## Troubleshooting

### "No Cloud Path Probes found"
- Ensure Cloud Path Probes are configured for the target application in ZDX Admin Portal
- Verify the application name matches exactly (case-insensitive partial match supported)

### "No devices found for user"
- Check that the user email is correct
- Verify the device has the ZDX Client installed and active
- Ensure the device has reported to ZDX recently

### Authentication Errors (403/401)
- Verify `ZDX_CLIENT_ID` and `ZDX_CLIENT_SECRET` are set correctly
- Ensure you're using Legacy ZDX API credentials, not ZIdentity credentials
- Check that the API key has not expired

### Geolocation shows "Unknown"
- This is normal for some IPs, especially Azure/AWS internal routing
- The free ipapi.co service may not have data for all IPs
- Rate limiting may occur after 1,000 requests

## Requirements

- `zscaler-sdk-python` - Official Zscaler SDK
- `requests` - HTTP library for API calls and geolocation lookups
- `python-dotenv` - Load environment variables from `.env` files

All dependencies are pinned in `requirements.txt`. Install with:
```bash
pip install -r requirements.txt
```

## Cloud Configuration

The script is configured for the `zdxcloud` cloud. If your organization uses a different cloud endpoint, modify line 72:

```python
client = ZDXClient(client_id=api_key, client_secret=api_secret, cloud="zdxcloud")
```

Valid cloud values: `zdxcloud`, `zdxone`, `zdxtwo`, `zdxthree`, `zdxbeta`

## License

This script is provided as-is for use with Zscaler Digital Experience monitoring.

---

**Last Updated**: February 25, 2026

---

# ZDX OneAPI Geo Path Tracker

`zdx_oneapi_geopath.py` is an alternative implementation that uses the Zscaler **OneAPI** (ZIdentity OAuth2) instead of the Legacy ZDX API. Use this script if your organization has migrated to the modern OneAPI authentication model.

## Features

- Authenticates via ZIdentity OAuth2 using `ZscalerClient` from `zscaler-sdk-python`
- Retrieves device list and cloud path data through the OneAPI
- Displays hop-by-hop network path with IP addresses and country geolocation

## Prerequisites

- Python 3.8 or higher
- OneAPI credentials (`ZSCALER_CLIENT_ID`, `ZSCALER_CLIENT_SECRET`, `ZSCALER_VANITY_DOMAIN`)
- Optionally `ZSCALER_CLOUD` for non-default cloud endpoints

## Configuration

Set the following environment variables (or add them to a `.env` file):

```bash
export ZSCALER_CLIENT_ID="your-client-id"
export ZSCALER_CLIENT_SECRET="your-client-secret"
export ZSCALER_VANITY_DOMAIN="yourcompany"   # e.g., yourcompany.zslogin.net vanity domain
export ZSCALER_CLOUD="zdxcloud"              # optional; defaults to vanity domain routing
```

## Usage

```bash
python zdx_oneapi_geopath.py --user <user_email> --app <app_name>
```

### Example

```bash
python zdx_oneapi_geopath.py --user user@example.com --app "Office 365"
```

## Sample Output

```
[OneAPI] Fetching devices for: user@example.com
Tracing: LAPTOP-001 -> Office 365

Hop   IP Address         RTT (ms)   Country
-------------------------------------------------------
1     192.168.1.1        5          Local Network
2     203.0.113.45       18         United States
3     2a04:4e40::1       35         Netherlands
```

## Differences from `zdx_geo_path.py`

| Feature | `zdx_geo_path.py` (Legacy) | `zdx_oneapi_geopath.py` (OneAPI) |
|---------|---------------------------|----------------------------------|
| Authentication | Legacy ZDX API Key | ZIdentity OAuth2 |
| Credentials | `ZDX_CLIENT_ID`, `ZDX_CLIENT_SECRET` | `ZSCALER_CLIENT_ID`, `ZSCALER_CLIENT_SECRET`, `ZSCALER_VANITY_DOMAIN` |
| Cloud config | Hardcoded in script | `ZSCALER_CLOUD` env var |
| SDK method | `LegacyZDXClientHelper` | `ZscalerClient` |

