import os
import argparse
import requests
from datetime import datetime
from zscaler.zdx import ZDXClient

# Helper function to find country from IP
def get_country(ip):
    # Filter out private IP addresses (Home/Office LAN)
    private_prefixes = ['10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.']
    if any(ip.startswith(prefix) for prefix in private_prefixes) or ip == "0.0.0.0":
        return "Local Network"
    
    try:
        # Using a free lookup service (Limited to 1000/day)
        response = requests.get(f"https://ipapi.co/{ip}/country_name/", timeout=3)
        if response.status_code == 200:
            return response.text.strip()
    except:
        pass
    return "Unknown"

def run_geo_lookup(user_email, app_name, cloud_name):
    client = ZDXClient(
        client_id=os.getenv('ZDX_CLIENT_ID'),
        client_secret=os.getenv('ZDX_CLIENT_SECRET'),
        cloud=cloud_name
    )

    # 1. Device Lookup
    devices = client.devices.list_devices(search=user_email)
    if not devices:
        print(f"Error: No devices found for {user_email}")
        return

    active_device = max(devices, key=lambda d: d.get('last_seen', 0))
    device_id = active_device.get('id')

    # 2. App Lookup
    apps = client.apps.list_apps()
    target_app = next((a for a in apps if app_name.lower() in a.get('name').lower()), None)
    
    if not target_app:
        print(f"Error: App '{app_name}' not found.")
        return

    # 3. Cloud Path Fetch & Geo Enrichment
    print(f"\nTracing Path for {user_email} to {target_app['name']}...")
    print(f"{'Hop':<5} {'IP Address':<18} {'RTT (ms)':<10} {'Country':<15}")
    print("-" * 55)

    path_data = client.apps.get_app_cloud_path(device_id=device_id, app_id=target_app['id'], since=2)

    if not path_data or 'hops' not in path_data:
        print("No path data found.")
        return

    for hop in path_data['hops']:
        ip = hop.get('address', '?.?.?.?')
        rtt = hop.get('rtt', '*')
        country = get_country(ip)
        
        print(f"{hop.get('hop'):<5} {ip:<18} {rtt:<10} {country:<15}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", required=True)
    parser.add_argument("--app", required=True)
    args = parser.parse_args()
    
    # Run the script
    run_geo_lookup(args.user, args.app, "zscalerthree")