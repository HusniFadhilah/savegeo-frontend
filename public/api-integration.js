/**
 * API Integration for GEE Analysis Frontend
 * Connects HTML/jQuery frontend to Flask backend
 */

// Configuration
const API_CONFIG = {
    baseURL: 'http://localhost:8086/api',
    timeout: 120000, // 2 minutes
    retries: 3
};

// API Client Class
class GEEApiClient {
    constructor(baseURL = API_CONFIG.baseURL) {
        this.baseURL = baseURL;
        this.timeout = API_CONFIG.timeout;
    }

    /**
     * Make API request with error handling and retries
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: this.timeout
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await $.ajax({
                url: url,
                method: config.method || 'GET',
                data: config.data ? JSON.stringify(config.data) : undefined,
                contentType: config.headers['Content-Type'],
                timeout: config.timeout,
                dataType: 'json'
            });

            return { success: true, data: response };
        } catch (error) {
            console.error('API Request Error:', error);
            return {
                success: false,
                error: error.responseJSON?.error || error.statusText || 'Network error'
            };
        }
    }

    /**
     * Health check
     */
    async healthCheck() {
        return await this.request('/health');
    }

    /**
     * Get list of provinces
     */
    async getProvinces() {
        return await this.request('/regions/provinces');
    }

    /**
     * Get cities for a province
     */
    async getCities(provinceCode) {
        return await this.request(`/regions/cities?province_code=${provinceCode}`);
    }

    /**
     * Get region geometry
     */
    async getRegionGeometry(endpoint, code) {
        return await this.request(`/regions/geometry?endpoint=${endpoint}&code=${code}`);
    }

    /**
     * Analyze vegetation indices
     */
    async analyzeVegetation(params) {
        return await this.request('/analyze/vegetation', {
            method: 'POST',
            data: params
        });
    }

    /**
     * Analyze land cover
     */
    async analyzeLandCover(params) {
        return await this.request('/analyze/landcover', {
            method: 'POST',
            data: params
        });
    }

    /**
     * Analyze time series
     */
    async analyzeTimeSeries(params) {
        return await this.request('/timeseries', {
            method: 'POST',
            data: params
        });
    }

    /**
     * Export to Google Drive
     */
    async exportToDrive(params) {
        return await this.request('/export', {
            method: 'POST',
            data: params
        });
    }
}

// Create global API client instance
const apiClient = new GEEApiClient();

// Update the existing code to use real API calls
// Replace the existing functions in the HTML file

/**
 * Load provinces from API
 */
async function loadProvincesFromAPI() {
    showLoading('Loading provinces...', 'Fetching data from server');

    const response = await apiClient.getProvinces();

    hideLoading();

    if (response.success) {
        const provinceSelect = $('#provinceSelect');
        provinceSelect.html('<option value="">-- Select Province --</option>');

        for (const [name, code] of Object.entries(response.data)) {
            provinceSelect.append(`<option value="${code}">${name}</option>`);
        }

        return response.data;
    } else {
        showAlert('Failed to load provinces: ' + response.error, 'danger');
        return {};
    }
}

/**
 * Load cities from API
 */
async function loadCitiesFromAPI(provinceCode) {
    showLoading('Loading cities...', 'Fetching data from server');

    const response = await apiClient.getCities(provinceCode);

    hideLoading();

    if (response.success) {
        const citySelect = $('#citySelect');
        citySelect.html('<option value="">-- Select City --</option>');
        citySelect.append('<option value="use_province">-- Use Province --</option>');

        for (const [name, code] of Object.entries(response.data)) {
            citySelect.append(`<option value="${code}">${name}</option>`);
        }

        return response.data;
    } else {
        showAlert('Failed to load cities: ' + response.error, 'danger');
        return {};
    }
}

/**
 * Load region geometry from API
 */
async function loadRegionGeometryFromAPI(endpoint, code) {
    showLoading('Loading region geometry...', 'Fetching boundary data');

    const response = await apiClient.getRegionGeometry(endpoint, code);

    hideLoading();

    if (response.success && response.data) {
        // Process GeoJSON and add to map
        const geojson = response.data;

        drawnItems.clearLayers();
        const geoJsonLayer = L.geoJSON(geojson, {
            style: {
                color: 'blue',
                fillOpacity: 0.3
            }
        });

        geoJsonLayer.addTo(drawnItems);
        map.fitBounds(geoJsonLayer.getBounds());

        // Calculate area
        const bounds = geoJsonLayer.getBounds();
        const area = calculateAreaFromBounds(bounds);

        currentAOI = {
            type: 'admin',
            name: $('#citySelect option:selected').text() || $('#provinceSelect option:selected').text(),
            geometry: bounds,
            area: area,
            geojson: geojson
        };

        showAOIInfo();
        showAlert('Region loaded successfully!', 'success');

        return geojson;
    } else {
        showAlert('Failed to load region geometry: ' + (response.error || 'Unknown error'), 'danger');
        return null;
    }
}

/**
 * Run vegetation analysis with real API
 */
async function runVegetationAnalysisAPI() {
    if (!currentAOI) {
        showAlert('Please select an AOI first', 'warning');
        return null;
    }

    showLoading('Analyzing vegetation indices...', 'Processing Sentinel-2 imagery');

    const params = {
        aoi: {
            west: currentAOI.geometry.getWest(),
            south: currentAOI.geometry.getSouth(),
            east: currentAOI.geometry.getEast(),
            north: currentAOI.geometry.getNorth()
        },
        year: parseInt($('#yearValue').text()),
        start_month: parseInt($('#startMonth').val()),
        end_month: parseInt($('#endMonth').val()),
        cloud_threshold: parseInt($('#cloudValue').text()),
        indices: selectedIndices
    };

    const response = await apiClient.analyzeVegetation(params);

    hideLoading();

    if (response.success) {
        showAlert(`Analysis complete! Found ${response.data.collection_size} images`, 'success');
        return response.data;
    } else {
        showAlert('Vegetation analysis failed: ' + response.error, 'danger');
        return null;
    }
}

/**
 * Run land cover analysis with real API
 */
async function runLandCoverAnalysisAPI() {
    if (!currentAOI) {
        showAlert('Please select an AOI first', 'warning');
        return null;
    }

    showLoading('Analyzing land cover...', 'Processing land cover datasets');

    const datasets = [];
    if ($('#dynamicWorld').is(':checked')) datasets.push('Dynamic_World');
    if ($('#esaWorld').is(':checked')) datasets.push('ESA_WorldCover');
    if ($('#esriLand').is(':checked')) datasets.push('ESRI_LandCover');

    const params = {
        aoi: {
            west: currentAOI.geometry.getWest(),
            south: currentAOI.geometry.getSouth(),
            east: currentAOI.geometry.getEast(),
            north: currentAOI.geometry.getNorth()
        },
        year: parseInt($('#yearValue').text()),
        datasets: datasets,
        dw_mode: $('#dwMode').val()
    };

    const response = await apiClient.analyzeLandCover(params);

    hideLoading();

    if (response.success) {
        showAlert('Land cover analysis complete!', 'success');
        return response.data;
    } else {
        showAlert('Land cover analysis failed: ' + response.error, 'danger');
        return null;
    }
}

/**
 * Run complete analysis (vegetation + land cover)
 */
async function runCompleteAnalysis() {
    if (!currentAOI) {
        showAlert('Please select an AOI first', 'warning');
        return;
    }

    const analysisType = $('#analysisType').val();
    analysisResults = {};

    try {
        // Run vegetation analysis
        if (analysisType === 'vegetation' || analysisType === 'combined') {
            const vegData = await runVegetationAnalysisAPI();
            if (vegData) {
                analysisResults.vegetation = vegData.indices;
                analysisResults.rgb_tile_url = vegData.rgb_tile_url;
                analysisResults.collection_size = vegData.collection_size;
            }
        }

        // Run land cover analysis
        if (analysisType === 'landcover' || analysisType === 'combined') {
            const lcData = await runLandCoverAnalysisAPI();
            if (lcData) {
                analysisResults.landcover = lcData;
            }
        }

        // Display results if we have any
        if (Object.keys(analysisResults).length > 0) {
            displayResults();

            // Scroll to results
            $('html, body').animate({
                scrollTop: $('#resultsSection').offset().top - 100
            }, 500);
        }

    } catch (error) {
        console.error('Analysis error:', error);
        showAlert('An error occurred during analysis', 'danger');
    }
}

/**
 * Display results with tile layers from GEE
 */
function displayResultsWithTiles() {
    $('#resultsSection').slideDown();

    // Create result tabs
    createResultTabsWithTiles();

    // Initialize result map with GEE tile layers
    initializeResultMapWithTiles();

    // Display statistics
    displayStatistics();

    // Create charts
    createCharts();
}

/**
 * Initialize result map with GEE tile layers
 */
function initializeResultMapWithTiles() {
    if (resultMap) {
        resultMap.remove();
    }

    const center = currentAOI.geometry.getCenter();
    resultMap = L.map('resultMap').setView([center.lat, center.lng], parseInt($('#zoomValue').text()));

    // Base layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri, Maxar, Earthstar Geographics'
    }).addTo(resultMap);

    // Add AOI boundary
    L.rectangle(currentAOI.geometry, {
        color: 'red',
        weight: 2,
        fillOpacity: 0.1
    }).addTo(resultMap);

    // Add GEE tile layers
    if (analysisResults.rgb_tile_url) {
        L.tileLayer(analysisResults.rgb_tile_url, {
            attribution: '© Google Earth Engine',
            maxZoom: 18
        }).addTo(resultMap);
    }

    // Add legends
    addLegendToMap();
}

/**
 * Download statistics with real data
 */
function downloadStatisticsReal() {
    const stats = {
        analysis_date: new Date().toISOString(),
        region: currentAOI.name,
        area_km2: currentAOI.area,
        year: $('#yearValue').text(),
        analysis_type: $('#analysisType').val(),
        parameters: {
            date_range: {
                start_month: $('#startMonth').val(),
                end_month: $('#endMonth').val()
            },
            cloud_threshold: $('#cloudValue').text()
        },
        results: analysisResults
    };

    const dataStr = JSON.stringify(stats, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gee_analysis_${currentAOI.name.replace(/\s+/g, '_')}_${new Date().getTime()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    showAlert('Statistics downloaded successfully!', 'success');
}

/**
 * Test API connection on page load
 */
$(document).ready(async function () {
    // Test backend connection
    const health = await apiClient.healthCheck();

    if (health.success && health.data.ee_initialized) {
        console.log('✓ Backend connected and Earth Engine initialized');
        showAlert('Connected to GEE Backend', 'success');
    } else {
        console.error('✗ Backend connection failed');
        showAlert('Warning: Backend not connected. Using demo mode.', 'warning');
    }

    // Load provinces
    await loadProvincesFromAPI();
});

// Export for use in HTML
window.GEEApi = {
    client: apiClient,
    loadProvinces: loadProvincesFromAPI,
    loadCities: loadCitiesFromAPI,
    loadRegionGeometry: loadRegionGeometryFromAPI,
    runVegetationAnalysis: runVegetationAnalysisAPI,
    runLandCoverAnalysis: runLandCoverAnalysisAPI,
    runCompleteAnalysis: runCompleteAnalysis,
    displayResultsWithTiles: displayResultsWithTiles,
    downloadStatistics: downloadStatisticsReal
};

/**
 * Update event handlers to use real API
 */
function updateEventHandlersForAPI() {
    // Province selection
    $('#provinceSelect').off('change').on('change', async function () {
        const provinceCode = $(this).val();
        if (provinceCode) {
            await loadCitiesFromAPI(provinceCode);
            $('#citySelect').prop('disabled', false);
        } else {
            $('#citySelect').prop('disabled', true).html('<option value="">-- Select City --</option>');
        }
    });

    // Load Region button
    $('#loadRegion').off('click').on('click', async function () {
        const provinceCode = $('#provinceSelect').val();
        const cityCode = $('#citySelect').val();

        if (!provinceCode) {
            showAlert('Please select a province', 'warning');
            return;
        }

        let endpoint, code, name;

        if (cityCode && cityCode !== 'use_province') {
            endpoint = 'city';
            code = cityCode;
            name = $('#citySelect option:selected').text();
        } else {
            endpoint = 'province';
            code = provinceCode;
            name = $('#provinceSelect option:selected').text();
        }

        await loadRegionGeometryFromAPI(endpoint, code);
    });

    // Run Analysis button
    $('#runAnalysis').off('click').on('click', async function () {
        await runCompleteAnalysis();
    });

    // Download Statistics button
    $('#downloadStats').off('click').on('click', function () {
        downloadStatisticsReal();
    });
}

// Initialize on DOM ready
$(document).ready(function () {
    updateEventHandlersForAPI();
    console.log('API Integration loaded and ready');
});
