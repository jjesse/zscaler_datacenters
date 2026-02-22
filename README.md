# Zscaler Datacenter Lookup Tool

A web application to identify which Zscaler datacenter an IP address belongs to. This tool helps you understand which Zscaler Cloud Enforcement Node (CEN) location you're connected to.

## Overview

When connected to Zscaler, you may see an IP address but not know which datacenter location it represents. This tool fetches the latest Cloud Enforcement Node Ranges (CENR) from Zscaler's public API and identifies the datacenter location for any given IP address.

## Features

- ✨ **Clean, Modern UI** - Responsive design that works on desktop and mobile
- 🌍 **Multi-Cloud Support** - Supports all 8 Zscaler clouds:
  - zscaler.net
  - zscalerone.net
  - zscalertwo.net
  - zscalerthree.net
  - zscloud.net
  - zscalerbeta.net
  - zscalergov.net
  - zscalerten.net
- 🔍 **IP Lookup** - Quickly identify which datacenter an IP belongs to
- �️ **Interactive Map** - Visualize datacenter locations on an interactive map using Leaflet
- 🚀 **Traffic Flow Visualization** - See the traffic path from your location to the Zscaler datacenter
  - Dual markers showing your location (📍) and datacenter (🏢)
  - Animated traffic flow line with directional arrow
  - Auto-fit map to show both locations
- 📏 **Distance Calculation** - Calculate and display the distance between locations
  - Shows distance in kilometers and miles
  - Distance label displayed on the map
- 🌐 **Geolocation** - Automatic or manual IP geolocation
  - Auto-detect your public IP address
  - Optional manual source IP input
  - Shows your city and country
- 🛣️ **Trace Route Visualization** - Map multiple IP addresses as a multi-hop route
  - Enter multiple IPs (one per line) to visualize the complete path
  - Numbered markers showing each hop in sequence
  - Distance calculation between consecutive hops and total route distance
  - Animated traffic flow lines connecting all hops
  - Export route data (Copy, JSON, CSV, PNG)
- 📦 **Docker Support** - Easy deployment with Docker
- ⚡ **Fast & Efficient** - Caches Zscaler data to minimize API calls
- 🏥 **Health Check Endpoint** - Monitor application health

## Quick Start

### Prerequisites

- Docker and Docker Compose (recommended)
- OR Node.js 18+ (for local development)

### Running with Docker (Recommended)

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd zscaler
   ```

2. Start the application:
   ```bash
   docker-compose up -d
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Running without Docker

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### Single IP Lookup

1. **Select your Zscaler Cloud** from the dropdown menu
2. **Enter a Zscaler IP address** to lookup (e.g., 165.225.28.50)
3. **Optional: Enter your IP address** to visualize traffic flow and distance
   - Leave blank for auto-detection (works with public IPs)
   - Or manually enter any public IP address
4. **Click "Lookup Datacenter"** to find the datacenter
5. **View results** showing:
   - Datacenter name and location
   - IP range and coordinates
   - Your location (if provided)
   - Distance between locations (in km and miles)
   - Interactive map with traffic flow visualization

### Trace Route Visualization

1. **Click the "Trace Route" tab** in the navigation
2. **Select your Zscaler Cloud** from the dropdown menu
3. **Enter multiple IP addresses** (one per line) to trace the route
4. **Click "Trace Route"** to visualize the path
5. **View results** showing:
   - Each hop with datacenter name, location, and coordinates
   - Distance between consecutive hops
   - Total route distance in kilometers and miles
   - Interactive map with numbered markers and connecting lines
6. **Export your results** using the export buttons:
   - 📋 **Copy** - Copy formatted text to clipboard
   - 📄 **JSON** - Download as JSON file
   - 📊 **CSV** - Download as CSV file
   - 🖼️ **PNG** - Download map as PNG image

### Examples

**Single IP Lookup:**
- **Zscaler IP**: `165.225.28.50`
- **Cloud**: `zscalerthree.net`
- **Your IP**: `8.8.8.8` (optional)
- **Result**: 
  - Datacenter: `Amsterdam II`
  - Your Location: `Ashburn, United States`
  - Distance: `6,209.9 km (3,858.7 miles)`
  - Map showing both locations with traffic flow

**Trace Route:**
- **IPs** (one per line):
  ```
  107.207.39.169
  165.225.28.50
  165.225.80.50
  ```
- **Cloud**: `zscalerthree.net`
- **Result**:
  - Hop 1: `Phoenix` → Hop 2: `Amsterdam II` (6,410.5 km)
  - Hop 2: `Amsterdam II` → Hop 3: `Paris` (431.3 km)
  - Total Distance: `6,841.8 km (4,251.2 miles)`
  - Map showing all hops with numbered markers and connecting lines

## API Endpoints

The application provides a REST API for programmatic access:

### `POST /api/trace`

Trace a route through multiple IP addresses.

**Request Body:**
```json
{
  "cloud": "zscalerthree.net",
  "ips": ["107.207.39.169", "165.225.28.50", "165.225.80.50"]
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/trace \
  -H "Content-Type: application/json" \
  -d '{"cloud":"zscalerthree.net","ips":["107.207.39.169","165.225.28.50"]}'
```

**Response:**
```json
{
  "success": true,
  "cloud": "zscalerthree.net",
  "totalHops": 2,
  "totalDistanceKm": 6410.5,
  "totalDistanceMiles": 3983.3,
  "hops": [
    {
      "hopNumber": 1,
      "ip": "107.207.39.169",
      "datacenter": "Phoenix",
      "city": "Phoenix",
      "continent": "Americas",
      "range": "107.207.38.0/23",
      "latitude": "33.448376",
      "longitude": "-112.074036"
    },
    {
      "hopNumber": 2,
      "ip": "165.225.28.50",
      "datacenter": "Amsterdam II",
      "city": "Amsterdam II",
      "continent": "EMEA",
      "range": "165.225.28.0/23",
      "latitude": "52.367573",
      "longitude": "4.904139",
      "distanceFromPrevKm": 6410.5,
      "distanceFromPrevMiles": 3983.3
    }
  ]
}
```

### `GET /api/lookup`

Lookup an IP address in a specific Zscaler cloud.

**Parameters:**
- `cloud` (required) - Zscaler cloud name (e.g., `zscalerthree.net`)
- `ip` (required) - IP address to lookup (e.g., `165.225.28.50`)
- `sourceIp` (optional) - Your source IP address for traffic flow visualization

**Example:**
```bash
curl "http://localhost:3000/api/lookup?cloud=zscalerthree.net&ip=165.225.28.50&sourceIp=8.8.8.8"
```

**Response:**
```json
{
  "success": true,
  "ip": "165.225.28.50",
  "cloud": "zscalerthree.net",
  "datacenter": "Amsterdam II",
  "city": "Amsterdam II",
  "continent": "EMEA",
  "range": "165.225.28.0/23",
  "latitude": "52.367573",
  "longitude": "4.904139",
  "clientIp": "8.8.8.8",
  "clientCity": "Ashburn",
  "clientCountry": "United States",
  "clientLatitude": 39.03,
  "clientLongitude": -77.5,
  "distanceKm": 6209.9,
  "distanceMiles": 3858.7
}
```

### `GET /api/clouds`

Get a list of all supported Zscaler clouds.

### `GET /api/health`

Health check endpoint for monitoring application status.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-02-21T12:00:00.000Z",
  "cacheSize": 3
}
```

## Development

### Project Structure

```
zscaler/
├── server.js           # Express backend server
├── public/             # Frontend static files
│   ├── index.html     # Main HTML page
│   ├── styles.css     # Styles
│   └── app.js         # Frontend JavaScript
├── package.json        # Node.js dependencies
├── Dockerfile          # Docker image configuration
├── docker-compose.yml  # Docker Compose configuration
├── .dockerignore      # Docker ignore file
├── README.md          # This file
├── TODO.md            # Development roadmap
└── instructions.md    # Original project instructions
```

### Technologies Used

- **Backend**: Node.js, Express
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Mapping**: Leaflet.js v1.9.4 with Polyline Decorator v1.6.0 for traffic flow visualization
- **Export**: html2canvas v1.4.1 for PNG map export
- **Geolocation**: ip-api.com for IP geolocation
- **Containerization**: Docker, Docker Compose
- **External API**: Zscaler Config API

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `CACHE_DURATION` - How long to cache Zscaler data in milliseconds (default: 3600000 - 1 hour)

### Docker Configuration

Modify `docker-compose.yml` to customize:
- Port mappings
- Environment variables
- Resource limits

## Troubleshooting

### Application won't start
- Ensure port 3000 is not in use by another application
- Check Docker is running: `docker ps`

### IP lookup returns no results
- Verify the IP address format is correct (IPv4)
- Ensure you've selected the correct Zscaler cloud
- The IP might not belong to any Zscaler datacenter

### Data seems outdated
- Restart the application to refresh the cache
- Or wait for the cache to expire (default: 1 hour)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this tool for your needs.

## Acknowledgments

- Zscaler for providing the public CENR API
- Built to solve a real-world problem with Zscaler connectivity visibility

## Support

For issues or questions, please open an issue on the repository.
