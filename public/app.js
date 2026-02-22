// DOM Elements - Single Lookup
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

// DOM Elements - Trace Route
const tracerouteForm = document.getElementById('tracerouteForm');
const trCloudSelect = document.getElementById('trCloudSelect');
const hopsInput = document.getElementById('hopsInput');
const traceSubmitBtn = document.getElementById('traceSubmitBtn');
const traceResultContainer = document.getElementById('traceResultContainer');
const traceResultContent = document.getElementById('traceResultContent');
const traceCloseBtn = document.getElementById('traceCloseBtn');
const traceBtnText = traceSubmitBtn.querySelector('.btn-text');
const traceLoader = traceSubmitBtn.querySelector('.loader');
const traceMapContainer = document.getElementById('traceMapContainer');
const copyTraceBtn = document.getElementById('copyTraceBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportPngBtn = document.getElementById('exportPngBtn');

// Tab Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Map instances
let map = null;
let clientMarker = null;
let datacenterMarker = null;
let flowLine = null;

let traceMap = null;
let traceMarkers = [];
let traceLines = [];
let currentTraceData = null; // Store current trace data for export

// Event Listeners - Tabs
tabButtons.forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
});

// Event Listeners - Single Lookup
lookupForm.addEventListener('submit', handleSubmit);
closeBtn.addEventListener('click', hideResults);

// Event Listeners - Trace Route
tracerouteForm.addEventListener('submit', handleTraceSubmit);
traceCloseBtn.addEventListener('click', hideTraceResults);
copyTraceBtn.addEventListener('click', copyTraceToClipboard);
exportJsonBtn.addEventListener('click', exportTraceAsJson);
exportCsvBtn.addEventListener('click', exportTraceAsCsv);
exportPngBtn.addEventListener('click', exportTraceAsPng);

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

// ========================================
// TAB SWITCHING
// ========================================

/**
 * Switch between tabs
 */
function switchTab(tabName) {
    // Update tab buttons
    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update tab content
    tabContents.forEach(content => {
        if (content.id === tabName + 'Tab') {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
    
    // Invalidate maps when switching to make sure they render correctly
    setTimeout(() => {
        if (map && tabName === 'single') map.invalidateSize();
        if (traceMap && tabName === 'traceroute') traceMap.invalidateSize();
    }, 100);
}

// ========================================
// TRACE ROUTE FUNCTIONALITY
// ========================================

/**
 * Handle trace route form submission
 */
async function handleTraceSubmit(e) {
    e.preventDefault();
    
    const cloud = trCloudSelect.value;
    const hopsText = hopsInput.value.trim();
    
    // Validate cloud
    if (!cloud) {
        showTraceError('Please select a Zscaler cloud');
        return;
    }
    
    // Parse and validate IPs
    const ips = hopsText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    if (ips.length === 0) {
        showTraceError('Please enter at least one IP address');
        return;
    }
    
    // Validate each IP
    const invalidIps = ips.filter(ip => !validateIp(ip));
    if (invalidIps.length > 0) {
        showTraceError(`Invalid IP address(es): ${invalidIps.join(', ')}`);
        return;
    }
    
    // Show loading state
    setTraceLoading(true);
    hideTraceResults();
    
    try {
        // Make API request for multiple IPs
        const response = await fetch('/api/trace', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cloud: cloud,
                ips: ips
            })
        });
        
        const data = await response.json();
        
        // Display results
        if (data.success && data.hops) {
            showTraceSuccess(data);
        } else {
            showTraceError(data.error || 'Failed to trace route');
        }
    } catch (error) {
        console.error('Trace route error:', error);
        showTraceError('Failed to trace route. Please check your connection and try again.');
    } finally {
        setTraceLoading(false);
    }
}

/**
 * Show loading state for trace route
 */
function setTraceLoading(isLoading) {
    if (isLoading) {
        traceSubmitBtn.disabled = true;
        traceBtnText.textContent = 'Tracing...';
        traceLoader.style.display = 'inline-block';
    } else {
        traceSubmitBtn.disabled = false;
        traceBtnText.textContent = 'Trace Route';
        traceLoader.style.display = 'none';
    }
}

/**
 * Show trace route success results
 */
function showTraceSuccess(data) {
    // Store data for export
    currentTraceData = data;
    
    let html = `
        <div class="trace-summary">
            <div class="info-row">
                <span class="info-label">Total Hops:</span>
                <span class="info-value highlight">${data.hops.length}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Cloud:</span>
                <span class="info-value">${escapeHtml(data.cloud)}</span>
            </div>
            ${data.totalDistance ? `
            <div class="info-row distance-info">
                <span class="info-label">Total Distance:</span>
                <span class="info-value highlight-distance">${data.totalDistance.toFixed(1)} km (${data.totalDistanceMiles.toFixed(1)} miles)</span>
            </div>
            ` : ''}
        </div>
        <div class="hops-list">
            <h3>Route Details</h3>
    `;
    
    data.hops.forEach((hop, index) => {
        const hopNum = index + 1;
        html += `
            <div class="hop-item ${hop.found ? '' : 'hop-unknown'}">
                <div class="hop-number">${hopNum}</div>
                <div class="hop-details">
                    <div class="hop-ip">${escapeHtml(hop.ip)}</div>
                    ${hop.found ? `
                        <div class="hop-location">
                            📍 ${escapeHtml(hop.datacenter || hop.city || 'Unknown')}
                            ${hop.country ? `, ${escapeHtml(hop.country)}` : ''}
                        </div>
                    ` : `
                        <div class="hop-location unknown">Location unknown</div>
                    `}
                    ${hop.distanceFromPrevious ? `
                        <div class="hop-distance">
                            ➡️ ${hop.distanceFromPrevious.toFixed(1)} km from previous hop
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    traceResultContent.innerHTML = html;
    traceResultContainer.style.display = 'block';
    traceResultContainer.querySelector('.result-card').classList.remove('error');
    
    // Show map if we have coordinates
    const hopsWithCoords = data.hops.filter(h => h.latitude && h.longitude);
    if (hopsWithCoords.length > 0) {
        showTraceMap(data.hops);
    } else {
        traceMapContainer.style.display = 'none';
    }
    
    // Scroll to results
    traceResultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Show trace route error
 */
function showTraceError(message) {
    const html = `
        <div class="error-message">
            <div>${escapeHtml(message)}</div>
        </div>
    `;
    
    traceResultContent.innerHTML = html;
    traceResultContainer.style.display = 'block';
    traceResultContainer.querySelector('.result-card').classList.add('error');
    traceMapContainer.style.display = 'none';
    
    // Scroll to results
    traceResultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Display trace route on map
 */
function showTraceMap(hops) {
    traceMapContainer.style.display = 'block';
    
    // Filter hops that have coordinates
    const validHops = hops.filter(h => h.latitude && h.longitude);
    
    if (validHops.length === 0) {
        traceMapContainer.style.display = 'none';
        return;
    }
    
    // Initialize map if not already created
    if (!traceMap) {
        // Center on first hop with coordinates
        const centerLat = parseFloat(validHops[0].latitude);
        const centerLng = parseFloat(validHops[0].longitude);
        
        traceMap = L.map('traceMap').setView([centerLat, centerLng], 4);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(traceMap);
    }
    
    // Clear existing markers and lines
    traceMarkers.forEach(marker => traceMap.removeLayer(marker));
    traceLines.forEach(line => traceMap.removeLayer(line));
    traceMarkers = [];
    traceLines = [];
    
    // Create markers for each hop
    const bounds = [];
    validHops.forEach((hop, index) => {
        const lat = parseFloat(hop.latitude);
        const lng = parseFloat(hop.longitude);
        bounds.push([lat, lng]);
        
        // Create numbered marker
        const icon = L.divIcon({
            className: 'custom-marker hop-marker',
            html: `<div class="marker-pin"><span class="hop-marker-number">${index + 1}</span></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });
        
        const marker = L.marker([lat, lng], { icon: icon })
            .addTo(traceMap)
            .bindPopup(`
                <b>Hop ${index + 1}</b><br>
                IP: ${hop.ip}<br>
                ${hop.datacenter || hop.city || 'Unknown location'}<br>
                ${hop.country ? hop.country + '<br>' : ''}
                Lat: ${lat}, Lng: ${lng}
            `);
        
        traceMarkers.push(marker);
        
        // Draw line to previous hop
        if (index > 0) {
            const prevHop = validHops[index - 1];
            const prevLat = parseFloat(prevHop.latitude);
            const prevLng = parseFloat(prevHop.longitude);
            
            const line = L.polyline(
                [[prevLat, prevLng], [lat, lng]],
                {
                    color: '#0066cc',
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '10, 10'
                }
            ).addTo(traceMap);
            
            traceLines.push(line);
            
            // Add arrow decorator
            const arrow = L.polylineDecorator(line, {
                patterns: [
                    {
                        offset: '50%',
                        repeat: 0,
                        symbol: L.Symbol.arrowHead({
                            pixelSize: 12,
                            polygon: false,
                            pathOptions: {
                                stroke: true,
                                color: '#0066cc',
                                weight: 2
                            }
                        })
                    }
                ]
            }).addTo(traceMap);
            
            traceLines.push(arrow);
        }
    });
    
    // Fit map to show all hops
    if (bounds.length > 0) {
        traceMap.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Force map to refresh
    setTimeout(() => {
        traceMap.invalidateSize();
    }, 100);
}

/**
 * Hide trace route results
 */
function hideTraceResults() {
    traceResultContainer.style.display = 'none';
    traceMapContainer.style.display = 'none';
}

// ========================================
// EXPORT FUNCTIONALITY
// ========================================

/**
 * Copy trace route results to clipboard as text
 */
function copyTraceToClipboard() {
    if (!currentTraceData) return;
    
    let text = `ZSCALER TRACE ROUTE RESULTS\n`;
    text += `${'='.repeat(50)}\n\n`;
    text += `Cloud: ${currentTraceData.cloud}\n`;
    text += `Total Hops: ${currentTraceData.totalHops}\n`;
    text += `Found Hops: ${currentTraceData.foundHops}\n`;
    
    if (currentTraceData.totalDistance) {
        text += `Total Distance: ${currentTraceData.totalDistance.toFixed(1)} km (${currentTraceData.totalDistanceMiles.toFixed(1)} miles)\n`;
    }
    
    text += `\nROUTE DETAILS:\n`;
    text += `${'-'.repeat(50)}\n\n`;
    
    currentTraceData.hops.forEach((hop, index) => {
        text += `Hop ${index + 1}:\n`;
        text += `  IP: ${hop.ip}\n`;
        
        if (hop.found) {
            if (hop.datacenter) {
                text += `  Datacenter: ${hop.datacenter}\n`;
            }
            if (hop.city) {
                text += `  City: ${hop.city}\n`;
            }
            if (hop.country) {
                text += `  Country: ${hop.country}\n`;
            }
            if (hop.continent) {
                text += `  Continent: ${hop.continent}\n`;
            }
            if (hop.latitude && hop.longitude) {
                text += `  Coordinates: ${hop.latitude}, ${hop.longitude}\n`;
            }
        } else {
            text += `  Location: Unknown\n`;
        }
        
        if (hop.distanceFromPrevious) {
            text += `  Distance from previous: ${hop.distanceFromPrevious.toFixed(1)} km\n`;
        }
        
        text += `\n`;
    });
    
    text += `\nGenerated: ${new Date().toLocaleString()}\n`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        // Show success feedback
        const originalText = copyTraceBtn.textContent;
        copyTraceBtn.textContent = '✓ Copied!';
        copyTraceBtn.style.backgroundColor = '#28a745';
        
        setTimeout(() => {
            copyTraceBtn.textContent = originalText;
            copyTraceBtn.style.backgroundColor = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
}

/**
 * Export trace route results as JSON
 */
function exportTraceAsJson() {
    if (!currentTraceData) return;
    
    const dataStr = JSON.stringify(currentTraceData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `zscaler-trace-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Show success feedback
    const originalText = exportJsonBtn.textContent;
    exportJsonBtn.textContent = '✓ Downloaded!';
    exportJsonBtn.style.backgroundColor = '#28a745';
    
    setTimeout(() => {
        exportJsonBtn.textContent = originalText;
        exportJsonBtn.style.backgroundColor = '';
    }, 2000);
}

/**
 * Export trace route results as CSV
 */
function exportTraceAsCsv() {
    if (!currentTraceData) return;
    
    let csv = 'Hop,IP Address,Location,City,Country,Datacenter,Continent,Latitude,Longitude,Distance from Previous (km)\n';
    
    currentTraceData.hops.forEach((hop, index) => {
        const hopNum = index + 1;
        const ip = hop.ip || '';
        const location = hop.found ? 'Found' : 'Unknown';
        const city = hop.city || '';
        const country = hop.country || '';
        const datacenter = hop.datacenter || '';
        const continent = hop.continent || '';
        const lat = hop.latitude || '';
        const lng = hop.longitude || '';
        const distance = hop.distanceFromPrevious ? hop.distanceFromPrevious.toFixed(1) : '';
        
        csv += `${hopNum},"${ip}","${location}","${city}","${country}","${datacenter}","${continent}","${lat}","${lng}","${distance}"\n`;
    });
    
    // Add summary row
    csv += `\nSummary\n`;
    csv += `Cloud,"${currentTraceData.cloud}"\n`;
    csv += `Total Hops,${currentTraceData.totalHops}\n`;
    csv += `Found Hops,${currentTraceData.foundHops}\n`;
    
    if (currentTraceData.totalDistance) {
        csv += `Total Distance (km),${currentTraceData.totalDistance.toFixed(1)}\n`;
        csv += `Total Distance (miles),${currentTraceData.totalDistanceMiles.toFixed(1)}\n`;
    }
    
    const csvBlob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(csvBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `zscaler-trace-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Show success feedback
    const originalText = exportCsvBtn.textContent;
    exportCsvBtn.textContent = '✓ Downloaded!';
    exportCsvBtn.style.backgroundColor = '#28a745';
    
    setTimeout(() => {
        exportCsvBtn.textContent = originalText;
        exportCsvBtn.style.backgroundColor = '';
    }, 2000);
}

/**
 * Export trace route results as PNG image
 */
function exportTraceAsPng() {
    if (!currentTraceData) return;
    
    // Show loading state
    const originalText = exportPngBtn.textContent;
    exportPngBtn.textContent = '⏳ Generating...';
    exportPngBtn.disabled = true;
    
    // Get the trace result container
    const element = document.getElementById('traceResultContainer');
    
    // Use html2canvas to capture the element
    html2canvas(element, {
        scale: 2, // Higher quality
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true,
        scrollY: -window.scrollY,
        scrollX: -window.scrollX,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
    }).then(canvas => {
        // Convert canvas to blob
        canvas.toBlob(blob => {
            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `zscaler-trace-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            // Show success feedback
            exportPngBtn.textContent = '✓ Downloaded!';
            exportPngBtn.style.backgroundColor = '#28a745';
            exportPngBtn.disabled = false;
            
            setTimeout(() => {
                exportPngBtn.textContent = originalText;
                exportPngBtn.style.backgroundColor = '';
            }, 2000);
        });
    }).catch(error => {
        console.error('PNG export error:', error);
        alert('Failed to export PNG. Please try again.');
        exportPngBtn.textContent = originalText;
        exportPngBtn.disabled = false;
    });
}
