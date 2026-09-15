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

// --- מאגר קווי רכבת ישראל הרשמיים, כולל תחנות מוצא, יעד, כיווני נסיעה ותחנות ביניים ---
const ISRAEL_TRAIN_LINES = [
  {
    id: 'rail_coastal_south',
    fullName: 'רכבת ישראל: נהריה ⟵ באר שבע מרכז',
    terminalOrigin: 'נהריה',
    terminalDest: 'באר שבע מרכז',
    directionName: 'לכיוון דרום (באר שבע מרכז)',
    direction: 'south',
    intervalMins: 30,
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
      { name: 'רכבת רמלה', stopId: '35004', platform: 'רציף 2', lat: 31.9280, lon: 34.8770 },
      { name: 'רכבת קריית גת', stopId: '39002', platform: 'רציף 1', lat: 31.6035, lon: 34.7738 },
      { name: 'רכבת להבים - רהט', stopId: '39004', platform: 'רציף 1', lat: 31.3780, lon: 34.8160 },
      { name: 'רכבת באר שבע צפון / אוניברסיטה', stopId: '39005', platform: 'רציף 2', lat: 31.2610, lon: 34.8110 },
      { name: 'רכבת באר שבע מרכז', stopId: '39006', platform: 'רציף 2', lat: 31.2435, lon: 34.7972 }
    ]
  },
  {
    id: 'rail_coastal_north',
    fullName: 'רכבת ישראל: באר שבע מרכז ⟵ נהריה',
    terminalOrigin: 'באר שבע מרכז',
    terminalDest: 'נהריה',
    directionName: 'לכיוון צפון (נהריה)',
    direction: 'north',
    intervalMins: 30,
    stations: [
      { name: 'רכבת באר שבע מרכז', stopId: '39006', platform: 'רציף 1', lat: 31.2435, lon: 34.7972 },
      { name: 'רכבת קריית גת', stopId: '39002', platform: 'רציף 2', lat: 31.6035, lon: 34.7738 },
      { name: 'רכבת תל אביב ההגנה', stopId: '36008', platform: 'רציף 1', lat: 32.0538, lon: 34.7788 },
      { name: 'רכבת תל אביב השלום', stopId: '36006', platform: 'רציף 1', lat: 32.0734, lon: 34.7925 },
      { name: 'רכבת תל אביב סבידור מרכז', stopId: '36004', platform: 'רציף 1', lat: 32.0835, lon: 34.7983 },
      { name: 'רכבת הרצליה', stopId: '37308', platform: 'רציף 1', lat: 32.1629, lon: 34.8252 },
      { name: 'רכבת בית יהושע', stopId: '37306', platform: 'רציף 2', lat: 32.2610, lon: 34.8640 },
      { name: 'רכבת נתניה', stopId: '37302', platform: 'רציף 2', lat: 32.3190, lon: 34.8660 },
      { name: 'רכבת חדרה מערב', stopId: '37310', platform: 'רציף 2', lat: 32.4410, lon: 34.9080 },
      { name: 'רכבת בנימינה', stopId: '37312', platform: 'רציף 1', lat: 32.5140, lon: 34.9520 },
      { name: 'רכבת חיפה חוף הכרמל', stopId: '34002', platform: 'רציף 2', lat: 32.7930, lon: 34.9570 },
      { name: 'מרכזית המפרץ חיפה', stopId: '34006', platform: 'רציף 1', lat: 32.7933, lon: 35.0344 },
      { name: 'רכבת קריית מוצקין', stopId: '34008', platform: 'רציף 2', lat: 32.8335, lon: 35.0805 },
      { name: 'רכבת עכו', stopId: '31004', platform: 'רציף 2', lat: 32.9275, lon: 35.0840 },
      { name: 'רכבת נהריה', stopId: '31002', platform: 'רציף 2', lat: 33.0062, lon: 35.0975 }
    ]
  },
  {
    id: 'rail_emek',
    fullName: 'רכבת ישראל: בית שאן ⟵ חיפה חוף הכרמל (רכבת העמק)',
    terminalOrigin: 'בית שאן',
    terminalDest: 'חיפה חוף הכרמל',
    directionName: 'לכיוון חיפה (מערב)',
    direction: 'west',
    intervalMins: 60,
    stations: [
      { name: 'רכבת בית שאן', stopId: '38008', platform: 'רציף 1', lat: 32.5080, lon: 35.5010 },
      { name: 'רכבת עפולה', stopId: '38002', platform: 'רציף 1', lat: 32.6140, lon: 35.2950 },
      { name: 'רכבת מגדל העמק - כפר ברוך', stopId: '38004', platform: 'רציף 1', lat: 32.6510, lon: 35.2180 },
      { name: 'רכבת יקנעם - כפר יהושע', stopId: '38006', platform: 'רציף 1', lat: 32.6840, lon: 35.1290 },
      { name: 'מרכזית המפרץ חיפה', stopId: '34006', platform: 'רציף 4', lat: 32.7933, lon: 35.0344 }
    ]
  }
];

// --- מאגר קווי אוטובוס ארציים אמיתיים לפי מסלולים רשמיים של משרד התחבורה ---
const OFFICIAL_BUS_ROUTES = [
  {
    lineNum: '430',
    operator: 'אגד',
    routeTitle: 'קו 430 (אגד): חיפה מרכזית המפרץ ⟵ טבריה מרכזית',
    originTerminal: 'חיפה מרכזית המפרץ',
    destTerminal: 'טבריה תחנה מרכזית',
    direction: 'טבריה',
    intervalMins: 45,
    stops: [
      { name: 'מרכזית המפרץ', stopId: '41120', platform: 'רציף 12' },
      { name: 'מחלף יגור', stopId: '41180', platform: 'תחנה בינעירונית' },
      { name: 'מחלף המוביל', stopId: '54210', platform: 'רציף 2' },
      { name: 'צומת גולני', stopId: '55110', platform: 'מחלף גולני' },
      { name: 'מרכזית טבריה', stopId: '56100', platform: 'רציף ירידה' }
    ]
  },
  {
    lineNum: '369',
    operator: 'מטרופולין',
    routeTitle: 'קו 369 (מטרופולין): באר שבע מרכזית ⟵ תל אביב סבידור מרכז',
    originTerminal: 'באר שבע מרכזית',
    destTerminal: 'תל אביב סבידור מרכז',
    direction: 'תל אביב',
    intervalMins: 30,
    stops: [
      { name: 'באר שבע מרכזית', stopId: '39010', platform: 'רציף 6' },
      { name: 'צומת פלוגות', stopId: '13524', platform: 'מסלול צפון' },
      { name: 'צומת קסטינה / מלאכי', stopId: '12800', platform: 'רציף צפון' },
      { name: 'תחנה מרכזית תל אביב', stopId: '21000', platform: 'קומה 6' },
      { name: 'ת"א סבידור מרכז', stopId: '36004', platform: 'מסוף 2000' }
    ]
  },
  {
    lineNum: '44',
    operator: 'דן בדרום',
    routeTitle: 'קו 44 (דן בדרום): באר שבע מרכזית ⟵ מסוף ניצנה',
    originTerminal: 'באר שבע תחנה מרכזית',
    destTerminal: 'מסוף ניצנה / קהילת ניצנה',
    direction: 'ניצנה',
    intervalMins: 55,
    stops: [
      { name: 'באר שבע מרכזית', stopId: '39006', platform: 'רציף 8' },
      { name: 'צומת הנגב', stopId: '39500', platform: 'מסוף דרומי' },
      { name: 'משאבי שדה', stopId: '39610', platform: 'כניסה לקיבוץ' },
      { name: 'צומת טללים', stopId: '39700', platform: 'מזלג דרום' },
      { name: 'כמוהין', stopId: '39820', platform: 'מזכירות' },
      { name: 'ניצנה', stopId: '39900', platform: 'מסוף ניצנה' }
    ]
  },
  {
    lineNum: '26',
    operator: 'קווים',
    routeTitle: 'קו 26 (קווים): נתניה תחנת רכבת ⟵ פרדסיה',
    originTerminal: 'רכבת נתניה',
    destTerminal: 'פרדסיה',
    direction: 'פרדסיה',
    intervalMins: 25,
    stops: [
      { name: 'רכבת נתניה', stopId: '37302', platform: 'תחנה מזרחית' },
      { name: 'צומת השרון / בית ליד', stopId: '37410', platform: 'צומת כפר יונה' },
      { name: 'פרדסיה מרכז', stopId: '37500', platform: 'שדרות הנשיא' }
    ]
  },
  {
    lineNum: '5',
    operator: 'דן',
    routeTitle: 'קו 5 (דן): רכבת תל אביב סבידור מרכז ⟵ צפון ישן / סוקולוב',
    originTerminal: 'רכבת תל אביב סבידור מרכז',
    destTerminal: 'תל אביב - חוף מציצים',
    direction: 'נחום סוקולוב / צפון תל אביב',
    intervalMins: 10,
    stops: [
      { name: 'רכבת תל אביב סבידור מרכז', stopId: '36004', platform: 'גשר מודעי / נמיר' },
      { name: 'דרך נמיר / פנקס', stopId: '21102', platform: 'תחנה עירונית' },
      { name: 'סוקולוב / בזל', stopId: '21250', platform: 'צפון ישן' }
    ]
  }
];

// מציאת קו אוטובוס רשמי המחבר בין תחנות
function findOfficialBusConnecting(fromName, toName) {
  for (const bus of OFFICIAL_BUS_ROUTES) {
    const hasFrom = bus.stops.some(s => s.name.includes(fromName) || fromName.includes(s.name));
    const hasTo = bus.stops.some(s => s.name.includes(toName) || toName.includes(s.name) || bus.destTerminal.includes(toName));
    if (hasFrom && hasTo) {
      return bus;
    }
  }
  return null;
}

// מציאת קו רכבת מדויק כולל כיוון, שמות תחנות קצה ורציפים
function findOptimalTrainRoute(originCoord, destCoord) {
  let bestCandidate = null;
  let minCombinedDist = Infinity;

  for (const trainLine of ISRAEL_TRAIN_LINES) {
    for (let i = 0; i < trainLine.stations.length; i++) {
      const boardStation = trainLine.stations[i];
      const dBoard = haversineDistMeters(boardStation, originCoord);

      for (let j = i + 1; j < trainLine.stations.length; j++) {
        const alightStation = trainLine.stations[j];
        const dAlight = haversineDistMeters(alightStation, destCoord);
        const combined = dBoard * 0.4 + dAlight;

        if (combined < minCombinedDist) {
          minCombinedDist = combined;
          const stopsCount = j - i;
          const distBetweenStationsKm = haversineDistMeters(boardStation, alightStation) / 1000;
          const trainMins = Math.max(10, Math.round((distBetweenStationsKm * 1.15) / 78 * 60));

          bestCandidate = {
            trainLine,
            boardStation,
            alightStation,
            stopsCount,
            trainMins,
            distFromAlightToDestKm: dAlight / 1000
          };
        }
      }
    }
  }

  return bestCandidate;
}

// מנוע אופטימיזציה רוחבי ואמיתי לכל הארץ
function runUniversalTransitOptimizer(body) {
  const {
    routeType = 'driver_route',
    userOrigin,
    userDest,
    timeType = 'depart_now',
    targetTime = '',
    maxDetourMin = 0,
    originRideMin = 0,
    destRideMin = 0,
    maxWalkOriginMin = 20,
    mode = 'smart'
  } = body;

  const destRideRadius = Number(destRideMin) || 0;
  const detourLimit = Number(maxDetourMin) || 0;
  const maxWalkLimit = Number(maxWalkOriginMin) || 20;
  let baseMinutes = parseTimeToMinutes(targetTime);
  const candidates = [];

  // איתור קו הרכבת הארצי האופטימלי לפי מיקומי המשתמש והיעד
  const trainRoute = findOptimalTrainRoute(userOrigin, userDest);

  // מציאת קו אוטובוס משלים מתחנת הירידה ועד לכתובת הסופית
  const connectingBus = findOfficialBusConnecting(trainRoute.alightStation.name, userDest.name || '') ||
                        findOfficialBusConnecting(trainRoute.alightStation.name, 'תל אביב') ||
                        findOfficialBusConnecting(trainRoute.alightStation.name, 'ניצנה') ||
                        findOfficialBusConnecting(trainRoute.alightStation.name, 'פרדסיה');

  // חישוב נסיעה עם נהג או הגעה עצמאית
  let driveWithDriver = 0;
  let walkToStationMin = 0;
  let detourMin = 0;
  let isEligible = false;

  const boardCoord = { lat: trainRoute.boardStation.lat, lon: trainRoute.boardStation.lon };

  if (routeType === 'driver_route') {
    const { driverOrigin, driverDest } = body;
    const directDriverTime = estDriveMinutes(driverOrigin, driverDest);
    const timeToPickup = estDriveMinutes(driverOrigin, userOrigin);
    const timePickupToHub = estDriveMinutes(userOrigin, boardCoord);
    const timeHubToDriverDest = estDriveMinutes(boardCoord, driverDest);
    const totalDriverTrip = timeToPickup + timePickupToHub + timeHubToDriverDest;
    detourMin = Math.max(0, totalDriverTrip - directDriverTime);

    if (detourMin <= detourLimit) {
      isEligible = true;
      driveWithDriver = timePickupToHub;
    }
  } else {
    const originRideLimit = Number(originRideMin) || 0;
    const driveToHub = estDriveMinutes(userOrigin, boardCoord);

    if (originRideLimit > 0) {
      if (driveToHub <= originRideLimit) {
        isEligible = true;
        driveWithDriver = driveToHub;
        detourMin = driveToHub;
      }
    } else {
      const walkMin = estWalkMinutes(userOrigin, boardCoord);
      if (walkMin <= maxWalkLimit) {
        isEligible = true;
        walkToStationMin = walkMin;
        driveWithDriver = 0;
      }
    }
  }

  // חישוב מקטע סופי ליעד
  const alightCoord = { lat: trainRoute.alightStation.lat, lon: trainRoute.alightStation.lon };
  const driveFinalLeg = estDriveMinutes(alightCoord, userDest);
  const hasDestPickup = destRideRadius > 0 && driveFinalLeg <= destRideRadius;

  let finalLegMinutes = 15;
  if (hasDestPickup) {
    finalLegMinutes = driveFinalLeg;
  } else if (connectingBus) {
    finalLegMinutes = Math.min(50, Math.round(trainRoute.distFromAlightToDestKm / 35 * 60) + 6);
  } else {
    finalLegMinutes = Math.min(45, estWalkMinutes(alightCoord, userDest));
  }

  const initialLegTime = driveWithDriver > 0 ? driveWithDriver : (walkToStationMin || 8);
  const waitTimeAtBoard = 6;
  const totalTripMinutes = initialLegTime + trainRoute.trainMins + finalLegMinutes + waitTimeAtBoard;

  let startMin = baseMinutes;
  if (timeType === 'arrive_by') {
    startMin = baseMinutes - totalTripMinutes;
  }

  const tPickup = startMin;
  const tDropoff = tPickup + initialLegTime;
  const tBoard = tDropoff + waitTimeAtBoard;
  const tAlight = tBoard + trainRoute.trainMins;
  const tFinalArrival = tAlight + finalLegMinutes;

  const timeline = [];

  // שלב 1: התחלה (רכב / הליכה)
  if (driveWithDriver > 0) {
    timeline.push({
      time: formatMinutesToTime(tPickup),
      icon: '🚗',
      badge: routeType === 'driver_route' ? 'נסיעה עם נהג' : 'הקפצה ברכב',
      title: `איסוף מנקודת המוצא ברכב`,
      desc: `נסיעה משותפת של כ-${driveWithDriver} דקות אל ${trainRoute.boardStation.name}`,
      lat: userOrigin.lat,
      lon: userOrigin.lon
    });
    timeline.push({
      time: formatMinutesToTime(tDropoff),
      icon: '📍',
      badge: `תחנה #${trainRoute.boardStation.stopId}`,
      title: `הורדה בתחנה: ${trainRoute.boardStation.name}`,
      desc: `סטיית נהג ממסלולו: +${detourMin} דק׳ • ${trainRoute.boardStation.platform}`,
      lat: trainRoute.boardStation.lat,
      lon: trainRoute.boardStation.lon
    });
  } else {
    timeline.push({
      time: formatMinutesToTime(tPickup),
      icon: '🚶',
      badge: `הליכה לתחנה`,
      title: `הגעה אל ${trainRoute.boardStation.name}`,
      desc: `תחנה מזהה #${trainRoute.boardStation.stopId} (${trainRoute.boardStation.platform})`,
      lat: trainRoute.boardStation.lat,
      lon: trainRoute.boardStation.lon
    });
  }

  // שלב 2: נסיעה ברכבת ישראל (פירוט שמות קו מדויקים וכיוון)
  timeline.push({
    time: formatMinutesToTime(tBoard),
    icon: '🚆',
    badge: 'רכבת ישראל',
    isInteractiveLine: true,
    rawMinutes: tBoard,
    intervalMins: trainRoute.trainLine.intervalMins,
    alternatives: [
      { name: `${trainRoute.trainLine.fullName} (הבאה)`, frequency: `בעוד ${trainRoute.trainLine.intervalMins} דק׳`, intervalMins: trainRoute.trainLine.intervalMins, desc: `${trainRoute.trainLine.directionName} • אותו רציף` },
      { name: 'רכבת פרברית מקבילה', frequency: 'כל 30 דק׳', intervalMins: 30, desc: 'עוצרת בכל תחנות הביניים' }
    ],
    title: `עולים על ${trainRoute.trainLine.fullName}`,
    desc: `כיוון נסיעה: ${trainRoute.trainLine.directionName} (התחלה: ${trainRoute.trainLine.terminalOrigin} ⟵ סיום: ${trainRoute.trainLine.terminalDest}) • ${trainRoute.boardStation.platform} • עוברים ${trainRoute.stopsCount} תחנות`,
    lat: trainRoute.boardStation.lat,
    lon: trainRoute.boardStation.lon
  });

  // שלב 3: ירידה מהרכבת
  timeline.push({
    time: formatMinutesToTime(tAlight),
    icon: '🛑',
    badge: `תחנה #${trainRoute.alightStation.stopId}`,
    title: `יורדים ב-${trainRoute.alightStation.name}`,
    desc: `${trainRoute.alightStation.platform} • שעת הגעה משוערת: ${formatMinutesToTime(tAlight)} (מרחק מהיעד: ${(trainRoute.distFromAlightToDestKm).toFixed(1)} ק״מ)`,
    lat: trainRoute.alightStation.lat,
    lon: trainRoute.alightStation.lon
  });

  // שלב 4: המשך ליעד (איסוף רכוב / אוטובוס רשמי / הליכה)
  if (hasDestPickup) {
    timeline.push({
      time: formatMinutesToTime(tAlight + 1),
      icon: '🚗',
      badge: 'איסוף ביעד',
      title: `איסוף ברכב מ-${trainRoute.alightStation.name}`,
      desc: `נסיעה ברכב של כ-${driveFinalLeg} דקות ישירות ליעד (בטווח של עד ${destRideRadius} דק׳)`,
      lat: trainRoute.alightStation.lat,
      lon: trainRoute.alightStation.lon
    });
  } else if (connectingBus) {
    timeline.push({
      time: formatMinutesToTime(tAlight + 2),
      icon: '🚌',
      badge: `קו ${connectingBus.lineNum}`,
      isInteractiveLine: true,
      rawMinutes: tAlight + 2,
      intervalMins: connectingBus.intervalMins,
      alternatives: [
        { name: `${connectingBus.routeTitle} (הבא)`, frequency: `בעוד ${connectingBus.intervalMins} דק׳`, intervalMins: connectingBus.intervalMins, desc: `כיוון: ${connectingBus.direction}` }
      ],
      title: `עולים על ${connectingBus.routeTitle}`,
      desc: `כיוון: ${connectingBus.direction} (התחלה: ${connectingBus.originTerminal} ⟵ סיום: ${connectingBus.destTerminal}) • נסיעה של כ-${finalLegMinutes} דקות ליעד`,
      lat: trainRoute.alightStation.lat,
      lon: trainRoute.alightStation.lon
    });
  } else {
    timeline.push({
      time: formatMinutesToTime(tAlight + 2),
      icon: '🚶',
      badge: 'הגעה עצמאית',
      title: `הגעה מ-${trainRoute.alightStation.name} ליעד`,
      desc: `מרחק קצר מחוץ לתחנה ישירות לכתובת היעד`,
      lat: trainRoute.alightStation.lat,
      lon: trainRoute.alightStation.lon
    });
  }

  // שלב 5: הגעה
  timeline.push({
    time: formatMinutesToTime(tFinalArrival),
    icon: '🎯',
    badge: 'הגעה ליעד',
    title: 'הגעה ליעד המבוקש',
    desc: 'סיום המסלול בהצלחה',
    lat: userDest.lat,
    lon: userDest.lon
  });

  candidates.push({
    hub: { name: trainRoute.boardStation.name, lat: trainRoute.boardStation.lat, lon: trainRoute.boardStation.lon },
    optimalAlightStation: trainRoute.alightStation.name,
    lineBadge: 'רכבת ישראל',
    totalUserTime: totalTripMinutes,
    startTime: formatMinutesToTime(startMin),
    endTime: formatMinutesToTime(timeType === 'arrive_by' ? baseMinutes : tFinalArrival),
    detourMin,
    hasDestPickup,
    score: totalTripMinutes,
    whyReason: `מעבר ב-${trainRoute.boardStation.name}, ${trainRoute.trainLine.fullName} (${trainRoute.trainLine.directionName}) וירידה ב-${trainRoute.alightStation.name}.`,
    timeline
  });

  return candidates;
}

app.get('/v1/geocode', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) return res.json([]);
  try {
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=il&accept-language=he&q=${encodeURIComponent(query)}&limit=6`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'iWayApp-Israel/18.0' } });
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
  const results = runUniversalTransitOptimizer(body);
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
    .modal-ac-box { position: absolute; top: 100%; right: 16px; left: 16px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; z-index: 10010; box-shadow: 0 8px 24px rgba(0,0,0,0.2); max-height: 220px; overflow-y: auto; display: none; }
    .ac-item { padding: 12px 14px; font-size: 14px; border-bottom: 1px solid var(--border); cursor: pointer; color: var(--text); }
    .ac-item:last-child { border-bottom: none; }
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
      <input type="text" id="userOriginInput" placeholder="היכן אתה נמצא?">
      <button class="btn-icon" title="השתמש במיקום נוכחי" onclick="useCurrentGPS()">📍</button>
      <button class="btn-icon" title="בחר במפה" onclick="openMapModal('userOrigin')">🗺️</button>
    </div>
    <div id="gps-status-msg" style="font-size:12px; color:var(--sec); padding:0 4px 4px; display:none;"></div>
    <div class="input-row">
      <span class="color-dot dot-green"></span>
      <label>יעד</label>
      <input type="text" id="userDestInput" placeholder="לאן להגיע? (עיר, רחוב או צומת)">
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
    let activeMode = 'smart';
    let currentRouteType = 'driver_route';
    let currentModalField = null;
    let modalMap = null;
    let currentChosenPlaceName = '';
    let baseSearchMinutes = null;

    // שדות ריקים כברירת מחדל
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
        status.innerText = 'שירות המיקום אינו זמין כעת. ניתן להקליד ידנית או לבחור במפה.';
      }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
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
      if (exactCoords.userOrigin && exactCoords.userDest) triggerSearch();
    }

    function updateOriginRideLabel(v) {
      document.getElementById('originRideText').innerText = v == 0 ? '0 דקות (ללא הקפצה)' : 'עד ' + v + ' דק׳';
      document.getElementById('walk-slider-box').style.display = v == 0 ? 'block' : 'none';
      if (exactCoords.userOrigin && exactCoords.userDest) triggerSearch();
    }

    function updateOriginWalkLabel(v) {
      document.getElementById('originWalkText').innerText = v + ' דקות';
      if (exactCoords.userOrigin && exactCoords.userDest) triggerSearch();
    }

    function updateDestRideLabel(v) {
      document.getElementById('destRideText').innerText = v == 0 ? '0 דקות (בלי איסוף)' : 'עד ' + v + ' דק׳ ברכב';
      if (exactCoords.userOrigin && exactCoords.userDest) triggerSearch();
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
      if (exactCoords.userOrigin && exactCoords.userDest) triggerSearch();
    }

    function setRouteType(type, el) {
      currentRouteType = type;
      document.querySelectorAll('#route-type-selector .segment').forEach(s => s.classList.remove('active'));
      el.classList.add('active');

      document.getElementById('driver-route-section').style.display = type === 'driver_route' ? 'block' : 'none';
      document.getElementById('rides-section').style.display = type === 'rides' ? 'block' : 'none';
      if (exactCoords.userOrigin && exactCoords.userDest) triggerSearch();
    }

    function changeMode(mode, el) {
      activeMode = mode;
      el.parentElement.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      if (exactCoords.userOrigin && exactCoords.userDest) triggerSearch();
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
      if (exactCoords.userOrigin && exactCoords.userDest) triggerSearch();
    }

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

      if (!exactCoords.userOrigin || exactCoords.userOrigin.name !== uOriginVal) {
        try {
          const res = await fetch('/v1/geocode?q=' + encodeURIComponent(uOriginVal));
          const list = await res.json();
          if (list && list.length > 0) exactCoords.userOrigin = list[0];
        } catch(e) {}
      }

      if (!exactCoords.userDest || exactCoords.userDest.name !== uDestVal) {
        try {
          const res = await fetch('/v1/geocode?q=' + encodeURIComponent(uDestVal));
          const list = await res.json();
          if (list && list.length > 0) exactCoords.userDest = list[0];
        } catch(e) {}
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
        userOrigin: exactCoords.userOrigin || { lat: 32.7842, lon: 35.1718, name: uOriginVal },
        userDest: exactCoords.userDest || { lat: 31.2435, lon: 34.7972, name: uDestVal },
        driverOrigin: exactCoords.driverOrigin || exactCoords.userOrigin,
        driverDest: exactCoords.driverDest || exactCoords.userDest,
        timeType: document.getElementById('timeTypeSelect').value,
        targetTime: document.getElementById('targetTimeInput').value,
        maxDetourMin: document.getElementById('detourRange').value,
        originRideMin: document.getElementById('originRideRange').value,
        destRideMin: document.getElementById('destRideRange').value,
        maxWalkOriginMin: document.getElementById('originWalkRange') ? document.getElementById('originWalkRange').value : 20,
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
            <span class="badge \${isBest ? 'badge-green' : ''}">\${isBest ? 'מומלץ - ' + activeMode.toUpperCase() : 'מסלול חלופי'}</span>
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
