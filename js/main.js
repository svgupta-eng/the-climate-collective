// 1. Initialize the Map
const map = L.map('map').setView([20, 0], 2); // Whole map view

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

const cityMarkers = L.layerGroup().addTo(map); 

let heatCircle = null;

// 2. Chart setup
const margin = {top: 30, right: 30, bottom: 50, left: 65};
const chartWidth = 750 - margin.left - margin.right;
const chartHeight = 420 - margin.top - margin.bottom;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", chartWidth + margin.left + margin.right)
    .attr("height", chartHeight + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear().range([0, chartWidth]);
const y = d3.scaleLinear().range([chartHeight, 0]);

const line = d3.line().x(d => x(d.year)).y(d => y(d.extreme_days));
const xAxis = svg.append("g").attr("transform", `translate(0,${chartHeight})`);
const yAxis = svg.append("g");

svg.append("text")
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + 42)
    .attr('text-anchor', 'middle')
    .text('Year');

svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -48)
    .attr("x", -chartHeight / 2)
    .attr("text-anchor", "middle")
    .text("Extreme Heat Days");

const historicalPath = svg.append("path").attr("fill", "none").attr("stroke", "steelblue").attr("stroke-width", 3);
const futurePath = svg.append("path").attr("fill", "none").attr("stroke", "#b30000").attr("stroke-width", 3);


// 3. Load Data and Initialize Interactive Elements
let fullData;
let selectedCity;

d3.json("data/extreme_heat_days.json").then(data => {
    fullData = data;

    fullData.forEach(d => {
        d.year = +d.year;
        d.extreme_days = +d.extreme_days;
        d.lat = +d.lat;
        d.lon = +d.lon;
    });

    setupCityDropdown();
    showAllCitiesOnMap();

    selectedCity = fullData[0].city;
    d3.select('#city-select').property('value', selectedCity);

    updateForCity(selectedCity);
});

// 4. Dropdown
function setupCityDropdown() {
    const cities = Array.from(new Set(fullData.map(d => d.city))).sort();
    d3.select("#city-select")
        .selectAll("option")
        .data(cities)
        .join("option")
        .text(d => d)
        .attr("value", d => d);
    d3.select("#city-select").on("change", function() {
        selectedCity = this.value;
        updateForCity(selectedCity);
    });
}

// 5. City Markers
function showAllCitiesOnMap() {
    cityMarkers.clearLayers();
    const oneRowPerCity = Array.from(
        d3.group(fullData, d => d.city),
        ([city, rows]) => rows[0]       
    );

    oneRowPerCity.forEach(d => {
        L.circleMarker([d.lat, d.lon], {
            radius: 5,
            fillColor: "white",
            weight: 1,
            fillColor: '#f97316',
            fillOpacity: 0.8
        }).addTo(cityMarkers)
          .bindPopup(`<b>${d.city}, ${d.country}</b><br>`)
          .on('click', () => {
                selectedCity = d.city;
                d3.select('#city-select').property('value', selectedCity);
                updateForCity(selectedCity);
            });
    });
}

// 6. Update selected city
function updateForCity(cityName) {
    const cityData = fullData
        .filter(d => d.city === cityName)
        .sort((a, b) => a.year - b.year);
    
    const cityInfo = cityData[0];

    map.setView([cityInfo.lat, cityInfo.lon], 5)
    
    const minYear = d3.min(cityData, d => d.year);
    const maxYear = d3.max(cityData, d => d.year);
    const maxDays = d3.max(cityData, d => d.extreme_days);

    x.domain([minYear, maxYear]);
    y.domain([0, maxDays + 5]).nice();

    xAxis.call(d3.axisBottom(x).tickFormat(d3.format("d")));
    yAxis.call(d3.axisLeft(y));

    d3.select('#year-slider')
        .attr('min', minYear)
        .attr('max', maxYear)
        .attr('value', minYear)
        
    updateVisuals(minYear);
}

// 3. Update chart and heat circle
function updateVisuals(currentYear) {
    currentYear = +currentYear;
    
    d3.select('#year-display').text(currentYear);

    const cityData = fullData
        .filter(d => d.city === selectedCity)
        .sort((a, b) => a.year - b.year);

    const visibleData = cityData.filter(d => d.year <= currentYear);

    const historicalData = visibleData.filter(d => d.experiment === 'historical');
    const futureData = visibleData.filter(d => d.experiment === 'ssp585');

    historicalPath.datum(historicalData).attr("d", line);
    futurePath.datum(futureData).attr("d", line);

    const currentData = cityData.find(d => d.year === currentYear);

    if (!currentData) return;

    const maxDays = d3.max(cityData, d => d.extreme_days);

    const colorScale = d3.scaleLinear()
        .domain([0, maxDays])
        .range(["#fee08b", "#b30000"]);

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxDays])
        .range([5000, 90000]);

    if (heatCircle) {
        map.removeLayer(heatCircle);
    }

    heatCircle = L.circle([currentData.lat, currentData.lon], {
        color: none,
        fillColor: colorScale(currentData.extreme_days),
        fillOpacity: 0.55,
        radius: radiusScale(currentData.extreme_days)
    }).addTo(map)

    heatCircle.bindPopup(`
        <b>${currentData.city}, ${currentData.country}</b><br>
        Year: ${currentData.year}<br>
        Extreme Heat Days: ${currentData.extreme_days}<br>
        Experiment: ${currentData.experiment}
    `);
}

// 8. Slider 
d3.select('#year-slider').on('input', function() {
    updateVisuals(this.value);
});