let width = 460;
let height = 460;
let margin = 35;

let svg = d3
  .select("svg#scatterplot")
  .attr("width", width)
  .attr("height", height)
  .style("background", "#e9e9e9");

let datasetSelect = d3.select("#dataset");
let clusterInput = d3.select("#n_clusters");
let stepText = d3.select("#step");
let backButton = d3.select("#back");
let runButton = d3.select("#run");
let forwardButton = d3.select("#forward");
let resetButton = d3.select("#reset");

let controlDiv = d3.select("#control");

let centroidSection = controlDiv
  .append("div")
  .attr("id", "centroid-section")
  .style("margin-top", "14px");

let currentState = {
  dataset: datasetSelect.property("value"),
  n_clusters: +clusterInput.property("value"),
  points: [],
  centroids: [],
  step: 0,
  converged: false,
};

let xScale = d3.scaleLinear();
let yScale = d3.scaleLinear();

const colors = [
  "#4E79A7",
  "#F28E2B",
  "#E15759",
  "#76B7B2",
  "#59A14F",
  "#EDC948",
  "#B07AA1",
  "#FF9DA7",
  "#9C755F",
  "#BAB0AC",
];

bindControls();
initializePage();

function initializePage() {
  load_and_plot(`${currentState.dataset}.csv`);
}

function load_and_plot(filename) {
  d3.csv(`static/datasets/${filename}`, d3.autoType).then((data) => {
    currentState.points = data.map((d) => ({
      x: d.x,
      y: d.y,
      label: null,
    }));

    currentState.step = 0;
    currentState.converged = false;
    stepText.text(currentState.step);

    initializeRandomCentroids();
    assignLabelsFromCurrentCentroids();
    updateScales();
    renderAll();
  });
}

function initializeRandomCentroids() {
  let shuffled = d3.shuffle([...currentState.points]);
  currentState.centroids = shuffled
    .slice(0, currentState.n_clusters)
    .map((d) => ({ x: d.x, y: d.y }));
}

function assignLabelsFromCurrentCentroids() {
  currentState.points.forEach((p) => {
    let bestLabel = 0;
    let bestDist = Infinity;

    currentState.centroids.forEach((c, i) => {
      let dx = p.x - c.x;
      let dy = p.y - c.y;
      let dist = dx * dx + dy * dy;

      if (dist < bestDist) {
        bestDist = dist;
        bestLabel = i;
      }
    });

    p.label = bestLabel;
  });
}

function bindControls() {
  datasetSelect.on("change", function () {
    currentState.dataset = this.value;
    load_and_plot(`${currentState.dataset}.csv`);
  });

  clusterInput.on("change", function () {
    let value = +this.value;
    value = Math.max(2, Math.min(5, value));
    this.value = value;

    currentState.n_clusters = value;
    load_and_plot(`${currentState.dataset}.csv`);
  });

  resetButton.on("click", function () {
    load_and_plot(`${currentState.dataset}.csv`);
  });

  forwardButton.on("click", async function () {
    syncCentroidsFromInputs();

    let response = await post("/step_forward", {
      dataset: currentState.dataset,
      n_clusters: currentState.n_clusters,
      points: currentState.points,
      centroids: currentState.centroids,
      step: currentState.step,
    });

    applyServerState(response);
    renderAll();
  });

  backButton.on("click", async function () {
    let response = await post("/step_back", {
      dataset: currentState.dataset,
      n_clusters: currentState.n_clusters,
      step: currentState.step,
    });

    applyServerState(response);
    renderAll();
  });

  runButton.on("click", async function () {
    syncCentroidsFromInputs();

    let response = await post("/run", {
      dataset: currentState.dataset,
      n_clusters: currentState.n_clusters,
      points: currentState.points,
      centroids: currentState.centroids,
      step: currentState.step,
    });

    applyServerState(response);
    renderAll();
  });
}

function applyServerState(serverData) {
  currentState.points = serverData.points || currentState.points;
  currentState.centroids = serverData.centroids || currentState.centroids;
  currentState.step = serverData.step ?? currentState.step;
  currentState.converged = serverData.converged ?? false;

  stepText.text(currentState.step);
  updateScales();
}

function syncCentroidsFromInputs() {
  let updated = [];

  for (let i = 0; i < currentState.n_clusters; i++) {
    let x = +d3.select(`#centroid-x-${i}`).property("value");
    let y = +d3.select(`#centroid-y-${i}`).property("value");
    updated.push({ x: x, y: y });
  }

  currentState.centroids = updated;
}

function updateScales() {
  let allX = [
    ...currentState.points.map((d) => d.x),
    ...currentState.centroids.map((d) => d.x),
  ];
  let allY = [
    ...currentState.points.map((d) => d.y),
    ...currentState.centroids.map((d) => d.y),
  ];

  if (allX.length === 0 || allY.length === 0) return;

  let xExtent = d3.extent(allX);
  let yExtent = d3.extent(allY);

  let xPad = (xExtent[1] - xExtent[0]) * 0.1 || 1;
  let yPad = (yExtent[1] - yExtent[0]) * 0.1 || 1;

  xScale
    .domain([xExtent[0] - xPad, xExtent[1] + xPad])
    .range([margin, width - margin]);

  yScale
    .domain([yExtent[0] - yPad, yExtent[1] + yPad])
    .range([height - margin, margin]);
}

function roundTo(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function renderAll() {
  renderCentroidInputs();
  drawScatterplot();
}

function renderCentroidInputs() {
  centroidSection.html("");

  centroidSection
    .append("div")
    .style("font-weight", "bold")
    .style("font-size", "16px")
    .style("margin-bottom", "8px")
    .text("centroids");

  let rows = centroidSection
    .selectAll(".centroid-row")
    .data(currentState.centroids)
    .join("div")
    .attr("class", "centroid-row")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "6px")
    .style("margin-bottom", "8px");

  rows.each(function (d, i) {
    let row = d3.select(this);
    row.html("");

    row
      .append("span")
      .style("display", "inline-block")
      .style("width", "34px")
      .style("font-weight", "bold")
      .style("color", colors[i % colors.length])
      .text(`C${i}`);

    row.append("span").text("x:");

    row
      .append("input")
      .attr("type", "number")
      .attr("step", "0.01")
      .attr("id", `centroid-x-${i}`)
      .attr("value", roundTo(d.x, 2))
      .style("width", "90px");

    row.append("span").text("y:");

    row
      .append("input")
      .attr("type", "number")
      .attr("step", "0.01")
      .attr("id", `centroid-y-${i}`)
      .attr("value", roundTo(d.y, 2))
      .style("width", "90px");
  });
}

function drawScatterplot() {
  svg.selectAll("*").remove();
  drawAxes();
  drawPoints();
  drawCentroids();
}

function drawAxes() {
  let xAxis = d3.axisBottom(xScale).ticks(6);
  let yAxis = d3.axisLeft(yScale).ticks(6);

  svg
    .append("g")
    .attr("transform", `translate(0, ${height - margin})`)
    .call(xAxis)
    .call((g) => g.selectAll("path, line").attr("stroke", "#b8b8b8"))
    .call((g) => g.selectAll("text").attr("fill", "#4d4d4d").style("font-size", "11px"));

  svg
    .append("g")
    .attr("transform", `translate(${margin}, 0)`)
    .call(yAxis)
    .call((g) => g.selectAll("path, line").attr("stroke", "#b8b8b8"))
    .call((g) => g.selectAll("text").attr("fill", "#4d4d4d").style("font-size", "11px"));
}

function drawPoints() {
  svg
    .append("g")
    .selectAll("circle")
    .data(currentState.points)
    .join("circle")
    .attr("r", 4.5)
    .attr("cx", (d) => xScale(d.x))
    .attr("cy", (d) => yScale(d.y))
    .attr("fill", (d) => {
      if (d.label === null || d.label === undefined) return "#6b6b6b";
      return colors[d.label % colors.length];
    })
    .attr("stroke", "white")
    .attr("stroke-width", 0.5)
    .attr("opacity", 0.9);
}

function drawCentroids() {
  svg
    .append("g")
    .selectAll("path.centroid")
    .data(currentState.centroids)
    .join("path")
    .attr("class", "centroid")
    .attr("transform", (d) => `translate(${xScale(d.x)}, ${yScale(d.y)})`)
    .attr("d", d3.symbol().type(d3.symbolDiamond).size(90))
    .attr("fill", (d, i) => colors[i % colors.length])
    .attr("stroke", "#222")
    .attr("stroke-width", 1.5);
}

async function post(url = "", data = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}