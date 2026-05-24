// 1. Initialize the Map
const map = L.map('map').setView([32.8801, -117.2340], 12); // Centered on UCSD

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

L.marker([32.8801, -117.2340]).addTo(map).bindPopup('<b>UCSD Campus</b>');

const heatCircle = L.circle([32.8801, -117.2340], {
    color: 'none',
    fillColor: '#fee08b',
    fillOpacity: 0.2,
    radius: 4000 
}).addTo(map);


// 2. Load Data and Initialize Interactive Elements
d3.json("data/ucsd_temperature.json").then(fullData => {
    
    // --- MAP LEGEND ---
    const minTemp = d3.min(fullData, d => d.tas_f);
    const maxTemp = d3.max(fullData, d => d.tas_f);

    const legend = L.control({position: 'bottomright'});
    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
            <strong style="display:block; margin-bottom: 5px;">Temperature (°F)</strong>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
                <span>${minTemp.toFixed(1)}</span>
                <span>${maxTemp.toFixed(1)}</span>
            </div>
            <div style="width: 150px; height: 15px; background: linear-gradient(to right, #fee08b, #b30000); border: 1px solid #ccc; border-radius: 3px;"></div>
        `;
        return div;
    };
    legend.addTo(map);

    // --- D3 CHART SETUP ---
    const margin = {top: 20, right: 30, bottom: 40, left: 50};
    const width = document.getElementById('chart').clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(fullData, d => d.year))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([minTemp - 1, maxTemp + 1])
        .range([height, 0]);

    const colorScale = d3.scaleLinear()
        .domain([minTemp, maxTemp])
        .range(["#fee08b", "#b30000"]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));
    svg.append("g").call(d3.axisLeft(y));

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Temperature (°F)");

    const line = d3.line().x(d => x(d.year)).y(d => y(d.tas_f));

    const histPath = svg.append("path").attr("fill", "none").attr("stroke", "steelblue").attr("stroke-width", 2);
    const futPath = svg.append("path").attr("fill", "none").attr("stroke", "#b30000").attr("stroke-width", 2);

    // --- TOOLTIP SETUP ---
    const tooltip = d3.select("body").append("div").attr("class", "chart-tooltip");
    
    // Group for the vertical hover line and dot
    const focus = svg.append("g").style("display", "none");
    focus.append("line").attr("class", "hover-line").attr("y1", 0).attr("y2", height).style("stroke", "#999").style("stroke-dasharray", "3,3");
    focus.append("circle").attr("class", "hover-circle").attr("r", 5);

    // Invisible rectangle to catch mouse movements
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => focus.style("display", null))
        .on("mouseout", () => {
            focus.style("display", "none");
            tooltip.style("opacity", 0);
        })
        .on("mousemove", mousemove);

    const bisectYear = d3.bisector(d => d.year).left;

    function mousemove(event) {
        // Only allow hovering over data that is currently revealed by the slider
        const currentSliderYear = parseInt(d3.select("#year-slider").property("value"));
        const visibleData = fullData.filter(d => d.year <= currentSliderYear);
        
        if (visibleData.length === 0) return;

        const x0 = x.invert(d3.pointer(event)[0]);
        const i = bisectYear(visibleData, x0, 1);
        const d0 = visibleData[i - 1];
        const d1 = visibleData[i];
        
        // Find the closest data point to the mouse
        let d = d0;
        if (d1 && (x0 - d0.year > d1.year - x0)) {
            d = d1;
        }

        // Move the line and circle to the exact data point
        focus.select(".hover-line").attr("transform", `translate(${x(d.year)}, 0)`);
        focus.select(".hover-circle")
            .attr("transform", `translate(${x(d.year)}, ${y(d.tas_f)})`)
            .attr("fill", d.experiment === 'historical' ? "steelblue" : "#b30000");

        // Populate and position the tooltip
        tooltip.transition().duration(50).style("opacity", 1);
        tooltip.html(`
            <strong>Year:</strong> ${d.year} <br>
            <strong>Temp:</strong> ${d.tas_f.toFixed(1)} °F <br>
            <strong>Location:</strong> UCSD Campus
        `)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
    }

    // --- THE UPDATE FUNCTION (Timeline Slider) ---
    function updateVisuals(currentYear) {
        const yearDisplay = d3.select("#year-display");
        yearDisplay.text(currentYear);
        
        if (currentYear <= 2014) {
            yearDisplay.style("color", "steelblue");
        } else {
            yearDisplay.style("color", "#b30000");
        }

        const visibleData = fullData.filter(d => d.year <= currentYear);
        const histData = visibleData.filter(d => d.experiment === 'historical');
        const futData = visibleData.filter(d => d.experiment === 'ssp585');

        histPath.datum(histData).attr("d", line);
        futPath.datum(futData).attr("d", line);

        const currentYearData = fullData.find(d => d.year == currentYear);
        if (currentYearData) {
            const currentTemp = currentYearData.tas_f;
            heatCircle.setStyle({
                fillColor: colorScale(currentTemp),
                fillOpacity: 0.6 
            });
            
            const sizeScale = d3.scaleLinear()
                .domain([minTemp, maxTemp])
                .range([3000, 6000]); 
            
            heatCircle.setRadius(sizeScale(currentTemp));
        }
    }

    // Hook up the slider
    const slider = d3.select("#year-slider");
    const minYear = d3.min(fullData, d => d.year);
    const maxYear = d3.max(fullData, d => d.year);
    
    slider.attr("min", minYear)
          .attr("max", maxYear)
          .attr("value", minYear);

    slider.on("input", function() {
        updateVisuals(this.value);
        // Hide tooltip while dragging the slider to prevent visual clutter
        focus.style("display", "none");
        tooltip.style("opacity", 0);
    });

    updateVisuals(minYear);
});