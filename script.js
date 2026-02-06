// Initialize map centered on Pueblo, CO
const map = L.map('map').setView([38.2511, -104.5884], 15);

// Free OpenStreetMap tiles (no API key needed)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

// Your CSV sheet published URL
const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlVJNYUaEcY1as9YcKPu18BaceP9vQvg1vxg3KD_Z1WOsv9lL5OOnHIqJ_sY5yJOKLPcgEsSopQTc8/pub?output=csv';

// Fetch and parse CSV
fetch(SHEET_CSV_URL)
  .then((res) => res.text())
  .then((csvText) => {
    const rows = csvText.trim().split('\n').slice(1); // Skip header
    rows.forEach((row) => {
      const [
        timestamp,
        lat,
        lng,
        street,
        city,
        state,
        zip,
        count,
      ] = row.split(',');

      // safety check
      if (!lat || !lng) return;

      const popupText = `
        <strong>${street}</strong><br>
        ${city}, ${state} ${zip}<br>
        Count: ${count}<br>
        Time: ${timestamp}
      `;

      L.marker([parseFloat(lat), parseFloat(lng)])
        .addTo(map)
        .bindPopup(popupText);
    });
  })
  .catch((err) => console.error('Error loading sheet data:', err));
