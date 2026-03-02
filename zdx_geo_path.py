import os
import argparse
import requests
from datetime import datetime
from zscaler.zdx.legacy import LegacyZDXClientHelper as ZDXClient
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Helper function to find country from IP
def get_country(ip):
    # Filter out private IP addresses (Home/Office LAN)
    private_prefixes = ['10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.']
    if any(ip.startswith(prefix) for prefix in private_prefixes) or ip == "0.0.0.0" or not ip:
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
    devices_response = client.devices.list_devices(search=user_email)
    
    # Extract devices from response structure (tuple -> list -> dict -> devices list)
    if not devices_response or not devices_response[0]:
        print(f"Error: No devices found for {user_email}")
        return
    
    devices = devices_response[0][0].get('devices', [])
    if not devices:
        print(f"Error: No devices found for {user_email}")
        return

    # Just use the first device (devices don't have last_seen in this response)
    active_device = devices[0]
    device_id = active_device.get('id')

    # 2. App Lookup
    apps_response = client.apps.list_apps()
    apps = apps_response[0]  # Apps are directly in the first element
    target_app = next((a for a in apps if app_name.lower() in a.get('name').lower()), None)
    
    if not target_app:
        print(f"Error: App '{app_name}' not found.")
        return

    # 3. Get Cloud Path Probe ID
    headers = client.headers.copy()
    headers['Authorization'] = f"Bearer {client.auth_token}"
    
    probes_url = f"{client.url}/v1/devices/{device_id}/apps/{target_app['id']}/cloudpath-probes"
    probes_response = requests.get(probes_url, headers=headers, timeout=client.timeout)
    
    if probes_response.status_code != 200:
        print(f"Error: No Cloud Path Probes found for {target_app['name']}")
        print(f"Please configure a Cloud Path Probe for this app in ZDX Admin Portal")
        return
    
    probes = probes_response.json()
    if not probes:
        print(f"Error: No Cloud Path Probes configured for {target_app['name']}")
        return
    
    probe_id = probes[0]['id']
    
    # 4. Fetch Cloud Path Data
    cloudpath_url = f"{client.url}/v1/devices/{device_id}/apps/{target_app['id']}/cloudpath-probes/{probe_id}/cloudpath"
    cloudpath_response = requests.get(cloudpath_url, headers=headers, timeout=client.timeout)
    
    if cloudpath_response.status_code != 200:
        print(f"Error: Could not fetch cloud path data")
        return
    
    path_data = cloudpath_response.json()
    if not path_data:
        print("No path data found.")
        return
    
    # 5. Display Path with Geo Enrichment
    latest = path_data[0]  # Most recent probe
    print(f"\nTracing Path for {user_email} to {target_app['name']}...")
    print(f"Device: {active_device['name']}")
    print(f"Probe: {probes[0]['name']}")
    
    # Get and display client's external/public IP (ISP's public IP)
    try:
        external_ip_response = requests.get('https://api.ipify.org?format=json', timeout=5)
        if external_ip_response.status_code == 200:
            external_ip = external_ip_response.json().get('ip')
            country = get_country(external_ip)
            print(f"\nClient External (ISP) IP: {external_ip} | {country}")
    except:
        print(f"\nClient External IP: (Unable to detect)")
    
    print(f"\n{'Hop':<5} {'IP Address':<18} {'RTT (ms)':<10} {'Country':<20}")
    print("-" * 60)
    
    hop_num = 1
    for leg in latest['cloudpath']:
        print(f"\n--- {leg['src'].capitalize()} → {leg['dst'].capitalize()} ---")
        for hop in leg['hops']:
            ip = hop['ip']
            latency = hop['latency_avg'] if hop['latency_avg'] > 0 else '*'
            
            if ip:  # Only show hops with IPs
                country = get_country(ip)
                print(f"{hop_num:<5} {ip:<18} {latency:<10} {country:<20}")
                hop_num += 1

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", required=True)
    parser.add_argument("--app", required=True)
    args = parser.parse_args()
    
    # Run the script
    run_geo_lookup(args.user, args.app, "zdxcloud")