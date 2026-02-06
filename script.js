const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlVJNYUaEcY1as9YcKPu18BaceP9vQvg1vxg3KD_Z1WOsv9lL5OOnHIqJ_sY5yJOKLPcgEsSopQTc8/pub?output=csv";

// ---- Map ----
const map = L.map("map").setView([38.25115, -104.5884], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

let markers = L.featureGroup().addTo(map);
let heatLayer = null;
let heatOn = false;
let data = [];

// ---- Inputs ----
const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");

// Default = last 7 days
const now = new Date();
const weekAgo = new Date();
weekAgo.setDate(now.getDate() - 7);

startInput.value = weekAgo.toISOString().split("T")[0];
endInput.value = now.toISOString().split("T")[0];

// ---- Load CSV ----
async function loadData() {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  const text = await res.text();

  const rows = text.trim().split("\n");
  rows.shift();

  data = rows.map(r => {
    const [
      timestamp,
      lat,
      lng,
      street,
      city,
      state,
      zip,
      count
    ] = r.split(",");

    return {
      date: new Date(timestamp),
      lat: Number(lat),
      lng: Number(lng),
      street,
      city,
      state,
      zip,
      count: Number(count)
    };
  });

  render();
}

// ---- Color logic ----
function pinColor(count) {
  if (count >= 5) return "red";
  if (count >= 3) return "orange";
  return "green";
}

// ---- Render ----
function render() {
  markers.clearLayers();
  if (heatLayer) map.removeLayer(heatLayer);

  const start = new Date(startInput.value);
  const end = new Date(endInput.value);
  end.setHours(23, 59, 59);

  const filtered = data.filter(d => d.date >= start && d.date <= end);
  const heatPoints = [];

  filtered.forEach(d => {
    const popup = `
      <strong>${d.street}</strong><br>
      ${d.city}, ${d.state} ${d.zip}<br>
      Count: ${d.count}<br>
      ${d.date.toLocaleString()}
    `;

    L.circleMarker([d.lat, d.lng], {
      radius: 8,
      color: pinColor(d.count),
      fillOpacity: 0.8
    })
      .bindPopup(popup)
      .addTo(markers);

    heatPoints.push([d.lat, d.lng, d.count]);
  });

  if (heatOn) {
    heatLayer = L.heatLayer(heatPoints, {
      radius: 25,
      blur: 18
    }).addTo(map);
  }

  if (filtered.length) {
    map.fitBounds(markers.getBounds(), { padding: [30, 30] });
  }
}

// ---- Buttons ----
document.getElementById("applyBtn").onclick = render;

document.getElementById("last24Btn").onclick = () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  startInput.value = yesterday.toISOString().split("T")[0];
  endInput.value = now.toISOString().split("T")[0];
  render();
};

document.getElementById("heatBtn").onclick = () => {
  heatOn = !heatOn;
  render();
};

// ---- Auto refresh every 60s ----
setInterval(loadData, 60000);

// Initial load
loadData();
