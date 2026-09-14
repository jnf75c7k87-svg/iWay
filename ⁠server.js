const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

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

async function geocodeAddress(text) {
  if (!text || text.trim().length < 2) return null;
  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&accept-language=he&q=${encodeURIComponent(text.trim())}&limit=1`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'iWayApp-Israel/5.0' } });
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

const ALL_HUBS = [
  { id: 'h_hamovill', name: 'צומת המוביל / מחלף המוביל', type: 'bus', transitType: 'אוטובוס בינעירוני מהיר', lineInfo: 'קווים 380, 430, 434, 500', nextDepartures: ['בעוד 5 דק׳', 'בעוד 12 דק׳'], lat: 32.7562, lon: 35.2341 },
  { id: 'h_motzkin', name: 'רכבת קריית מוצקין', type: 'train', transitType: 'רכבת ישראל', lineInfo: 'קו נהריה ⟵ תל אביב ובאר שבע', nextDepartures: ['08:16 (רציף 2)', '08:46 (רציף 2)'], lat: 32.8335, lon: 35.0805 },
  { id: 'h_mifratz', name: 'מרכזית המפרץ', type: 'train', transitType: 'רכבת ומטרונית', lineInfo: 'רכבת החוף + מטרונית קו 1, 2, 3', nextDepartures: ['מטרונית - כל 4 דק׳', '08:24 (רציף 1)'], lat: 32.7933, lon: 35.0344 },
  { id: 'h_yagur', name: 'מחלף יגור / מסוף אזורי', type: 'bus', transitType: 'אוטובוס ומטרונית', lineInfo: 'קווים 75, 180, 301', nextDepartures: ['בעוד 6 דק׳'], lat: 32.7440, lon: 35.0760 },
  { id: 'h_afula', name: 'רכבת עפולה (העמק)', type: 'train', transitType: 'רכבת ישראל', lineInfo: 'קו עתלית ⟵ בית שאן', nextDepartures: ['08:27 (רציף 1)', '09:27 (רציף 1)'], lat: 32.6140, lon: 35.2950 },
  { id: 'h_kgat', name: 'רכבת קריית גת', type: 'train', transitType: 'רכבת ישראל', lineInfo: 'קו באר שבע ⟵ תל אביב סבידור', nextDepartures: ['08:14 (רציף 1)', '08:44 (רציף 1)'], lat: 31.6035, lon: 34.7738 },
  { id: 'h_plugot', name: 'צומת פלוגות', type: 'bus', transitType: 'אוטובוס בינעירוני', lineInfo: 'קווים 369, 370, 348', nextDepartures: ['בעוד 7 דק׳'], lat: 31.6214, lon: 34.7478 },
  { id: 'h_ashkelon', name: 'רכבת אשקלון', type: 'train', transitType: 'רכבת ישראל', lineInfo: 'קו אשקלון ⟵ הרצליה', nextDepartures: ['08:08 (רציף 1)'], lat: 31.6750, lon: 34.5950 },
  { id: 'h_b7', name: 'רכבת באר שבע מרכז', type: 'train', transitType: 'רכבת ישראל', lineInfo: 'קו מהיר לתל אביב', nextDepartures: ['08:00 (רציף 2)'], lat: 31.2435, lon: 34.7972 },
  { id: 'h_tlv_hashalom', name: 'רכבת ת"א השלום', type: 'train', transitType: 'רכבת ישראל', lineInfo: 'כל הקווים הבינעירוניים', nextDepartures: ['08:22 (רציף 3)'], lat: 32.0734, lon: 34.7925 },
  { id: 'h_tlv_savidor', name: 'ת"א סבידור מרכז', type: 'train', transitType: 'רכבת והדנקל', lineInfo: 'רכבת ישראל + קו אדום', nextDepartures: ['דנקל כל 6 דק׳'], lat: 32.0835, lon: 34.7983 },
  { id: 'h_herzliya', name: 'רכבת הרצליה', type: 'train', transitType: 'רכבת ישראל', lineInfo: 'קו החוף וקווי השרון', nextDepartures: ['08:20 (רציף 2)'], lat: 32.1629, lon: 34.8252 },
  { id: 'h_shapirim', name: 'חניון שפירים הנתיב המהיר', type: 'bus', transitType: 'שאטל ישיר', lineInfo: 'שאטלים לתל אביב ולבורסה', nextDepartures: ['כל 5 דקות'], lat: 32.0078, lon: 34.8322 }
];

// מנוע אופטימיזציה מלא
function runFullOptimizer(body) {
  const { mode = 'smart', routeType = 'driver_route', userOrigin, userDest } = body;
  const candidates = [];

  // מצב 1: הצטרפות למסלול נהג קיים
  if (routeType === 'driver_route') {
    const { driverOrigin, driverDest, maxDetourMin = 20 } = body;
    const directDriverTime = estDriveMinutes(driverOrigin, driverDest);

    for (const hub of ALL_HUBS) {
      const timeToPickup = estDriveMinutes(driverOrigin, userOrigin);
      const timePickupToHub = estDriveMinutes(userOrigin, hub);
      const timeHubToDriverDest = estDriveMinutes(hub, driverDest);
      const driverTripWithUser = timeToPickup + timePickupToHub + timeHubToDriverDest;
      const detourMin = Math.max(0, driverTripWithUser - directDriverTime);

      if (detourMin > Number(maxDetourMin)) continue;

      const distKm = haversineDistMeters(hub, userDest) / 1000;
      const transitTime = Math.round(distKm / 35 * 60) + 8;
      const totalUserTime = timePickupToHub + transitTime;

      let score = totalUserTime * 1.2 + detourMin * 1.0;
      if (mode === 'fast') score = totalUserTime * 1.5 + detourMin * 0.6;
      if (mode === 'easy') score = totalUserTime * 1.0 + (detourMin > 10 ? 15 : 0);

      candidates.push({
        hub,
        totalUserTime,
        detourMin,
        score,
        whyReason: `נסיעה עם הנהג עד ${hub.name}. סטייה של ${detourMin} דק׳ בלבד מהנסיעה הרגילה שלו.`,
        timeline: [
          { icon: '🚗', badge: 'נסיעה עם נהג', title: 'איסוף מנקודת המוצא', desc: `נסיעה משותפת של כ-${timePickupToHub} דקות עד לנקודת ההורדה` },
          { icon: '📍', badge: 'הורדה', title: `הורדה ב-${hub.name}`, desc: `סטיית נהג ממסלולו: +${detourMin} דקות` },
          { icon: hub.type === 'train' ? '🚆' : '🚌', badge: hub.transitType, title: hub.lineInfo, desc: `המשך בתחבורה ציבורית (כ-${transitTime} דקות). יציאות: ${hub.nextDepartures.join(' • ')}` },
          { icon: '🎯', badge: 'סיום', title: 'הגעה ליעד המבוקש', desc: 'הגעה סופית ליעד' }
        ]
      });
    }
  } 
  // מצב 2: שילוב הקפצה / איסוף
  else {
    const originRide = Number(body.originRideMin) || 0;
    const destRide = Number(body.destRideMin) || 0;

    if (originRide === 0 && destRide === 0) {
      const distKm = haversineDistMeters(userOrigin, userDest) / 1000;
      const transitTime = Math.round(distKm / 32 * 60) + 12;
      return [{
        hub: { name: 'תחבורה ציבורית ישירה', lat: userDest.lat, lon: userDest.lon },
        totalUserTime: transitTime,
        detourMin: 0,
        whyReason: 'נסיעה עצמאית בתחבורה ציבורית ישירה ללא טרמפים.',
        timeline: [
          { icon: '🚶', badge: 'הליכה', title: 'הליכה לתחנה הקרובה', desc: 'כ-6 דקות הליכה מנקודת המוצא' },
          { icon: '🚆', badge: 'תחב״צ', title: 'נסיעה באוטובוס / רכבת', desc: `זמן נסיעה מוערך: כ-${transitTime - 10} דקות` },
          { icon: '🎯', badge: 'סיום', title: 'הגעה ליעד', desc: 'הגעה סופית ליעד' }
        ]
      }];
    }

    for (const hub of ALL_HUBS) {
      const driveFromOrigin = estDriveMinutes(userOrigin, hub);
      const driveToDest = estDriveMinutes(hub, userDest);
      const canUseAsOriginDrop = originRide > 0 && driveFromOrigin <= originRide;
      const canUseAsDestPickup = destRide > 0 && driveToDest <= destRide;

      if (!canUseAsOriginDrop && !canUseAsDestPickup) continue;

      let totalUserTime = 0;
      const timeline = [];

      if (canUseAsOriginDrop && canUseAsDestPickup) {
        totalUserTime = driveFromOrigin + 20 + driveToDest;
        timeline.push({ icon: '🚗', badge: 'הקפצה', title: `הקפצה ברכב ל-${hub.name}`, desc: `נסיעה של כ-${driveFromOrigin} דקות מהמוצא` });
        timeline.push({ icon: hub.type === 'train' ? '🚆' : '🚌', badge: hub.transitType, title: hub.lineInfo, desc: `זמני יציאה: ${hub.nextDepartures.join(' • ')}` });
        timeline.push({ icon: '🚗', badge: 'איסוף', title: `איסוף ברכב מ-${hub.name}`, desc: `נסיעה של כ-${driveToDest} דקות ליעד` });
      } else if (canUseAsOriginDrop) {
        const distKm = haversineDistMeters(hub, userDest) / 1000;
        const transitLeg = Math.round(distKm / 35 * 60) + 8;
        totalUserTime = driveFromOrigin + transitLeg;
        timeline.push({ icon: '🚗', badge: 'הקפצה', title: `הקפצה ברכב ל-${hub.name}`, desc: `נסיעה של כ-${driveFromOrigin} דקות מהמוצא` });
        timeline.push({ icon: hub.type === 'train' ? '🚆' : '🚌', badge: hub.transitType, title: hub.lineInfo, desc: `המשך בתחבורה ציבורית (כ-${transitLeg} דקות)` });
      } else {
        const distKm = haversineDistMeters(userOrigin, hub) / 1000;
        const transitLeg = Math.round(distKm / 38 * 60) + 10;
        totalUserTime = transitLeg + driveToDest;
        timeline.push({ icon: hub.type === 'train' ? '🚆' : '🚌', badge: hub.transitType, title: hub.lineInfo, desc: `נסיעה בתחבורה ציבורית ל-${hub.name} (כ-${transitLeg} דקות)` });
        timeline.push({ icon: '🚗', badge: 'איסוף', title: `איסוף ברכב מ-${hub.name}`, desc: `נסיעה של כ-${driveToDest} דקות ליעד` });
      }

      timeline.push({ icon: '🎯', badge: 'סיום', title: 'הגעה ליעד', desc: 'הגעה סופית ליעד' });

      candidates.push({
        hub,
        totalUserTime,
        detourMin: canUseAsOriginDrop ? driveFromOrigin : driveToDest,
        score: totalUserTime,
        whyReason: `מעבר ב-${hub.name}. שילוב טרמפים ולוחות זמנים של תחב״צ.`,
        timeline
      });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, 5);
}

app.get('/v1/geocode', async (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 2) return res.json([]);
  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&accept-language=he&q=${encodeURIComponent(query)}&limit=6`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'iWayApp-Israel/5.0' } });
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

app.post('/v1/search', async (req, res) => {
  const body = req.body;
  if (typeof body.userOrigin === 'string') body.userOrigin = await geocodeAddress(body.userOrigin) || { lat: 31.6341, lon: 34.7479 };
  if (typeof body.userDest === 'string') body.userDest = await geocodeAddress(body.userDest) || { lat: 32.7842, lon: 35.1718 };
  if (body.driverOrigin && typeof body.driverOrigin === 'string') body.driverOrigin = await geocodeAddress(body.driverOrigin) || body.userOrigin;
  if (body.driverDest && typeof body.driverDest === 'string') body.driverDest = await geocodeAddress(body.driverDest) || body.userDest;

  const results = runFullOptimizer(body);
  res.json({ results, userOrigin: body.userOrigin, userDest: body.userDest });
});

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

    .input-row label { width: 85px; font-size: 14px; color: var(--sec); font-weight: 500; }
    .input-row input { flex: 1; border: none; outline: none; background: transparent; font-size: 16px; color: var(--text); direction: rtl; }
    .btn-icon { background: none; border: none; font-size: 17px; cursor: pointer; padding: 4px; color: var(--blue); }

    .segmented { display: flex; background: rgba(118, 118, 128, 0.12); border-radius: 9px; padding: 2px; gap: 2px; margin-top: 10px; }
    .segment { flex: 1; text-align: center; padding: 7px 0; font-size: 13px; border-radius: 7px; cursor: pointer; color: var(--text); }
    .segment.active { background: var(--card); font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }

    .slider-header { display: flex; justify-content: space-between; font-size: 14px; margin: 10px 0 6px; }
    .slider-val { font-weight: 600; color: var(--blue); }
    input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px; background: var(--border); outline: none; margin-bottom: 8px; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #FFF; box-shadow: 0 2px 6px rgba(0,0,0,0.25); cursor: pointer; }

    .btn-primary { width: 100%; background: var(--blue); color: #FFF; border: none; border-radius: 14px; padding: 16px; font-size: 17px; font-weight: 600; cursor: pointer; margin-top: 6px; box-shadow: 0 4px 12px rgba(0,122,255,0.25); display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-primary:active { opacity: 0.85; }

    .spinner { width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: #FFFFFF; border-radius: 50%; animation: spin 0.8s linear infinite; display: none; }
    @keyframes spin { to { transform: rotate(360deg); } }

    #map { width: 100%; height: 230px; border-radius: var(--radius); margin-top: 14px; border: 1px solid var(--border); }

    .result-card { background: var(--card); border-radius: var(--radius); padding: 14px; margin-top: 12px; border: 1px solid var(--border); }
    .result-card.featured { border: 1.5px solid var(--blue); }
    .result-top { display: flex; justify-content: space-between; align-items: baseline; }
    .result-time { font-size: 24px; font-weight: 700; }
    .badge { background: var(--tint); color: var(--blue); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .badge-green { background: rgba(52, 199, 89, 0.15); color: var(--green); }
    .result-sub { font-size: 13px; color: var(--sec); margin: 6px 0 10px; }

    .timeline { border-top: 1px solid var(--border); margin-top: 10px; padding-top: 12px; display: none; }
    .timeline.open { display: block; }
    .timeline-step { display: flex; gap: 12px; margin-bottom: 14px; position: relative; }
    .timeline-step:not(:last-child)::after { content: ''; position: absolute; right: 13px; top: 28px; bottom: -10px; width: 2px; background: var(--border); }
    .step-icon { width: 28px; height: 28px; border-radius: 50%; background: var(--tint); display: flex; align-items: center; justify-content: center; font-size: 14px; z-index: 2; flex-shrink: 0; }
    .step-content { flex: 1; }
    .step-header { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
    .step-title { font-size: 14px; font-weight: 600; }
    .step-tag { font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; background: rgba(142,142,147,0.15); color: var(--text); }
    .step-desc { font-size: 12.5px; color: var(--sec); line-height: 1.35; margin-top: 2px; }

    .action-row { display: flex; gap: 8px; margin-top: 12px; }
    .btn-action { flex: 1; text-align: center; text-decoration: none; padding: 10px; background: var(--tint); color: var(--blue); border-radius: 10px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; }

    /* Map Picker Modal */
    .map-modal { position: fixed; inset: 0; background: var(--bg); z-index: 10000; display: none; flex-direction: column; }
    .map-modal-header { padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; background: var(--card); border-bottom: 1px solid var(--border); }
    .map-modal-search { padding: 8px 16px; background: var(--card); border-bottom: 1px solid var(--border); position: relative; }
    .map-modal-search input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); outline: none; font-size: 15px; direction: rtl; }
    .modal-ac-box { position: absolute; top: 100%; right: 16px; left: 16px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; z-index: 11000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-height: 200px; overflow-y: auto; display: none; }
    .ac-item { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid var(--border); cursor: pointer; }
    .ac-item:last-child { border-bottom: none; }
    #modal-map-view { flex: 1; position: relative; }
    .center-pin { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -100%); z-index: 1000; font-size: 36px; pointer-events: none; }
    .map-modal-footer { padding: 14px 16px; background: var(--card); border-top: 1px solid var(--border); }
  </style>
</head>
<body>

  <!-- Modal Map Picker עם חיפוש מובנה שמזיז את המפה -->
  <div id="map-modal" class="map-modal">
    <div class="map-modal-header">
      <span style="font-weight: 700; font-size: 17px;" id="modal-field-title">בחר מיקום על המפה</span>
      <button onclick="closeMapModal()" style="border: none; background: none; color: var(--blue); font-size: 16px; font-weight: 600; cursor: pointer;">ביטול</button>
    </div>
    <div class="map-modal-search">
      <input type="text" id="modalSearchInput" placeholder="הקלד שם מקום, עיר או צומת..." autocomplete="off" oninput="handleModalSearch()">
      <div id="modal-ac-box" class="modal-ac-box"></div>
    </div>
    <div id="modal-map-view">
      <div class="center-pin">📍</div>
    </div>
    <div class="map-modal-footer">
      <button class="btn-primary" onclick="confirmModalSelection()">אישור מיקום זה</button>
    </div>
  </div>

  <header class="header">
    <div>
      <h1 class="title">iWay</h1>
      <div class="subtitle">Your way to get there</div>
    </div>
  </header>

  <!-- בורר ראשי: הצטרפות למסלול נהג מול שילוב הקפצה/איסוף -->
  <div class="card-title">סוג המסלול</div>
  <div class="card">
    <div class="segmented" id="route-type-selector">
      <div class="segment active" onclick="setRouteType('driver_route', this)">הצטרפות למסלול נהג</div>
      <div class="segment" onclick="setRouteType('rides', this)">שילוב הקפצה / איסוף</div>
    </div>
  </div>

  <!-- פרטי הנוסע -->
  <div class="card-title">הנסיעה שלך</div>
  <div class="card">
    <div class="input-row">
      <span class="color-dot dot-blue"></span>
      <label>מוצא</label>
      <input type="text" id="userOriginInput" placeholder="היכן אתה נמצא?">
      <button class="btn-icon" title="בחר במפה" onclick="openMapModal('userOrigin')">🗺️</button>
    </div>
    <div class="input-row">
      <span class="color-dot dot-green"></span>
      <label>יעד</label>
      <input type="text" id="userDestInput" placeholder="לאן להגיע?">
      <button class="btn-icon" title="בחר במפה" onclick="openMapModal('userDest')">🗺️</button>
    </div>

    <div class="segmented">
      <div class="segment active" onclick="changeMode('smart', this)">Smart</div>
      <div class="segment" onclick="changeMode('fast', this)">Fast</div>
      <div class="segment" onclick="changeMode('easy', this)">Easy</div>
    </div>
  </div>

  <!-- חלק 1: נסיעה עם נהג קיים -->
  <div id="driver-route-section">
    <div class="card-title">מסלול הנהג שמסיע אותך</div>
    <div class="card">
      <div class="input-row">
        <span class="color-dot dot-orange"></span>
        <label>מוצא נהג</label>
        <input type="text" id="driverOriginInput" placeholder="מהיכן הנהג יוצא?">
        <button class="btn-icon" title="בחר במפה" onclick="openMapModal('driverOrigin')">🗺️</button>
      </div>
      <div class="input-row">
        <span class="color-dot dot-purple"></span>
        <label>יעד נהג</label>
        <input type="text" id="driverDestInput" placeholder="לאן הנהג ממשיך?">
        <button class="btn-icon" title="בחר במפה" onclick="openMapModal('driverDest')">🗺️</button>
      </div>

      <div class="slider-header">
        <span>מקסימום סטייה לנהג</span>
        <span class="slider-val" id="detourText">20 דקות</span>
      </div>
      <input type="range" id="detourRange" min="5" max="120" step="5" value="20" oninput="document.getElementById('detourText').innerText = this.value + ' דקות'; triggerSearch();">
    </div>
  </div>

  <!-- חלק 2: שילוב הקפצה או איסוף לפי רדיוס זמן -->
  <div id="rides-section" style="display: none;">
    <div class="card-title">שילוב טרמפים (0 = ללא טרמפ)</div>
    <div class="card">
      <div class="slider-header">
        <span>🚗 טרמפ ביציאה מהמוצא</span>
        <span class="slider-val" id="originRideText">0 דקות (בלי טרמפ)</span>
      </div>
      <input type="range" id="originRideRange" min="0" max="60" step="5" value="0" oninput="document.getElementById('originRideText').innerText = this.value == 0 ? '0 דקות (בלי טרמפ)' : 'עד ' + this.value + ' דק׳'; triggerSearch();">

      <div class="slider-header" style="margin-top: 14px;">
        <span>🚗 טרמפ בהגעה ליעד</span>
        <span class="slider-val" id="destRideText">0 דקות (בלי טרמפ)</span>
      </div>
      <input type="range" id="destRideRange" min="0" max="60" step="5" value="0" oninput="document.getElementById('destRideText').innerText = this.value == 0 ? '0 דקות (בלי טרמפ)' : 'עד ' + this.value + ' דק׳'; triggerSearch();">
    </div>
  </div>

  <button class="btn-primary" id="btn-search" onclick="triggerSearch()">
    <div class="spinner" id="search-spinner"></div>
    <span id="btn-text">מצא לי דרך</span>
  </button>

  <div id="map"></div>
  <div id="results-area" style="margin-top: 14px;"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    let activeMode = 'smart';
    let currentRouteType = 'driver_route';
    let currentModalField = null;
    let modalMap = null;

    const exactCoords = {
      userOrigin: { lat: 31.6341, lon: 34.7479, name: 'מחנה פלוגות' },
      userDest: { lat: 32.7842, lon: 35.1718, name: 'עדי' },
      driverOrigin: { lat: 31.6341, lon: 34.7479, name: 'מחנה פלוגות' },
      driverDest: { lat: 32.8335, lon: 35.0805, name: 'קריית מוצקין' }
    };

    const markers = { userOrigin: null, userDest: null, driverOrigin: null, driverDest: null, hub: null };

    const map = L.map('map').setView([32.2, 34.9], 8);
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}').addTo(map);

    function createColorIcon(colorHex) {
      return L.divIcon({
        className: 'custom-pin',
        html: \`<div style="width: 16px; height: 16px; border-radius: 50%; background: \${colorHex}; border: 2.5px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>\`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
    }

    function updateMarkerOnMap(field, lat, lon, title, colorHex) {
      if (markers[field]) map.removeLayer(markers[field]);
      markers[field] = L.marker([lat, lon], { icon: createColorIcon(colorHex) })
        .addTo(map)
        .bindPopup(\`<b>\${title}</b>\`);
      fitAllMarkers();
    }

    function fitAllMarkers() {
      const active = Object.values(markers).filter(m => m !== null);
      if (active.length > 0) {
        const group = new L.featureGroup(active);
        map.fitBounds(group.getBounds().pad(0.2));
      }
    }

    function setRouteType(type, el) {
      currentRouteType = type;
      document.querySelectorAll('#route-type-selector .segment').forEach(s => s.classList.remove('active'));
      el.classList.add('active');

      document.getElementById('driver-route-section').style.display = type === 'driver_route' ? 'block' : 'none';
      document.getElementById('rides-section').style.display = type === 'rides' ? 'block' : 'none';
      triggerSearch();
    }

    function changeMode(mode, el) {
      activeMode = mode;
      el.parentElement.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      triggerSearch();
    }

    // Modal Map Picker עם חיפוש חי שמקפיץ את המפה
    function openMapModal(field) {
      currentModalField = field;
      const titles = {
        userOrigin: 'בחר מוצא הנוסע',
        userDest: 'בחר יעד הנוסע',
        driverOrigin: 'בחר מוצא הנהג',
        driverDest: 'בחר יעד הנהג'
      };
      document.getElementById('modal-field-title').innerText = titles[field] || 'בחר מיקום על המפה';
      document.getElementById('modalSearchInput').value = '';
      document.getElementById('modal-ac-box').style.display = 'none';
      document.getElementById('map-modal').style.display = 'flex';

      const initialLat = exactCoords[field] ? exactCoords[field].lat : 32.0853;
      const initialLon = exactCoords[field] ? exactCoords[field].lon : 34.7818;

      if (!modalMap) {
        modalMap = L.map('modal-map-view').setView([initialLat, initialLon], 14);
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}').addTo(modalMap);
      } else {
        modalMap.setView([initialLat, initialLon], 14);
        setTimeout(() => modalMap.invalidateSize(), 200);
      }
    }

    function closeMapModal() {
      document.getElementById('map-modal').style.display = 'none';
    }

    function confirmModalSelection() {
      const center = modalMap.getCenter();
      const name = center.lat.toFixed(4) + ', ' + center.lng.toFixed(4);
      exactCoords[currentModalField] = { lat: center.lat, lon: center.lng, name };
      document.getElementById(currentModalField + 'Input').value = name;
      
      const colors = { userOrigin: '#007AFF', userDest: '#34C759', driverOrigin: '#FF9500', driverDest: '#AF52DE' };
      updateMarkerOnMap(currentModalField, center.lat, center.lng, name, colors[currentModalField] || '#007AFF');
      closeMapModal();
      triggerSearch();
    }

    let modalAcTimer = null;
    function handleModalSearch() {
      clearTimeout(modalAcTimer);
      const query = document.getElementById('modalSearchInput').value;
      const box = document.getElementById('modal-ac-box');
      if (query.length < 2) { box.style.display = 'none'; return; }

      modalAcTimer = setTimeout(async () => {
        try {
          const res = await fetch('/v1/geocode?q=' + encodeURIComponent(query));
          const list = await res.json();
          box.innerHTML = '';
          if (list.length === 0) { box.style.display = 'none'; return; }
          list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'ac-item';
            div.innerText = item.fullName || item.name;
            div.onclick = () => {
              modalMap.setView([item.lat, item.lon], 15);
              box.style.display = 'none';
            };
            box.appendChild(div);
          });
          box.style.display = 'block';
        } catch(e) {}
      }, 300);
    }

    async function triggerSearch() {
      const spinner = document.getElementById('search-spinner');
      const btnText = document.getElementById('btn-text');
      spinner.style.display = 'block';
      btnText.innerText = 'מחשב מסלול...';

      const payload = {
        routeType: currentRouteType,
        userOrigin: exactCoords.userOrigin || document.getElementById('userOriginInput').value,
        userDest: exactCoords.userDest || document.getElementById('userDestInput').value,
        driverOrigin: exactCoords.driverOrigin || document.getElementById('driverOriginInput').value,
        driverDest: exactCoords.driverDest || document.getElementById('driverDestInput').value,
        maxDetourMin: document.getElementById('detourRange').value,
        originRideMin: document.getElementById('originRideRange').value,
        destRideMin: document.getElementById('destRideRange').value,
        mode: activeMode
      };

      try {
        const res = await fetch('/v1/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.userOrigin) updateMarkerOnMap('userOrigin', data.userOrigin.lat, data.userOrigin.lon, 'מוצא נוסע', '#007AFF');
        if (data.userDest) updateMarkerOnMap('userDest', data.userDest.lat, data.userDest.lon, 'יעד נוסע', '#34C759');
        if (currentRouteType === 'driver_route') {
          if (payload.driverOrigin && exactCoords.driverOrigin) updateMarkerOnMap('driverOrigin', exactCoords.driverOrigin.lat, exactCoords.driverOrigin.lon, 'מוצא נהג', '#FF9500');
          if (payload.driverDest && exactCoords.driverDest) updateMarkerOnMap('driverDest', exactCoords.driverDest.lat, exactCoords.driverDest.lon, 'יעד נהג', '#AF52DE');
        }

        renderResults(data.results);
      } catch(e) {
      } finally {
        spinner.style.display = 'none';
        btnText.innerText = 'מצא לי דרך';
      }
    }

    function toggleTimeline(idx, btn) {
      const el = document.getElementById('timeline-' + idx);
      const isOpen = el.classList.toggle('open');
      btn.innerText = isOpen ? '🔼 סגור פירוט' : '📋 פירוט שלבי המסלול';
    }

    function renderResults(results) {
      const container = document.getElementById('results-area');
      container.innerHTML = '';

      if (!results || results.length === 0) {
        container.innerHTML = '<div class="card">לא נמצאו נקודות מעבר בטווח שנבחר. נסה להגדיל את זמן הסטייה.</div>';
        return;
      }

      const best = results[0];
      if (best.hub && best.hub.lat) {
        updateMarkerOnMap('hub', best.hub.lat, best.hub.lon, 'נקודת מעבר: ' + best.hub.name, '#FF3B30');
      }

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
            <span class="badge \${isBest ? 'badge-green' : ''}">\${isBest ? 'מומלץ - ' + activeMode.toUpperCase() : '+' + r.detourMin + ' דק׳ לנהג'}</span>
          </div>

          <div style="font-size: 15px; font-weight: 600; margin-top: 6px;">נקודת מעבר: \${r.hub.name}</div>
          <div class="result-sub">\${r.whyReason}</div>

          <div class="timeline" id="timeline-\${idx}">
            <div style="font-size: 12px; font-weight: 700; color: var(--sec); margin-bottom: 10px;">שלבי המסלול המפורטים:</div>
            \${r.timeline.map(t => \`
              <div class="timeline-step">
                <div class="step-icon">\${t.icon}</div>
                <div class="step-content">
                  <div class="step-header">
                    <span class="step-title">\${t.title}</span>
                    <span class="step-tag">\${t.badge}</span>
                  </div>
                  <div class="step-desc">\${t.desc}</div>
                </div>
              </div>
            \`).join('')}
          </div>

          <div class="action-row">
            <button class="btn-action" onclick="toggleTimeline(\${idx}, this)">📋 פירוט שלבי המסלול</button>
            <a class="btn-action" href="\${wazeUrl}" target="_blank">נווט ב-Waze</a>
            <button class="btn-action" onclick="shareTrip('\${r.hub.name}', '\${wazeUrl}')">שתף עם הנהג</button>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    function shareTrip(hubName, wazeUrl) {
      const text = 'היי, זו נקודת המפגש שנבחרה: ' + hubName + '. קישור לניווט ב-Waze: ' + wazeUrl;
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

    updateMarkerOnMap('userOrigin', exactCoords.userOrigin.lat, exactCoords.userOrigin.lon, 'מוצא נוסע', '#007AFF');
    updateMarkerOnMap('userDest', exactCoords.userDest.lat, exactCoords.userDest.lon, 'יעד נוסע', '#34C759');
  </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('iWay Server running on port ' + PORT));
