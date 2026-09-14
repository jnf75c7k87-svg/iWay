const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- מאגר נקודות מעבר בטוחות ומאושרות בפריסה ארצית רחבה ---
const SAFE_HUBS = [
  // דרום ושפלה
  { id: 'kiryat_gat_stn', name: 'רכבת קריית גת', type: 'רכבת ישראל', line: 'קו באר שבע - תל אביב וקווים אזוריים', lat: 31.6035, lon: 34.7738, safe: true },
  { id: 'plugot_junction', name: 'צומת פלוגות / תחנת אוטובוס מרכזית', type: 'מסוף אוטובוסים', line: 'קווים בינעירוניים 368 / 369 / 370', lat: 31.6214, lon: 34.7478, safe: true },
  { id: 'ashkelon_stn', name: 'רכבת אשקלון', type: 'רכבת ישראל', line: 'קו החוף הדרומי וקווים אזוריים', lat: 31.6750, lon: 34.5950, safe: true },
  { id: 'beer_sheva_merkaz', name: 'רכבת באר שבע מרכז', type: 'רכבת ישראל', line: 'קווי דרום ורכבות בינעירוניות', lat: 31.2435, lon: 34.7972, safe: true },
  { id: 'ashdod_ad_halom', name: 'רכבת אשדוד עד הלום', type: 'רכבת ישראל', line: 'רכבת בינעירונית וקווי שפלה', lat: 31.7770, lon: 34.6660, safe: true },
  { id: 'rehovot_stn', name: 'רכבת רחובות', type: 'רכבת ישראל', line: 'רכבת בינעירונית וקווי רחובות', lat: 31.9080, lon: 34.8080, safe: true },
  { id: 'gedera_central', name: 'צומת גדרה / תחנה מרכזית', type: 'מסוף אוטובוסים', line: 'קווי שפלה ודרום', lat: 31.8120, lon: 34.7770, safe: true },
  { id: 'latrun_hub', name: 'מחלף לטרון / דור אלון', type: 'תחנת דלק ומסוף', line: 'קווי ירושלים ומרכז', lat: 31.8360, lon: 34.9810, safe: true },
  
  // מרכז וגוש דן
  { id: 'rishon_moshe_dayan', name: 'רכבת משה דיין ראשון לציון', type: 'רכבת ישראל', line: 'רכבת וקווי חולון-בת ים', lat: 31.9877, lon: 34.7570, safe: true },
  { id: 'rishon_harishonim', name: 'רכבת הראשונים ראשון לציון', type: 'רכבת ישראל', line: 'רכבת ותחנה מרכזית', lat: 31.9493, lon: 34.8028, safe: true },
  { id: 'tlv_haganah', name: 'רכבת ת"א ההגנה / מרכזית', type: 'רכבת ישראל', line: 'רכבת וקווי דרום', lat: 32.0538, lon: 34.7788, safe: true },
  { id: 'tlv_hashalom', name: 'רכבת ת"א השלום / עזריאלי', type: 'רכבת ישראל', line: 'רכבת וציר עזריאלי', lat: 32.0734, lon: 34.7925, safe: true },
  { id: 'tlv_savidor', name: 'רכבת ת"א סבידור מרכז', type: 'רכבת ישראל', line: 'רכבת ודנקל קו אדום', lat: 32.0835, lon: 34.7983, safe: true },
  { id: 'tlv_univ', name: 'רכבת ת"א אוניברסיטה', type: 'רכבת ישראל', line: 'רכבת חוף / צפון', lat: 32.1032, lon: 34.8049, safe: true },
  { id: 'shapirim_park_ride', name: 'חניון שפירים הנתיב המהיר', type: 'Park & Ride', line: 'שאטל ישיר לתל אביב', lat: 32.0078, lon: 34.8322, safe: true },
  
  // שרון, צפון וירושלים
  { id: 'herzliya_stn', name: 'רכבת הרצליה', type: 'רכבת ישראל', line: 'רכבת וקווי שרון', lat: 32.1629, lon: 34.8252, safe: true },
  { id: 'netanya_stn', name: 'רכבת נתניה', type: 'רכבת ישראל', line: 'רכבת בינעירונית', lat: 32.3190, lon: 34.8660, safe: true },
  { id: 'hadera_maarav', name: 'רכבת חדרה מערב', type: 'רכבת ישראל', line: 'רכבת חוף', lat: 32.4410, lon: 34.9080, safe: true },
  { id: 'afula_stn', name: 'רכבת עפולה / העמק', type: 'רכבת ישראל', line: 'רכבת העמק וקווי צפון', lat: 32.6140, lon: 35.2950, safe: true },
  { id: 'yagur_junction', name: 'מחלף יגור / מסוף', type: 'מסוף אוטובוסים', line: 'קווי עמקים וחיפה', lat: 32.7440, lon: 35.0760, safe: true },
  { id: 'haifa_hof_hacarmel', name: 'מרכזית חוף הכרמל חיפה', type: 'רכבת ומרכזית', line: 'רכבת וקווים צפוניים', lat: 32.7930, lon: 34.9570, safe: true },
  { id: 'jerusalem_navon', name: 'רכבת יצחק נבון ירושלים', type: 'רכבת ורכבת קלה', line: 'רכבת מהירה וקווי ירושלים', lat: 31.7870, lon: 35.2010, safe: true }
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
  return Math.max(2, Math.round((dist / 1000) / 48 * 60));
}

function estWalkMinutes(from, to) {
  const dist = haversineDistMeters(from, to);
  return Math.max(1, Math.round((dist / 1000) / 4.2 * 60));
}

// חיפוש כתובות אוטומטי בישראל
async function geocodeAddress(text) {
  if (!text || text.trim().length < 2) return null;
  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&q=${encodeURIComponent(text.trim())}&limit=1`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'iWayApp-Israel/1.0' } });
    const data = await resp.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        name: data[0].display_name.split(',')[0]
      };
    }
  } catch (e) {}
  return null;
}

// --- אלגוריתם ה-Optimizer המורחב ---
function runOptimizer({ scenario = 'driver_route', userOrigin, userDest, driverOrigin, driverDest, maxDetourMin = 20, mode = 'smart' }) {
  const candidates = [];

  // תרחיש 2: מישהו מקפיץ אותי מהבית לתחנה ברדיוס זמן
  if (scenario === 'dropoff_only') {
    for (const hub of SAFE_HUBS) {
      const dropTime = estDriveMinutes(userOrigin, hub);
      if (dropTime > maxDetourMin) continue; // חורג מרדיוס זמן ההקפצה

      const distKm = haversineDistMeters(hub, userDest) / 1000;
      const transitTime = Math.round(distKm / 26 * 60) + 7;
      const totalUserTime = dropTime + transitTime;

      candidates.push({
        hub,
        totalUserTime,
        detourMin: dropTime,
        transitTime,
        transitName: hub.type.includes('רכבת') ? 'רכבת ישראל' : 'אוטובוס מהיר',
        score: totalUserTime * 1.2 + dropTime * 0.8,
        whyReason: `הקפצה של ${dropTime} דקות בלבד ברכב ל${hub.name}, ומשם המשך ישיר בתחבורה ציבורית.`,
        timeline: [
          { icon: '🚗', title: 'הקפצה ברכב מהמוצא', desc: `נסיעה של כ-${dropTime} דקות לנקודת המעבר` },
          { icon: '📍', title: `הורדה בתחנה: ${hub.name}`, desc: 'מעבר נוח לתחבורה ציבורית' },
          { icon: hub.type.includes('רכבת') ? '🚆' : '🚌', title: 'המשך בתחבורה ציבורית', desc: `${hub.line} (כ-${transitTime} דקות)` },
          { icon: '🎯', title: 'הגעה ליעד', desc: 'הגעה ליעד המבוקש' }
        ]
      });
    }
  }
  // תרחיש 3: איסוף בדרך חזרה (תחבורה ציבורית לתחנת איסוף ברדיוס הנהג)
  else if (scenario === 'pickup_only') {
    for (const hub of SAFE_HUBS) {
      const pickupDriverTime = estDriveMinutes(driverOrigin, hub);
      if (pickupDriverTime > maxDetourMin) continue;

      const distKm = haversineDistMeters(userOrigin, hub) / 1000;
      const transitToHub = Math.round(distKm / 26 * 60) + 7;
      const rideWithDriver = estDriveMinutes(hub, userDest);
      const totalUserTime = transitToHub + rideWithDriver;

      candidates.push({
        hub,
        totalUserTime,
        detourMin: pickupDriverTime,
        transitTime: transitToHub,
        transitName: hub.type.includes('רכבת') ? 'רכבת ישראל' : 'אוטובוס',
        score: totalUserTime * 1.2 + pickupDriverTime * 0.8,
        whyReason: `הגעה בתחבורה ציבורית ל-${hub.name}, ומשם איסוף נוח ברכב ליעד.`,
        timeline: [
          { icon: '🚆', title: 'תחבורה ציבורית לנקודת האיסוף', desc: `נסיעה של כ-${transitToHub} דקות אל ${hub.name}` },
          { icon: '📍', title: `נקודת איסוף: ${hub.name}`, desc: `זמן הגעת הנהג לאיסוף: כ-${pickupDriverTime} דקות` },
          { icon: '🚗', title: 'נסיעה עם הנהג ליעד', desc: `נסיעה משותפת של כ-${rideWithDriver} דקות ליעד הסופי` },
          { icon: '🎯', title: 'הגעה ליעד', desc: 'הגעה ליעד המבוקש' }
        ]
      });
    }
  }
  // תרחיש 1 (ברירת מחדל): נסיעה לאורך מסלול נהג קיים
  else {
    const directDriverTime = estDriveMinutes(driverOrigin, driverDest);
    for (const hub of SAFE_HUBS) {
      const timeToPickup = estDriveMinutes(driverOrigin, userOrigin);
      const timePickupToHub = estDriveMinutes(userOrigin, hub);
      const timeHubToDriverDest = estDriveMinutes(hub, driverDest);
      
      const driverTripWithUser = timeToPickup + timePickupToHub + timeHubToDriverDest;
      const detourMin = Math.max(0, driverTripWithUser - directDriverTime);

      if (detourMin > maxDetourMin) continue;

      const distKm = haversineDistMeters(hub, userDest) / 1000;
      const transitTime = Math.round(distKm / 26 * 60) + 7;
      const totalUserTime = timePickupToHub + transitTime;

      let score = totalUserTime * 1.2 + detourMin * 1.0;
      if (mode === 'fast') score = totalUserTime * 1.5 + detourMin * 0.6;
      if (mode === 'easy') score = totalUserTime * 1.0 + (detourMin > 10 ? 15 : 0);

      candidates.push({
        hub,
        totalUserTime,
        detourMin,
        transitTime,
        transitName: hub.type.includes('רכבת') ? 'רכבת ישראל' : 'אוטובוס מהיר',
        score,
        whyReason: `מעבר ב-${hub.name}. סטייה של ${detourMin} דקות בלבד מהמסלול של הנהג.`,
        timeline: [
          { icon: '🚗', title: 'איסוף על ידי הנהג', desc: `נסיעה משותפת של כ-${timePickupToHub} דקות ממוצא הנוסע` },
          { icon: '📍', title: `הורדה בנקודת מעבר: ${hub.name}`, desc: `סטיית הנהג: +${detourMin} דק׳ ממסלולו הישיר` },
          { icon: hub.type.includes('רכבת') ? '🚆' : '🚌', title: 'המשך בתחבורה ציבורית', desc: `${hub.line} (כ-${transitTime} דקות)` },
          { icon: '🎯', title: 'הגעה ליעד', desc: 'הגעה ליעד המבוקש' }
        ]
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, 5);
}

// נתיב Autocomplete
app.get('/v1/geocode', async (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 2) return res.json([]);
  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&q=${encodeURIComponent(query)}&limit=5`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'iWayApp-Israel/1.0' } });
    const data = await resp.json();
    res.json(data.map(item => ({
      name: item.display_name.split(',')[0],
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    })));
  } catch (err) {
    res.json([]);
  }
});

// נתיב Geocode ישיר לנקודה בודדת (לאישור מיידי על המפה בהקלדה)
app.post('/v1/resolve', async (req, res) => {
  const { text } = req.body;
  const result = await geocodeAddress(text);
  res.json({ result });
});

// נתיב חיפוש ראשי
app.post('/v1/search', async (req, res) => {
  let { scenario, userOrigin, userDest, driverOrigin, driverDest, maxDetourMin, mode } = req.body;

  if (typeof userOrigin === 'string') userOrigin = await geocodeAddress(userOrigin) || { lat: 31.6214, lon: 34.7478 };
  if (typeof userDest === 'string') userDest = await geocodeAddress(userDest) || { lat: 31.6035, lon: 34.7738 };
  if (typeof driverOrigin === 'string') driverOrigin = await geocodeAddress(driverOrigin) || userOrigin;
  if (typeof driverDest === 'string') driverDest = await geocodeAddress(driverDest) || userDest;

  const results = runOptimizer({
    scenario: scenario || 'driver_route',
    userOrigin,
    userDest,
    driverOrigin,
    driverDest,
    maxDetourMin: Number(maxDetourMin) || 20,
    mode: mode || 'smart'
  });

  res.json({ results, userOrigin, userDest, driverOrigin, driverDest });
});

// ממשק המשתמש
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
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
      --orange: #FF9500;
      --purple: #AF52DE;
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
    .header { padding: 12px 4px 16px; }
    .title { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; }
    .subtitle { font-size: 13px; color: var(--sec); }
    .card-title { font-size: 13px; text-transform: uppercase; color: var(--sec); margin: 0 4px 6px; font-weight: 600; }
    .card { background: var(--card); border-radius: var(--radius); padding: 14px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    
    .input-row { display: flex; align-items: center; background: var(--card); padding: 10px 4px; border-bottom: 1px solid var(--border); position: relative; }
    .input-row:last-child { border-bottom: none; }
    
    .color-dot { width: 10px; height: 10px; border-radius: 50%; margin-left: 8px; flex-shrink: 0; }
    .dot-blue { background: var(--blue); }
    .dot-green { background: var(--green); }
    .dot-orange { background: var(--orange); }
    .dot-purple { background: var(--purple); }

    .input-row label { width: 75px; font-size: 14px; color: var(--sec); font-weight: 500; }
    .input-row input { flex: 1; border: none; outline: none; background: transparent; font-size: 16px; color: var(--text); direction: rtl; }
    .btn-icon { background: none; border: none; font-size: 17px; cursor: pointer; padding: 4px; color: var(--blue); }

    .segmented { display: flex; background: rgba(118, 118, 128, 0.12); border-radius: 9px; padding: 2px; gap: 2px; margin-top: 10px; }
    .segment { flex: 1; text-align: center; padding: 7px 0; font-size: 13px; border-radius: 7px; cursor: pointer; color: var(--text); }
    .segment.active { background: var(--card); font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }

    .slider-header { display: flex; justify-content: space-between; font-size: 14px; margin: 10px 0 6px; }
    .slider-val { font-weight: 600; color: var(--blue); }
    input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px; background: var(--border); outline: none; margin-bottom: 8px; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #FFF; box-shadow: 0 2px 6px rgba(0,0,0,0.25); cursor: pointer; }

    .btn-primary { width: 100%; background: var(--blue); color: #FFF; border: none; border-radius: 14px; padding: 16px; font-size: 17px; font-weight: 600; cursor: pointer; margin-top: 6px; box-shadow: 0 4px 12px rgba(0,122,255,0.25); }
    .btn-primary:active { opacity: 0.85; }

    #map { width: 100%; height: 230px; border-radius: var(--radius); margin-top: 14px; border: 1px solid var(--border); }
    .map-helper { font-size: 12px; color: var(--sec); text-align: center; margin-top: 4px; }

    .result-card { background: var(--card); border-radius: var(--radius); padding: 14px; margin-top: 12px; border: 1px solid var(--border); }
    .result-card.featured { border: 1.5px solid var(--blue); }
    .result-top { display: flex; justify-content: space-between; align-items: baseline; }
    .result-time { font-size: 24px; font-weight: 700; }
    .badge { background: var(--tint); color: var(--blue); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .badge-green { background: rgba(52, 199, 89, 0.15); color: var(--green); }
    .result-sub { font-size: 13px; color: var(--sec); margin: 6px 0 10px; }

    .timeline { border-top: 1px solid var(--border); margin-top: 10px; padding-top: 12px; }
    .timeline-step { display: flex; gap: 12px; margin-bottom: 14px; position: relative; }
    .timeline-step:not(:last-child)::after { content: ''; position: absolute; right: 13px; top: 26px; bottom: -12px; width: 2px; background: var(--border); }
    .step-icon { width: 28px; height: 28px; border-radius: 50%; background: var(--tint); display: flex; align-items: center; justify-content: center; font-size: 14px; z-index: 2; }
    .step-content { flex: 1; }
    .step-title { font-size: 14px; font-weight: 600; }
    .step-desc { font-size: 12px; color: var(--sec); margin-top: 2px; }

    .action-row { display: flex; gap: 8px; margin-top: 10px; }
    .btn-action { flex: 1; text-align: center; text-decoration: none; padding: 10px; background: var(--tint); color: var(--blue); border-radius: 10px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; }

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
        iWay מתאימה את המסלול בזמן אמת. נתוני המיקום מעובדים בזיכרון המכשיר בלבד ללא שמירת היסטוריה.
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

  <!-- בורר תרחישי נסיעה לפי האפיון -->
  <div class="card-title">סוג הנסיעה</div>
  <div class="card">
    <div class="segmented" id="scenario-selector">
      <div class="segment active" onclick="setScenario('driver_route', this)">מסלול נהג</div>
      <div class="segment" onclick="setScenario('dropoff_only', this)">הקפצה לתחנה</div>
      <div class="segment" onclick="setScenario('pickup_only', this)">איסוף מתחנה</div>
    </div>
  </div>

  <!-- פרטי הנסיעה שלך -->
  <div class="card-title">הנסיעה שלך</div>
  <div class="card">
    <div class="input-row">
      <span class="color-dot dot-blue" title="סימון כחול על המפה"></span>
      <label>מוצא</label>
      <input type="text" id="userOriginInput" placeholder="היכן אתה נמצא?" autocomplete="off" oninput="handleAc('userOrigin')" onblur="resolveManualInput('userOrigin')">
      <button class="btn-icon" title="בחר על המפה" onclick="startMapPick('userOrigin')">🗺️</button>
      <div id="ac-userOrigin" class="ac-list"></div>
    </div>
    <div class="input-row">
      <span class="color-dot dot-green" title="סימון ירוק על המפה"></span>
      <label>יעד</label>
      <input type="text" id="userDestInput" placeholder="לאן להגיע?" autocomplete="off" oninput="handleAc('userDest')" onblur="resolveManualInput('userDest')">
      <button class="btn-icon" title="בחר על המפה" onclick="startMapPick('userDest')">🗺️</button>
      <div id="ac-userDest" class="ac-list"></div>
    </div>

    <div class="segmented">
      <div class="segment active" onclick="changeMode('smart', this)">Smart</div>
      <div class="segment" onclick="changeMode('fast', this)">Fast</div>
      <div class="segment" onclick="changeMode('easy', this)">Easy</div>
    </div>
  </div>

  <!-- נסיעה עם נהג -->
  <div class="card-title" id="driver-card-title">נסיעה עם נהג</div>
  <div class="card" id="driver-card">
    <div class="input-row" id="row-driver-origin">
      <span class="color-dot dot-orange" title="סימון כתום על המפה"></span>
      <label id="label-driver-origin">מוצא נהג</label>
      <input type="text" id="driverOriginInput" placeholder="מהיכן הנהג יוצא?" autocomplete="off" oninput="handleAc('driverOrigin')" onblur="resolveManualInput('driverOrigin')">
      <button class="btn-icon" title="בחר על המפה" onclick="startMapPick('driverOrigin')">🗺️</button>
      <div id="ac-driverOrigin" class="ac-list"></div>
    </div>
    <div class="input-row" id="row-driver-dest">
      <span class="color-dot dot-purple" title="סימון סגול על המפה"></span>
      <label id="label-driver-dest">יעד נהג</label>
      <input type="text" id="driverDestInput" placeholder="לאן הנהג ממשיך?" autocomplete="off" oninput="handleAc('driverDest')" onblur="resolveManualInput('driverDest')">
      <button class="btn-icon" title="בחר על המפה" onclick="startMapPick('driverDest')">🗺️</button>
      <div id="ac-driverDest" class="ac-list"></div>
    </div>

    <div class="slider-header">
      <span id="sliderLabel">מקסימום סטייה לנהג</span>
      <span class="slider-val" id="detourText">20 דקות</span>
    </div>
    <input type="range" id="detourRange" min="5" max="120" step="5" value="20" oninput="updateDetour(this.value)">
  </div>

  <button class="btn-primary" id="btn-search" onclick="triggerSearch()">מצא לי דרך</button>

  <div id="map"></div>
  <div class="map-helper" id="mapHelperText">כל הנקודות מוצגות בצבעים נפרדים על המפה לאישור</div>

  <div id="results-area" style="margin-top: 14px;"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    let activeMode = 'smart';
    let currentScenario = 'driver_route';
    let pickingField = null;

    // ניהול כל הסמנים על המפה בצבעים ייחודיים
    const markers = {
      userOrigin: null,
      userDest: null,
      driverOrigin: null,
      driverDest: null,
      hub: null
    };

    const exactCoords = {
      userOrigin: { lat: 31.6214, lon: 34.7478, name: 'מחנה פלוגות' },
      userDest: { lat: 31.6035, lon: 34.7738, name: 'רכבת קריית גת' },
      driverOrigin: { lat: 31.6214, lon: 34.7478, name: 'מחנה פלוגות' },
      driverDest: { lat: 31.6035, lon: 34.7738, name: 'רכבת קריית גת' }
    };

    const colorConfigs = {
      userOrigin: { color: '#007AFF', label: 'מוצא הנוסע (כחול)' },
      userDest: { color: '#34C759', label: 'יעד הנוסע (ירוק)' },
      driverOrigin: { color: '#FF9500', label: 'מוצא הנהג (כתום)' },
      driverDest: { color: '#AF52DE', label: 'יעד הנהג (סגול)' },
      hub: { color: '#FF3B30', label: 'נקודת מעבר / הורדה (אדום)' }
    };

    function createColorIcon(colorHex) {
      return L.divIcon({
        className: 'custom-pin',
        html: \`<div style="width: 16px; height: 16px; border-radius: 50%; background: \${colorHex}; border: 2.5px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>\`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
    }

    const map = L.map('map').setView([31.6124, 34.7608], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    function updateMarkerOnMap(field, lat, lon, title) {
      if (markers[field]) map.removeLayer(markers[field]);
      const cfg = colorConfigs[field];
      markers[field] = L.marker([lat, lon], { icon: createColorIcon(cfg.color) })
        .addTo(map)
        .bindPopup(\`<b>\${cfg.label}</b><br>\${title}\`);

      fitAllMarkers();
    }

    function fitAllMarkers() {
      const activeGroup = Object.values(markers).filter(m => m !== null);
      if (activeGroup.length > 0) {
        const group = new L.featureGroup(activeGroup);
        map.fitBounds(group.getBounds().pad(0.2));
      }
    }

    map.on('click', e => {
      if (!pickingField) return;
      const { lat, lng } = e.latlng;
      const name = lat.toFixed(4) + ', ' + lng.toFixed(4);
      exactCoords[pickingField] = { lat, lon: lng, name };
      document.getElementById(pickingField + 'Input').value = name;
      updateMarkerOnMap(pickingField, lat, lng, name);
      document.getElementById('mapHelperText').innerText = 'הנקודה עודכנה על המפה!';
      pickingField = null;
    });

    function startMapPick(field) {
      pickingField = field;
      document.getElementById('mapHelperText').innerText = '👈 לחץ על המפה לבחירת ' + colorConfigs[field].label;
      document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
    }

    function initPrivacy() {
      document.getElementById('privacy-modal').style.display = 'none';
      renderInitialMarkers();
    }

    function renderInitialMarkers() {
      Object.keys(exactCoords).forEach(key => {
        const item = exactCoords[key];
        if (item) updateMarkerOnMap(key, item.lat, item.lon, item.name);
      });
    }

    function setScenario(scen, el) {
      currentScenario = scen;
      document.querySelectorAll('#scenario-selector .segment').forEach(s => s.classList.remove('active'));
      el.classList.add('active');

      const driverDestRow = document.getElementById('row-driver-dest');
      const driverOriginRow = document.getElementById('row-driver-origin');
      const sliderLabel = document.getElementById('sliderLabel');

      if (scen === 'dropoff_only') {
        driverDestRow.style.display = 'none';
        driverOriginRow.style.display = 'none';
        sliderLabel.innerText = 'מקסימום זמן הקפצה מהבית';
      } else if (scen === 'pickup_only') {
        driverDestRow.style.display = 'none';
        driverOriginRow.style.display = 'flex';
        document.getElementById('label-driver-origin').innerText = 'מיקום הנהג';
        sliderLabel.innerText = 'רדיוס זמן לאיסוף הנהג';
      } else {
        driverDestRow.style.display = 'flex';
        driverOriginRow.style.display = 'flex';
        document.getElementById('label-driver-origin').innerText = 'מוצא נהג';
        sliderLabel.innerText = 'מקסימום סטייה לנהג';
      }
      triggerSearch();
    }

    function updateDetour(val) {
      document.getElementById('detourText').innerText = val + ' דקות';
      triggerSearch();
    }

    function changeMode(mode, el) {
      activeMode = mode;
      document.querySelectorAll('.segmented:not(#scenario-selector) .segment').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      triggerSearch();
    }

    // אישור מיידי על המפה בעת הקלדה ידנית
    async function resolveManualInput(field) {
      const val = document.getElementById(field + 'Input').value;
      if (!val || val.trim().length < 2) return;
      try {
        const res = await fetch('/v1/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: val })
        });
        const data = await res.json();
        if (data && data.result) {
          exactCoords[field] = data.result;
          updateMarkerOnMap(field, data.result.lat, data.result.lon, data.result.name);
        }
      } catch(e) {}
    }

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
            div.innerText = item.fullName || item.name;
            div.onclick = () => {
              exactCoords[field] = { lat: item.lat, lon: item.lon, name: item.name };
              document.getElementById(field + 'Input').value = item.name;
              box.style.display = 'none';
              updateMarkerOnMap(field, item.lat, item.lon, item.name);
            };
            box.appendChild(div);
          });
          box.style.display = 'block';
        } catch(e) {}
      }, 300);
    }

    async function triggerSearch() {
      const btn = document.getElementById('btn-search');
      btn.innerText = 'מחשב מסלול אופטימלי...';

      const payload = {
        scenario: currentScenario,
        userOrigin: exactCoords.userOrigin || document.getElementById('userOriginInput').value,
        userDest: exactCoords.userDest || document.getElementById('userDestInput').value,
        driverOrigin: exactCoords.driverOrigin || document.getElementById('driverOriginInput').value,
        driverDest: exactCoords.driverDest || document.getElementById('driverDestInput').value,
        maxDetourMin: document.getElementById('detourRange').value,
        mode: activeMode
      };

      try {
        const res = await fetch('/v1/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        // עדכון כל הנקודות על המפה בו-זמנית
        if (data.userOrigin) updateMarkerOnMap('userOrigin', data.userOrigin.lat, data.userOrigin.lon, 'מוצא הנוסע');
        if (data.userDest) updateMarkerOnMap('userDest', data.userDest.lat, data.userDest.lon, 'יעד הנוסע');
        if (currentScenario === 'driver_route' && data.driverOrigin) updateMarkerOnMap('driverOrigin', data.driverOrigin.lat, data.driverOrigin.lon, 'מוצא הנהג');
        if (currentScenario === 'driver_route' && data.driverDest) updateMarkerOnMap('driverDest', data.driverDest.lat, data.driverDest.lon, 'יעד הנהג');

        renderResults(data.results);
      } catch(e) {
        alert('שגיאה בתקשורת עם השרת');
      } finally {
        btn.innerText = 'מצא לי דרך';
      }
    }

    function renderResults(results) {
      const container = document.getElementById('results-area');
      container.innerHTML = '';

      if (!results || results.length === 0) {
        container.innerHTML = '<div class="card">לא נמצאו נקודות מעבר בטווח הזמן שהוגדר. נסה להגדיל את הסליידר.</div>';
        return;
      }

      // סימון נקודת המעבר המובילה על המפה באדום
      const best = results[0];
      updateMarkerOnMap('hub', best.hub.lat, best.hub.lon, best.hub.name);

      results.forEach((r, idx) => {
        const isBest = idx === 0;
        const wazeUrl = 'https://waze.com/ul?ll=' + r.hub.lat + ',' + r.hub.lon + '&navigate=yes';
        const card = document.createElement('div');
        card.className = 'result-card ' + (isBest ? 'featured' : '');
        card.innerHTML = \`
          <div class="result-top">
            <div>
              <span class="result-time">\${r.totalUserTime} דקות</span>
              <span style="font-size: 13px; color: var(--sec); margin-right: 4px;">זמן כולל</span>
            </div>
            <span class="badge \${isBest ? 'badge-green' : ''}">\${isBest ? 'מומלץ - ' + activeMode.toUpperCase() : '+' + r.detourMin + ' דק׳'}</span>
          </div>

          <div style="font-size: 15px; font-weight: 600; margin-top: 6px;">נקודת מעבר: \${r.hub.name}</div>
          <div class="result-sub">\${r.whyReason}</div>

          <div class="timeline">
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
            <a class="btn-action" href="\${wazeUrl}" target="_blank">נווט ב-Waze</a>
            <button class="btn-action" onclick="shareWithDriver('\${r.hub.name}', \${r.detourMin}, '\${wazeUrl}')">שתף עם הנהג</button>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function shareWithDriver(hubName, detour, wazeUrl) {
      const text = 'היי, מצאתי נקודת מפגש מצוינת ב-' + hubName + ' (סטייה: ' + detour + ' דקות). קישור ל-Waze: ' + wazeUrl;
      if (navigator.share) {
        navigator.share({ title: 'iWay נקודת מפגש', text });
      } else {
        window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text));
      }
    }

    // ערכי התחלה
    document.getElementById('userOriginInput').value = exactCoords.userOrigin.name;
    document.getElementById('userDestInput').value = exactCoords.userDest.name;
    document.getElementById('driverOriginInput').value = exactCoords.driverOrigin.name;
    document.getElementById('driverDestInput').value = exactCoords.driverDest.name;
    renderInitialMarkers();
  </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('iWay Server running on port ' + PORT));
