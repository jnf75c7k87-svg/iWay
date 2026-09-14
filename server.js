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

function parseTimeToMinutes(timeStr) {
  if (!timeStr) {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function formatMinutesToTime(totalMins) {
  const normalized = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const mins = (normalized % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

// מאגר מקומות, צמתים ותחנות מובנה בישראל לזיהוי מיידי
const ISRAEL_PLACES = [
  { name: 'עדי', lat: 32.7842, lon: 35.1718 },
  { name: 'צומת עדי', lat: 32.7840, lon: 35.1720 },
  { name: 'שפרעם', lat: 32.8050, lon: 35.1690 },
  { name: 'צומת המוביל / מחלף המוביל', lat: 32.7562, lon: 35.2341 },
  { name: 'מחנה פלוגות', lat: 31.6341, lon: 34.7479 },
  { name: 'צומת פלוגות', lat: 31.6214, lon: 34.7478 },
  { name: 'קריית גת', lat: 31.6035, lon: 34.7738 },
  { name: 'רכבת קריית מוצקין', lat: 32.8335, lon: 35.0805 },
  { name: 'מרכזית המפרץ', lat: 32.7933, lon: 35.0344 },
  { name: 'מחלף יגור', lat: 32.7440, lon: 35.0760 },
  { name: 'רכבת עפולה', lat: 32.6140, lon: 35.2950 },
  { name: 'רכבת תל אביב השלום', lat: 32.0734, lon: 34.7925 },
  { name: 'תל אביב סבידור מרכז', lat: 32.0835, lon: 34.7983 },
  { name: 'רכבת הרצליה', lat: 32.1629, lon: 34.8252 },
  { name: 'רכבת אשקלון', lat: 31.6750, lon: 34.5950 },
  { name: 'באר שבע מרכז', lat: 31.2435, lon: 34.7972 },
  { name: 'חיפה', lat: 32.7940, lon: 34.9896 },
  { name: 'ירושלים', lat: 31.7870, lon: 35.2010 },
  { name: 'ראשון לציון', lat: 31.9730, lon: 34.7925 }
];

// מאגר תחנות מעבר מפורט
const ALL_HUBS = [
  { id: 'h_hamovill', name: 'צומת המוביל / מחלף המוביל', type: 'bus', transitType: 'אוטובוס בינעירוני מהיר', lineName: 'קו 430 (סופרבוס)', platform: 'רציף 2', dropStation: 'מרכזית טבריה / עמקים', intermediateStops: 4, lat: 32.7562, lon: 35.2341 },
  { id: 'h_motzkin', name: 'רכבת קריית מוצקין', type: 'train', transitType: 'רכבת ישראל', lineName: 'רכבת בינעירונית (נהריה ⟵ באר שבע)', platform: 'רציף 1', dropStation: 'ת"א סבידור מרכז', intermediateStops: 5, lat: 32.8335, lon: 35.0805 },
  { id: 'h_mifratz', name: 'מרכזית המפרץ', type: 'train', transitType: 'רכבת ומטרונית', lineName: 'מטרונית קו 1 / רכבת החוף', platform: 'רציף 3', dropStation: 'חיפה חוף הכרמל', intermediateStops: 6, lat: 32.7933, lon: 35.0344 },
  { id: 'h_yagur', name: 'מחלף יגור', type: 'bus', transitType: 'אוטובוס אזורי', lineName: 'קו 75 (נתיב אקספרס)', platform: 'תחנה ראשית', dropStation: 'צומת המוביל / גולני', intermediateStops: 3, lat: 32.7440, lon: 35.0760 },
  { id: 'h_afula', name: 'רכבת עפולה (העמק)', type: 'train', transitType: 'רכבת ישראל', lineName: 'רכבת העמק (בית שאן ⟵ חיפה)', platform: 'רציף 1', dropStation: 'מרכזית המפרץ', intermediateStops: 3, lat: 32.6140, lon: 35.2950 },
  { id: 'h_kgat', name: 'רכבת קריית גת', type: 'train', transitType: 'רכבת ישראל', lineName: 'רכבת מהירה (באר שבע ⟵ הרצליה)', platform: 'רציף 1', dropStation: 'ת"א השלום', intermediateStops: 2, lat: 31.6035, lon: 34.7738 },
  { id: 'h_plugot', name: 'צומת פלוגות', type: 'bus', transitType: 'אוטובוס בינעירוני', lineName: 'קו 369 (מטרופולין)', platform: 'תחנה בינעירונית', dropStation: 'ת"א תחנה מרכזית', intermediateStops: 7, lat: 31.6214, lon: 34.7478 },
  { id: 'h_ashkelon', name: 'רכבת אשקלון', type: 'train', transitType: 'רכבת ישראל', lineName: 'רכבת פרברית (אשקלון ⟵ הרצליה)', platform: 'רציף 2', dropStation: 'ראשל"צ משה דיין', intermediateStops: 4, lat: 31.6750, lon: 34.5950 },
  { id: 'h_b7', name: 'רכבת באר שבע מרכז', type: 'train', transitType: 'רכבת ישראל', lineName: 'קו מהיר לתל אביב', platform: 'רציף 2', dropStation: 'ת"א ההגנה', intermediateStops: 3, lat: 31.2435, lon: 34.7972 },
  { id: 'h_tlv_hashalom', name: 'רכבת ת"א השלום', type: 'train', transitType: 'רכבת ישראל', lineName: 'רכבת צפון (ת"א ⟵ נהריה / כרמיאל)', platform: 'רציף 3', dropStation: 'חיפה מרכז', intermediateStops: 4, lat: 32.0734, lon: 34.7925 },
  { id: 'h_tlv_savidor', name: 'ת"א סבידור מרכז', type: 'train', transitType: 'רכבת ישראל / דנקל', lineName: 'רכבת ישירה לצפון + קו אדום', platform: 'רציף 4', dropStation: 'בנימינה / חיפה', intermediateStops: 3, lat: 32.0835, lon: 34.7983 },
  { id: 'h_herzliya', name: 'רכבת הרצליה', type: 'train', transitType: 'רכבת ישראל', lineName: 'קו החוף ורכבות השרון', platform: 'רציף 2', dropStation: 'נתניה מרכז', intermediateStops: 2, lat: 32.1629, lon: 34.8252 },
  { id: 'h_shapirim', name: 'חניון שפירים הנתיב המהיר', type: 'bus', transitType: 'שאטל ישיר', lineName: 'שאטל נתיב מהיר (תל אביב הקריה)', platform: 'מתחם שאטלים', dropStation: 'תל אביב עזריאלי / הקריה', intermediateStops: 0, lat: 32.0078, lon: 34.8322 }
];

function runOptimizerWithSchedule(body) {
  const {
    routeType = 'driver_route',
    userOrigin,
    userDest,
    timeType = 'depart_now',
    targetTime = '',
    destRideMin = 0,
    mode = 'smart'
  } = body;

  const destRideRadius = Number(destRideMin) || 0;
  let baseMinutes = parseTimeToMinutes(targetTime);
  const candidates = [];

  for (const hub of ALL_HUBS) {
    let driveWithDriver = 0;
    let detourMin = 0;
    let isEligible = false;

    if (routeType === 'driver_route') {
      const { driverOrigin, driverDest, maxDetourMin = 20 } = body;
      const directDriverTime = estDriveMinutes(driverOrigin, driverDest);
      const timeToPickup = estDriveMinutes(driverOrigin, userOrigin);
      const timePickupToHub = estDriveMinutes(userOrigin, hub);
      const timeHubToDriverDest = estDriveMinutes(hub, driverDest);

      const totalDriverTrip = timeToPickup + timePickupToHub + timeHubToDriverDest;
      detourMin = Math.max(0, totalDriverTrip - directDriverTime);

      if (detourMin <= Number(maxDetourMin)) {
        isEligible = true;
        driveWithDriver = timePickupToHub;
      }
    } else {
      const originRideMin = Number(body.originRideMin) || 0;
      const driveFromOrigin = estDriveMinutes(userOrigin, hub);
      if (originRideMin === 0 || driveFromOrigin <= originRideMin) {
        isEligible = true;
        driveWithDriver = originRideMin === 0 ? 0 : driveFromOrigin;
        detourMin = driveWithDriver;
      }
    }

    if (!isEligible) continue;

    const driveFromHubToDest = estDriveMinutes(hub, userDest);
    const hasDestPickup = destRideRadius > 0 && driveFromHubToDest <= destRideRadius;

    const distKm = haversineDistMeters(hub, userDest) / 1000;
    const transitLegMinutes = hasDestPickup ? 0 : Math.round(distKm / 38 * 60) + 10;
    const finalDestLegMinutes = hasDestPickup ? driveFromHubToDest : 5;

    const totalTripMinutes = driveWithDriver + transitLegMinutes + finalDestLegMinutes + 7;

    let startMin = baseMinutes;
    if (timeType === 'arrive_by') {
      startMin = baseMinutes - totalTripMinutes;
    }

    const tPickup = startMin;
    const tDropoffAtHub = tPickup + driveWithDriver;
    const tBoardTransit = tDropoffAtHub + 5;
    const tAlightTransit = tBoardTransit + transitLegMinutes;
    const tFinalArrival = tAlightTransit + finalDestLegMinutes;

    const timeline = [];

    if (driveWithDriver > 0) {
      timeline.push({
        time: formatMinutesToTime(tPickup),
        icon: '🚗',
        badge: routeType === 'driver_route' ? 'הצטרפות לנהג' : 'הקפצה מהמוצא',
        title: `איסוף ברכב מנקודת המוצא`,
        desc: `נסיעה משותפת כ-${driveWithDriver} דקות עד לתחנת המעבר`
      });
      timeline.push({
        time: formatMinutesToTime(tDropoffAtHub),
        icon: '📍',
        badge: 'הורדה',
        title: `הורדה בתחנה: ${hub.name}`,
        desc: routeType === 'driver_route' ? `סטיית הנהג ממסלולו: +${detourMin} דקות` : `זמן הקפצה: ${driveWithDriver} דקות`
      });
    } else {
      timeline.push({
        time: formatMinutesToTime(tPickup),
        icon: '🚶',
        badge: 'הליכה',
        title: `הליכה לתחנת ${hub.name}`,
        desc: 'הגעה עצמאית לתחנת המוצא'
      });
    }

    if (!hasDestPickup) {
      timeline.push({
        time: formatMinutesToTime(tBoardTransit),
        icon: hub.type === 'train' ? '🚆' : '🚌',
        badge: hub.transitType,
        title: `עולים על: ${hub.lineName} (${hub.platform})`,
        desc: `עולים ב-${hub.name} • עוברים ${hub.intermediateStops} תחנות ביניים`
      });
      timeline.push({
        time: formatMinutesToTime(tAlightTransit),
        icon: '🛑',
        badge: 'ירידה',
        title: `יורדים בתחנה: ${hub.dropStation}`,
        desc: `שעת ירידה משוערת: ${formatMinutesToTime(tAlightTransit)}`
      });
      timeline.push({
        time: formatMinutesToTime(tFinalArrival),
        icon: '🎯',
        badge: 'הגעה',
        title: 'הגעה ליעד הסופי',
        desc: 'הגעה ברגל ליעד המבוקש'
      });
    } else {
      timeline.push({
        time: formatMinutesToTime(tDropoffAtHub + 5),
        icon: '🚗',
        badge: 'איסוף ביעד',
        title: `איסוף ברכב מ-${hub.name}`,
        desc: `נסיעה ברכב של כ-${driveFromHubToDest} דקות ישירות ליעד (בטווח של עד ${destRideRadius} דק׳)`
      });
      timeline.push({
        time: formatMinutesToTime(tDropoffAtHub + 5 + driveFromHubToDest),
        icon: '🎯',
        badge: 'הגעה',
        title: 'הגעה ליעד הסופי',
        desc: 'סיום הנסיעה ברכב ביעד המבוקש'
      });
    }

    let score = totalTripMinutes;
    if (mode === 'fast') score = totalTripMinutes * 1.1;
    if (mode === 'easy') score = totalTripMinutes + (hasDestPickup ? -20 : 0);

    candidates.push({
      hub,
      totalUserTime: totalTripMinutes,
      startTime: formatMinutesToTime(startMin),
      endTime: formatMinutesToTime(timeType === 'arrive_by' ? baseMinutes : tFinalArrival),
      detourMin,
      hasDestPickup,
      score,
      whyReason: `מעבר מסודר ב-${hub.name}. יציאה ב-${formatMinutesToTime(startMin)} והגעה ב-${formatMinutesToTime(tFinalArrival)}.`,
      timeline
    });
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, 5);
}

// נתיב Autocomplete משולב: קודם בודק במאגר המקומי, ואז ברשת
app.get('/v1/geocode', async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  if (!query || query.length < 2) return res.json([]);

  const localMatches = ISRAEL_PLACES.filter(p => p.name.toLowerCase().includes(query))
    .map(p => ({ name: p.name, fullName: p.name + ', ישראל', lat: p.lat, lon: p.lon }));

  if (localMatches.length >= 3) {
    return res.json(localMatches);
  }

  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&accept-language=he&q=${encodeURIComponent(query)}&limit=5`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'iWayApp-Israel/8.0' } });
    const data = await resp.json();
    const netMatches = (data || []).map(item => ({
      name: item.display_name.split(',')[0],
      fullName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }));

    const combined = [...localMatches, ...netMatches];
    const unique = Array.from(new Map(combined.map(item => [item.name, item])).values());
    res.json(unique);
  } catch (err) {
    res.json(localMatches);
  }
});

app.post('/v1/search', async (req, res) => {
  const body = req.body;
  const results = runOptimizerWithSchedule(body);
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
    .input-row input, .input-row select { flex: 1; border: none; outline: none; background: transparent; font-size: 15px; color: var(--text); direction: rtl; }
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
    .timeline-step { display: flex; gap: 10px; margin-bottom: 14px; position: relative; }
    .timeline-step:not(:last-child)::after { content: ''; position: absolute; right: 54px; top: 28px; bottom: -10px; width: 2px; background: var(--border); }
    
    .step-time-badge { width: 42px; font-size: 12px; font-weight: 700; color: var(--sec); text-align: left; padding-top: 4px; }
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
    .map-modal-search { padding: 10px 16px; background: var(--card); border-bottom: 1px solid var(--border); position: relative; z-index: 10005; display: flex; gap: 8px; }
    .map-modal-search input { flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border); outline: none; font-size: 15px; direction: rtl; background: var(--bg); color: var(--text); }
    .btn-search-modal { padding: 0 14px; background: var(--blue); color: #FFF; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .modal-ac-box { position: absolute; top: 100%; right: 16px; left: 16px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; z-index: 10010; box-shadow: 0 8px 24px rgba(0,0,0,0.2); max-height: 220px; overflow-y: auto; display: none; }
    .ac-item { padding: 12px 14px; font-size: 14px; border-bottom: 1px solid var(--border); cursor: pointer; color: var(--text); }
    .ac-item:last-child { border-bottom: none; }
    #modal-map-view { flex: 1; position: relative; z-index: 1; }
    .center-pin { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -100%); z-index: 999; font-size: 38px; pointer-events: none; }
    .map-modal-footer { padding: 14px 16px; background: var(--card); border-top: 1px solid var(--border); z-index: 10005; }
  </style>
</head>
<body>

  <div id="map-modal" class="map-modal">
    <div class="map-modal-header">
      <span style="font-weight: 700; font-size: 17px;" id="modal-field-title">בחר מיקום על המפה</span>
      <button onclick="closeMapModal()" style="border: none; background: none; color: var(--blue); font-size: 16px; font-weight: 600; cursor: pointer;">ביטול</button>
    </div>
    <div class="map-modal-search">
      <input type="text" id="modalSearchInput" placeholder="הקלד עיר, צומת או רחוב..." autocomplete="off" oninput="handleModalSearch()" onkeydown="if(event.key==='Enter'){event.preventDefault();executeModalSearch();}">
      <button class="btn-search-modal" onclick="executeModalSearch()">חפש</button>
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

  <div class="card-title">סוג המסלול</div>
  <div class="card">
    <div class="segmented" id="route-type-selector">
      <div class="segment active" onclick="setRouteType('driver_route', this)">הצטרפות למסלול נהג</div>
      <div class="segment" onclick="setRouteType('rides', this)">הקפצה לתחנה</div>
    </div>
  </div>

  <div class="card-title">זמני נסיעה</div>
  <div class="card">
    <div class="input-row">
      <label>מועד נסיעה</label>
      <select id="timeTypeSelect" onchange="handleTimeTypeChange()">
        <option value="depart_now">צא עכשיו</option>
        <option value="depart_at">יציאה בשעה...</option>
        <option value="arrive_by">הגעה עד שעה...</option>
      </select>
    </div>
    <div class="input-row" id="timeInputRow" style="display: none;">
      <label>שעה רצויה</label>
      <input type="time" id="targetTimeInput">
    </div>
  </div>

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

  <div id="driver-route-section">
    <div class="card-title">מסלול הנהג</div>
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

  <div id="rides-section" style="display: none;">
    <div class="card-title">הקפצה מהמוצא לתחנה</div>
    <div class="card">
      <div class="slider-header">
        <span>🚗 זמן הקפצה מהמוצא</span>
        <span class="slider-val" id="originRideText">15 דק׳</span>
      </div>
      <input type="range" id="originRideRange" min="0" max="60" step="5" value="15" oninput="document.getElementById('originRideText').innerText = this.value == 0 ? 'ללא הקפצה' : 'עד ' + this.value + ' דק׳'; triggerSearch();">
    </div>
  </div>

  <div class="card-title">איסוף ביעד (אופציונלי)</div>
  <div class="card">
    <div class="slider-header">
      <span>🚗 זמן איסוף מתחנה ליעד</span>
      <span class="slider-val" id="destRideText">0 דקות (בלי איסוף)</span>
    </div>
    <input type="range" id="destRideRange" min="0" max="60" step="5" value="0" oninput="document.getElementById('destRideText').innerText = this.value == 0 ? '0 דקות (בלי איסוף)' : 'עד ' + this.value + ' דק׳ ברכב'; triggerSearch();">
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
    let currentChosenPlaceName = '';

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

    function handleTimeTypeChange() {
      const val = document.getElementById('timeTypeSelect').value;
      const row = document.getElementById('timeInputRow');
      if (val === 'depart_now') {
        row.style.display = 'none';
      } else {
        row.style.display = 'flex';
        if (!document.getElementById('targetTimeInput').value) {
          const now = new Date();
          document.getElementById('targetTimeInput').value = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        }
      }
      triggerSearch();
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
      currentChosenPlaceName = exactCoords[field] ? exactCoords[field].name : '';

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

    // חיפוש כפול: פונה לשרת, ובמקביל פונה ישירות מהדפדפן
    async function searchPlaces(query) {
      if (!query || query.length < 2) return [];
      try {
        const res = await fetch('/v1/geocode?q=' + encodeURIComponent(query));
        const list = await res.json();
        if (list && list.length > 0) return list;
      } catch (e) {}

      try {
        const directUrl = 'https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&accept-language=he&q=' + encodeURIComponent(query) + '&limit=5';
        const res = await fetch(directUrl);
        const data = await res.json();
        return (data || []).map(item => ({
          name: item.display_name.split(',')[0],
          fullName: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon)
        }));
      } catch (e) {}
      return [];
    }

    async function executeModalSearch() {
      const query = document.getElementById('modalSearchInput').value.trim();
      if (!query) return;
      document.getElementById('modal-ac-box').style.display = 'none';
      const results = await searchPlaces(query);
      if (results && results.length > 0) {
        const item = results[0];
        modalMap.setView([item.lat, item.lon], 15);
        currentChosenPlaceName = item.name;
        document.getElementById('modalSearchInput').value = item.name;
      } else {
        alert('לא נמצא מיקום עבור: "' + query + '". נסה להקליד שם עיר או יישוב סמוך.');
      }
    }

    let modalAcTimer = null;
    function handleModalSearch() {
      clearTimeout(modalAcTimer);
      const query = document.getElementById('modalSearchInput').value.trim();
      const box = document.getElementById('modal-ac-box');
      if (query.length < 2) { box.style.display = 'none'; return; }

      modalAcTimer = setTimeout(async () => {
        const list = await searchPlaces(query);
        box.innerHTML = '';
        if (!list || list.length === 0) { box.style.display = 'none'; return; }
        list.forEach(item => {
          const div = document.createElement('div');
          div.className = 'ac-item';
          div.innerText = item.fullName || item.name;
          div.onclick = () => {
            modalMap.setView([item.lat, item.lon], 15);
            currentChosenPlaceName = item.name;
            document.getElementById('modalSearchInput').value = item.name;
            box.style.display = 'none';
          };
          box.appendChild(div);
        });
        box.style.display = 'block';
      }, 300);
    }

    function confirmModalSelection() {
      const center = modalMap.getCenter();
      const name = currentChosenPlaceName || (center.lat.toFixed(4) + ', ' + center.lng.toFixed(4));
      exactCoords[currentModalField] = { lat: center.lat, lon: center.lng, name };
      document.getElementById(currentModalField + 'Input').value = name;
      
      const colors = { userOrigin: '#007AFF', userDest: '#34C759', driverOrigin: '#FF9500', driverDest: '#AF52DE' };
      updateMarkerOnMap(currentModalField, center.lat, center.lng, name, colors[currentModalField] || '#007AFF');
      closeMapModal();
      triggerSearch();
    }

    async function triggerSearch() {
      const spinner = document.getElementById('search-spinner');
      const btnText = document.getElementById('btn-text');
      spinner.style.display = 'block';
      btnText.innerText = 'מחשב זמני אמת...';

      const payload = {
        routeType: currentRouteType,
        userOrigin: exactCoords.userOrigin,
        userDest: exactCoords.userDest,
        driverOrigin: exactCoords.driverOrigin,
        driverDest: exactCoords.driverDest,
        timeType: document.getElementById('timeTypeSelect').value,
        targetTime: document.getElementById('targetTimeInput').value,
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
          if (exactCoords.driverOrigin) updateMarkerOnMap('driverOrigin', exactCoords.driverOrigin.lat, exactCoords.driverOrigin.lon, 'מוצא נהג', '#FF9500');
          if (exactCoords.driverDest) updateMarkerOnMap('driverDest', exactCoords.driverDest.lat, exactCoords.driverDest.lon, 'יעד נהג', '#AF52DE');
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
        container.innerHTML = '<div class="card">לא נמצאו נקודות מעבר בטווח שנבחר. נסה להגדיל את זמן הסטייה או האיסוף.</div>';
        return;
      }

      const best = results[0];
      if (best.hub && best.hub.lat) {
        updateMarkerOnMap('hub', best.hub.lat, best.hub.lon, 'תחנת מעבר: ' + best.hub.name, '#FF3B30');
      }

      results.forEach((r, idx) => {
        const isBest = idx === 0;
        const wazeUrl = 'https://waze.com/ul?ll=' + r.hub.lat + ',' + r.hub.lon + '&navigate=yes';
        const card = document.createElement('div');
        card.className = 'result-card ' + (isBest ? 'featured' : '');
        card.innerHTML = \`
          <div class="result-top">
            <div>
              <span class="result-time">\${r.startTime} ⟵ \${r.endTime}</span>
              <span style="font-size: 13px; color: var(--sec); margin-right: 4px;">(\${r.totalUserTime} דקות)</span>
            </div>
            <span class="badge \${isBest ? 'badge-green' : ''}">\${isBest ? 'מומלץ - ' + activeMode.toUpperCase() : 'מסלול חלופי'}</span>
          </div>

          <div style="font-size: 15px; font-weight: 600; margin-top: 6px;">תחנת מעבר: \${r.hub.name}</div>
          <div class="result-sub">\${r.whyReason}</div>

          <div class="timeline" id="timeline-\${idx}">
            <div style="font-size: 12px; font-weight: 700; color: var(--sec); margin-bottom: 10px;">שלבי המסלול המפורטים:</div>
            \${r.timeline.map(t => \`
              <div class="timeline-step">
                <div class="step-time-badge">\${t.time}</div>
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
