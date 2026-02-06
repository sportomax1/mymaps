// Initialize map
const map = L.map('map').setView([38.2511, -104.5884], 15); // Center on Pueblo

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

// Example: Fetch data from Google Sheets published as JSON
const SHEET_JSON_URL = "https://spreadsheets.google.com/feeds/list/<SHEET_ID>/od6/public/values?alt=json";

fetch(SHEET_JSON_URL)
  .then(res => res.json())
  .then(data => {
    // Transform the Google Sheets feed to usable array
    const entries = data.feed.entry.map(e => ({
      timestamp: e.gsx$timestamp.$t,
      lat: parseFloat(e.gsx$latitude.$t),
      lng: parseFloat(e.gsx$longitude.$t),
      street: e.gsx$street.$t,
      city: e.gsx$city.$t,
      state: e.gsx$state.$t,
      zip: e.gsx$zipcode.$t,
      count: e.gsx$count.$t
    }));

    // Add markers
    entries.forEach(item => {
      const popupText = `
        <strong>${item.street}</strong><br>
        ${item.city}, ${item.state} ${item.zip}<br>
        Count: ${item.count}<br>
        Timestamp: ${item.timestamp}
      `;
      L.marker([item.lat, item.lng]).addTo(map)
        .bindPopup(popupText);
    });
  })
  .catch(err => console.error("Error fetching sheet data:", err));
