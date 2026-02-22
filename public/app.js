// DOM Elements
const lookupForm = document.getElementById('lookupForm');
const cloudSelect = document.getElementById('cloudSelect');
const ipInput = document.getElementById('ipInput');
const sourceIpInput = document.getElementById('sourceIpInput');
const submitBtn = document.getElementById('submitBtn');
const resultContainer = document.getElementById('resultContainer');
const resultContent = document.getElementById('resultContent');
const closeBtn = document.getElementById('closeBtn');
const btnText = submitBtn.querySelector('.btn-text');
const loader = submitBtn.querySelector('.loader');
const mapContainer = document.getElementById('mapContainer');

// Map instance
let map = null;
let clientMarker = null;
let datacenterMarker = null;
let flowLine = null;

// Event Listeners
lookupForm.addEventListener('submit', handleSubmit);
closeBtn.addEventListener('click', hideResults);

// IP address validation regex
const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Validate IP address
 */
function validateIp(ip) {
    const match = ip.match(ipRegex);
    if (!match) return false;
    
    // Check each octet is 0-255
    for (let i = 1; i <= 4; i++) {
        const octet = parseInt(match[i]);
        if (octet < 0 || octet > 255) return false;
    }
    
    return true;
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
    e.preventDefault();
    
    const cloud = cloudSelect.value;
    const ip = ipInput.value.trim();
    const sourceIp = sourceIpInput.value.trim();
    
    // Validate inputs
    if (!cloud) {
        showError('Please select a Zscaler cloud');
        return;
    }
    
    if (!validateIp(ip)) {
        showError('Please enter a valid Zscaler IPv4 address');
        return;
    }
    
    // Validate source IP if provided
    if (sourceIp && !validateIp(sourceIp)) {
        showError('Please enter a valid source IPv4 address');
        return;
    }
    
    // Show loading state
    setLoading(true);
    hideResults();
    
    try {
        // Make API request
        let url = `/api/lookup?cloud=${encodeURIComponent(cloud)}&ip=${encodeURIComponent(ip)}`;
        if (sourceIp) {
            url += `&sourceIp=${encodeURIComponent(sourceIp)}`;
        }
        const response = await fetch(url);
        const data = await response.json();
        
        // Display results
        if (data.success && data.datacenter) {
            showSuccess(data);
        } else {
            showError(data.error || 'IP address not found in any datacenter for this cloud');
        }
    } catch (error) {
        console.error('Lookup error:', error);
        showError('Failed to lookup IP address. Please check your connection and try again.');
    } finally {
        setLoading(false);
    }
}

/**
 * Show loading state
 */
function setLoading(isLoading) {
    if (isLoading) {
        submitBtn.disabled = true;
        btnText.textContent = 'Looking up...';
        loader.style.display = 'inline-block';
    } else {
        submitBtn.disabled = false;
        btnText.textContent = 'Lookup Datacenter';
        loader.style.display = 'none';
    }
}

/**
 * Show success result
 */
function showSuccess(data) {
    const html = `
        <div class="result-info">
            <div class="info-row">
                <span class="info-label">Datacenter:</span>
                <span class="info-value highlight">${escapeHtml(data.datacenter)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">City:</span>
                <span class="info-value">${escapeHtml(data.city)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Continent:</span>
                <span class="info-value">${escapeHtml(data.continent)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">IP Range:</span>
                <span class="info-value">${escapeHtml(data.range)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Cloud:</span>
                <span class="info-value">${escapeHtml(data.cloud)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Queried IP:</span>
                <span class="info-value">${escapeHtml(data.ip)}</span>
            </div>
            ${data.latitude && data.longitude ? `
            <div class="info-row">
                <span class="info-label">Coordinates:</span>
                <span class="info-value">${escapeHtml(data.latitude)}, ${escapeHtml(data.longitude)}</span>
            </div>
            ` : ''}
            ${data.clientIp ? `
            <div class="section-divider"></div>
            <div class="info-row client-info">
                <span class="info-label">Your IP:</span>
                <span class="info-value">${escapeHtml(data.clientIp)}</span>
            </div>
            ${data.clientCity && data.clientCountry ? `
            <div class="info-row client-info">
                <span class="info-label">Your Location:</span>
                <span class="info-value">${escapeHtml(data.clientCity)}, ${escapeHtml(data.clientCountry)}</span>
            </div>
            ` : ''}
            ${data.distanceKm ? `
            <div class="info-row distance-info">
                <span class="info-label">Distance:</span>
                <span class="info-value highlight-distance">${escapeHtml(data.distanceKm)} km (${escapeHtml(data.distanceMiles)} miles)</span>
            </div>
            ` : ''}
            ` : ''}
        </div>
    `;
    
    resultContent.innerHTML = html;
    resultContainer.style.display = 'block';
    resultContainer.querySelector('.result-card').classList.remove('error');
    
    // Show map if coordinates are available
    if (data.latitude && data.longitude) {
        const datacenterLat = parseFloat(data.latitude);
        const datacenterLng = parseFloat(data.longitude);
        const clientLat = data.clientLatitude ? parseFloat(data.clientLatitude) : null;
        const clientLng = data.clientLongitude ? parseFloat(data.clientLongitude) : null;
        const distance = data.distanceKm ? `${data.distanceKm} km` : null;
        
        showMap(datacenterLat, datacenterLng, data.datacenter, clientLat, clientLng, data.clientCity || 'Your Location', distance);
    } else {
        mapContainer.style.display = 'none';
    }
    
    // Scroll to results
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Show error message
 */
function showError(message) {
    const html = `
        <div class="error-message">
            <div>${escapeHtml(message)}</div>
        </div>
    `;
    
    resultContent.innerHTML = html;
    resultContainer.style.display = 'block';
    resultContainer.querySelector('.result-card').classList.add('error');
    
    // Hide map on error
    mapContainer.style.display = 'none';
    
    // Scroll to results
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Display location on map with traffic flow
 */
function showMap(datacenterLat, datacenterLng, datacenterName, clientLat, clientLng, clientName, distance) {
    mapContainer.style.display = 'block';
    
    // Initialize map if not already created
    if (!map) {
        // If we have both locations, center between them, otherwise center on datacenter
        const centerLat = (clientLat && clientLng) ? (datacenterLat + clientLat) / 2 : datacenterLat;
        const centerLng = (clientLat && clientLng) ? (datacenterLng + clientLng) / 2 : datacenterLng;
        
        map = L.map('map').setView([centerLat, centerLng], 4);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);
    }
    
    // Clear existing markers and lines
    if (datacenterMarker) map.removeLayer(datacenterMarker);
    if (clientMarker) map.removeLayer(clientMarker);
    if (flowLine) map.removeLayer(flowLine);
    
    // Create custom icons
    const datacenterIcon = L.divIcon({
        className: 'custom-marker datacenter-marker',
        html: '<div class="marker-pin">🏢</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });
    
    const clientIcon = L.divIcon({
        className: 'custom-marker client-marker',
        html: '<div class="marker-pin">📍</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });
    
    // Add datacenter marker
    datacenterMarker = L.marker([datacenterLat, datacenterLng], { icon: datacenterIcon })
        .addTo(map)
        .bindPopup(`<b>🏢 ${datacenterName}</b><br>Zscaler Datacenter<br>Lat: ${datacenterLat}<br>Lng: ${datacenterLng}`)
        .openPopup();
    
    // Add client marker and traffic flow line if client location is available
    if (clientLat && clientLng) {
        clientMarker = L.marker([clientLat, clientLng], { icon: clientIcon })
            .addTo(map)
            .bindPopup(`<b>📍 ${clientName}</b><br>Your Location<br>Lat: ${clientLat}<br>Lng: ${clientLng}`);
        
        // Draw traffic flow line
        flowLine = L.polyline(
            [[clientLat, clientLng], [datacenterLat, datacenterLng]], 
            {
                color: '#0066cc',
                weight: 3,
                opacity: 0.7,
                dashArray: '10, 10',
                className: 'traffic-flow-line'
            }
        ).addTo(map);
        
        // Add distance label in the middle of the line if available
        if (distance) {
            const midLat = (clientLat + datacenterLat) / 2;
            const midLng = (clientLng + datacenterLng) / 2;
            
            const distanceIcon = L.divIcon({
                className: 'distance-label',
                html: `<div class="distance-text">📏 ${distance}</div>`,
                iconSize: [120, 30],
                iconAnchor: [60, 15]
            });
            
            L.marker([midLat, midLng], { icon: distanceIcon }).addTo(map);
        }
        
        // Add arrow decorator to show direction
        const arrowHead = L.polylineDecorator(flowLine, {
            patterns: [
                {
                    offset: '50%',
                    repeat: 0,
                    symbol: L.Symbol.arrowHead({
                        pixelSize: 15,
                        polygon: false,
                        pathOptions: {
                            stroke: true,
                            color: '#0066cc',
                            weight: 3
                        }
                    })
                }
            ]
        }).addTo(map);
        
        // Fit map to show both locations
        const bounds = L.latLngBounds([clientLat, clientLng], [datacenterLat, datacenterLng]);
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        // Only datacenter, zoom to it
        map.setView([datacenterLat, datacenterLng], 10);
    }
    
    // Force map to refresh/resize after display
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

/**
 * Hide results
 */
function hideResults() {
    resultContainer.style.display = 'none';
    mapContainer.style.display = 'none';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-format IP input (optional enhancement)
ipInput.addEventListener('input', function(e) {
    // Remove non-numeric and non-dot characters
    let value = e.target.value.replace(/[^\d.]/g, '');
    
    // Prevent multiple consecutive dots
    value = value.replace(/\.{2,}/g, '.');
    
    // Update input
    e.target.value = value;
});

// Add example data on page load
window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Zscaler Datacenter Lookup Tool loaded');
    console.log('Example: Try IP 165.225.28.50 with zscalerthree.net');
});
