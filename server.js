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
  const straightDistKm = haversineDistMeters(from, to) / 1000;
  const roadDistKm = straightDistKm * 1.35;
  if (roadDistKm <= 4.5) {
    return Math.max(3, Math.round((roadDistKm / 16) * 60) + 2);
  } else if (roadDistKm <= 12) {
    return Math.max(5, Math.round((roadDistKm / 32) * 60) + 3);
  } else {
    return Math.max(8, Math.round((roadDistKm / 55) * 60) + 4);
  }
}

function estWalkMinutes(from, to) {
  const straightDistKm = haversineDistMeters(from, to) / 1000;
  return Math.max(1, Math.round(((straightDistKm * 1.25) / 4.2) * 60));
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

function isShabbatTime(targetTimeStr) {
  const now = new Date();
  const day = now.getDay();
  const mins = parseTimeToMinutes(targetTimeStr);
  if (day === 5 && mins >= 16 * 60 + 30) return true;
  if (day === 6 && mins <= 19 * 60 + 30) return true;
  return false;
}

const ISRAEL_TRAIN_NETWORK = [
  {
    id: 'rail_coastal',
    name: 'קו החוף והנגב (נהריה ⟵ באר שבע מרכז)',
    terminalA: 'נהריה',
    terminalB: 'באר שבע מרכז',
    intervalPeak: 20,
    intervalOffpeak: 30,
    stations: [
      { name: 'רכבת נהריה', stopId: '31002', platform: 'רציף 1', lat: 33.0062, lon: 35.0975 },
      { name: 'רכבת עכו', stopId: '31004', platform: 'רציף 1', lat: 32.9275, lon: 35.0840 },
      { name: 'רכבת קריית מוצקין', stopId: '34008', platform: 'רציף 1', lat: 32.8335, lon: 35.0805 },
      { name: 'מרכזית המפרץ חיפה', stopId: '34006', platform: 'רציף 3', lat: 32.7933, lon: 35.0344 },
      { name: 'רכבת חיפה מרכז השמונה', stopId: '34004', platform: 'רציף 2', lat: 32.8220, lon: 34.9970 },
      { name: 'רכבת חיפה חוף הכרמל', stopId: '34002', platform: 'רציף 1', lat: 32.7930, lon: 34.9570 },
      { name: 'רכבת בנימינה', stopId: '37312', platform: 'רציף 2', lat: 32.5140, lon: 34.9520 },
      { name: 'רכבת חדרה מערב', stopId: '37310', platform: 'רציף 1', lat: 32.4410, lon: 34.9080 },
      { name: 'רכבת נתניה', stopId: '37302', platform: 'רציף 1', lat: 32.3190, lon: 34.8660 },
      { name: 'רכבת בית יהושע', stopId: '37306', platform: 'רציף 1', lat: 32.2610, lon: 34.8640 },
      { name: 'רכבת הרצליה', stopId: '37308', platform: 'רציף 2', lat: 32.1629, lon: 34.8252 },
      { name: 'רכבת תל אביב אוניברסיטה', stopId: '36002', platform: 'רציף 4', lat: 32.1032, lon: 34.8049 },
      { name: 'רכבת תל אביב סבידור מרכז', stopId: '36004', platform: 'רציף 4', lat: 32.0835, lon: 34.7983 },
      { name: 'רכבת תל אביב השלום', stopId: '36006', platform: 'רציף 3', lat: 32.0734, lon: 34.7925 },
      { name: 'רכבת תל אביב ההגנה', stopId: '36008', platform: 'רציף 3', lat: 32.0538, lon: 34.7788 },
      { name: 'רכבת לוד', stopId: '35002', platform: 'רציף 1', lat: 31.9450, lon: 34.8750 },
      { name: 'רכבת קריית גת', stopId: '39002', platform: 'רציף 1', lat: 31.6035, lon: 34.7738 },
      { name: 'רכבת להבים - רהט', stopId: '39004', platform: 'רציף 1', lat: 31.3780, lon: 34.8160 },
      { name: 'רכבת באר שבע צפון / אוניברסיטה', stopId: '39005', platform: 'רציף 2', lat: 31.2610, lon: 34.8110 },
      { name: 'רכבת באר שבע מרכז', stopId: '39006', platform: 'רציף 2', lat: 31.2435, lon: 34.7972 }
    ]
  },
  {
    id: 'rail_jerusalem_fast',
    name: 'הקו המהיר לירושלים (הרצליה ⟵ ירושלים יצחק נבון)',
    terminalA: 'הרצליה',
    terminalB: 'ירושלים יצחק נבון',
    intervalPeak: 30,
    intervalOffpeak: 30,
    stations: [
      { name: 'רכבת הרצליה', stopId: '37308', platform: 'רציף 3', lat: 32.1629, lon: 34.8252 },
      { name: 'רכבת תל אביב סבידור מרכז', stopId: '36004', platform: 'רציף 3', lat: 32.0835, lon: 34.7983 },
      { name: 'רכבת תל אביב השלום', stopId: '36006', platform: 'רציף 2', lat: 32.0734, lon: 34.7925 },
      { name: 'רכבת תל אביב ההגנה', stopId: '36008', platform: 'רציף 2', lat: 32.0538, lon: 34.7788 },
      { name: 'רכבת נתב"ג', stopId: '35500', platform: 'רציף 1', lat: 32.0005, lon: 34.8710 },
      { name: 'רכבת ירושלים יצחק נבון', stopId: '33002', platform: 'רציף 1', lat: 31.7878, lon: 35.2015 }
    ]
  },
  {
    id: 'rail_western_negev',
    name: 'קו הנגב המערבי (אשקלון ⟵ שדרות ⟵ באר שבע)',
    terminalA: 'אשקלון',
    terminalB: 'באר שבע מרכז',
    intervalPeak: 30,
    intervalOffpeak: 60,
    stations: [
      { name: 'רכבת אשקלון', stopId: '36200', platform: 'רציף 1', lat: 31.6750, lon: 34.5950 },
      { name: 'רכבת שדרות', stopId: '36300', platform: 'רציף 1', lat: 31.5270, lon: 34.5970 },
      { name: 'רכבת נתיבות', stopId: '36400', platform: 'רציף 1', lat: 31.4220, lon: 34.5820 },
      { name: 'רכבת אופקים', stopId: '36500', platform: 'רציף 1', lat: 31.3170, lon: 34.6290 },
      { name: 'רכבת באר שבע צפון', stopId: '39005', platform: 'רציף 3', lat: 31.2610, lon: 34.8110 },
      { name: 'רכבת באר שבע מרכז', stopId: '39006', platform: 'רציף 3', lat: 31.2435, lon: 34.7972 }
    ]
  },
  {
    id: 'rail_emek',
    name: 'רכבת העמק (בית שאן ⟵ עפולה ⟵ חיפה)',
    terminalA: 'בית שאן',
    terminalB: 'חיפה חוף הכרמל',
    intervalPeak: 60,
    intervalOffpeak: 60,
    stations: [
      { name: 'רכבת בית שאן', stopId: '38008', platform: 'רציף 1', lat: 32.5080, lon: 35.5010 },
      { name: 'רכבת עפולה', stopId: '38002', platform: 'רציף 1', lat: 32.6140, lon: 35.2950 },
      { name: 'רכבת מגדל העמק', stopId: '38004', platform: 'רציף 1', lat: 32.6510, lon: 35.2180 },
      { name: 'רכבת יקנעם - כפר יהושע', stopId: '38006', platform: 'רציף 1', lat: 32.6840, lon: 35.1290 },
      { name: 'מרכזית המפרץ חיפה', stopId: '34006', platform: 'רציף 4', lat: 32.7933, lon: 35.0344 }
    ]
  },
  {
    id: 'rail_galil',
    name: 'קו הגליל (כרמיאל ⟵ חיפה חוף הכרמל)',
    terminalA: 'כרמיאל',
    terminalB: 'חיפה חוף הכרמל',
    intervalPeak: 30,
    intervalOffpeak: 60,
    stations: [
      { name: 'רכבת כרמיאל', stopId: '38500', platform: 'רציף 1', lat: 32.9190, lon: 35.3090 },
      { name: 'רכבת אחיהוד', stopId: '38600', platform: 'רציף 1', lat: 32.9120, lon: 35.1760 },
      { name: 'מרכזית המפרץ חיפה', stopId: '34006', platform: 'רציף 2', lat: 32.7933, lon: 35.0344 }
    ]
  }
];

const REGIONAL_BUS_DATABASE = [
  { tags: ['ירושלים', 'מעלה אדומים'], lineNum: '174', operator: 'אלקטרה אפיקים', title: 'קו 174: ירושלים ⟵ מעלה אדומים', intervalMins: 15, terminalA: 'תחנה מרכזית ירושלים', terminalB: 'מעלה אדומים', stopId: '30050', platform: 'תחנה 4', alts: ['קו 176', 'קו 177'] },
  { tags: ['פלוגות', 'תל אביב', 'מרכז'], lineNum: '369', operator: 'מטרופולין', title: 'קו 369: באר שבע ⟵ פלוגות ⟵ ת"א סבידור', intervalMins: 30, terminalA: 'באר שבע', terminalB: 'תל אביב סבידור מרכז', stopId: '13524', platform: 'מסלול צפון', alts: ['קו 370 (מטרופולין)', 'קו 348 (אפיקים)'] },
  { tags: ['המוביל', 'טבריה', 'עמקים'], lineNum: '430', operator: 'אגד', title: 'קו 430: חיפה ⟵ מחלף המוביל ⟵ טבריה', intervalMins: 45, terminalA: 'חיפה מרכזית המפרץ', terminalB: 'טבריה מרכזית', stopId: '54210', platform: 'רציף 2', alts: ['קו 434 (אגד)', 'קו 500 (נתיב אקספרס)'] },
  { tags: ['באר שבע', 'ניצנה', 'עזוז'], lineNum: '44', operator: 'דן בדרום', title: 'קו 44: באר שבע ⟵ מסוף ניצנה', intervalMins: 60, terminalA: 'באר שבע מרכזית', terminalB: 'מסוף ניצנה', stopId: '39006', platform: 'רציף 8', alts: ['קו 45 (דן בדרום)'] },
  { tags: ['נתניה', 'פרדסיה'], lineNum: '26', operator: 'קווים', title: 'קו 26: רכבת נתניה ⟵ פרדסיה', intervalMins: 25, terminalA: 'רכבת נתניה', terminalB: 'פרדסיה', stopId: '37302', platform: 'תחנה מזרחית', alts: ['קו 39 (קווים)', 'קו 47 (קווים)'] },
  { tags: ['תל אביב', 'סוקולוב', 'פנקס'], lineNum: '5', operator: 'דן', title: 'קו 5: רכבת ת"א סבידור ⟵ רחוב סוקולוב', intervalMins: 10, terminalA: 'ת"א סבידור מרכז', terminalB: 'צפון תל אביב', stopId: '36004', platform: 'גשר מודעי', alts: ['קו 25 (דן)', 'קו 125 (דן)'] },
  { tags: ['אריאל', 'תל אביב'], lineNum: '286', operator: 'תנופה', title: 'קו 286: אריאל ⟵ ת"א סבידור', intervalMins: 20, terminalA: 'אריאל', terminalB: 'ת"א סבידור מרכז', stopId: '19001', platform: 'מסוף אריאל', alts: ['קו 186 (תנופה)'] },
  { tags: ['באר שבע', 'אילת'], lineNum: '390', operator: 'אגד', title: 'קו 390: באר שבע ⟵ אילת', intervalMins: 60, terminalA: 'באר שבע מרכזית', terminalB: 'אילת תחנה מרכזית', stopId: '39010', platform: 'רציף בינעירוני', alts: ['קו 394 (אגד)', 'קו 397 (אגד)'] }
];

function findMatchingBus(fromText, toText) {
  const f = (fromText || '').toLowerCase();
  const t = (toText || '').toLowerCase();
  for (const b of REGIONAL_BUS_DATABASE) {
    const matchFrom = b.tags.some(tag => f.includes(tag.toLowerCase()));
    const matchTo = b.tags.some(tag => t.includes(tag.toLowerCase()));
    if (matchFrom && matchTo) return b;
  }
  for (const b of REGIONAL_BUS_DATABASE) {
    if (b.tags.some(tag => t.includes(tag.toLowerCase()))) return b;
  }
  return null;
}

function resolveOptimalTrainNetworkRoute(originCoord, destCoord) {
  let best = null;
  let minScore = Infinity;

  for (const line of ISRAEL_TRAIN_NETWORK) {
    for (let i = 0; i < line.stations.length; i++) {
      const sA = line.stations[i];
      const distToSA = haversineDistMeters(sA, originCoord);

      for (let j = 0; j < line.stations.length; j++) {
        if (i === j) continue;
        const sB = line.stations[j];
        const distFromSB = haversineDistMeters(sB, destCoord);

        const isForward = j > i;
        const directionName = isForward ? `לכיוון ${line.terminalB}` : `לכיוון ${line.terminalA}`;
        const targetTerminal = isForward ? line.terminalB : line.terminalA;
        const originTerminal = isForward ? line.terminalA : line.terminalB;

        const score = distToSA * 0.45 + distFromSB;

        if (score < minScore) {
          minScore = score;
          const stopsCount = Math.abs(j - i);
          const trackDistKm = (haversineDistMeters(sA, sB) / 1000) * 1.15;
          const trainMins = Math.max(12, Math.round(trackDistKm / 78 * 60));

          best = {
            line,
            boardStation: sA,
            alightStation: sB,
            directionName,
            originTerminal,
            targetTerminal,
            stopsCount,
            trainMins,
            distFromAlightToDestKm: distFromSB / 1000
          };
        }
      }
    }
  }
  return best;
}

function runMasterTransitEngine(body) {
  const {
    routeType = 'driver_route',
    userOrigin,
    userDest,
    timeType = 'depart_now',
    targetTime = '',
    maxDetourMin = 0,
    originRideMin = 0,
    destRideMin = 0,
    maxWalkOriginMin = 20
  } = body;

  const totalDistanceKm = haversineDistMeters(userOrigin, userDest) / 1000;
  const isShabbat = isShabbatTime(targetTime);
  const detourLimit = Number(maxDetourMin) || 0;
  const originRideLimit = Number(originRideMin) || 0;
  const destRideRadius = Number(destRideMin) || 0;
  const maxWalkLimit = Number(maxWalkOriginMin) || 20;

  let baseMinutes = parseTimeToMinutes(targetTime);

  if (totalDistanceKm <= 9.0) {
    const driveDirectMins = estDriveMinutes(userOrigin, userDest);
    const timeline = [
      {
        time: formatMinutesToTime(baseMinutes),
        icon: '🚗',
        badge: 'נסיעה ישירה',
        title: 'נסיעה עירונית רציפה ליעד',
        desc: `מרחק קצר (${totalDistanceKm.toFixed(1)} ק״מ). זמן נסיעה משוער: כ-${driveDirectMins} דקות.`,
        lat: userOrigin.lat,
        lon: userOrigin.lon
      },
      {
        time: formatMinutesToTime(baseMinutes + driveDirectMins),
        icon: '🎯',
        badge: 'הגעה',
        title: 'הגעה ליעד',
        desc: 'סיום הנסיעה',
        lat: userDest.lat,
        lon: userDest.lon
      }
    ];

    return [{
      hub: { name: userDest.name || 'נסיעה ישירה', lat: userDest.lat, lon: userDest.lon },
      optimalAlightStation: userDest.name || 'היעד המבוקש',
      lineBadge: 'נסיעה ישירה',
      totalUserTime: driveDirectMins,
      startTime: formatMinutesToTime(baseMinutes),
      endTime: formatMinutesToTime(baseMinutes + driveDirectMins),
      detourMin: 0,
      hasDestPickup: false,
      score: driveDirectMins,
      whyReason: `נסיעה מקומית קצרה (${totalDistanceKm.toFixed(1)} ק״מ). נסיעה רציפה ברכב/קו מקומי.`,
      timeline
    }];
  }

  if (isShabbat) {
    const driveMins = estDriveMinutes(userOrigin, userDest);
    return [{
      hub: { name: 'תחבורה בשבת', lat: userOrigin.lat, lon: userOrigin.lon },
      optimalAlightStation: userDest.name,
      lineBadge: 'שבת/חג',
      totalUserTime: driveMins,
      startTime: formatMinutesToTime(baseMinutes),
      endTime: formatMinutesToTime(baseMinutes + driveMins),
      detourMin: 0,
      hasDestPickup: false,
      score: driveMins,
      whyReason: 'מועד הנסיעה חל בשבת. רכבות אינן פעילות. נדרש שיתוף נסיעה מלא או מוניות שירות.',
      timeline: [
        {
          time: formatMinutesToTime(baseMinutes),
          icon: '⚠️',
          badge: 'שבת/חג',
          title: 'השבתת תחב״צ סדירה',
          desc: 'רכבת ישראל אינה פועלת בשעות אלו.',
          lat: userOrigin.lat,
          lon: userOrigin.lon
        },
        {
          time: formatMinutesToTime(baseMinutes + 5),
          icon: '🚗',
          badge: 'נסיעה ברכב',
          title: 'נסיעה רכובה משותפת ליעד',
          desc: `זמן נסיעה ברכב: כ-${driveMins} דקות`,
          lat: userOrigin.lat,
          lon: userOrigin.lon
        },
        {
          time: formatMinutesToTime(baseMinutes + driveMins),
          icon: '🎯',
          badge: 'הגעה',
          title: 'הגעה ליעד',
          desc: 'סיום מסלול',
          lat: userDest.lat,
          lon: userDest.lon
        }
      ]
    }];
  }

  const trainLeg = resolveOptimalTrainNetworkRoute(userOrigin, userDest);
  const connectingBus = findMatchingBus(trainLeg.alightStation.name, userDest.name || '');

  let driveWithDriver = 0;
  let walkToStationMin = 0;
  let detourMin = 0;

  const boardCoord = { lat: trainLeg.boardStation.lat, lon: trainLeg.boardStation.lon };

  if (routeType === 'driver_route') {
    const { driverOrigin, driverDest } = body;
    const directDriverTime = estDriveMinutes(driverOrigin, driverDest);
    const timeToPickup = estDriveMinutes(driverOrigin, userOrigin);
    const timePickupToHub = estDriveMinutes(userOrigin, boardCoord);
    const timeHubToDriverDest = estDriveMinutes(boardCoord, driverDest);
    const totalDriverTrip = timeToPickup + timePickupToHub + timeHubToDriverDest;
    detourMin = Math.max(0, totalDriverTrip - directDriverTime);

    if (detourMin <= detourLimit) {
      driveWithDriver = timePickupToHub;
    } else {
      driveWithDriver = 0;
      walkToStationMin = estWalkMinutes(userOrigin, boardCoord);
    }
  } else {
    const driveToHub = estDriveMinutes(userOrigin, boardCoord);
    if (originRideLimit > 0 && driveToHub <= originRideLimit) {
      driveWithDriver = driveToHub;
      detourMin = driveToHub;
    } else {
      walkToStationMin = estWalkMinutes(userOrigin, boardCoord);
      driveWithDriver = 0;
    }
  }

  const alightCoord = { lat: trainLeg.alightStation.lat, lon: trainLeg.alightStation.lon };
  const driveFinalLeg = estDriveMinutes(alightCoord, userDest);
  const hasDestPickup = destRideRadius > 0 && driveFinalLeg <= destRideRadius;

  let finalLegMinutes = 15;
  if (hasDestPickup) {
    finalLegMinutes = driveFinalLeg;
  } else if (connectingBus) {
    finalLegMinutes = Math.min(55, Math.round(trainLeg.distFromAlightToDestKm / 35 * 60) + 8);
  } else {
    finalLegMinutes = Math.min(45, estWalkMinutes(alightCoord, userDest));
  }

  const initialLegTime = driveWithDriver > 0 ? driveWithDriver : Math.min(walkToStationMin || 10, maxWalkLimit);
  const waitTimeAtBoard = 6;
  const totalTripMinutes = initialLegTime + trainLeg.trainMins + finalLegMinutes + waitTimeAtBoard;

  let startMin = baseMinutes;
  if (timeType === 'arrive_by') {
    startMin = baseMinutes - totalTripMinutes;
  }

  const tPickup = startMin;
  const tDropoff = tPickup + initialLegTime;
  const tBoard = tDropoff + waitTimeAtBoard;
  const tAlight = tBoard + trainLeg.trainMins;
  const tFinalArrival = tAlight + finalLegMinutes;

  const timeline = [];

  if (driveWithDriver > 0) {
    timeline.push({
      time: formatMinutesToTime(tPickup),
      icon: '🚗',
      badge: routeType === 'driver_route' ? 'נסיעה עם נהג' : 'הקפצה ברכב',
      title: 'איסוף מנקודת המוצא',
      desc: `נסיעה משותפת כ-${driveWithDriver} דקות אל ${trainLeg.boardStation.name}`,
      lat: userOrigin.lat,
      lon: userOrigin.lon
    });
    timeline.push({
      time: formatMinutesToTime(tDropoff),
      icon: '📍',
      badge: `תחנה #${trainLeg.boardStation.stopId}`,
      title: `הורדה ב-${trainLeg.boardStation.name}`,
      desc: `סטיית נהג: +${detourMin} דק׳ • ${trainLeg.boardStation.platform}`,
      lat: trainLeg.boardStation.lat,
      lon: trainLeg.boardStation.lon
    });
  } else {
    timeline.push({
      time: formatMinutesToTime(tPickup),
      icon: '🚶',
      badge: 'הגעה עצמאית',
      title: `הגעה אל ${trainLeg.boardStation.name}`,
      desc: `תחנה #${trainLeg.boardStation.stopId} (${trainLeg.boardStation.platform})`,
      lat: trainLeg.boardStation.lat,
      lon: trainLeg.boardStation.lon
    });
  }

  timeline.push({
    time: formatMinutesToTime(tBoard),
    icon: '🚆',
    badge: 'רכבת ישראל',
    isInteractiveLine: true,
    rawMinutes: tBoard,
    intervalMins: trainLeg.line.intervalPeak,
    alternatives: [
      { name: `${trainLeg.line.name} (עוקבת)`, frequency: `בעוד ${trainLeg.line.intervalPeak} דק׳`, intervalMins: trainLeg.line.intervalPeak, desc: `${trainLeg.directionName} • אותו רציף` }
    ],
    title: `עולים על ${trainLeg.line.name}`,
    desc: `כיוון נסיעה: ${trainLeg.directionName} (התחלה: ${trainLeg.originTerminal} ⟵ סיום: ${trainLeg.targetTerminal}) • ${trainLeg.boardStation.platform} • עוברים ${trainLeg.stopsCount} תחנות`,
    lat: trainLeg.boardStation.lat,
    lon: trainLeg.boardStation.lon
  });

  timeline.push({
    time: formatMinutesToTime(tAlight),
    icon: '🛑',
    badge: `תחנה #${trainLeg.alightStation.stopId}`,
    title: `יורדים ב-${trainLeg.alightStation.name}`,
    desc: `${trainLeg.alightStation.platform} • הגעה: ${formatMinutesToTime(tAlight)} (מרחק מהיעד: ${trainLeg.distFromAlightToDestKm.toFixed(1)} ק״מ)`,
    lat: trainLeg.alightStation.lat,
    lon: trainLeg.alightStation.lon
  });

  if (hasDestPickup) {
    timeline.push({
      time: formatMinutesToTime(tAlight + 1),
      icon: '🚗',
      badge: 'איסוף ביעד',
      title: `איסוף ברכב מ-${trainLeg.alightStation.name}`,
      desc: `נסיעה ברכב כ-${driveFinalLeg} דקות ישירות ליעד (בטווח של עד ${destRideRadius} דק׳)`,
      lat: trainLeg.alightStation.lat,
      lon: trainLeg.alightStation.lon
    });
  } else if (connectingBus) {
    timeline.push({
      time: formatMinutesToTime(tAlight + 2),
      icon: '🚌',
      badge: `קו ${connectingBus.lineNum}`,
      isInteractiveLine: true,
      rawMinutes: tAlight + 2,
      intervalMins: connectingBus.intervalMins,
      alternatives: connectingBus.alts.map(a => ({
        name: a,
        frequency: `כל ${connectingBus.intervalMins} דק׳`,
        intervalMins: connectingBus.intervalMins,
        desc: `יציאה מרציף סמוך`
      })),
      title: `עולים על ${connectingBus.title}`,
      desc: `מסלול: ${connectingBus.terminalA} ⟵ ${connectingBus.terminalB} • רציף: ${connectingBus.platform}`,
      lat: trainLeg.alightStation.lat,
      lon: trainLeg.alightStation.lon
    });
  } else {
    timeline.push({
      time: formatMinutesToTime(tAlight + 2),
      icon: '🚶',
      badge: 'הגעה עצמאית',
      title: `הגעה מ-${trainLeg.alightStation.name} ליעד`,
      desc: `הליכה קצרה או קו מקומי עד לכתובת היעד`,
      lat: trainLeg.alightStation.lat,
      lon: trainLeg.alightStation.lon
    });
  }

  timeline.push({
    time: formatMinutesToTime(tFinalArrival),
    icon: '🎯',
    badge: 'הגעה ליעד',
    title: 'הגעה ליעד המבוקש',
    desc: 'סיום המסלול',
    lat: userDest.lat,
    lon: userDest.lon
  });

  return [{
    hub: { name: trainLeg.boardStation.name, lat: trainLeg.boardStation.lat, lon: trainLeg.boardStation.lon },
    optimalAlightStation: trainLeg.alightStation.name,
    lineBadge: 'רכבת ישראל',
    totalUserTime: totalTripMinutes,
    startTime: formatMinutesToTime(startMin),
    endTime: formatMinutesToTime(timeType === 'arrive_by' ? baseMinutes : tFinalArrival),
    detourMin,
    hasDestPickup,
    score: totalTripMinutes,
    whyReason: `מעבר דרך ${trainLeg.boardStation.name} (${trainLeg.line.name}, ${trainLeg.directionName}), ירידה ב-${trainLeg.alightStation.name} והמשך ישיר.`,
    timeline
  }];
}

function normalizeHebrewSearchQuery(q) {
  return q.replace(/פרדסייה/g, 'פרדסיה')
          .replace(/תל-אביב/g, 'תל אביב')
          .replace(/באר-שבע/g, 'באר שבע')
          .replace(/קרית/g, 'קריית')
          .replace(/מעלה-אדומים/g, 'מעלה אדומים')
          .trim();
}

app.get('/v1/geocode', async (req, res) => {
  const rawQ = (req.query.q || '').trim();
  if (!rawQ || rawQ.length < 2) return res.json([]);
  const query = normalizeHebrewSearchQuery(rawQ);

  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&accept-language=he&q=${encodeURIComponent(query)}&limit=6`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'iWayApp-Israel/20.0' } });
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
  const results = runMasterTransitEngine(body);
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

    /* תיבת השלמה אוטומטית (Autocomplete) מתחת לשדה */
    .ac-dropdown { position: absolute; top: 100%; right: 0; left: 0; background: var(--card); border: 1px solid var(--border); border-radius: 12px; z-index: 5000; box-shadow: 0 8px 24px rgba(0,0,0,0.15); max-height: 200px; overflow-y: auto; display: none; }
    .ac-row { padding: 10px 14px; font-size: 14px; border-bottom: 1px solid var(--border); cursor: pointer; color: var(--text); }
    .ac-row:last-child { border-bottom: none; }

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
    
    .step-tag-clickable { font-size: 11.5px; padding: 3px 8px; border-radius: 6px; font-weight: 700; background: #007AFF; color: #FFF; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
    .step-desc { font-size: 12.5px; color: var(--sec); line-height: 1.35; margin-top: 2px; }

    .btn-step-nav { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 4px 10px; font-size: 11.5px; font-weight: 600; border-radius: 6px; background: rgba(0,122,255,0.08); color: var(--blue); text-decoration: none; border: 1px solid rgba(0,122,255,0.2); }

    .action-row { display: flex; gap: 8px; margin-top: 12px; }
    .btn-action { flex: 1; text-align: center; text-decoration: none; padding: 10px; background: var(--tint); color: var(--blue); border-radius: 10px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 30000; display: none; align-items: center; justify-content: center; padding: 20px; }
    .modal-box { background: var(--card); border-radius: 20px; padding: 22px; max-width: 330px; width: 100%; text-align: right; box-shadow: 0 10px 30px rgba(0,0,0,0.25); max-height: 85vh; overflow-y: auto; }
    
    .alt-item-btn { background: var(--bg); padding: 10px 12px; border-radius: 10px; margin-bottom: 8px; font-size: 13px; cursor: pointer; border: 1px solid var(--border); text-align: right; width: 100%; display: block; }
    .alt-sub-departures { margin-top: 6px; display: none; flex-wrap: wrap; gap: 4px; }

    .map-modal { position: fixed; inset: 0; background: var(--bg); z-index: 10000; display: none; flex-direction: column; }
    .map-modal-header { padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; background: var(--card); border-bottom: 1px solid var(--border); }
    .map-modal-search { padding: 10px 16px; background: var(--card); border-bottom: 1px solid var(--border); position: relative; z-index: 10005; display: flex; gap: 8px; }
    .map-modal-search input { flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border); outline: none; font-size: 15px; direction: rtl; background: var(--bg); color: var(--text); }
    .btn-search-modal { padding: 0 14px; background: var(--blue); color: #FFF; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    #modal-map-view { flex: 1; position: relative; z-index: 1; }
    .center-pin { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -100%); z-index: 999; font-size: 38px; pointer-events: none; }
    .map-modal-footer { padding: 14px 16px; background: var(--card); border-top: 1px solid var(--border); z-index: 10005; }
  </style>
</head>
<body>

  <!-- חלון זמנים וחלופות -->
  <div id="alt-modal" class="modal-backdrop">
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 id="alt-modal-title" style="font-size:16px;">זמנים וקווים חלופיים</h3>
        <button onclick="document.getElementById('alt-modal').style.display='none'" style="border:none; background:none; color:var(--blue); font-size:15px; font-weight:700; cursor:pointer;">סגור</button>
      </div>
      
      <div style="font-size:12.5px; color:var(--sec); margin-bottom:8px;">זמני יציאה קרובים (לשעתיים הבאות):</div>
      <div id="alt-departures-list" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px;"></div>
      
      <div style="font-size:12.5px; color:var(--sec); margin-bottom:8px;">קווים חלופיים (לחץ לצפייה בלוח הזמנים שלהם):</div>
      <div id="alt-lines-list"></div>
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
      <div id="modal-ac-box" class="ac-dropdown"></div>
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
        <option value="depart_now" selected>צא עכשיו</option>
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
      <input type="text" id="userOriginInput" placeholder="היכן אתה נמצא?" autocomplete="off" oninput="handleInputAutocomplete('userOrigin')">
      <button class="btn-icon" title="השתמש במיקום נוכחי" onclick="useCurrentGPS()">📍</button>
      <button class="btn-icon" title="בחר במפה" onclick="openMapModal('userOrigin')">🗺️</button>
      <div id="ac-userOrigin" class="ac-dropdown"></div>
    </div>
    <div id="gps-status-msg" style="font-size:12px; color:var(--sec); padding:0 4px 4px; display:none;"></div>
    
    <div class="input-row">
      <span class="color-dot dot-green"></span>
      <label>יעד</label>
      <input type="text" id="userDestInput" placeholder="לאן להגיע? (עיר, רחוב או צומת)" autocomplete="off" oninput="handleInputAutocomplete('userDest')">
      <button class="btn-icon" title="בחר במפה" onclick="openMapModal('userDest')">🗺️</button>
      <div id="ac-userDest" class="ac-dropdown"></div>
    </div>
  </div>

  <div id="driver-route-section">
    <div class="card-title">מסלול הנהג</div>
    <div class="card">
      <div class="input-row">
        <span class="color-dot dot-orange"></span>
        <label>מוצא נהג</label>
        <input type="text" id="driverOriginInput" placeholder="מהיכן הנהג יוצא?" autocomplete="off" oninput="handleInputAutocomplete('driverOrigin')">
        <button class="btn-icon" title="בחר במפה" onclick="openMapModal('driverOrigin')">🗺️</button>
        <div id="ac-driverOrigin" class="ac-dropdown"></div>
      </div>
      <div class="input-row">
        <span class="color-dot dot-purple"></span>
        <label>יעד נהג</label>
        <input type="text" id="driverDestInput" placeholder="לאן הנהג ממשיך?" autocomplete="off" oninput="handleInputAutocomplete('driverDest')">
        <button class="btn-icon" title="בחר במפה" onclick="openMapModal('driverDest')">🗺️</button>
        <div id="ac-driverDest" class="ac-dropdown"></div>
      </div>

      <div class="slider-header">
        <span>מקסימום סטייה לנהג</span>
        <span class="slider-val" id="detourText">5 דקות</span>
      </div>
      <input type="range" id="detourRange" min="0" max="120" step="5" value="5" oninput="updateDetourLabel(this.value)">
    </div>
  </div>

  <div id="rides-section" style="display: none;">
    <div class="card-title">הקפצה / הליכה מהמוצא</div>
    <div class="card">
      <div class="slider-header">
        <span>🚗 זמן הקפצה מהמוצא</span>
        <span class="slider-val" id="originRideText">0 דקות (ללא הקפצה)</span>
      </div>
      <input type="range" id="originRideRange" min="0" max="60" step="5" value="0" oninput="updateOriginRideLabel(this.value)">

      <div id="walk-slider-box" style="margin-top: 14px;">
        <div class="slider-header">
          <span>🚶 מקסימום הליכה לתחנה ראשונה</span>
          <span class="slider-val" id="originWalkText">20 דקות</span>
        </div>
        <input type="range" id="originWalkRange" min="5" max="45" step="5" value="20" oninput="updateOriginWalkLabel(this.value)">
      </div>
    </div>
  </div>

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
    let currentRouteType = 'driver_route';
    let currentModalField = null;
    let modalMap = null;
    let currentChosenPlaceName = '';
    let baseSearchMinutes = null;
    let acTimers = {};

    const exactCoords = {
      userOrigin: null,
      userDest: null,
      driverOrigin: null,
      driverDest: null
    };

    const markers = { userOrigin: null, userDest: null, driverOrigin: null, driverDest: null, hub: null };

    const map = L.map('map').setView([32.08, 34.80], 9);
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

    // מנגנון השלמה אוטומטית בעת הקלדה בכל שדה
    function handleInputAutocomplete(field) {
      clearTimeout(acTimers[field]);
      const val = document.getElementById(field + 'Input').value.trim();
      const drop = document.getElementById('ac-' + field);
      
      if (val.length < 2) {
        drop.style.display = 'none';
        return;
      }

      acTimers[field] = setTimeout(async () => {
        try {
          const res = await fetch('/v1/geocode?q=' + encodeURIComponent(val));
          const list = await res.json();
          drop.innerHTML = '';
          if (!list || list.length === 0) {
            drop.style.display = 'none';
            return;
          }
          list.forEach(item => {
            const row = document.createElement('div');
            row.className = 'ac-row';
            row.innerText = item.fullName || item.name;
            row.onclick = () => {
              exactCoords[field] = item;
              document.getElementById(field + 'Input').value = item.name;
              drop.style.display = 'none';
              const colors = { userOrigin: '#007AFF', userDest: '#34C759', driverOrigin: '#FF9500', driverDest: '#AF52DE' };
              updateMarkerOnMap(field, item.lat, item.lon, item.name, colors[field] || '#007AFF');
            };
            drop.appendChild(row);
          });
          drop.style.display = 'block';
        } catch(e) {
          drop.style.display = 'none';
        }
      }, 300);
    }

    // מנגנון מיקום נוכחי עמיד
    function useCurrentGPS() {
      const status = document.getElementById('gps-status-msg');
      if (!navigator.geolocation) {
        status.style.display = 'block';
        status.innerText = 'שירות מיקום אינו נתמך במכשיר זה';
        return;
      }
      status.style.display = 'block';
      status.innerText = 'מזהה מיקום נוכחי...';

      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        exactCoords.userOrigin = { lat, lon, name: 'המיקום הנוכחי שלי' };
        document.getElementById('userOriginInput').value = 'המיקום הנוכחי שלי';
        status.style.display = 'none';
        updateMarkerOnMap('userOrigin', lat, lon, 'המיקום שלי', '#007AFF');
        map.setView([lat, lon], 14);
      }, err => {
        status.style.display = 'block';
        status.innerText = 'לא ניתן לקבל מיקום: ודא ששירותי המיקום פועלים';
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    }

    function openAlternativesModal(lineName, rawMins, intervalMins, altsJson) {
      baseSearchMinutes = Number(rawMins);
      document.getElementById('alt-modal-title').innerText = 'זמנים וחלופות עבור ' + lineName;
      
      const depContainer = document.getElementById('alt-departures-list');
      depContainer.innerHTML = '';
      
      for (let i = 0; i <= 120; i += Number(intervalMins || 30)) {
        const timeStr = formatMinutesToTime(Number(rawMins) + i);
        const pill = document.createElement('span');
        pill.style = 'background:var(--tint); color:var(--blue); font-weight:700; padding:5px 9px; border-radius:7px; font-size:12px;';
        pill.innerText = (i === 0 ? 'קרוב: ' : '+ ' + i + ' דק׳: ') + timeStr;
        depContainer.appendChild(pill);
      }

      const altContainer = document.getElementById('alt-lines-list');
      altContainer.innerHTML = '';
      const alternatives = JSON.parse(decodeURIComponent(altsJson) || '[]');
      
      if (alternatives.length === 0) {
        altContainer.innerHTML = '<div style="font-size:12px; color:var(--sec);">אין קווי חלופה ישירים נוספים לציר זה.</div>';
      } else {
        alternatives.forEach((alt, idx) => {
          const btn = document.createElement('div');
          btn.className = 'alt-item-btn';
          const altName = typeof alt === 'object' ? alt.name : alt;
          const altFreq = typeof alt === 'object' ? alt.frequency : 'כל 30 דק׳';
          const altInterval = typeof alt === 'object' ? (alt.intervalMins || 30) : 30;
          const altDesc = typeof alt === 'object' ? alt.desc : 'מסלול מקביל';

          btn.innerHTML = \`
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b>\${altName}</b>
              <span style="font-size:11px; background:var(--tint); color:var(--blue); padding:2px 6px; border-radius:5px;">\${altFreq}</span>
            </div>
            <div style="font-size:12px; color:var(--sec); margin-top:2px;">\${altDesc} (לחץ להצגת שעות)</div>
            <div class="alt-sub-departures" id="sub-dep-\${idx}"></div>
          \`;

          btn.onclick = () => {
            const subBox = document.getElementById('sub-dep-' + idx);
            if (subBox.style.display === 'flex') {
              subBox.style.display = 'none';
              return;
            }
            subBox.innerHTML = '';
            for (let j = 10; j <= 120; j += altInterval) {
              const tStr = formatMinutesToTime(baseSearchMinutes + j);
              const sp = document.createElement('span');
              sp.style = 'background:rgba(52,199,89,0.15); color:var(--green); font-weight:700; padding:3px 7px; border-radius:5px; font-size:11px;';
              sp.innerText = tStr;
              subBox.appendChild(sp);
            }
            subBox.style.display = 'flex';
          };
          altContainer.appendChild(btn);
        });
      }

      document.getElementById('alt-modal').style.display = 'flex';
    }

    function formatMinutesToTime(totalMins) {
      const normalized = ((Math.round(totalMins) % 1440) + 1440) % 1440;
      const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
      const mins = (normalized % 60).toString().padStart(2, '0');
      return hours + ':' + mins;
    }

    function updateDetourLabel(v) {
      document.getElementById('detourText').innerText = v == 0 ? '0 דקות (ללא סטייה)' : v + ' דקות';
    }

    function updateOriginRideLabel(v) {
      document.getElementById('originRideText').innerText = v == 0 ? '0 דקות (ללא הקפצה)' : 'עד ' + v + ' דק׳';
      document.getElementById('walk-slider-box').style.display = v == 0 ? 'block' : 'none';
    }

    function updateOriginWalkLabel(v) {
      document.getElementById('originWalkText').innerText = v + ' דקות';
    }

    function updateDestRideLabel(v) {
      document.getElementById('destRideText').innerText = v == 0 ? '0 דקות (בלי איסוף)' : 'עד ' + v + ' דק׳ ברכב';
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
    }

    function setRouteType(type, el) {
      currentRouteType = type;
      document.querySelectorAll('#route-type-selector .segment').forEach(s => s.classList.remove('active'));
      el.classList.add('active');

      document.getElementById('driver-route-section').style.display = type === 'driver_route' ? 'block' : 'none';
      document.getElementById('rides-section').style.display = type === 'rides' ? 'block' : 'none';
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
        const res = await fetch('/v1/geocode?q=' + encodeURIComponent(query));
        const list = await res.json();
        if (list && list.length > 0) {
          const item = list[0];
          modalMap.setView([item.lat, item.lon], 15);
          currentChosenPlaceName = item.name;
          document.getElementById('modalSearchInput').value = currentChosenPlaceName;
        } else {
          alert('לא נמצא מיקום עבור: "' + query + '".');
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
    }

    // חיפוש חכם כולל תרגום טקסט חופשי לקואורדינטות אוטומטית
    async function triggerSearch() {
      const uOriginVal = document.getElementById('userOriginInput').value.trim();
      const uDestVal = document.getElementById('userDestInput').value.trim();

      if (!uOriginVal || !uDestVal) {
        alert('נא להזין נקודת מוצא ונקודת יעד.');
        return;
      }

      const spinner = document.getElementById('search-spinner');
      const btnText = document.getElementById('btn-text');
      spinner.style.display = 'block';
      btnText.innerText = 'מחשב מסלול...';

      // תרגום מוצא לקואורדינטות אם הוזן רק טקסט
      if (!exactCoords.userOrigin || exactCoords.userOrigin.name !== uOriginVal) {
        try {
          const res = await fetch('/v1/geocode?q=' + encodeURIComponent(uOriginVal));
          const list = await res.json();
          if (list && list.length > 0) exactCoords.userOrigin = list[0];
          else throw new Error();
        } catch(e) {
          spinner.style.display = 'none';
          btnText.innerText = 'מצא לי דרך';
          alert('לא נמצא מיקום עבור נקודת המוצא: "' + uOriginVal + '". נסה לבחור מהרשימה או מהמפה.');
          return;
        }
      }

      // תרגום יעד לקואורדינטות אם הוזן רק טקסט
      if (!exactCoords.userDest || exactCoords.userDest.name !== uDestVal) {
        try {
          const res = await fetch('/v1/geocode?q=' + encodeURIComponent(uDestVal));
          const list = await res.json();
          if (list && list.length > 0) exactCoords.userDest = list[0];
          else throw new Error();
        } catch(e) {
          spinner.style.display = 'none';
          btnText.innerText = 'מצא לי דרך';
          alert('לא נמצא מיקום עבור נקודת היעד: "' + uDestVal + '". נסה לבחור מהרשימה או מהמפה.');
          return;
        }
      }

      const dOriginVal = document.getElementById('driverOriginInput').value.trim();
      const dDestVal = document.getElementById('driverDestInput').value.trim();

      if (dOriginVal && (!exactCoords.driverOrigin || exactCoords.driverOrigin.name !== dOriginVal)) {
        try {
          const res = await fetch('/v1/geocode?q=' + encodeURIComponent(dOriginVal));
          const list = await res.json();
          if (list && list.length > 0) exactCoords.driverOrigin = list[0];
        } catch(e) {}
      }

      if (dDestVal && (!exactCoords.driverDest || exactCoords.driverDest.name !== dDestVal)) {
        try {
          const res = await fetch('/v1/geocode?q=' + encodeURIComponent(dDestVal));
          const list = await res.json();
          if (list && list.length > 0) exactCoords.driverDest = list[0];
        } catch(e) {}
      }

      const payload = {
        routeType: currentRouteType,
        userOrigin: exactCoords.userOrigin,
        userDest: exactCoords.userDest,
        driverOrigin: exactCoords.driverOrigin || exactCoords.userOrigin,
        driverDest: exactCoords.driverDest || exactCoords.userDest,
        timeType: document.getElementById('timeTypeSelect').value,
        targetTime: document.getElementById('targetTimeInput').value,
        maxDetourMin: document.getElementById('detourRange').value,
        originRideMin: document.getElementById('originRideRange').value,
        destRideMin: document.getElementById('destRideRange').value,
        maxWalkOriginMin: document.getElementById('originWalkRange') ? document.getElementById('originWalkRange').value : 20
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
        container.innerHTML = '<div class="card">לא נמצאו נקודות מעבר בטווח שנבחר. נסה להעלות מעט את זמן הסטייה או ההליכה בסליידר.</div>';
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
            <span class="badge \${isBest ? 'badge-green' : ''}">\${isBest ? 'מומלץ' : 'מסלול חלופי'}</span>
          </div>

          <div style="font-size: 15px; font-weight: 600; margin-top: 6px;">\${r.hub.name} ⟵ \${r.optimalAlightStation}</div>
          <div class="result-sub">\${r.whyReason}</div>

          <div class="timeline" id="timeline-\${idx}">
            <div style="font-size: 12px; font-weight: 700; color: var(--sec); margin-bottom: 10px;">שלבי המסלול המפורטים:</div>
            \${r.timeline.map(t => {
              const navUrl = t.icon === '🚗' ? 'https://waze.com/ul?ll=' + t.lat + ',' + t.lon + '&navigate=yes' : 'https://www.google.com/maps/dir/?api=1&destination=' + t.lat + ',' + t.lon + '&travelmode=walking';
              const altDataJson = encodeURIComponent(JSON.stringify(t.alternatives || []));
              return \`
                <div class="timeline-step">
                  <div class="step-time-badge">\${t.time}</div>
                  <div class="step-icon">\${t.icon}</div>
                  <div class="step-content">
                    <div class="step-header">
                      <span class="step-title">\${t.title}</span>
                      \${t.isInteractiveLine ? \`
                        <span class="step-tag-clickable" onclick="openAlternativesModal('\${t.badge}', '\${t.rawMinutes}', '\${t.intervalMins}', '\${altDataJson}')" title="לחץ לבדיקת זמנים נוספים וחלופות">
                          \${t.badge} ⏱️
                        </span>
                      \` : \`
                        <span style="font-size: 11px; padding: 2px 7px; border-radius: 5px; font-weight: 700; background: #007AFF; color: #FFF;">\${t.badge}</span>
                      \`}
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
  </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('iWay Server running on port ' + PORT));
