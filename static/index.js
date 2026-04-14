let width = 520;
let height = 520;
let margin = 45;

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
  labels: [],
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

async function initializePage() {
  await initializeFromBackend();
}

async function initializeFromBackend() {
  let response = await post("/api/init", {
    dataset: currentState.dataset,
    n_clusters: currentState.n_clusters,
    centroids: null,
  });

  applyServerState(response);
  renderAll();
}

function bindControls() {
  datasetSelect.on("change", async function () {
    currentState.dataset = this.value;
    await initializeFromBackend();
  });

  clusterInput.on("change", async function () {
    let value = +this.value;
    value = Math.max(2, value);
    this.value = value;

    currentState.n_clusters = value;
    await initializeFromBackend();
  });

  resetButton.on("click", async function () {
    let response = await post("/api/reset", {});
    applyServerState(response);
    renderAll();
  });

  forwardButton.on("click", async function () {
    syncCentroidsFromInputs();

    // send updated centroids to backend without reinitializing
    let response = await post("/api/update_centroids", {
      centroids: currentState.centroids,
    });

    applyServerState(response);

    response = await post("/api/step", {});
    applyServerState(response);
    renderAll();
  });

  backButton.on("click", async function () {
    let response = await post("/api/back", {});
    applyServerState(response);
    renderAll();
  });

  runButton.on("click", async function () {
    syncCentroidsFromInputs();

    let response = await post("/api/update_centroids", {
      centroids: currentState.centroids,
    });

    applyServerState(response);

    response = await post("/api/run", {});
    applyServerState(response);
    renderAll();
  });
}

function applyServerState(serverData) {
  currentState.dataset = serverData.dataset ?? currentState.dataset;
  currentState.n_clusters = serverData.n_clusters ?? currentState.n_clusters;
  currentState.centroids = serverData.centroids || currentState.centroids;
  currentState.labels = serverData.labels || [];
  currentState.step = serverData.step ?? currentState.step;
  currentState.converged = serverData.converged ?? currentState.converged;

  let rawPoints = serverData.points || [];

  currentState.points = rawPoints.map((p, i) => ({
    x: p[0],
    y: p[1],
    label: currentState.labels[i],
  }));

  stepText.text(currentState.step);
  updateScales();
}

function syncCentroidsFromInputs() {
  let updated = [];

  for (let i = 0; i < currentState.n_clusters; i++) {
    let x = +d3.select(`#centroid-x-${i}`).property("value");
    let y = +d3.select(`#centroid-y-${i}`).property("value");
    updated.push([x, y]);
  }

  currentState.centroids = updated;
}

function updateScales() {
  let allX = [
    ...currentState.points.map((d) => d.x),
    ...currentState.centroids.map((d) => d[0]),
  ];
  let allY = [
    ...currentState.points.map((d) => d.y),
    ...currentState.centroids.map((d) => d[1]),
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
      .attr("value", roundTo(d[0], 2))
      .style("width", "90px");

    row.append("span").text("y:");

    row
      .append("input")
      .attr("type", "number")
      .attr("step", "0.01")
      .attr("id", `centroid-y-${i}`)
      .attr("value", roundTo(d[1], 2))
      .style("width", "90px");
  });
}

function drawScatterplot() {
  svg.selectAll("*").remove();

  svg
    .append("rect")
    .attr("x", margin)
    .attr("y", margin)
    .attr("width", width - 2 * margin)
    .attr("height", height - 2 * margin)
    .attr("fill", "#dcdcdc");

  drawGrid();
  drawAxes();
  drawPoints();
  drawCentroids();
}

function drawGrid() {
  let xTicks = xScale.ticks(6);
  let yTicks = yScale.ticks(6);

  svg
    .append("g")
    .selectAll("line.vertical-grid")
    .data(xTicks)
    .join("line")
    .attr("x1", (d) => xScale(d))
    .attr("x2", (d) => xScale(d))
    .attr("y1", margin)
    .attr("y2", height - margin)
    .attr("stroke", "#efefef")
    .attr("stroke-width", 1);

  svg
    .append("g")
    .selectAll("line.horizontal-grid")
    .data(yTicks)
    .join("line")
    .attr("x1", margin)
    .attr("x2", width - margin)
    .attr("y1", (d) => yScale(d))
    .attr("y2", (d) => yScale(d))
    .attr("stroke", "#efefef")
    .attr("stroke-width", 1);
}

function drawAxes() {
  let xAxis = d3.axisBottom(xScale).ticks(6);
  let yAxis = d3.axisLeft(yScale).ticks(6);

  svg
    .append("g")
    .attr("transform", `translate(0, ${height - margin})`)
    .call(xAxis)
    .call((g) => g.selectAll("path, line").attr("stroke", "#a9a9a9"))
    .call((g) =>
      g.selectAll("text").attr("fill", "#4d4d4d").style("font-size", "11px")
    );

  svg
    .append("g")
    .attr("transform", `translate(${margin}, 0)`)
    .call(yAxis)
    .call((g) => g.selectAll("path, line").attr("stroke", "#a9a9a9"))
    .call((g) =>
      g.selectAll("text").attr("fill", "#4d4d4d").style("font-size", "11px")
    );
}

function drawPoints() {
  svg
    .append("g")
    .selectAll("circle")
    .data(currentState.points)
    .join("circle")
    .attr("r", 5.5)
    .attr("cx", (d) => xScale(d.x))
    .attr("cy", (d) => yScale(d.y))
    .attr("fill", (d) => {
      if (d.label === null || d.label === undefined) return "#6b6b6b";
      return colors[d.label % colors.length];
    })
    .attr("stroke", "white")
    .attr("stroke-width", 0.8)
    .attr("opacity", 0.9);
}

function drawCentroids() {
  svg
    .append("g")
    .selectAll("circle.centroid")
    .data(currentState.centroids)
    .join("circle")
    .attr("class", "centroid")
    .attr("cx", (d) => xScale(d[0]))
    .attr("cy", (d) => yScale(d[1]))
    .attr("r", 12)
    .attr("fill", (d, i) => colors[i % colors.length])
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