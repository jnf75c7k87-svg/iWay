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

function estWalkMinutes(from, to) {
  const dist = haversineDistMeters(from, to);
  return Math.max(1, Math.round((dist / 1000) / 4.2 * 60));
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

const TRAIN_NETWORK_STATIONS = [
  { name: 'רכבת נתניה', stopId: '37302', platform: 'רציף 1', trainNum: 'רכבת 142', lat: 32.3190, lon: 34.8660 },
  { name: 'רכבת בית יהושע', stopId: '37306', platform: 'רציף 1', trainNum: 'רכבת 142', lat: 32.2610, lon: 34.8640 },
  { name: 'רכבת נתניה - ספיר', stopId: '37314', platform: 'רציף 1', trainNum: 'רכבת 144', lat: 32.2820, lon: 34.8650 },
  { name: 'רכבת הרצליה', stopId: '37308', platform: 'רציף 2', trainNum: 'רכבת 218', lat: 32.1629, lon: 34.8252 },
  { name: 'רכבת תל אביב אוניברסיטה', stopId: '36002', platform: 'רציף 4', trainNum: 'רכבת 142', lat: 32.1032, lon: 34.8049 },
  { name: 'רכבת תל אביב סבידור מרכז', stopId: '36004', platform: 'רציף 4', trainNum: 'רכבת 142', lat: 32.0835, lon: 34.7983 },
  { name: 'רכבת תל אביב השלום', stopId: '36006', platform: 'רציף 3', trainNum: 'רכבת 142', lat: 32.0734, lon: 34.7925 },
  { name: 'רכבת תל אביב ההגנה', stopId: '36008', platform: 'רציף 3', trainNum: 'רכבת 142', lat: 32.0538, lon: 34.7788 },
  { name: 'רכבת חדרה מערב', stopId: '37310', platform: 'רציף 1', trainNum: 'רכבת 218', lat: 32.4410, lon: 34.9080 },
  { name: 'רכבת בנימינה', stopId: '37312', platform: 'רציף 2', trainNum: 'רכבת 218', lat: 32.5140, lon: 34.9520 },
  { name: 'רכבת חיפה חוף הכרמל', stopId: '34002', platform: 'רציף 1', trainNum: 'רכבת 218', lat: 32.7930, lon: 34.9570 },
  { name: 'מרכזית המפרץ', stopId: '34006', platform: 'רציף 3', trainNum: 'רכבת 218', lat: 32.7933, lon: 35.0344 },
  { name: 'רכבת קריית מוצקין', stopId: '34008', platform: 'רציף 1', trainNum: 'רכבת 218', lat: 32.8335, lon: 35.0805 },
  { name: 'רכבת עפולה', stopId: '38002', platform: 'רציף 1', trainNum: 'רכבת 512', lat: 32.6140, lon: 35.2950 },
  { name: 'רכבת ראשון לציון משה דיין', stopId: '36102', platform: 'רציף 1', trainNum: 'רכבת 124', lat: 31.9877, lon: 34.7570 },
  { name: 'רכבת קריית גת', stopId: '39002', platform: 'רציף 1', trainNum: 'רכבת 142', lat: 31.6035, lon: 34.7738 },
  { name: 'רכבת באר שבע מרכז', stopId: '39006', platform: 'רציף 2', trainNum: 'רכבת 142', lat: 31.2435, lon: 34.7972 }
];

function findClosestStationToDestination(destCoord) {
  let closest = TRAIN_NETWORK_STATIONS[0];
  let minDistance = Infinity;

  for (const stn of TRAIN_NETWORK_STATIONS) {
    const d = haversineDistMeters(stn, destCoord);
    if (d < minDistance) {
      minDistance = d;
      closest = stn;
    }
  }
  return { station: closest, distanceMeters: minDistance };
}

const ALL_HUBS = [
  { id: 'h_plugot', name: 'צומת פלוגות (תחנה בינעירונית)', type: 'bus', transitType: 'אוטובוס בינעירוני', lineBadge: 'קו 369', lineName: 'קו 369 (מטרופולין) לתל אביב', stopId: '13524', platform: 'מסלול צפון', lat: 31.6214, lon: 34.7478 },
  { id: 'h_kgat', name: 'רכבת קריית גת', type: 'train', transitType: 'רכבת ישראל', lineBadge: 'רכבת 142', lineName: 'רכבת מהירה למרכז (באר שבע ⟵ הרצליה)', stopId: '39002', platform: 'רציף 1', lat: 31.6035, lon: 34.7738 },
  { id: 'h_tlv_hashalom', name: 'רכבת ת"א השלום (עזריאלי)', type: 'train', transitType: 'רכבת ישראל', lineBadge: 'רכבת 142', lineName: 'רכבת בינעירונית (באר שבע ⟵ נהריה)', stopId: '36006', platform: 'רציף 3', lat: 32.0734, lon: 34.7925 },
  { id: 'h_tlv_savidor', name: 'ת"א סבידור מרכז', type: 'train', transitType: 'רכבת ישראל', lineBadge: 'רכבת 218', lineName: 'רכבת מהירה לצפון (ת"א ⟵ חיפה)', stopId: '36004', platform: 'רציף 4', lat: 32.0835, lon: 34.7983 },
  { id: 'h_shapirim', name: 'חניון שפירים הנתיב המהיר', type: 'bus', transitType: 'שאטל ישיר', lineBadge: 'שאטל 1', lineName: 'שאטל ישיר לקריה / עזריאלי', stopId: '10022', platform: 'מתחם שאטלים', lat: 32.0078, lon: 34.8322 },
  { id: 'h_herzliya', name: 'רכבת הרצליה', type: 'train', transitType: 'רכבת ישראל', lineBadge: 'רכבת 142', lineName: 'קו החוף ורכבות השרון', stopId: '37308', platform: 'רציף 2', lat: 32.1629, lon: 34.8252 },
  { id: 'h_hamovill', name: 'מחלף המוביל (מסוף בינעירוני)', type: 'bus', transitType: 'אוטובוס בינעירוני מהיר', lineBadge: 'קו 430', lineName: 'קו 430 (סופרבוס) לצפון ולמרכז', stopId: '54210', platform: 'רציף 2', lat: 32.7562, lon: 35.2341 }
];

function runSmartOptimizer(body) {
  const {
    routeType = 'driver_route',
    userOrigin,
    userDest,
    timeType = 'depart_now',
    targetTime = '',
    maxDetourMin = 0,
    originRideMin = 0,
    destRideMin = 0,
    mode = 'smart'
  } = body;

  const destRideRadius = Number(destRideMin) || 0;
  const detourLimit = Number(maxDetourMin) || 0;
  let baseMinutes = parseTimeToMinutes(targetTime);
  const candidates = [];

  const { station: optimalAlightStation, distanceMeters: distFromAlightToDest } = findClosestStationToDestination(userDest);

  for (const hub of ALL_HUBS) {
    let driveWithDriver = 0;
    let walkToHubMin = 0;
    let detourMin = 0;
    let isEligible = false;

    if (routeType === 'driver_route') {
      const { driverOrigin, driverDest } = body;
      const directDriverTime = estDriveMinutes(driverOrigin, driverDest);
      const timeToPickup = estDriveMinutes(driverOrigin, userOrigin);
      const timePickupToHub = estDriveMinutes(userOrigin, hub);
      const timeHubToDriverDest = estDriveMinutes(hub, driverDest);

      const totalDriverTrip = timeToPickup + timePickupToHub + timeHubToDriverDest;
      detourMin = Math.max(0, totalDriverTrip - directDriverTime);

      // אם סטייה 0: הנהג לא מבצע שום סטייה
      if (detourMin <= detourLimit) {
        isEligible = true;
        driveWithDriver = timePickupToHub;
      }
    } else {
      const rideFromOriginTime = Number(originRideMin) || 0;
      const driveFromOrigin = estDriveMinutes(userOrigin, hub);
      const distFromOriginKm = haversineDistMeters(userOrigin, hub) / 1000;

      if (rideFromOriginTime > 0) {
        if (driveFromOrigin <= rideFromOriginTime) {
          isEligible = true;
          driveWithDriver = driveFromOrigin;
          detourMin = driveFromOrigin;
        }
      } else {
        // 0 דקות במוצא: ללא הקפצה ברכב כלל (רק תחנות ברדיוס הליכה סביר)
        if (distFromOriginKm <= 3.5) {
          isEligible = true;
          walkToHubMin = estWalkMinutes(userOrigin, hub);
          driveWithDriver = 0;
        }
      }
    }

    if (!isEligible) continue;

    const distBetweenStationsKm = haversineDistMeters(hub, optimalAlightStation) / 1000;
    const trainRideMinutes = Math.max(8, Math.round(distBetweenStationsKm / 75 * 60));

    const distFinalKm = distFromAlightToDest / 1000;
    const driveFinalLeg = Math.max(3, Math.round(distFinalKm / 45 * 60));
    const hasDestPickup = destRideRadius > 0 && driveFinalLeg <= destRideRadius;

    const finalLegMinutes = hasDestPickup ? driveFinalLeg : Math.min(45, Math.round(distFinalKm / 20 * 60) + 6);
    const initialLegTime = driveWithDriver > 0 ? driveWithDriver : walkToHubMin;
    const totalTripMinutes = initialLegTime + trainRideMinutes + finalLegMinutes + 6;

    let startMin = baseMinutes;
    if (timeType === 'arrive_by') {
      startMin = baseMinutes - totalTripMinutes;
    }

    const tPickup = startMin;
    const tDropoffAtHub = tPickup + initialLegTime;
    const tBoardTransit = tDropoffAtHub + 5;
    const tAlightTransit = tBoardTransit + trainRideMinutes;
    const tFinalArrival = tAlightTransit + finalLegMinutes;

    const timeline = [];

    if (driveWithDriver > 0) {
      timeline.push({
        time: formatMinutesToTime(tPickup),
        icon: '🚗',
        badge: routeType === 'driver_route' ? 'נסיעה עם נהג' : 'הקפצה ברכב',
        title: `איסוף מנקודת המוצא`,
        desc: `נסיעה משותפת כ-${driveWithDriver} דק׳ עד לתחנת המעבר`,
        lat: userOrigin.lat,
        lon: userOrigin.lon
      });
      timeline.push({
        time: formatMinutesToTime(tDropoffAtHub),
        icon: '📍',
        badge: `תחנה #${hub.stopId}`,
        title: `הורדה בתחנה: ${hub.name}`,
        desc: `סטיית נהג: +${detourMin} דק׳ • ${hub.platform}`,
        lat: hub.lat,
        lon: hub.lon
      });
    } else {
      timeline.push({
        time: formatMinutesToTime(tPickup),
        icon: '🚶',
        badge: `הליכה (${walkToHubMin} דק׳)`,
        title: `הגעה עצמאית לתחנת ${hub.name}`,
        desc: `תחנה סמוכה למוצא שלך (#${hub.stopId})`,
        lat: hub.lat,
        lon: hub.lon
      });
    }

    timeline.push({
      time: formatMinutesToTime(tBoardTransit),
      icon: hub.type === 'train' ? '🚆' : '🚌',
      badge: hub.lineBadge,
      title: `עולים על ${hub.lineName}`,
      desc: `תחנה #${hub.stopId} (${hub.platform}) • ירידה ב-${optimalAlightStation.name} (כ-${trainRideMinutes} דק׳)`,
      lat: hub.lat,
      lon: hub.lon
    });

    timeline.push({
      time: formatMinutesToTime(tAlightTransit),
      icon: '🛑',
      badge: `תחנה #${optimalAlightStation.stopId}`,
      title: `יורדים ב-${optimalAlightStation.name}`,
      desc: `${optimalAlightStation.platform} • מרחק מהיעד: כ-${(distFinalKm).toFixed(1)} ק״מ`,
      lat: optimalAlightStation.lat,
      lon: optimalAlightStation.lon
    });

    if (hasDestPickup) {
      timeline.push({
        time: formatMinutesToTime(tAlightTransit + 2),
        icon: '🚗',
        badge: 'איסוף ביעד',
        title: `איסוף ברכב מ-${optimalAlightStation.name}`,
        desc: `נסיעה ברכב של כ-${driveFinalLeg} דקות ליעד (ברדיוס של עד ${destRideRadius} דק׳)`,
        lat: optimalAlightStation.lat,
        lon: optimalAlightStation.lon
      });
    } else {
      timeline.push({
        time: formatMinutesToTime(tAlightTransit + 2),
        icon: '🚌',
        badge: 'קו מקומי / הליכה',
        title: `המשך מקומי מ-${optimalAlightStation.name} ליעד`,
        desc: `קו מקומי או הליכה רגלית כ-${finalLegMinutes} דקות (0 דק׳ איסוף)`,
        lat: optimalAlightStation.lat,
        lon: optimalAlightStation.lon
      });
    }

    timeline.push({
      time: formatMinutesToTime(tFinalArrival),
      icon: '🎯',
      badge: 'סיום מסלול',
      title: 'הגעה ליעד המבוקש',
      desc: 'הגעה ליעד הסופי',
      lat: userDest.lat,
      lon: userDest.lon
    });

    let score = totalTripMinutes;
    if (mode === 'fast') score = totalTripMinutes * 1.1;
    if (mode === 'easy') score = totalTripMinutes + (hasDestPickup ? -20 : 0);

    candidates.push({
      hub,
      optimalAlightStation: optimalAlightStation.name,
      totalUserTime: totalTripMinutes,
      startTime: formatMinutesToTime(startMin),
      endTime: formatMinutesToTime(timeType === 'arrive_by' ? baseMinutes : tFinalArrival),
      detourMin,
      hasDestPickup,
      score,
      whyReason: `מעבר דרך ${hub.name} (${hub.lineBadge}) וירידה ב-${optimalAlightStation.name}.`,
      timeline
    });
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates.slice(0, 5);
}

app.get('/v1/geocode', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) return res.json([]);

  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&accept-language=he&q=${encodeURIComponent(query)}&limit=6`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'iWayApp-Israel/12.0' } });
    const data = await resp.json();
    res.json((data || []).map(item => ({
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
  const results = runSmartOptimizer(body);
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
    .timeline-step { display: flex; gap: 10px; margin-bottom: 16px; position: relative; }
    .timeline-step:not(:last-child)::after { content: ''; position: absolute; right: 54px; top: 30px; bottom: -12px; width: 2px; background: var(--border); }
    
    .step-time-badge { width: 42px; font-size: 12px; font-weight: 700; color: var(--sec); text-align: left; padding-top: 4px; }
    .step-icon { width: 28px; height: 28px; border-radius: 50%; background: var(--tint); display: flex; align-items: center; justify-content: center; font-size: 14px; z-index: 2; flex-shrink: 0; }
    .step-content { flex: 1; }
    .step-header { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px; }
    .step-title { font-size: 14px; font-weight: 600; }
    .step-tag { font-size: 11px; padding: 2px 7px; border-radius: 5px; font-weight: 700; background: #007AFF; color: #FFF; }
    .step-desc { font-size: 12.5px; color: var(--sec); line-height: 1.35; margin-top: 2px; }

    .btn-step-nav { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 4px 10px; font-size: 11.5px; font-weight: 600; border-radius: 6px; background: rgba(0,122,255,0.08); color: var(--blue); text-decoration: none; border: 1px solid rgba(0,122,255,0.2); }

    .action-row { display: flex; gap: 8px; margin-top: 12px; }
    .btn-action { flex: 1; text-align: center; text-decoration: none; padding: 10px; background: var(--tint); color: var(--blue); border-radius: 10px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; }

    /* Privacy / Permissions Modal */
    .perm-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); z-index: 20000; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .perm-box { background: var(--card); border-radius: 20px; padding: 24px; max-width: 320px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .perm-list { text-align: right; margin: 16px 0; font-size: 13.5px; color: var(--sec); line-height: 1.6; }
    .perm-list li { margin-bottom: 8px; }

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

  <!-- חלון הרשאות ופרטיות שקופץ מיד עם הפתיחה -->
  <div id="perm-modal" class="perm-modal">
    <div class="perm-box">
      <div style="font-size: 40px; margin-bottom: 10px;">🛡️</div>
      <h3 style="font-size: 18px; margin-bottom: 6px;">ברוכים הבאים ל-iWay</h3>
      <p style="font-size: 13px; color: var(--sec);">כדי להתאים עבורך מסלולים משולבים בזמן אמת, האפליקציה זקוקה להרשאות הבאות:</p>
      
      <ul class="perm-list">
        <li>📍 <b>מיקום מדויק (GPS):</b> לאיתור תחנות ונהגים בסביבתך.</li>
        <li>⏱️ <b>זמני אמת:</b> לחישוב שעות יציאה והחלפה של רכבות ואוטובוסים.</li>
        <li>🔒 <b>פרטיות מלאה:</b> המיקום מעובד במכשיר ואינו נשמר בהיסטוריה.</li>
      </ul>

      <button class="btn-primary" onclick="acceptPermissionsAndLocate()">אישור והפעלת מיקום</button>
    </div>
  </div>

  <div id="map-modal" class="map-modal">
    <div class="map-modal-header">
      <span style="font-weight: 700; font-size: 17px;" id="modal-field-title">בחר מיקום על המפה</span>
      <button onclick="closeMapModal()" style="border: none; background: none; color: var(--blue); font-size: 16px; font-weight: 600; cursor: pointer;">ביטול</button>
    </div>
    <div class="map-modal-search">
      <input type="text" id="modalSearchInput" placeholder="הקלד עיר, צומת או רחוב..." autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();executeModalSearch();}">
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
      <button class="btn-icon" title="השתמש במיקום נוכחי" onclick="useCurrentGPS()">📍</button>
      <button class="btn-icon" title="בחר במפה" onclick="openMapModal('userOrigin')">🗺️</button>
    </div>
    <div class="input-row">
      <span class="color-dot dot-green"></span>
      <label>יעד</label>
      <input type="text" id="userDestInput" placeholder="לאן להגיע? (למשל: השושן, פרדסיה)">
      <button class="btn-icon" title="בחר במפה" onclick="openMapModal('userDest')">🗺️</button>
    </div>

    <div class="segmented">
      <div class="segment active" onclick="changeMode('smart', this)">Smart</div>
      <div class="segment" onclick="changeMode('fast', this)">Fast</div>
      <div class="segment" onclick="changeMode('easy', this)">Easy</div>
    </div>
  </div>

  <!-- מסלול הנהג (תמיכה החל מ-0 דקות סטייה) -->
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
        <span class="slider-val" id="detourText">10 דקות</span>
      </div>
      <input type="range" id="detourRange" min="0" max="120" step="5" value="10" oninput="updateDetourLabel(this.value)">
    </div>
  </div>

  <!-- הקפצה מהמוצא לתחנה (תמיכה החל מ-0 דקות) -->
  <div id="rides-section" style="display: none;">
    <div class="card-title">הקפצה מהמוצא לתחנה</div>
    <div class="card">
      <div class="slider-header">
        <span>🚗 זמן הקפצה מהמוצא</span>
        <span class="slider-val" id="originRideText">0 דקות (ללא הקפצה)</span>
      </div>
      <input type="range" id="originRideRange" min="0" max="60" step="5" value="0" oninput="updateOriginRideLabel(this.value)">
    </div>
  </div>

  <!-- איסוף ביעד (תמיכה החל מ-0 דקות) -->
  <div class="card-title">איסוף ביעד (אופציונלי)</div>
  <div class="card">
    <div class="slider-header">
      <span>🚗 זמן איסוף מתחנה ליעד</span>
      <span class="slider-val" id="destRideText">0 דקות (בלי איסוף)</span>
    </div>
    <input type="range" id="destRideRange" min="0" max="60" step="5" value="0" oninput="updateDestRideLabel(this.value)">
  </div>

  <button class="btn-primary" id="btn-search" onclick="triggerSearch()">
    <div class="spinner" id="search-spinner"></div>
    <span id="btn-text">מצא לי דרך</span>
  </button>

  <div id="map"></div>
  <div id="results-area" style="margin-top: 14px;"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    let activeMode = 'fast';
    let currentRouteType = 'driver_route';
    let currentModalField = null;
    let modalMap = null;
    let currentChosenPlaceName = '';

    const exactCoords = {
      userOrigin: { lat: 31.6341, lon: 34.7479, name: 'מחנה פלוגות' },
      userDest: { lat: 32.3040, lon: 34.9120, name: 'השושן, פרדסיה' },
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

    function acceptPermissionsAndLocate() {
      document.getElementById('perm-modal').style.display = 'none';
      useCurrentGPS();
    }

    function useCurrentGPS() {
      if (!navigator.geolocation) {
        alert('שירות מיקום אינו נתמך במכשיר');
        return;
      }
      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        exactCoords.userOrigin = { lat, lon, name: 'מיקום נוכחי' };
        document.getElementById('userOriginInput').value = 'מיקום נוכחי';
        updateMarkerOnMap('userOrigin', lat, lon, 'מיקום נוכחי', '#007AFF');
        map.setView([lat, lon], 14);
        triggerSearch();
      }, err => {
        alert('כדי להשתמש במיקום הנוכחי, יש לאשר הרשאת מיקום בספארי (בהגדרות האתר משמאל לשורת הכתובת)');
      }, { enableHighAccuracy: true });
    }

    function updateDetourLabel(v) {
      document.getElementById('detourText').innerText = v == 0 ? '0 דקות (ללא סטייה)' : v + ' דקות';
      triggerSearch();
    }

    function updateOriginRideLabel(v) {
      document.getElementById('originRideText').innerText = v == 0 ? '0 דקות (ללא הקפצה)' : 'עד ' + v + ' דק׳';
      triggerSearch();
    }

    function updateDestRideLabel(v) {
      document.getElementById('destRideText').innerText = v == 0 ? '0 דקות (בלי איסוף)' : 'עד ' + v + ' דק׳ ברכב';
      triggerSearch();
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

    async function executeModalSearch() {
      const query = document.getElementById('modalSearchInput').value.trim();
      if (!query) return;
      document.getElementById('modal-ac-box').style.display = 'none';
      
      try {
        const directUrl = 'https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&accept-language=he&q=' + encodeURIComponent(query) + '&limit=5';
        const res = await fetch(directUrl);
        const list = await res.json();
        if (list && list.length > 0) {
          const item = list[0];
          modalMap.setView([item.lat, item.lon], 15);
          currentChosenPlaceName = item.display_name.split(',')[0];
          document.getElementById('modalSearchInput').value = currentChosenPlaceName;
        } else {
          alert('לא נמצא מיקום עבור: "' + query + '". נסה להוסיף שם עיר סמוכה.');
        }
      } catch(e) {
        alert('שגיאה בחיפוש המיקום.');
      }
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
      btnText.innerText = 'מחשב מסלול...';

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
        container.innerHTML = '<div class="card">לא נמצאו נקודות מעבר בטווח שנבחר. נסה להעלות מעט את זמן הסטייה או האיסוף בסליידר.</div>';
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

          <div style="font-size: 15px; font-weight: 600; margin-top: 6px;">\${r.hub.name} ⟵ \${r.optimalAlightStation}</div>
          <div class="result-sub">\${r.whyReason}</div>

          <div class="timeline" id="timeline-\${idx}">
            <div style="font-size: 12px; font-weight: 700; color: var(--sec); margin-bottom: 10px;">שלבי המסלול המפורטים:</div>
            \${r.timeline.map(t => {
              const navUrl = t.icon === '🚗' ? 'https://waze.com/ul?ll=' + t.lat + ',' + t.lon + '&navigate=yes' : 'https://www.google.com/maps/dir/?api=1&destination=' + t.lat + ',' + t.lon + '&travelmode=walking';
              return \`
                <div class="timeline-step">
                  <div class="step-time-badge">\${t.time}</div>
                  <div class="step-icon">\${t.icon}</div>
                  <div class="step-content">
                    <div class="step-header">
                      <span class="step-title">\${t.title}</span>
                      <span class="step-tag">\${t.badge}</span>
                    </div>
                    <div class="step-desc">\${t.desc}</div>
                    <a class="btn-step-nav" href="\${navUrl}" target="_blank">🧭 נווט לנקודה זו</a>
                  </div>
                </div>
              \`;
            }).join('')}
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
