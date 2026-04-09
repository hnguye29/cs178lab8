let svg = d3
  .select("svg#scatterplot")
  .attr("width", 500)
  .attr("height", 500)
  .style("background", "#eee");

load_and_plot("blobs.csv");
example_use_of_post();

function load_and_plot(filename) {
  d3.csv(`static/datasets/${filename}`, d3.autoType).then((data) => {
    console.log("data", data);
    svg
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("r", 8)
      .attr("fill", "#333")
      .attr("stroke", "#eee")
      .attr("stroke-width", 1)
      .attr("cx", (d) => d.x * 20 + 50)
      .attr("cy", (d) => d.y * 20 + 250);
  });
}

// utilities
async function post(url = "", data = {}) {
  const response = await fetch(url, {
    method: "POST", // Specify the method (POST)
    headers: {
      "Content-Type": "application/json", // Tell the server you're sending JSON
    },
    body: JSON.stringify(data), // Convert JS object to JSON string
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`); // Check for errors
  }
  return await response.json(); // Parse the JSON response
}

function example_use_of_post() {
  post("your_route", {data: "aabbccc"}).then((returned_data) => {
    console.log("server says", returned_data);
  });
}
