const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- Utilities & Geography ---
function toRad(deg) { return (deg * Math.PI) / 180; }
function haversineDistMeters(c1, c2) {
  const R = 6371000;
  const dLat = toRad(c2.lat - c1.lat);
  const dLon = toRad(c2.lon - c1.lon);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Estimate drive time in minutes (urban/interurban mix: ~45 km/h)
function estDriveMinutes(from, to) {
  const dist = haversineDistMeters(from, to);
  return Math.max(2, Math.round((dist / 1000) / 45 * 60));
}

// Estimate walk time in minutes (~4.5 km/h)
function estWalkMinutes(from, to) {
  const dist = haversineDistMeters(from, to);
  return Math.max(1, Math.round((dist / 1000) / 4.5 * 60));
}

// --- Safe Hubs / Transfer Points Dataset (Israel Central Hubs) ---
const SAFE_HUBS = [
  { id: 'tlv_savidor', name: 'רכבת סבידור מרכז', type: 'train_station', lat: 32.0835, lon: 34.7983, safe: true },
  { id: 'tlv_hashalom', name: 'רכבת השלום / עזריאלי', type: 'train_station', lat: 32.0734, lon: 34.7925, safe: true },
  { id: 'tlv_haganah', name: 'רכבת ההגנה / תחנה מרכזית', type: 'train_station', lat: 32.0538, lon: 34.7788, safe: true },
  { id: 'tlv_univ', name: 'רכבת תל אביב אוניברסיטה', type: 'train_station', lat: 32.1032, lon: 34.8049, safe: true },
  { id: 'herzliya_stn', name: 'רכבת הרצליה', type: 'train_station', lat: 32.1629, lon: 34.8252, safe: true },
  { id: 'rishon_moshe_dayan', name: 'רכבת ראשון לציון משה דיין', type: 'train_station', lat: 31.9877, lon: 34.7570, safe: true },
  { id: 'rishon_harishonim', name: 'רכבת הראשונים ראשון לציון', type: 'train_station', lat: 31.9493, lon: 34.8028, safe: true },
  { id: 'holon_wolfson', name: 'מחלף וולפסון / רכבת', type: 'train_station', lat: 32.0361, lon: 34.7601, safe: true },
  { id: 'pt_kiryat_aryeh', name: 'רכבת פתח תקווה קריית אריה', type: 'train_station', lat: 32.1054, lon: 34.8624, safe: true },
  { id: 'cinema_city_glilot', name: 'סינמה סיטי גלילות / תחנת דלק', type: 'commercial_gas', lat: 32.1462, lon: 34.8021, safe: true },
  { id: 'morasha_hub', name: 'מחלף מורשה / תחנת אוטובוס בינעירונית', type: 'bus_terminal', lat: 32.1384, lon: 34.8465, safe: true },
  { id: 'shapirim_park_ride', name: 'חניון הנתיב המהיר שפירים (Park & Ride)', type: 'park_and_ride', lat: 32.0078, lon: 34.8322, safe: true }
];

// --- Core Optimizer ---
function runOptimizer({ userOrigin, userDest, driverOrigin, driverDest, maxDetourMin = 20, maxWalkMin = 20, mode = 'smart' }) {
  const directDriverTime = estDriveMinutes(driverOrigin, driverDest);
  const candidates = [];

  for (const hub of SAFE_HUBS) {
    // Detour: DriverStart -> UserOrigin (pickup) -> Transfer Hub (dropoff) -> DriverDest
    const timeToPickup = estDriveMinutes(driverOrigin, userOrigin);
    const timePickupToHub = estDriveMinutes(userOrigin, hub);
    const timeHubToDriverDest = estDriveMinutes(hub, driverDest);
    
    const driverTripWithUser = timeToPickup + timePickupToHub + timeHubToDriverDest;
    const detourMin = Math.max(0, driverTripWithUser - directDriverTime);

    if (detourMin > maxDetourMin) continue;

    // User path: Car with driver to Hub -> Walk/Transit from Hub to User Destination
    const walkTimeToDest = estWalkMinutes(hub, userDest);
    let transitTime = 0;
    let transitTransfers = 0;

    if (walkTimeToDest > maxWalkMin) {
      // Approximate public transit leg (averaging ~20km/h with wait times)
      const distKm = haversineDistMeters(hub, userDest) / 1000;
      transitTime = Math.round(distKm / 20 * 60) + 7;
      transitTransfers = distKm > 8 ? 1 : 0;
    } else {
      transitTime = walkTimeToDest;
    }

    const totalUserTime = timePickupToHub + transitTime;

    // Scoring weights based on mode
    let score = 0;
    if (mode === 'fast') {
      score = totalUserTime * 1.5 + detourMin * 0.8;
    } else if (mode === 'easy') {
      score = totalUserTime * 1.0 + transitTransfers * 15 + (walkTimeToDest > maxWalkMin ? 10 : 0);
    } else {
      // Smart: Balanced optimal trade-off
      score = totalUserTime * 1.2 + detourMin * 1.0 + transitTransfers * 8;
    }

    candidates.push({
      hub,
      totalUserTime,
      detourMin,
      transitTime,
      transfers: transitTransfers,
      walkTime: Math.min(walkTimeToDest, 12),
      score,
      whyReason: `חיסכון משמעותי בזמן. עצירה ב${hub.name} שהיא נקודה בטוחה ומסודרת.`
    });
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, 5);
}

// --- API Endpoints ---
app.get('/health', (req, res) => res.json({ status: 'healthy', app: 'iWay', version: '1.0.0' }));

app.post('/v1/search', (req, res) => {
  const { userOrigin, userDest, driverOrigin, driverDest, maxDetourMin, maxWalkMin, mode } = req.body;
  if (!userOrigin || !userDest || !driverOrigin || !driverDest) {
    return res.status(400).json({ error: 'חסרים שדות חובה (מוצא/יעד משתמש ומוצא/יעד נהג)' });
  }

  const results = runOptimizer({
    userOrigin,
    userDest,
    driverOrigin,
    driverDest,
    maxDetourMin: Number(maxDetourMin) || 20,
    maxWalkMin: Number(maxWalkMin) || 20,
    mode: mode || 'smart'
  });

  res.json({ results, count: results.length });
});

// --- Frontend Web UI (Apple iOS 17/18 Human Interface Styling) ---
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <title>iWay</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    :root {
      --ios-bg: #F2F2F7;
      --ios-card: #FFFFFF;
      --ios-blue: #007AFF;
      --ios-text: #000000;
      --ios-secondary: #8E8E93;
      --ios-separator: #E5E5EA;
      --radius: 16px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --ios-bg: #000000;
        --ios-card: #1C1C1E;
        --ios-blue: #0A84FF;
        --ios-text: #FFFFFF;
        --ios-secondary: #8E8E93;
        --ios-separator: #38383A;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; -webkit-tap-highlight-color: transparent; }
    body { background-color: var(--ios-bg); color: var(--ios-text); padding: env(safe-area-inset-top, 20px) 16px calc(env(safe-area-inset-bottom, 20px) + 20px) 16px; }
    .header { padding: 12px 4px 18px; }
    .title { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; }
    .subtitle { font-size: 14px; color: var(--ios-secondary); }
    .card-title { font-size: 13px; text-transform: uppercase; color: var(--ios-secondary); margin: 0 4px 8px; font-weight: 600; }
    .card { background: var(--ios-card); border-radius: var(--radius); padding: 14px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .input-group { display: flex; flex-direction: column; gap: 1px; background: var(--ios-separator); border-radius: 10px; overflow: hidden; border: 1px solid var(--ios-separator); }
    .input-row { display: flex; align-items: center; background: var(--ios-card); padding: 10px 12px; }
    .input-row label { width: 75px; font-size: 15px; color: var(--ios-secondary); }
    .input-row input { flex: 1; border: none; outline: none; background: transparent; font-size: 16px; color: var(--ios-text); direction: rtl; }
    .btn-gps { border: none; background: none; font-size: 18px; cursor: pointer; }
    .segmented { display: flex; background: rgba(118, 118, 128, 0.12); border-radius: 9px; padding: 2px; gap: 2px; margin-top: 12px; }
    .segment { flex: 1; text-align: center; padding: 7px 0; font-size: 14px; border-radius: 7px; cursor: pointer; color: var(--ios-text); }
    .segment.active { background: var(--ios-card); font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .slider-row { display: flex; justify-content: space-between; font-size: 14px; margin: 10px 2px 4px; }
    .slider-val { font-weight: 600; color: var(--ios-blue); }
    input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px; background: var(--ios-separator); outline: none; margin-bottom: 12px; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #FFF; box-shadow: 0 2px 6px rgba(0,0,0,0.25); cursor: pointer; }
    .btn-primary { width: 100%; background: var(--ios-blue); color: #FFF; border: none; border-radius: 14px; padding: 16px; font-size: 17px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,122,255,0.25); }
    #map { width: 100%; height: 220px; border-radius: var(--radius); margin-top: 16px; border: 1px solid var(--ios-separator); }
    .result-card { background: var(--ios-card); border-radius: var(--radius); padding: 14px; margin-top: 12px; border: 1px solid var(--ios-separator); }
    .result-card.best { border: 1.5px solid var(--ios-blue); }
    .result-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
    .result-time { font-size: 22px; font-weight: 700; }
    .badge { background: rgba(0, 122, 255, 0.1); color: var(--ios-blue); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .result-desc { font-size: 13px; color: var(--ios-secondary); margin: 6px 0 12px; }
    .action-row { display: flex; gap: 8px; }
    .btn-action { flex: 1; text-align: center; text-decoration: none; padding: 10px; background: rgba(118, 118, 128, 0.1); color: var(--ios-blue); border-radius: 10px; font-size: 14px; font-weight: 600; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
    .modal { background: var(--ios-card); border-radius: 20px; padding: 24px 20px; text-align: center; max-width: 320px; }
  </style>
</head>
<body>

  <div id="privacy-modal" class="modal-backdrop">
    <div class="modal">
      <div style="font-size: 38px; margin-bottom: 8px;">🛡️</div>
      <h3 style="font-size: 18px; margin-bottom: 8px;">פרטיות ב-iWay</h3>
      <p style="font-size: 13px; color: var(--ios-secondary); margin-bottom: 18px; line-height: 1.4;">
        iWay מחשבת נתיבי מעבר בזמן אמת. נתוני המיקום מעובדים בזיכרון המכשיר בלבד ואינם נשמרים בשרת.
      </p>
      <button class="btn-primary" onclick="acceptPrivacy()">אישור והמשך</button>
    </div>
  </div>

  <header class="header">
    <h1 class="title">iWay</h1>
    <div class="subtitle">Your way to get there</div>
  </header>

  <div class="card-title">הנסיעה שלך</div>
  <div class="card">
    <div class="input-group">
      <div class="input-row">
        <label>מוצא</label>
        <input type="text" id="userOrigin" value="ראשון לציון" placeholder="היכן אתה נמצא?">
        <button class="btn-gps" onclick="getGPS()">📍</button>
      </div>
      <div class="input-row">
        <label>יעד</label>
        <input type="text" id="userDest" value="תל אביב - עזריאלי" placeholder="לאן צריך להגיע?">
      </div>
    </div>
    <div class="segmented" id="modes">
      <div class="segment active" onclick="setMode('smart', this)">Smart</div>
      <div class="segment" onclick="setMode('fast', this)">Fast</div>
      <div class="segment" onclick="setMode('easy', this)">Easy</div>
    </div>
  </div>

  <div class="card-title">נסיעה עם נהג</div>
  <div class="card">
    <div class="input-group">
      <div class="input-row">
        <label>מוצא נהג</label>
        <input type="text" id="driverOrigin" value="ראשון לציון" placeholder="מהיכן הנהג יוצא?">
      </div>
      <div class="input-row">
        <label>יעד נהג</label>
        <input type="text" id="driverDest" value="הרצליה פיתוח" placeholder="לאן הנהג ממשיך?">
      </div>
    </div>
    <div class="slider-row">
      <span>מקסימום סטייה לנהג</span>
      <span class="slider-val" id="detourVal">20 דקות</span>
    </div>
    <input type="range" id="detourSlider" min="5" max="120" step="5" value="20" oninput="detourVal.innerText = this.value + ' דקות'">
  </div>

  <button class="btn-primary" onclick="searchTrip()">מצא לי דרך</button>

  <div id="map"></div>
  <div id="results" style="margin-top: 14px;"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    let selectedMode = 'smart';
    const map = L.map('map').setView([32.0853, 34.7818], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    function acceptPrivacy() {
      document.getElementById('privacy-modal').style.display = 'none';
    }

    function setMode(mode, el) {
      selectedMode = mode;
      document.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
    }

    function getGPS() {
      if (!navigator.geolocation) return alert('GPS אינו נתמך במכשיר');
      navigator.geolocation.getCurrentPosition(pos => {
        document.getElementById('userOrigin').value = 'מיקום נוכחי (' + pos.coords.latitude.toFixed(3) + ', ' + pos.coords.longitude.toFixed(3) + ')';
      }, () => alert('נא לאשר גישת מיקום בהגדרות הדפדפן'));
    }

    async function searchTrip() {
      const payload = {
        userOrigin: { lat: 31.9730, lon: 34.7925 },
        userDest: { lat: 32.0734, lon: 34.7925 },
        driverOrigin: { lat: 31.9610, lon: 34.8016 },
        driverDest: { lat: 32.1629, lon: 34.8085 },
        maxDetourMin: document.getElementById('detourSlider').value,
        mode: selectedMode
      };

      const res = await fetch('/v1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      renderResults(data.results);
    }

    function renderResults(results) {
      const container = document.getElementById('results');
      container.innerHTML = '';
      if (!results || results.length === 0) {
        container.innerHTML = '<div class="card">לא נמצאו מסלולים בטווח הסטייה שהוגדר. נסה להגדיל את זמן הסטייה.</div>';
        return;
      }

      results.forEach((r, idx) => {
        const isBest = idx === 0;
        const wazeUrl = 'https://waze.com/ul?ll=' + r.hub.lat + ',' + r.hub.lon + '&navigate=yes';
        const card = document.createElement('div');
        card.className = 'result-card ' + (isBest ? 'best' : '');
        card.innerHTML = \`
          <div class="result-header">
            <div class="result-time">\${r.totalUserTime} דקות הגעה</div>
            <span class="badge">\${isBest ? 'Smart Choice' : '+' + r.detourMin + ' דק לנהג'}</span>
          </div>
          <div style="font-size: 14px; font-weight: 600;">נקודת מעבר: \${r.hub.name}</div>
          <div class="result-desc">\${r.whyReason}</div>
          <div class="action-row">
            <a class="btn-action" href="\${wazeUrl}" target="_blank">נווט ב-Waze</a>
            <button class="btn-action" onclick="shareTrip('\${r.hub.name}', \${r.detourMin}, '\${wazeUrl}')">שתף עם הנהג</button>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function shareTrip(hubName, detour, navUrl) {
      const text = 'היי, מצאתי נקודת מעבר מצוינת ב-' + hubName + '. זה מוסיף לך רק כ-' + detour + ' דקות לנסיעה. קישור לניווט: ' + navUrl;
      if (navigator.share) {
        navigator.share({ title: 'iWay מסלול משותף', text: text });
      } else {
        window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text));
      }
    }
  </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('iWay Server running on port ' + PORT);
});
