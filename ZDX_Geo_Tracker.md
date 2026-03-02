# ZDX Cloud Path Geo-Tracker

## Overview
This tool uses the Zscaler Digital Experience (ZDX) API to trace the network path of a specific user to a specific application. It identifies every hop (router/gateway), calculates latency, and performs a <b>GEOLOCATION LOOKUP</b> to show you which countries the traffic is passing through.

## Prerequisites

The following prerequisites are needed
- Python 3.8+ installed
- A Zscaler ZDX subscription with Admin access to generate API keys
- The Application you want to query must already have a <b>Cloud Path Probe </b> configured in the ZDX portal.

## Step #1 - Get your ZDX API Credentials

- Login to your ZDX Admin
- Administration -> Role Management
    - Make sure your role has "API Key Management" enabled
- Go to Administration -> API Key Management
- Add an API Key
- Copy the Client ID and Client Secret
    - NOTE: The secret is only shown once, save it securely!!!

## Step #2 - Environmental Setup

Open your terminal and install the following required libraries:
```bash
# Install the Zscaler SDK and the Requests library for Geo-IP Lookups
pip install zscaler-sdk-python requests
```

## Step #3 - Configuration

To keep your credentials secure, set them as <b>Environment Variables</b>. Do not include them in your script

```bash
export ZDX_CLIENT_ID="your_client_id_here"
export ZDX_CLIENT_SECRET="your_client_secret_here"
export ZDX_CLOUD="zscalerthree"
```

## Step #4 - Running the script

Save the Python Script (zdx_geo_path.py) and run it with the following syntax:

```bash
python zdx_geo_path.py --user jonathan@jessefamily.cloud --app "Office 365"
```

### Expected output:

The script will perform the following logic:
- Authenticate with Zscaler
- Find the most recently active device for the user
- Retrieve the hop-by-hop IP list
- Translate each ip into a Country.
