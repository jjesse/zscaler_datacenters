import os
import argparse
import requests
from datetime import datetime
from zscaler import ZscalerClient

# 1. Geolocation Helper
def get_country(ip):
    # Filter for private LAN IPs
    private = ['10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.', 
               '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.']
    if any(ip.startswith(p) for p in private) or ip == "0.0.0.0":
        return "Local Network"
    
    try:
        # Standard Geo-IP lookup
        res = requests.get(f"https://ipapi.co/{ip}/country_name/", timeout=3)
        return res.text.strip() if res.status_code == 200 else "Unknown"
    except:
        return "Unknown"

# 2. Main Logic using OneAPI
def fetch_oneapi_path(user_email, app_name):
    # Initialize using OneAPI (ZIdentity OAuth2)
    # The SDK targets api.zsapi.net automatically when vanity_domain is used
    user_config = {
        "client_id": os.getenv('ZSCALER_CLIENT_ID'),
        "client_secret": os.getenv('ZSCALER_CLIENT_SECRET'),
        "vanity_domain": os.getenv('ZSCALER_VANITY_DOMAIN')
    }
    
    # Only add cloud if it's set
    if os.getenv('ZSCALER_CLOUD'):
        user_config["cloud"] = os.getenv('ZSCALER_CLOUD')
    
    client = ZscalerClient(user_config=user_config)

    print(f"\n[OneAPI] Fetching devices for: {user_email}")
    devices_response = client.zdx.devices.list_devices(search=user_email)
    
    # Extract devices from response structure (tuple -> list -> dict -> devices list)
    if not devices_response or not devices_response[0]:
        print("Error: User not found.")
        return
    
    devices = devices_response[0][0].get('devices', [])
    if not devices:
        print("Error: No devices found.")
        return

    # Grab most recent device (devices don't have last_seen in this response, just use first)
    active_dev = devices[0]
    dev_id = active_dev['id']

    # Identify App
    apps_response = client.zdx.apps.list_apps()
    apps = apps_response[0]  # Apps are directly in the first element
    target = next((a for a in apps if app_name.lower() in a['name'].lower()), None)
    
    if not target:
        print(f"Error: Application '{app_name}' not found.")
        return

    # Pull Cloud Path
    print(f"Tracing: {active_dev['name']} -> {target['name']}")
    path = client.zdx.apps.get_app_cloud_path(device_id=dev_id, app_id=target['id'], since=2)

    if not path or 'hops' not in path:
        print("No path data available.")
        return

    # Print Table
    print(f"\n{'Hop':<5} {'IP Address':<18} {'RTT (ms)':<10} {'Country':<15}")
    print("-" * 55)
    for hop in path['hops']:
        ip = hop.get('address', '?.?.?.?')
        country = get_country(ip)
        print(f"{hop.get('hop'):<5} {ip:<18} {hop.get('rtt', '*'):<10} {country:<15}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", required=True)
    parser.add_argument("--app", required=True)
    args = parser.parse_args()
    fetch_oneapi_path(args.user, args.app)
    