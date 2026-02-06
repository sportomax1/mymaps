const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlVJNYUaEcY1as9YcKPu18BaceP9vQvg1vxg3KD_Z1WOsv9lL5OOnHIqJ_sY5yJOKLPcgEsSopQTc8/pub?output=csv";

// ---- Map init ----
const map = L.map("map").setView([38.25115, -104.5884], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

let markersLayer = L.featureGroup().addTo(map);
let records = [];

// ---- Date defaults (last 7 days) ----
const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");

const today = new Date();
const lastWeek = new Date();
lastWeek.setDate(today.getDate() - 7);

startInput.value = lastWeek.toISOString().split("T")[0];
endInput.value = today.toISOString().split("T")[0];

// ---- Load CSV ----
fetch(CSV_URL)
  .then(res => res.text())
  .then(text => {
    const rows = text.trim().split("\n");
    rows.shift(); // remove header

    records = rows.map(row => {
      const [
        timestamp,
        lat,
        lng,
        street,
        city,
        state,
        zip,
        count
      ] = row.split(",");

      return {
        date: new Date(timestamp),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        street,
        city,
        state,
        zip,
        count
      };
    });

    render();
  });

// ---- Render markers ----
function render() {
  markersLayer.clearLayers();

  const startDate = new Date(startInput.value);
  const endDate = new Date(endInput.value);
  endDate.setHours(23, 59, 59);

  const filtered = records.filter(r =>
    r.date >= startDate && r.date <= endDate
  );

  filtered.forEach(r => {
    const popup = `
      <strong>${r.street}</strong><br/>
      ${r.city}, ${r.state} ${r.zip}<br/>
      Count: ${r.count}<br/>
      ${r.date.toLocaleString()}
    `;

    L.marker([r.lat, r.lng])
      .bindPopup(popup)
      .addTo(markersLayer);
  });

  if (filtered.length > 0) {
    map.fitBounds(markersLayer.getBounds(), { padding: [30, 30] });
  }
}

// ---- Button ----
document.getElementById("applyBtn").addEventListener("click", render);
