// -----------------------------
// City data for location feature
// -----------------------------
const cities = [
    { city: "San Diego", country: "USA", lat: 32.7157, lon: -117.1611, base: 8, future: 68 },
    { city: "Los Angeles", country: "USA", lat: 34.0522, lon: -118.2437, base: 14, future: 85 },
    { city: "San Francisco", country: "USA", lat: 37.7749, lon: -122.4194, base: 4, future: 38 },
    { city: "Sacramento", country: "USA", lat: 38.5816, lon: -121.4944, base: 28, future: 115 },
    { city: "Fresno", country: "USA", lat: 36.7378, lon: -119.7871, base: 45, future: 145 },
    { city: "Palm Springs", country: "USA", lat: 33.8303, lon: -116.5453, base: 95, future: 190 },
    { city: "San Jose", country: "USA", lat: 37.3382, lon: -121.8863, base: 12, future: 72 },
    { city: "Riverside", country: "USA", lat: 33.9806, lon: -117.3755, base: 42, future: 138 },
    { city: "Bakersfield", country: "USA", lat: 35.3733, lon: -119.0187, base: 55, future: 158 },
    { city: "Irvine", country: "USA", lat: 33.6846, lon: -117.8265, base: 15, future: 80 }
];

function makeCityTimeline(city) {
    const years = d3.range(1950, 2101, 5);

    return years.map(year => {
        let extremeDays;

        if (year <= 2014) {
            const progress = (year - 1950) / (2014 - 1950);
            extremeDays = city.base + progress * 10;
        } else {
            const progress = (year - 2015) / (2100 - 2015);
            extremeDays = city.base + 10 + progress * (city.future - city.base);
        }

        return {
            city: city.city,
            country: city.country,
            lat: city.lat,
            lon: city.lon,
            year: year,
            extreme_days: Math.round(extremeDays),
            experiment: year <= 2014 ? "historical" : "ssp585"
        };
    });
}

const fullData = cities.flatMap(makeCityTimeline);
let selectedCity = "San Diego";
let heatCircle = null;


// -----------------------------
// Map setup
// -----------------------------
const map = L.map("map").setView([36.7783, -119.4179], 6);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
}).addTo(map);

const cityMarkers = L.layerGroup().addTo(map);


// -----------------------------
// Main chart setup
// -----------------------------
const margin = { top: 30, right: 30, bottom: 50, left: 65 };
const chartWidth = 750 - margin.left - margin.right;
const chartHeight = 420 - margin.top - margin.bottom;

const svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${chartWidth + margin.left + margin.right} ${chartHeight + margin.top + margin.bottom}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear().range([0, chartWidth]);
const y = d3.scaleLinear().range([chartHeight, 0]);

const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.extreme_days));

const xAxis = svg.append("g")
    .attr("transform", `translate(0,${chartHeight})`);

const yAxis = svg.append("g");

svg.append("text")
    .attr("x", chartWidth / 2)
    .attr("y", chartHeight + 42)
    .attr("text-anchor", "middle")
    .text("Year");

svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -48)
    .attr("x", -chartHeight / 2)
    .attr("text-anchor", "middle")
    .text("Extreme Heat Days");

const historicalPath = svg.append("path")
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 3);

const futurePath = svg.append("path")
    .attr("fill", "none")
    .attr("stroke", "#b30000")
    .attr("stroke-width", 3);


// -----------------------------
// City dropdown
// -----------------------------
function setupCityDropdown() {
    d3.select("#city-select")
        .selectAll("option")
        .data(cities)
        .join("option")
        .text(d => d.city)
        .attr("value", d => d.city);

    d3.select("#city-select")
        .property("value", selectedCity)
        .on("change", function () {
            selectedCity = this.value;
            updateForCity(selectedCity);
        });
}


// -----------------------------
// City map markers
// -----------------------------
function showAllCitiesOnMap() {
    cityMarkers.clearLayers();

    cities.forEach(d => {
        L.circleMarker([d.lat, d.lon], {
            radius: 6,
            color: "white",
            weight: 1,
            fillColor: "#f97316",
            fillOpacity: 0.85
        })
        .addTo(cityMarkers)
        .bindPopup(`<b>${d.city}, ${d.country}</b>`)
        .on("click", () => {
            selectedCity = d.city;
            d3.select("#city-select").property("value", selectedCity);
            updateForCity(selectedCity);
        });
    });
}


// -----------------------------
// Update selected city
// -----------------------------
function updateForCity(cityName) {
    const cityData = fullData
        .filter(d => d.city === cityName)
        .sort((a, b) => a.year - b.year);

    const cityInfo = cityData[0];

    map.setView([cityInfo.lat, cityInfo.lon], 8);

    const minYear = d3.min(cityData, d => d.year);
    const maxYear = d3.max(cityData, d => d.year);
    const maxDays = d3.max(cityData, d => d.extreme_days);

    x.domain([minYear, maxYear]);
    y.domain([0, maxDays + 10]).nice();

    xAxis.call(d3.axisBottom(x).tickFormat(d3.format("d")));
    yAxis.call(d3.axisLeft(y));

    d3.select("#year-slider")
        .attr("min", minYear)
        .attr("max", maxYear)
        .attr("value", minYear);

    updateVisuals(minYear);
    updateCityInsight(cityName, cityData);
}


// -----------------------------
// Update chart and heat circle
// -----------------------------
function updateVisuals(currentYear) {
    currentYear = +currentYear;

    d3.select("#year-display").text(currentYear);

    const cityData = fullData
        .filter(d => d.city === selectedCity)
        .sort((a, b) => a.year - b.year);

    const visibleData = cityData.filter(d => d.year <= currentYear);
    const historicalData = visibleData.filter(d => d.experiment === "historical");
    const futureData = visibleData.filter(d => d.experiment === "ssp585");

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
        color: "none",
        fillColor: colorScale(currentData.extreme_days),
        fillOpacity: 0.55,
        radius: radiusScale(currentData.extreme_days)
    }).addTo(map);

    heatCircle.bindPopup(`
        <b>${currentData.city}, ${currentData.country}</b><br>
        Year: ${currentData.year}<br>
        Extreme Heat Days: ${currentData.extreme_days}<br>
        Experiment: ${currentData.experiment}
    `);
}


// -----------------------------
// City explanation text
// -----------------------------
function updateCityInsight(cityName, cityData) {
    const first = cityData[0].extreme_days;
    const last = cityData[cityData.length - 1].extreme_days;
    const increase = last - first;

    d3.select("#city-insight").html(`
        <strong>${cityName} takeaway:</strong>
        In this projection, annual extreme heat days rise from about
        <strong>${first}</strong> days in 1950 to about
        <strong>${last}</strong> days by 2100. This is an increase of roughly
        <strong>${increase}</strong> additional extreme heat days, showing how local heat exposure becomes more intense under a high-emissions future.
    `);
}


// -----------------------------
// Slider behavior
// -----------------------------
d3.select("#year-slider").on("input", function () {
    updateVisuals(this.value);
});


// -----------------------------
// Moderate emissions chart
// -----------------------------
const moderateData = [
    { year: 2020, ssp245: 18, ssp585: 19 },
    { year: 2030, ssp245: 24, ssp585: 29 },
    { year: 2040, ssp245: 31, ssp585: 43 },
    { year: 2050, ssp245: 38, ssp585: 61 },
    { year: 2060, ssp245: 44, ssp585: 82 },
    { year: 2070, ssp245: 49, ssp585: 104 },
    { year: 2080, ssp245: 53, ssp585: 126 },
    { year: 2090, ssp245: 56, ssp585: 145 },
    { year: 2100, ssp245: 58, ssp585: 162 }
];

function drawModerateEmissionsChart() {
    const margin = { top: 40, right: 130, bottom: 50, left: 70 };
    const width = 850 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    const svg = d3.select("#moderate-emissions-chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(moderateData, d => d.year))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(moderateData, d => Math.max(d.ssp245, d.ssp585))])
        .nice()
        .range([height, 0]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g").call(d3.axisLeft(y));

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .text("Year");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .text("Annual extreme heat days");

    const line245 = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.ssp245));

    const line585 = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.ssp585));

    svg.append("path")
        .datum(moderateData)
        .attr("fill", "none")
        .attr("stroke", "#f4a261")
        .attr("stroke-width", 3)
        .attr("d", line245);

    svg.append("path")
        .datum(moderateData)
        .attr("fill", "none")
        .attr("stroke", "#d62828")
        .attr("stroke-width", 3)
        .attr("d", line585);

    svg.append("text")
        .attr("x", x(2100) + 8)
        .attr("y", y(58))
        .attr("dominant-baseline", "middle")
        .text("SSP245 Moderate");

    svg.append("text")
        .attr("x", x(2100) + 8)
        .attr("y", y(162))
        .attr("dominant-baseline", "middle")
        .text("SSP585 High");

    svg.append("text")
        .attr("x", x(2060))
        .attr("y", y(105))
        .attr("font-weight", "bold")
        .text("The action gap");
}


// -----------------------------
// Emissions impact chart
// -----------------------------
const impactData = [
    { category: "Extreme heat days avoided", value: 104 },
    { category: "Lower warming trajectory", value: 65 },
    { category: "Reduced health exposure", value: 58 },
    { category: "Less infrastructure stress", value: 47 }
];

function drawEmissionsImpactChart() {
    const margin = { top: 30, right: 70, bottom: 50, left: 210 };
    const width = 850 - margin.left - margin.right;
    const height = 360 - margin.top - margin.bottom;

    const svg = d3.select("#emissions-impact-chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([0, d3.max(impactData, d => d.value)])
        .nice()
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(impactData.map(d => d.category))
        .range([0, height])
        .padding(0.25);

    svg.append("g").call(d3.axisLeft(y));

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.selectAll("rect")
        .data(impactData)
        .join("rect")
        .attr("y", d => y(d.category))
        .attr("height", y.bandwidth())
        .attr("x", 0)
        .attr("width", d => x(d.value))
        .attr("fill", "#2a9d8f");

    svg.selectAll(".impact-label")
        .data(impactData)
        .join("text")
        .attr("class", "impact-label")
        .attr("x", d => x(d.value) + 8)
        .attr("y", d => y(d.category) + y.bandwidth() / 2)
        .attr("dominant-baseline", "middle")
        .text(d => d.value);
}


// -----------------------------
// Initialize everything
// -----------------------------
setupCityDropdown();
showAllCitiesOnMap();
updateForCity(selectedCity);
drawModerateEmissionsChart();
drawEmissionsImpactChart();