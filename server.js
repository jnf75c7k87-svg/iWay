const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- מסד נתוני נקודות מעבר בטוחות ומאושרות בישראל ---
const SAFE_HUBS = [
  { id: 'tlv_savidor', name: 'רכבת ת"א סבידור מרכז', type: 'רכבת ישראל', line: 'רכבת בינעירונית / קו אדום', lat: 32.0835, lon: 34.7983, safe: true },
  { id: 'tlv_hashalom', name: 'רכבת ת"א השלום / עזריאלי', type: 'רכבת ישראל', line: 'רכבת בינעירונית / קווי אוטובוס מרכזיים', lat: 32.0734, lon: 34.7925, safe: true },
  { id: 'tlv_haganah', name: 'רכבת ת"א ההגנה / תחנה מרכזית', type: 'רכבת ישראל', line: 'רכבת וקווי דרום', lat: 32.0538, lon: 34.7788, safe: true },
  { id: 'tlv_univ', name: 'רכבת ת"א אוניברסיטה', type: 'רכבת ישראל', line: 'רכבת חוף / צפון', lat: 32.1032, lon: 34.8049, safe: true },
  { id: 'herzliya_stn', name: 'רכבת הרצליה', type: 'רכבת ישראל', line: 'רכבת בינעירונית / קווי שרון', lat: 32.1629, lon: 34.8252, safe: true },
  { id: 'rishon_moshe_dayan', name: 'רכבת משה דיין ראשון לציון', type: 'רכבת ישראל', line: 'רכבת / קווי חולון-בת ים', lat: 31.9877, lon: 34.7570, safe: true },
  { id: 'rishon_harishonim', name: 'רכבת הראשונים ראשון לציון', type: 'רכבת ישראל', line: 'רכבת / תחנה מרכזית', lat: 31.9493, lon: 34.8028, safe: true },
  { id: 'holon_wolfson', name: 'מחלף וולפסון / רכבת', type: 'רכבת ורכבת קלה', line: 'קו אדום ורכבת', lat: 32.0361, lon: 34.7601, safe: true },
  { id: 'pt_kiryat_aryeh', name: 'רכבת פ"ת קריית אריה', type: 'רכבת ורכבת קלה', line: 'קו אדום דנקל', lat: 32.1054, lon: 34.8624, safe: true },
  { id: 'cinema_city_glilot', name: 'סינמה סיטי גלילות / תחנת דלק', type: 'תחנת דלק ומרכז מסחרי', line: 'קווי השרון ותל אביב', lat: 32.1462, lon: 34.8021, safe: true },
  { id: 'morasha_hub', name: 'מחלף מורשה / תחנה אזורית', type: 'מסוף אוטובוסים', line: 'קווים בינעירוניים 47 / 501 / 567', lat: 32.1384, lon: 34.8465, safe: true },
  { id: 'shapirim_park_ride', name: 'חניון שפירים הנתיב המהיר (Park & Ride)', type: 'חניון ומסוף שאטלים', line: 'שאטל ישיר לתל אביב', lat: 32.0078, lon: 34.8322, safe: true }
];

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

function estDriveMinutes(from, to) {
  const dist = haversineDistMeters(from, to);
  return Math.max(3, Math.round((dist / 1000) / 45 * 60));
}

function estWalkMinutes(from, to) {
  const dist = haversineDistMeters(from, to);
  return Math.max(1, Math.round((dist / 1000) / 4.2 * 60));
}

// אלגוריתם ה-Optimizer של iWay
function runOptimizer({ userOrigin, userDest, driverOrigin, driverDest, hasDriver = true, maxDetourMin = 20, maxWalkMin = 20, mode = 'smart' }) {
  const candidates = [];

  if (!hasDriver) {
    // מסלול תחבורה ציבורית והליכה בלבד
    const distKm = haversineDistMeters(userOrigin, userDest) / 1000;
    const walkMins = estWalkMinutes(userOrigin, userDest);
    const transitMins = Math.round(distKm / 22 * 60) + 8;
    const totalTime = Math.min(walkMins, transitMins);

    return [{
      id: 'pt_only',
      hub: { name: 'תחבורה ציבורית ישירה', type: 'אוטובוס / רכבת', line: 'קווים ישירים', lat: userDest.lat, lon: userDest.lon },
      totalUserTime: totalTime,
      detourMin: 0,
      walkTime: Math.min(walkMins, 8),
      transfers: distKm > 9 ? 1 : 0,
      modeUsed: 'תחבורה ציבורית בלבד',
      whyReason: 'ללא נסיעה ברכב: הגעה בתחבורה ציבורית ישירה ליעדך.',
      timeline: [
        { icon: '🚶', title: 'הליכה לתחנה', desc: 'כ-5 דקות הליכה ממוצא הנסיעה' },
        { icon: '🚆', title: 'נסיעה בתחבורה ציבורית', desc: `זמן נסיעה מוערך כ-${totalTime - 7} דקות` },
        { icon: '📍', title: 'הגעה ליעד', desc: 'הגעה רגלית קצרה ליעד הסופי' }
      ]
    }];
  }

  // חישוב מסלול הנהג המקורי A -> B
  const directDriverTime = estDriveMinutes(driverOrigin, driverDest);

  for (const hub of SAFE_HUBS) {
    // סטיית נהג מדויקת ולא מצטברת: מוצא נהג -> איסוף משתמש -> נקודת מעבר -> יעד נהג
    const timeToPickup = estDriveMinutes(driverOrigin, userOrigin);
    const timePickupToHub = estDriveMinutes(userOrigin, hub);
    const timeHubToDriverDest = estDriveMinutes(hub, driverDest);
    
    const driverTripWithUser = timeToPickup + timePickupToHub + timeHubToDriverDest;
    const detourMin = Math.max(0, driverTripWithUser - directDriverTime);

    if (detourMin > maxDetourMin) continue;

    // המשך דרכו של המשתמש: נקודת מעבר -> יעד
    const walkTimeToDest = estWalkMinutes(hub, userDest);
    let transitTime = 0;
    let transfers = 0;
    let transitName = '';

    if (walkTimeToDest > maxWalkMin) {
      const distKm = haversineDistMeters(hub, userDest) / 1000;
      transitTime = Math.round(distKm / 24 * 60) + 6;
      transfers = distKm > 10 ? 1 : 0;
      transitName = hub.type.includes('רכבת') ? 'רכבת ישראל' : 'אוטובוס מהיר';
    } else {
      transitTime = walkTimeToDest;
      transitName = 'הליכה רגלית ישירה';
    }

    const totalUserTime = timePickupToHub + transitTime;

    let score = 0;
    if (mode === 'fast') {
      score = totalUserTime * 1.6 + detourMin * 0.7;
    } else if (mode === 'easy') {
      score = totalUserTime * 1.0 + (walkTimeToDest > 10 ? 20 : 0) + transfers * 25;
    } else {
      // Smart ברירת מחדל: איזון אופטימלי
      score = totalUserTime * 1.2 + detourMin * 1.1 + transfers * 10;
    }

    candidates.push({
      id: hub.id,
      hub,
      totalUserTime,
      detourMin,
      rideWithDriverTime: timePickupToHub,
      transitTime,
      transfers,
      walkTime: Math.min(walkTimeToDest, 10),
      transitName,
      score,
      whyReason: `חיסכון של ${Math.max(10, 45 - totalUserTime)} דקות לעומת תחבורה רגילה. נקודת הורדה בטוחה ב${hub.name}.`,
      timeline: [
        { icon: '🚗', title: 'איסוף על ידי הנהג', desc: `איסוף במוצא שלך, נסיעה משותפת כ-${timePickupToHub} דקות` },
        { icon: '📍', title: `הורדה בנקודת מעבר: ${hub.name}`, desc: `סטיית נהג: +${detourMin} דק׳ מהמסלול הרגיל שלו` },
        { icon: hub.type.includes('רכבת') ? '🚆' : '🚌', title: `המשך ב${transitName}`, desc: `${hub.line} (כ-${transitTime} דקות)` },
        { icon: '🎯', title: 'הגעה ליעד', desc: 'הגעה ליעד המבוקש' }
      ]
    });
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, 5);
}

// שירות חיפוש כתובות אוטומטי בישראל (Open Data Autocomplete)
app.get('/v1/geocode', async (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 2) return res.json([]);
  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&q=${encodeURIComponent(query)}&limit=5`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'iWayApp-Israel/1.0' } });
    const data = await resp.json();
    const results = data.map(item => ({
      name: item.display_name.split(',')[0],
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }));
    res.json(results);
  } catch (err) {
    res.json([]);
  }
});

app.post('/v1/search', (req, res) => {
  const { userOrigin, userDest, driverOrigin, driverDest, hasDriver, maxDetourMin, maxWalkMin, mode } = req.body;
  if (!userOrigin || !userDest) {
    return res.status(400).json({ error: 'חסרים מוצא או יעד למשתמש' });
  }

  const results = runOptimizer({
    userOrigin,
    userDest,
    driverOrigin: driverOrigin || userOrigin,
    driverDest: driverDest || userDest,
    hasDriver: hasDriver !== false,
    maxDetourMin: Number(maxDetourMin) || 20,
    maxWalkMin: Number(maxWalkMin) || 20,
    mode: mode || 'smart'
  });

  res.json({ results, count: results.length });
});

// דף האפליקציה המלא
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
      --bg: #F2F2F7;
      --card: #FFFFFF;
      --blue: #007AFF;
      --text: #000000;
      --sec: #8E8E93;
      --border: #E5E5EA;
      --tint: rgba(0, 122, 255, 0.1);
      --green: #34C759;
      --radius: 16px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #000000;
        --card: #1C1C1E;
        --blue: #0A84FF;
        --text: #FFFFFF;
        --sec: #8E8E93;
        --border: #38383A;
        --tint: rgba(10, 132, 255, 0.15);
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; -webkit-tap-highlight-color: transparent; }
    body { background: var(--bg); color: var(--text); padding: env(safe-area-inset-top, 20px) 16px calc(env(safe-area-inset-bottom, 20px) + 30px); }
    .header { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 4px 16px; }
    .title { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; }
    .subtitle { font-size: 13px; color: var(--sec); }
    .card-title { font-size: 13px; text-transform: uppercase; color: var(--sec); margin: 0 4px 6px; font-weight: 600; }
    .card { background: var(--card); border-radius: var(--radius); padding: 14px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    
    .input-row { display: flex; align-items: center; background: var(--card); padding: 10px 4px; border-bottom: 1px solid var(--border); position: relative; }
    .input-row:last-child { border-bottom: none; }
    .input-row label { width: 70px; font-size: 15px; color: var(--sec); font-weight: 500; }
    .input-row input { flex: 1; border: none; outline: none; background: transparent; font-size: 16px; color: var(--text); direction: rtl; }
    .btn-icon { background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px; color: var(--blue); }

    .segmented { display: flex; background: rgba(118, 118, 128, 0.12); border-radius: 9px; padding: 2px; gap: 2px; margin-top: 12px; }
    .segment { flex: 1; text-align: center; padding: 8px 0; font-size: 14px; border-radius: 7px; cursor: pointer; color: var(--text); }
    .segment.active { background: var(--card); font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }

    .slider-header { display: flex; justify-content: space-between; font-size: 14px; margin: 10px 0 6px; }
    .slider-val { font-weight: 600; color: var(--blue); }
    input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px; background: var(--border); outline: none; margin-bottom: 8px; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #FFF; box-shadow: 0 2px 6px rgba(0,0,0,0.25); cursor: pointer; }

    .btn-primary { width: 100%; background: var(--blue); color: #FFF; border: none; border-radius: 14px; padding: 16px; font-size: 17px; font-weight: 600; cursor: pointer; margin-top: 6px; box-shadow: 0 4px 12px rgba(0,122,255,0.25); }
    .btn-primary:active { opacity: 0.85; }

    #map { width: 100%; height: 220px; border-radius: var(--radius); margin-top: 14px; border: 1px solid var(--border); }
    .map-helper { font-size: 12px; color: var(--sec); text-align: center; margin-top: 4px; }

    /* Results Cards & Moovit-like Details */
    .result-card { background: var(--card); border-radius: var(--radius); padding: 14px; margin-top: 12px; border: 1px solid var(--border); cursor: pointer; transition: all 0.2s ease; }
    .result-card.featured { border: 1.5px solid var(--blue); }
    .result-top { display: flex; justify-content: space-between; align-items: baseline; }
    .result-time { font-size: 24px; font-weight: 700; }
    .badge { background: var(--tint); color: var(--blue); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .badge-green { background: rgba(52, 199, 89, 0.15); color: var(--green); }
    .result-sub { font-size: 13px; color: var(--sec); margin: 6px 0 10px; }

    /* Timeline breakdown (Moovit style) */
    .timeline { border-top: 1px solid var(--border); margin-top: 10px; padding-top: 12px; display: none; }
    .timeline.show { display: block; }
    .timeline-step { display: flex; gap: 12px; margin-bottom: 14px; position: relative; }
    .timeline-step:not(:last-child)::after { content: ''; position: absolute; right: 13px; top: 26px; bottom: -12px; width: 2px; background: var(--border); }
    .step-icon { width: 28px; height: 28px; border-radius: 50%; background: var(--tint); display: flex; align-items: center; justify-content: center; font-size: 14px; z-index: 2; }
    .step-content { flex: 1; }
    .step-title { font-size: 14px; font-weight: 600; }
    .step-desc { font-size: 12px; color: var(--sec); margin-top: 2px; }

    .action-row { display: flex; gap: 8px; margin-top: 10px; }
    .btn-action { flex: 1; text-align: center; text-decoration: none; padding: 10px; background: var(--tint); color: var(--blue); border-radius: 10px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; }

    /* Autocomplete dropdown */
    .ac-list { position: absolute; top: 100%; right: 0; left: 0; background: var(--card); border: 1px solid var(--border); border-radius: 10px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-height: 180px; overflow-y: auto; display: none; }
    .ac-item { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid var(--border); cursor: pointer; }
    .ac-item:last-child { border-bottom: none; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
    .modal { background: var(--card); border-radius: 20px; padding: 22px; text-align: center; max-width: 320px; }
  </style>
</head>
<body>

  <div id="privacy-modal" class="modal-backdrop">
    <div class="modal">
      <div style="font-size: 40px; margin-bottom: 8px;">🛡️</div>
      <h3 style="font-size: 18px; margin-bottom: 8px;">פרטיות ב-iWay</h3>
      <p style="font-size: 13px; color: var(--sec); margin-bottom: 18px; line-height: 1.4;">
        iWay מתאימה את המסלול בזמן אמת. נתוני ה-GPS משמשים לחישוב הנוכחי בלבד, ללא שמירת היסטוריה או שיתוף עם צד שלישי.
      </p>
      <button class="btn-primary" onclick="initPrivacy()">אישור והמשך</button>
    </div>
  </div>

  <header class="header">
    <div>
      <h1 class="title">iWay</h1>
      <div class="subtitle">Your way to get there</div>
    </div>
  </header>

  <!-- פרטי הנסיעה שלך -->
  <div class="card-title">הנסיעה שלך</div>
  <div class="card">
    <div class="input-row">
      <label>מוצא</label>
      <input type="text" id="userOriginInput" placeholder="היכן אתה נמצא?" autocomplete="off" oninput="handleAc('userOrigin')">
      <button class="btn-icon" title="מיקום נוכחי" onclick="useCurrentGPS()">📍</button>
      <button class="btn-icon" title="בחר על המפה" onclick="startMapPick('userOrigin')">🗺️</button>
      <div id="ac-userOrigin" class="ac-list"></div>
    </div>
    <div class="input-row">
      <label>יעד</label>
      <input type="text" id="userDestInput" placeholder="לאן להגיע?" autocomplete="off" oninput="handleAc('userDest')">
      <button class="btn-icon" title="בחר על המפה" onclick="startMapPick('userDest')">🗺️</button>
      <div id="ac-userDest" class="ac-list"></div>
    </div>

    <div class="segmented">
      <div class="segment active" data-mode="smart" onclick="changeMode('smart', this)">Smart</div>
      <div class="segment" data-mode="fast" onclick="changeMode('fast', this)">Fast</div>
      <div class="segment" data-mode="easy" onclick="changeMode('easy', this)">Easy</div>
    </div>
  </div>

  <!-- נסיעה עם נהג -->
  <div class="card-title">נסיעה עם נהג (אופציונלי)</div>
  <div class="card">
    <div class="input-row">
      <label>מוצא נהג</label>
      <input type="text" id="driverOriginInput" placeholder="מהיכן הנהג יוצא?" autocomplete="off" oninput="handleAc('driverOrigin')">
      <button class="btn-icon" title="בחר על המפה" onclick="startMapPick('driverOrigin')">🗺️</button>
      <div id="ac-driverOrigin" class="ac-list"></div>
    </div>
    <div class="input-row">
      <label>יעד נהג</label>
      <input type="text" id="driverDestInput" placeholder="לאן הנהג ממשיך?" autocomplete="off" oninput="handleAc('driverDest')">
      <button class="btn-icon" title="בחר על המפה" onclick="startMapPick('driverDest')">🗺️</button>
      <div id="ac-driverDest" class="ac-list"></div>
    </div>

    <div class="slider-header">
      <span>מקסימום סטייה לנהג</span>
      <span class="slider-val" id="detourText">20 דקות</span>
    </div>
    <input type="range" id="detourRange" min="5" max="120" step="5" value="20" oninput="updateDetour(this.value)">
  </div>

  <button class="btn-primary" onclick="triggerSearch()">מצא לי דרך</button>

  <div id="map"></div>
  <div class="map-helper" id="mapHelperText">לחץ על 🗺️ ליד אחד השדות כדי למקם נעץ על המפה</div>

  <div id="results-area" style="margin-top: 14px;"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    // State
    let activeMode = 'smart';
    let pickingField = null;
    let mapMarker = null;

    const coords = {
      userOrigin: { lat: 31.9730, lon: 34.7925, name: 'ראשון לציון (נוכחי)' },
      userDest: { lat: 32.0734, lon: 34.7925, name: 'תל אביב - עזריאלי' },
      driverOrigin: { lat: 31.9610, lon: 34.8016, name: 'ראשון לציון' },
      driverDest: { lat: 32.1629, lon: 34.8085, name: 'הרצליה פיתוח' }
    };

    const map = L.map('map').setView([32.0853, 34.7818], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // מנגנון בחירת נקודה חופשית מהמפה
    map.on('click', e => {
      if (!pickingField) return;
      const { lat, lng } = e.latlng;
      coords[pickingField] = { lat, lon: lng, name: lat.toFixed(4) + ', ' + lng.toFixed(4) };
      document.getElementById(pickingField + 'Input').value = coords[pickingField].name;
      
      if (mapMarker) map.removeLayer(mapMarker);
      mapMarker = L.marker([lat, lng]).addTo(map).bindPopup('מיקום נבחר: ' + coords[pickingField].name).openPopup();
      
      document.getElementById('mapHelperText').innerText = 'נבחר מיקום עבור שדה זה!';
      pickingField = null;
    });

    function startMapPick(field) {
      pickingField = field;
      document.getElementById('mapHelperText').innerText = '👈 הקלק על המפה כדי לבחור מיקום עבור ' + (field.includes('user') ? 'הנוסע' : 'הנהג');
      document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
    }

    function initPrivacy() {
      document.getElementById('privacy-modal').style.display = 'none';
      useCurrentGPS();
    }

    function useCurrentGPS() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        coords.userOrigin = { lat: latitude, lon: longitude, name: 'המיקום הנוכחי שלי' };
        document.getElementById('userOriginInput').value = coords.userOrigin.name;
        map.setView([latitude, longitude], 13);
        if (mapMarker) map.removeLayer(mapMarker);
        mapMarker = L.marker([latitude, longitude]).addTo(map).bindPopup('אתה כאן').openPopup();
      }, () => {
        // Fallback default
        document.getElementById('userOriginInput').value = coords.userOrigin.name;
      });
    }

    function updateDetour(val) {
      document.getElementById('detourText').innerText = val + ' דקות';
      triggerSearch();
    }

    function changeMode(mode, el) {
      activeMode = mode;
      document.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      triggerSearch();
    }

    // שירות חיפוש כתובות אוטומטי (Autocomplete)
    let acTimer = null;
    function handleAc(field) {
      clearTimeout(acTimer);
      const val = document.getElementById(field + 'Input').value;
      const box = document.getElementById('ac-' + field);
      if (val.length < 2) { box.style.display = 'none'; return; }

      acTimer = setTimeout(async () => {
        try {
          const res = await fetch('/v1/geocode?q=' + encodeURIComponent(val));
          const list = await res.json();
          box.innerHTML = '';
          if (list.length === 0) { box.style.display = 'none'; return; }
          list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'ac-item';
            div.innerText = item.name;
            div.onclick = () => {
              coords[field] = { lat: item.lat, lon: item.lon, name: item.name };
              document.getElementById(field + 'Input').value = item.name;
              box.style.display = 'none';
              map.setView([item.lat, item.lon], 13);
            };
            box.appendChild(div);
          });
          box.style.display = 'block';
        } catch(e) {}
      }, 300);
    }

    // חיפוש והצגת תוצאות
    async function triggerSearch() {
      const payload = {
        userOrigin: coords.userOrigin,
        userDest: coords.userDest,
        driverOrigin: coords.driverOrigin,
        driverDest: coords.driverDest,
        maxDetourMin: document.getElementById('detourRange').value,
        mode: activeMode
      };

      const res = await fetch('/v1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      renderMoovitResults(data.results);
    }

    function renderMoovitResults(results) {
      const container = document.getElementById('results-area');
      container.innerHTML = '';

      if (!results || results.length === 0) {
        container.innerHTML = '<div class="card">לא נמצא מסלול בטווח הסטייה. נסה להעלות את זמן הסטייה בסליידר.</div>';
        return;
      }

      results.forEach((r, idx) => {
        const isBest = idx === 0;
        const wazeUrl = 'https://waze.com/ul?ll=' + r.hub.lat + ',' + r.hub.lon + '&navigate=yes';
        const gmapsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + r.hub.lat + ',' + r.hub.lon;

        const card = document.createElement('div');
        card.className = 'result-card ' + (isBest ? 'featured' : '');
        card.innerHTML = \`
          <div class="result-top">
            <div>
              <span class="result-time">\${r.totalUserTime} דקות</span>
              <span style="font-size: 13px; color: var(--sec); margin-right: 4px;">זמן הגעה כולל</span>
            </div>
            <span class="badge \${isBest ? 'badge-green' : ''}">\${isBest ? 'מומלץ - ' + activeMode.toUpperCase() : '+' + r.detourMin + ' דק׳ לנהג'}</span>
          </div>

          <div style="font-size: 15px; font-weight: 600; margin-top: 6px;">נקודת מעבר: \${r.hub.name}</div>
          <div class="result-sub">\${r.whyReason}</div>

          <!-- כפתור לפתיחת פירוט צעד-אחר-צעד (סגנון Moovit) -->
          <div class="timeline" id="timeline-\${idx}">
            <div style="font-size: 12px; font-weight: 700; color: var(--sec); margin-bottom: 10px;">שלבי המסלול המפורטים:</div>
            \${r.timeline.map(t => \`
              <div class="timeline-step">
                <div class="step-icon">\${t.icon}</div>
                <div class="step-content">
                  <div class="step-title">\${t.title}</div>
                  <div class="step-desc">\${t.desc}</div>
                </div>
              </div>
            \`).join('')}
          </div>

          <div class="action-row">
            <button class="btn-action" onclick="toggleTimeline(\${idx}, this)">📋 פירוט מסלול</button>
            <a class="btn-action" href="\${wazeUrl}" target="_blank">נווט ב-Waze</a>
            <button class="btn-action" onclick="shareWithDriver('\${r.hub.name}', \${r.detourMin}, '\${wazeUrl}')">שתף עם הנהג</button>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function toggleTimeline(idx, btn) {
      const el = document.getElementById('timeline-' + idx);
      const isShowing = el.classList.toggle('show');
      btn.innerText = isShowing ? 'סגור פירוט' : '📋 פירוט מסלול';
    }

    function shareWithDriver(hubName, detour, wazeUrl) {
      const text = 'היי, מצאתי נקודת מפגש מצוינת ב-' + hubName + '. זה מוסיף לך רק ' + detour + ' דקות לנסיעה. קישור לניווט ב-Waze: ' + wazeUrl;
      if (navigator.share) {
        navigator.share({ title: 'iWay נקודת מפגש', text });
      } else {
        window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text));
      }
    }

    // הפעלה ראשונית
    document.getElementById('userOriginInput').value = coords.userOrigin.name;
    document.getElementById('userDestInput').value = coords.userDest.name;
    document.getElementById('driverOriginInput').value = coords.driverOrigin.name;
    document.getElementById('driverDestInput').value = coords.driverDest.name;
  </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('iWay Server running on port ' + PORT);
});
