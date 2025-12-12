# 📍 Google Maps + Google Sheets Pin Map with Date Filtering

A **powerful yet simple** interactive web map that loads pins from your Google Sheet with advanced date filtering capabilities. No backend, no npm, no build tools - just open `index.html` in your browser!

## ✨ Features

- **Immediate Access**: No password required - instant access to your map
- **No Setup Required**: Just edit env.js file and open in browser
- **Live Google Sheets**: Automatically fetches data from your sheet
- **Advanced Date Filtering**: Filter by last week, month, year, custom dates, or date ranges
- **Interactive Markers**: Click pins to see location names and dates
- **Auto-Updates**: Refreshes with latest sheet data on each page load
- **Pure HTML/CSS/JS**: No build tools or dependencies needed

## 📋 Google Sheet Format

Your Google Sheet should have exactly this structure:

| Column A | Column B | Column C |
|----------|----------|----------|
| Name/Label | Latitude | Longitude |
| Coffee Shop | 39.7392 | -104.9903 |
| Restaurant | 39.7817 | -105.0178 |
| Park | 39.7547 | -105.0006 |

## 🚀 Super Quick Setup (3 steps!)

### 1. Get Google Maps API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable "Maps JavaScript API"
3. Create an API key

### 2. Publish Your Google Sheet
1. Create your Google Sheet with location data (see format above)
2. Go to **File > Share > Publish to web**
3. Click "Publish"
4. Copy the Sheet ID from your URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

### 3. Update Your Config
Edit `env.js` with your credentials:
```javascript
window.GOOGLE_MAPS_API_KEY = "your_api_key_here";
window.GOOGLE_SHEET_ID = "your_sheet_id_here";
```

**That's it!** Just open the page with a local server (see below).

## 📁 Project Files

```
mymaps/
├── index.html    # Main page - open this in browser
├── main.js       # Map logic
├── style.css     # Styling
├── env.js        # Your API keys (edit this!)
└── readme.md     # Instructions
```

## 🌐 How to Run (IMPORTANT!)

**⚠️ REQUIRED: You MUST use a local server to load env.js securely**

The `env.js` file cannot be loaded when opening `index.html` directly in the browser due to CORS security restrictions. You need to run a simple local server:

**Option 1: Python (Recommended)**
```bash
cd /path/to/mymaps
python -m http.server 8000
```
Then open: `http://localhost:8000`

**Option 2: Node.js**
```bash
npx serve .
```

**Option 3: PHP**
```bash
php -S localhost:8000
```

**Option 4: VS Code Live Server Extension**
- Install "Live Server" extension in VS Code
- Right-click `index.html` and select "Open with Live Server"

## 🔧 Customization

### Change Map Center
Edit the center coordinates in `main.js`:
```javascript
center: { lat: 39.5, lng: -104.8 }, // Your preferred center
```

### Change Map Zoom
Adjust the zoom level in `main.js`:
```javascript
zoom: 10, // Higher = more zoomed in
```

## 🚨 Troubleshooting

- **Map shows gray box**: Check your Google Maps API key
- **No pins appear**: Verify Google Sheet is published and Sheet ID is correct  
- **Wrong locations**: Make sure lat/lng are in decimal degrees (not degrees/minutes/seconds)
- **CORS errors**: Use a local server instead of opening file directly

## 🔒 Security Note

Since this runs entirely in the browser and has no password protection, your API key and data will be visible to anyone who accesses the page. For production use:
- Restrict your API key to your domain in Google Cloud Console
- Consider using a backend proxy for additional security
- If you need access control, consider adding authentication through a backend service

---

**Perfect for**: Quick prototypes, personal projects, simple location displays
**No need for**: npm, Node.js, build tools, or complex setup!