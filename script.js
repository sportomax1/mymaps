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
let lastFiltered = [];
let daysOffset = 0; // for last24 navigation (0 = ending now)

// ---- Inputs ----
const rangeSelect = document.getElementById("rangeSelect");
const startInput = document.getElementById("startDate");
const endInput = document.getElementById("endDate");
const nav24 = document.getElementById("nav24");
const prevDay = document.getElementById("prevDay");
const nextDay = document.getElementById("nextDay");
const todayBtn = document.getElementById("todayBtn");
const detailsBtn = document.getElementById("detailsBtn");
const detailsModal = document.getElementById("detailsModal");
const detailsList = document.getElementById("detailsList");
const closeModal = document.getElementById("closeModal");
const loginModal = document.getElementById("loginModal");
const sitePassword = document.getElementById("sitePassword");
const loginSubmit = document.getElementById("loginSubmit");
const loginCancel = document.getElementById("loginCancel");
const loginError = document.getElementById("loginError");

function formatDate(d) {
  // Use local timezone instead of UTC to avoid date shifting
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Default = last 7 days
function setDefaultRange() {
  rangeSelect.value = "last7";
  applyRange();
}

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

  // If user has chosen 'all' we might want earliest date; keep defaults otherwise
  applyRange();
  render();
}

// ---- Auth ----
function showLogin() {
  loginError.style.display = 'none';
  sitePassword.value = '';
  loginModal.style.display = 'flex';
}

function hideLogin() {
  loginModal.style.display = 'none';
}

async function attemptLogin(pw) {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });

    if (res.ok) {
      sessionStorage.setItem('mymaps_auth', '1');
      hideLogin();
      startAppAfterAuth();
      return true;
    }

    const j = await res.json().catch(()=>({}));
    loginError.textContent = j && j.error ? j.error : 'Incorrect password';
    loginError.style.display = 'block';
    return false;
  } catch (err) {
    loginError.textContent = 'Network error';
    loginError.style.display = 'block';
    return false;
  }
}

loginSubmit.onclick = () => {
  const pw = sitePassword.value || '';
  attemptLogin(pw);
};

loginCancel.onclick = () => {
  // simple behavior: keep modal open but clear; user can close tab
  sitePassword.value = '';
};

function checkAuth() {
  return sessionStorage.getItem('mymaps_auth') === '1';
}

function startAppAfterAuth() {
  // start auto-refresh and initial load only after auth
  loadData();
  // refresh every 60s
  if (!window._mymaps_interval) window._mymaps_interval = setInterval(loadData, 60000);
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
  lastFiltered = filtered;
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

    // store popup content on data for modal interaction
    d._popup = popup;

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
function applyRange() {
  const now = new Date();
  if (rangeSelect.value === "last24") {
    nav24.style.display = "flex";
    const end = new Date(now.getTime() - daysOffset * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    startInput.value = formatDate(start);
    endInput.value = formatDate(end);
  } else {
    nav24.style.display = "none";
    daysOffset = 0;
    if (rangeSelect.value === "last7") {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      startInput.value = formatDate(start);
      endInput.value = formatDate(now);
    } else if (rangeSelect.value === "last30") {
      const start = new Date();
      start.setDate(now.getDate() - 30);
      startInput.value = formatDate(start);
      endInput.value = formatDate(now);
    } else if (rangeSelect.value === "last365") {
      const start = new Date();
      start.setFullYear(now.getFullYear() - 1);
      startInput.value = formatDate(start);
      endInput.value = formatDate(now);
    } else if (rangeSelect.value === "all") {
      // set start to far past so it includes everything
      startInput.value = "1970-01-01";
      endInput.value = formatDate(now);
    } else if (rangeSelect.value === "custom") {
      // keep whatever user sets
    }
  }
}

document.getElementById("applyBtn").onclick = () => {
  // if custom selected, don't overwrite inputs
  if (rangeSelect.value !== "custom") applyRange();
  render();
};

rangeSelect.onchange = () => {
  daysOffset = 0;
  applyRange();
  render();
};

prevDay.onclick = () => {
  daysOffset += 1;
  applyRange();
  render();
};

nextDay.onclick = () => {
  if (daysOffset > 0) daysOffset -= 1;
  applyRange();
  render();
};

todayBtn.onclick = () => {
  daysOffset = 0;
  applyRange();
  render();
};

detailsBtn.onclick = () => {
  // populate modal with lastFiltered
  detailsList.innerHTML = "";
  if (!lastFiltered || !lastFiltered.length) {
    detailsList.innerHTML = "<div style='text-align:center;color:var(--text-secondary);padding:20px 0'>No addresses in range.</div>";
  } else {
    lastFiltered.forEach((d, i) => {
      const el = document.createElement("div");
      el.className = "detail-item";
      el.innerHTML = `
        <strong>${d.street}</strong><br>
        <span style="color:var(--text-secondary)">${d.city}, ${d.state} ${d.zip}</span><br>
        <span style="font-size:14px;color:var(--text-secondary)">Count: <strong style="color:var(--primary)">${d.count}</strong></span><br>
        <button data-i="${i}" class="focusBtn">📍 Show on Map</button>
      `;
      detailsList.appendChild(el);
    });

    detailsList.querySelectorAll(".focusBtn").forEach(btn => {
      btn.onclick = (e) => {
        const idx = Number(e.target.dataset.i);
        const d = lastFiltered[idx];
        map.setView([d.lat, d.lng], 17);
        // find marker and open popup
        markers.eachLayer(l => {
          const latlng = l.getLatLng();
          if (Math.abs(latlng.lat - d.lat) < 0.00001 && Math.abs(latlng.lng - d.lng) < 0.00001) {
            l.openPopup();
          }
        });
        detailsModal.style.display = "none";
      };
    });
  }
  detailsModal.style.display = "flex";
};

closeModal.onclick = () => {
  detailsModal.style.display = "none";
};

// Close modals when clicking backdrop
detailsModal.onclick = (e) => {
  if (e.target === detailsModal || e.target.classList.contains('modal-backdrop')) {
    detailsModal.style.display = 'none';
  }
};

loginModal.onclick = (e) => {
  if (e.target === loginModal || e.target.classList.contains('modal-backdrop')) {
    // Don't allow closing login modal by clicking outside for security
    // loginModal.style.display = 'none';
  }
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    detailsModal.style.display = 'none';
    // Don't allow ESC to close login modal for security
  }
});

document.getElementById("heatBtn").onclick = () => {
  heatOn = !heatOn;
  render();
};

// ---- Auth + initial boot ----
if (checkAuth()) {
  startAppAfterAuth();
} else {
  showLogin();
}
