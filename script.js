// Initialize map (center on Pueblo for your data)
const map = L.map('map').setView([38.2511, -104.5884], 15);

// Add free OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

// Fetch your published sheet as CSV or JSON
// Example: CSV published URL (replace with your published link)
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pub?output=csv';

fetch(SHEET_CSV_URL)
  .then(res => res.text())
  .then(csvText => {
    const rows = csvText.split('\n').slice(1); // skip header
    rows.forEach(row => {
      const [timestamp, lat, lng, street, city, state, zip, count] = row.split(',');
      if(lat && lng){
        const popupText = `
          <strong>${street}</strong><br>
          ${city}, ${state} ${zip}<br>
          Count: ${count}<br>
          Timestamp: ${timestamp}
        `;
        L.marker([parseFloat(lat), parseFloat(lng)])
         .addTo(map)
         .bindPopup(popupText);
      }
    });
  })
  .catch(err => console.error("Error fetching sheet:", err));
