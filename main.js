// ------------------------------
// Global variables and state
// ------------------------------
let map;
let allMarkers = [];
let allData = [];
let currentFilter = 'all';
let isAuthenticated = false;

// Hash-based password verification (more secure than plain text)
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

// Simple password check (password will be in env.js or set via secret)
// For GitHub Pages, the password will be embedded via workflow
// For local testing, default to "PASSWORD"
const APP_PASSWORD_HASH = window.APP_PASSWORD_HASH || hashPassword('PASSWORD');

function checkPassword(inputPassword) {
  return hashPassword(inputPassword) === APP_PASSWORD_HASH;
}

function initLoginModal() {
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const passwordInput = document.getElementById('passwordInput');
  const loginError = document.getElementById('loginError');
  const appContainer = document.getElementById('appContainer');

  // Check if already authenticated in localStorage
  const sessionToken = localStorage.getItem('mapSessionToken');
  if (sessionToken === 'authenticated_' + APP_PASSWORD_HASH.slice(0, 8)) {
    // Already logged in
    loginModal.setAttribute('aria-hidden', 'true');
    appContainer.style.display = 'flex';
    isAuthenticated = true;
    return;
  }

  // Show login modal
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = passwordInput.value;

    if (checkPassword(password)) {
      // Correct password
      isAuthenticated = true;
      localStorage.setItem('mapSessionToken', 'authenticated_' + APP_PASSWORD_HASH.slice(0, 8));
      loginError.classList.remove('show');
      loginModal.setAttribute('aria-hidden', 'true');
      appContainer.style.display = 'flex';
      passwordInput.value = '';
      startApp(); // Start the app after auth
    } else {
      // Wrong password
      loginError.textContent = '❌ Incorrect password. Try again.';
      loginError.classList.add('show');
      passwordInput.value = '';
      passwordInput.focus();
    }
  });

  // Auto-focus password input
  passwordInput.focus();
}

// ------------------------------
// Utility functions for date filtering
// ------------------------------
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Handle Google Sheets format: "M/D/YYYY HH:MM:SS"
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [_, month, day, year, hour, minute, second] = match;
    // month is 0-indexed in JS Date
    return new Date(year, month - 1, day, hour, minute, second);
  }
  
  // Fallback: try native Date parser for ISO and other formats
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function getDateRangeFilter(filterType, customDate = null, startDate = null, endDate = null) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filterType) {
    case 'all':
      return () => true;
      
    case 'last-week':
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      return (date) => date >= weekAgo && date <= today;
      
    case 'last-month':
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      return (date) => date >= monthAgo && date <= today;
      
    case 'last-year':
      const yearAgo = new Date(today);
      yearAgo.setFullYear(today.getFullYear() - 1);
      return (date) => date >= yearAgo && date <= today;
      
    case 'custom-date':
      if (!customDate) return () => false;
      const targetDate = new Date(customDate);
      const nextDay = new Date(targetDate);
      nextDay.setDate(targetDate.getDate() + 1);
      return (date) => date >= targetDate && date < nextDay;
      
    case 'date-range':
      if (!startDate || !endDate) return () => false;
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1); // Include end date
      return (date) => date >= start && date < end;
      
    default:
      return () => true;
  }
}

// ------------------------------
// Map and marker functions
// ------------------------------
function getEmojiMarker(emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="40" height="40">
    <circle cx="50" cy="50" r="48" fill="#404040" opacity="0.85"/>
    <text x="50" y="60" font-size="50" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getMarkerEmojiByMinute(date) {
  // If date is null/undefined, default to car emoji
  if (!date) return '🚗';
  
  const minutes = date.getMinutes();
  
  // 🕐 Clock emoji for records at the top of the hour (00 minutes)
  if (minutes === 0) {
    return '🕐';
  }
  
  // 🚗 Car emoji for all other times
  return '🚗';
}

function clearMarkers() {
  allMarkers.forEach(marker => marker.setMap(null));
  allMarkers = [];
}

function createMarker(data) {
  const { date, name, lat, lng } = data;
  // Ensure title is a string (Google Maps API requires a string)
  const title = (name === undefined || name === null) ? '' : String(name);

  // Validate coordinates
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    console.warn('Skipping marker with invalid coordinates:', data);
    return null;
  }

  // Determine emoji based on minute value
  const emoji = getMarkerEmojiByMinute(date);
  
  let marker;
  try {
    marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title,
      icon: getEmojiMarker(emoji),
    });
  } catch (err) {
    console.error('Failed to create marker for data:', data, err);
    return null;
  }

  if (name || date) {
    const content = `
      <div style="max-width: 200px;">
        ${name ? `<strong>${name}</strong>` : ''}
        ${date ? `<br><small>📅 ${date.toLocaleDateString()}</small>` : ''}
      </div>
    `;
    
    const infowindow = new google.maps.InfoWindow({ content });
    marker.addListener("click", () => infowindow.open(map, marker));
  }

  return marker;
}

function filterAndDisplayMarkers() {
  clearMarkers();
  
  const filterType = document.getElementById('filterType').value;
  const customDate = document.getElementById('customDate').value;
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  
  const dateFilter = getDateRangeFilter(filterType, customDate, startDate, endDate);
  
  const filteredData = allData.filter(item => {
    if (!item.date && filterType !== 'all') return false;
    return filterType === 'all' || dateFilter(item.date);
  });
  
  // Create markers for filtered data
  filteredData.forEach(item => {
    const marker = createMarker(item);
    if (marker) allMarkers.push(marker);
  });
  
  // Update status
  updateFilterStatus(filteredData.length, allData.length, filterType);
  
  // Adjust map bounds if we have markers
  if (allMarkers.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    allMarkers.forEach(marker => bounds.extend(marker.getPosition()));
    map.fitBounds(bounds);
    
    // Don't zoom too much for single markers
    if (allMarkers.length === 1) {
      google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        if (map.getZoom() > 15) map.setZoom(15);
      });
    }
  }
}

function updateFilterStatus(filteredCount, totalCount, filterType) {
  const statusEl = document.getElementById('filterStatus');
  
  if (filterType === 'all') {
    statusEl.className = 'filter-status';
    statusEl.style.display = 'none';
  } else if (filteredCount === 0) {
    statusEl.className = 'filter-status no-results';
    statusEl.textContent = `No records found for the selected date filter.`;
  } else {
    statusEl.className = 'filter-status active';
    statusEl.textContent = `Showing ${filteredCount} of ${totalCount} records`;
  }
}

function setFilterStatus(message, type) {
  const statusEl = document.getElementById('filterStatus');
  statusEl.style.display = 'block';
  if (type === 'no-results') {
    statusEl.className = 'filter-status no-results';
  } else if (type === 'active') {
    statusEl.className = 'filter-status active';
  } else {
    statusEl.className = 'filter-status';
  }
  statusEl.textContent = message;
}

// ------------------------------
// Data modal functions
// ------------------------------
function openDataModal() {
  const modal = document.getElementById('dataModal');
  populateDataTable();
  modal.setAttribute('aria-hidden', 'false');
}

function closeDataModal() {
  const modal = document.getElementById('dataModal');
  modal.setAttribute('aria-hidden', 'true');
}

function populateDataTable() {
  const tbody = document.querySelector('#dataTable tbody');
  tbody.innerHTML = '';

  // Show currently filtered data
  const filterType = document.getElementById('filterType').value;
  const customDate = document.getElementById('customDate').value;
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const dateFilter = getDateRangeFilter(filterType, customDate, startDate, endDate);

  const rows = allData.filter(item => {
    if (!item.date && filterType !== 'all') return false;
    return filterType === 'all' || dateFilter(item.date);
  });

  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    const dateText = r.date ? r.date.toLocaleString() : r.raw.timestamp || '';
    const street = escapeHtml(r.raw.street || '');
    const city = escapeHtml(r.raw.city || '');
    const state = escapeHtml(r.raw.state || '');
    const zip = escapeHtml(r.raw.zip || '');
    tr.innerHTML = `<td>${i+1}</td><td>${dateText}</td><td>${street}</td><td>${city}</td><td>${state}</td><td>${zip}</td><td>${r.lat}</td><td>${r.lng}</td>`;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (s) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s];
  });
}

function exportCsv() {
  const rows = Array.from(document.querySelectorAll('#dataTable tbody tr'));
  if (rows.length === 0) return;
  const lines = [['#','Timestamp','Street','City','State','ZIP','Latitude','Longitude']];
  rows.forEach(r => {
    const cols = Array.from(r.querySelectorAll('td')).map(td => td.textContent);
    lines.push(cols);
  });

  const csv = lines.map(l => l.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data-points.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ------------------------------
// UI Event handlers
// ------------------------------
function setupFilterEventHandlers() {
  // Toggle filter panel on mobile
  const toggleBtn = document.getElementById('toggleFiltersBtn');
  const filterPanel = document.getElementById('filterPanel');
  
  if (toggleBtn && filterPanel) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = filterPanel.style.display === 'none' || filterPanel.style.display === '';
      filterPanel.style.display = isHidden ? 'flex' : 'none';
      toggleBtn.classList.toggle('active');
    });
  }

  const filterTypeSelect = document.getElementById('filterType');
  const customDateGroup = document.getElementById('customDateGroup');
  const dateRangeGroup = document.getElementById('dateRangeGroup');
  const applyButton = document.getElementById('applyFilter');
  const clearButton = document.getElementById('clearFilter');
  
  // Show/hide date inputs based on filter type
  filterTypeSelect.addEventListener('change', () => {
    const filterType = filterTypeSelect.value;
    
    customDateGroup.style.display = filterType === 'custom-date' ? 'flex' : 'none';
    dateRangeGroup.style.display = filterType === 'date-range' ? 'flex' : 'none';
    
    // Auto-apply for simple filters
    if (['all', 'last-week', 'last-month', 'last-year'].includes(filterType)) {
      filterAndDisplayMarkers();
    }
  });
  
  // Apply filter button
  applyButton.addEventListener('click', filterAndDisplayMarkers);
  
  // Clear filter button
  clearButton.addEventListener('click', () => {
    filterTypeSelect.value = 'all';
    customDateGroup.style.display = 'none';
    dateRangeGroup.style.display = 'none';
    document.getElementById('customDate').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    filterAndDisplayMarkers();
  });
  
  // Enter key on date inputs
  [document.getElementById('customDate'), document.getElementById('startDate'), document.getElementById('endDate')]
    .forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') filterAndDisplayMarkers();
      });
    });

  // Daily navigation
  const datePickerDaily = document.getElementById('datePickerDaily');
  const prevDayBtn = document.getElementById('prevDayBtn');
  const nextDayBtn = document.getElementById('nextDayBtn');
  const dailyDateDisplay = document.getElementById('dailyDateDisplay');
  
  // Initialize date picker to today
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  datePickerDaily.value = todayString;
  updateDailyDateDisplay(today);
  
  function updateDailyDateDisplay(date) {
    dailyDateDisplay.textContent = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  function filterByDailyDate(dateString) {
    // Switch to custom-date filter
    filterTypeSelect.value = 'custom-date';
    customDateGroup.style.display = 'flex';
    dateRangeGroup.style.display = 'none';
    
    // Set the custom date and apply filter
    document.getElementById('customDate').value = dateString;
    filterAndDisplayMarkers();
  }
  
  prevDayBtn.addEventListener('click', () => {
    const currentDate = new Date(datePickerDaily.value);
    currentDate.setDate(currentDate.getDate() - 1);
    const dateString = currentDate.toISOString().split('T')[0];
    datePickerDaily.value = dateString;
    updateDailyDateDisplay(currentDate);
    filterByDailyDate(dateString);
  });
  
  nextDayBtn.addEventListener('click', () => {
    const currentDate = new Date(datePickerDaily.value);
    currentDate.setDate(currentDate.getDate() + 1);
    const dateString = currentDate.toISOString().split('T')[0];
    datePickerDaily.value = dateString;
    updateDailyDateDisplay(currentDate);
    filterByDailyDate(dateString);
  });
  
  datePickerDaily.addEventListener('change', (e) => {
    const selectedDate = new Date(e.target.value);
    updateDailyDateDisplay(selectedDate);
    filterByDailyDate(e.target.value);
  });

  // View Data modal
  const viewBtn = document.getElementById('viewDataBtn');
  const closeBtn = document.getElementById('closeModal');
  const exportBtn = document.getElementById('exportCsv');

  if (viewBtn) viewBtn.addEventListener('click', openDataModal);
  if (closeBtn) closeBtn.addEventListener('click', closeDataModal);
  if (exportBtn) exportBtn.addEventListener('click', exportCsv);

  // Close modal on background click
  const modal = document.getElementById('dataModal');
  if (modal) modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDataModal();
  });

  // Timeline modal
  const timelineBtn = document.getElementById('timelineBtn');
  const closeTimelineBtn = document.getElementById('closeTimelineModal');
  const timelineModal = document.getElementById('timelineModal');

  if (timelineBtn) timelineBtn.addEventListener('click', displayTimelineModal);
  if (closeTimelineBtn) closeTimelineBtn.addEventListener('click', closeTimelineModal);
  if (timelineModal) timelineModal.addEventListener('click', (e) => {
    if (e.target === timelineModal) closeTimelineModal();
  });

  // Play mode controls
  const playBtn = document.getElementById('playBtn');
  const stopPlayBtn = document.getElementById('stopPlayBtn');
  const playSpeed = document.getElementById('playSpeed');
  const playSpeedDisplay = document.getElementById('playSpeedDisplay');
  const playControls = document.getElementById('playControls');

  if (playBtn) playBtn.addEventListener('click', startPlayAnimation);
  if (stopPlayBtn) stopPlayBtn.addEventListener('click', stopPlayAnimation);

  // Show play controls when custom date filter is selected
  filterTypeSelect.addEventListener('change', () => {
    if (filterTypeSelect.value === 'custom-date') {
      playControls.style.display = 'flex';
    }
  });

  if (playSpeed) {
    playSpeed.addEventListener('input', (e) => {
      playSpeedDisplay.textContent = e.target.value + 'x';
    });
  }
}

// ------------------------------
// Google Maps initialization
// ------------------------------
function loadGoogleMaps(callbackName = "initMap") {
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${window.GOOGLE_MAPS_API_KEY}&callback=${callbackName}`;
  script.async = true;
  script.onerror = () => {
    console.error('Failed to load Google Maps API');
    const msg = '❌ Failed to load Google Maps API script. Check your API key and network (see console).';
    document.getElementById('map').innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f8d7da; color: #721c24; border-radius: 15px;">${msg}</div>`;
    setFilterStatus(msg, 'no-results');
  };
  document.head.appendChild(script);

  // If Google Maps doesn't initialize within a timeout, show a helpful message
  const checkTimeout = 8000; // ms
  setTimeout(() => {
    if (!window.google || !window.google.maps) {
      const msg = 'Google Maps API did not initialize within 8s. Possible API key restriction or network error. Check browser console for API errors.';
      console.warn(msg);
      setFilterStatus(msg, 'no-results');
    }
  }, checkTimeout);
}

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 10,
    center: { lat: 39.5, lng: -104.8 }, // default center
  });

  // Build the Google Sheet JSON URL
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${window.GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json`;

  // Fetch sheet data
  setFilterStatus('Loading sheet data...', 'active');

  fetch(sheetUrl + "&" + new Date().getTime()) // cache-busting
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return response.text();
    })
    .then((text) => {
      try {
        // Strip JSON padding from Google Sheets
        const json = JSON.parse(text.substr(47).slice(0, -2));
        const rows = json.table.rows;

      // Process all data
      // Expected columns: A=Timestamp, B=Latitude, C=Longitude, D=Street, E=City, F=State, G=ZIP, H=Count
      allData = rows.map((row, idx) => {
        // Use .f (formatted) for timestamp, fallback to .v (raw value)
        const timestamp = row.c[0]?.f || row.c[0]?.v || "";      // Column A (Timestamp)
        const lat = parseFloat(row.c[1]?.v);        // Column B (Latitude)
        const lng = parseFloat(row.c[2]?.v);        // Column C (Longitude)
        const street = row.c[3]?.v || '';
        const city = row.c[4]?.v || '';
        const state = row.c[5]?.v || '';
        const zip = row.c[6]?.v || '';
        const count = row.c[7]?.v || '';            // Column H (Count)

        const addressParts = [street, city, state, zip].filter(Boolean);
        const name = addressParts.join(', ');

        // Try parsing timestamp into date
        const date = parseDate(timestamp) || (timestamp ? new Date(timestamp) : null);

        const item = {
          date,
          name,
          lat,
          lng,
          count,
          raw: { timestamp, street, city, state, zip, count },
          rowIndex: idx + 1,
          isValid: !isNaN(lat) && !isNaN(lng)
        };

        if (!item.isValid) {
          console.warn(`Invalid row ${item.rowIndex}:`, row);
        }

        return item;
      }).filter(item => item.isValid);

      console.log(`Loaded ${allData.length} valid records from Google Sheet`);
      setFilterStatus(`Loaded ${allData.length} valid records`, 'active');
      // Initial display of all markers
      filterAndDisplayMarkers();
    } catch (err) {
        console.error('Failed to parse Google Sheet response', err);
        setFilterStatus('Failed to parse sheet data. Is the sheet published to web and using expected columns?', 'no-results');
    }
    })
    .catch((err) => {
      console.error("Error loading Google Sheet data:", err);
      setFilterStatus(`Error loading sheet: ${err.message}`, 'no-results');
    });
}

// ------------------------------
// Play mode animation
// ------------------------------
let playMode = false;
let playIntervalId = null;
let playCurrentIndex = 0;

function getFilteredAndSortedData() {
  const filterType = document.getElementById('filterType').value;
  const customDate = document.getElementById('customDate').value;
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const dateFilter = getDateRangeFilter(filterType, customDate, startDate, endDate);

  const filtered = allData.filter(item => {
    if (!item.date && filterType !== 'all') return false;
    return filterType === 'all' || dateFilter(item.date);
  });

  // Sort by date/time
  return filtered.sort((a, b) => (a.date || new Date(0)) - (b.date || new Date(0)));
}

function displayTimelineModal() {
  const sorted = getFilteredAndSortedData();
  const timelineList = document.getElementById('timelineList');
  timelineList.innerHTML = '';

  sorted.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'timeline-item';
    const timeStr = item.date ? item.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Unknown';
    const countDisplay = item.count ? `<div class="timeline-count">Count: ${item.count}</div>` : '';
    div.innerHTML = `
      <div class="timeline-sequence">#${idx + 1}</div>
      <div class="timeline-time">${timeStr}</div>
      <div>
        <div class="timeline-location">${item.name || 'Unknown location'}</div>
        <div class="timeline-coords">${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}</div>
        ${countDisplay}
      </div>
    `;
    timelineList.appendChild(div);
  });

  const modal = document.getElementById('timelineModal');
  modal.setAttribute('aria-hidden', 'false');
}

function closeTimelineModal() {
  const modal = document.getElementById('timelineModal');
  modal.setAttribute('aria-hidden', 'true');
}

function startPlayAnimation() {
  const sorted = getFilteredAndSortedData();
  if (sorted.length === 0) {
    alert('No data points to play for this filter.');
    return;
  }

  playMode = true;
  playCurrentIndex = 0;
  const playBtn = document.getElementById('playBtn');
  const stopPlayBtn = document.getElementById('stopPlayBtn');
  playBtn.disabled = true;
  stopPlayBtn.disabled = false;

  // Clear current markers
  clearMarkers();
  
  const speed = parseFloat(document.getElementById('playSpeed').value) || 1;
  const interval = 1000 / speed; // milliseconds between pins

  const animatePin = () => {
    if (playCurrentIndex < sorted.length) {
      const item = sorted[playCurrentIndex];
      
      // Show all previous pins in blue (visited)
      for (let i = 0; i < playCurrentIndex; i++) {
        const prevItem = sorted[i];
        const prevMarker = new google.maps.Marker({
          position: { lat: prevItem.lat, lng: prevItem.lng },
          map,
          icon: getEmojiMarker('🔵'), // Blue for visited
          zIndex: i,
          opacity: 0.6,
        });
        allMarkers.push(prevMarker);
      }
      
      // Show current pin in green
      const currentMarker = new google.maps.Marker({
        position: { lat: item.lat, lng: item.lng },
        map,
        title: item.name,
        icon: getEmojiMarker('🟢'), // Green for current
        zIndex: 1000 + playCurrentIndex, // Higher z-index for current
      });
      allMarkers.push(currentMarker);

      // Add click listener for info
      if (item.name || item.date) {
        const countInfo = item.count ? `<br><small>📊 Count: ${item.count}</small>` : '';
        const content = `
          <div style="max-width: 200px;">
            <strong>#${playCurrentIndex + 1}</strong>
            ${item.name ? `<br><strong>${item.name}</strong>` : ''}
            ${item.date ? `<br><small>🕐 ${item.date.toLocaleTimeString()}</small>` : ''}
            ${countInfo}
          </div>
        `;
        const infowindow = new google.maps.InfoWindow({ content });
        currentMarker.addListener("click", () => infowindow.open(map, currentMarker));
      }

      // Pan to current marker
      map.panTo({ lat: item.lat, lng: item.lng });
      
      const timeStr = item.date ? item.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Unknown';
      const countDisplay = item.count ? ` | Count: ${item.count}` : '';
      document.getElementById('playStatus').textContent = `▶️ Stop #${playCurrentIndex + 1}/${sorted.length} at ${timeStr}${countDisplay}`;

      playCurrentIndex++;
      playIntervalId = setTimeout(animatePin, interval);
    } else {
      stopPlayAnimation();
    }
  };

  animatePin();
}

function stopPlayAnimation() {
  playMode = false;
  if (playIntervalId) clearTimeout(playIntervalId);
  playIntervalId = null;
  playCurrentIndex = 0;

  const playBtn = document.getElementById('playBtn');
  const stopPlayBtn = document.getElementById('stopPlayBtn');
  playBtn.disabled = false;
  stopPlayBtn.disabled = true;
  document.getElementById('playStatus').textContent = 'Animation stopped.';

  // Refresh markers to show normal filtered view
  filterAndDisplayMarkers();
}

// ------------------------------
// Application startup
// ------------------------------
function startApp() {
  // Check if environment variables are loaded
  if (!window.GOOGLE_MAPS_API_KEY || !window.GOOGLE_SHEET_ID) {
    console.error('Missing required environment variables');
    document.getElementById('map').innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f8d7da; color: #721c24; border-radius: 15px;">❌ Missing API key or Sheet ID. Ensure `env.js` exists locally (for testing) or is generated at build time.</div>';
    return;
  }
  
  // Setup UI event handlers
  setupFilterEventHandlers();
  
  // Load Google Maps
  loadGoogleMaps();
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize login modal first
  initLoginModal();
  // startApp will be called after successful authentication
  if (isAuthenticated) {
    startApp();
  }
});
