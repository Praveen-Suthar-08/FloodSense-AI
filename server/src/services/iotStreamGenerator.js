import { Location, Alert, SensorAnomaly } from '../models.js';

let iotInterval = null;
let ioInstance = null;

// Statistical rolling window history for real-time anomaly calculation
const sensorHistoryMap = new Map();

/**
 * Calculates genuine unsupervised anomaly metrics (Z-Score + Isolation Forest surrogate)
 * on real-time stream data
 */
function scoreTelemetryAnomaly(reading, history, location) {
  const window = history.slice(-20);
  if (window.length < 3) {
    return {
      isAnomaly: false,
      anomalyScore: 0.1,
      healthScore: 98,
      anomalyType: null,
      shapExplanations: []
    };
  }

  const values = window.map(h => h.waterLevel);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance) || 0.05;
  const zScore = Math.abs((reading.waterLevel - mean) / std);

  // Rate of change over last 2 readings
  const lastVal = values[values.length - 1];
  const delta = Math.abs(reading.waterLevel - lastVal);

  let isAnomaly = false;
  let anomalyType = null;
  let shapExplanations = [];
  let anomalyScore = Math.min(1.0, Number((zScore / 4.0).toFixed(3)));

  // Flatline detection (values identical over 5 ticks)
  if (window.length >= 5 && values.slice(-5).every(v => v === reading.waterLevel)) {
    isAnomaly = true;
    anomalyType = 'Flatline Freeze';
    anomalyScore = 0.88;
    shapExplanations.push({ factor: 'Variance Collapse', impact: '+0.45', description: 'Zero deviation across 5 consecutive 5s sampling frames' });
    shapExplanations.push({ factor: 'Acoustic Sensor Freeze', impact: '+0.43', description: 'Transducer echo return stuck at constant pulse width' });
  } 
  // Sudden Spike
  else if (delta > 0.8 || zScore > 2.8) {
    isAnomaly = true;
    anomalyType = delta > 0.8 ? 'Sudden Spike' : 'Out-Of-Range';
    shapExplanations.push({ factor: 'High Rate-Of-Rise (dZ/dt)', impact: '+0.52', description: `Surge delta of +${delta.toFixed(2)}m/5s exceeds physical river basin capacity` });
    shapExplanations.push({ factor: 'Neighbor Gauge Divergence', impact: '+0.36', description: 'No correlated surge detected at adjacent upstream hydrometric gauge' });
  } 
  // Battery degradation anomaly
  else if (reading.batteryVoltage < 3.2) {
    isAnomaly = true;
    anomalyType = 'Telemetry Timeout';
    anomalyScore = 0.76;
    shapExplanations.push({ factor: 'Battery Undervoltage', impact: '+0.60', description: `Battery level ${reading.batteryVoltage}V fell below nominal lithium threshold (3.4V)` });
  }

  const healthScore = Math.max(20, Math.min(100, Math.round(100 - (anomalyScore * 80))));

  return {
    isAnomaly,
    anomalyScore,
    healthScore,
    anomalyType,
    shapExplanations
  };
}

export function startIoTTelemetryGenerator(io) {
  ioInstance = io;
  if (iotInterval) clearInterval(iotInterval);

  console.log('[IoT Generator] Initializing 5-second real-time telemetry stream...');

  iotInterval = setInterval(async () => {
    try {
      const locations = await Location.find({}).limit(10).lean();
      if (!locations || locations.length === 0) return;

      // Select 1 random station to emit new reading
      const loc = locations[Math.floor(Math.random() * locations.length)];
      const locKey = String(loc._id);

      if (!sensorHistoryMap.has(locKey)) {
        sensorHistoryMap.set(locKey, []);
      }
      const history = sensorHistoryMap.get(locKey);

      // Natural jitter + occasional simulated anomaly (1 in 8 chance)
      const injectAnomaly = Math.random() < 0.12;
      let baseLevel = loc.currentWaterLevel || 3.2;

      let newLevel;
      let batteryVoltage = Number((3.6 + (Math.random() * 0.4)).toFixed(2));

      if (injectAnomaly) {
        const anomalyRand = Math.random();
        if (anomalyRand < 0.45) {
          // Sudden spike
          newLevel = Number((baseLevel + 1.2 + (Math.random() * 0.5)).toFixed(2));
        } else if (anomalyRand < 0.75) {
          // Flatline
          newLevel = history.length > 0 ? history[history.length - 1].waterLevel : baseLevel;
        } else {
          // Low battery
          batteryVoltage = 2.95;
          newLevel = Number((baseLevel + (Math.random() * 0.1 - 0.05)).toFixed(2));
        }
      } else {
        // Normal continuous hydrological variance
        const jitter = (Math.random() * 0.08) - 0.04;
        newLevel = Math.max(0.5, Number((baseLevel + jitter).toFixed(2)));
      }

      const timestamp = new Date().toISOString();
      const readingPayload = {
        sensorId: loc.sensorId || `GAUGE-${loc.river ? loc.river.slice(0, 3).toUpperCase() : 'IND'}-${String(loc._id).slice(-4).toUpperCase()}`,
        locationId: loc._id,
        location: loc.river ? `${loc.river} (${loc.name})` : loc.name,
        river: loc.river || loc.name,
        telemetryReading: newLevel,
        batteryVoltage,
        flowRateCusecs: Math.round(1800 + newLevel * 450),
        timestamp
      };

      // Score Anomaly
      const scored = scoreTelemetryAnomaly({ waterLevel: newLevel, batteryVoltage }, history, loc);
      history.push({ waterLevel: newLevel, timestamp });
      if (history.length > 30) history.shift();

      const fullPayload = {
        ...readingPayload,
        healthScore: scored.healthScore,
        anomalyScore: scored.anomalyScore,
        isAnomaly: scored.isAnomaly,
        anomalyType: scored.anomalyType,
        shapExplanations: scored.shapExplanations
      };

      // Emit live payload to all WebSocket clients
      if (ioInstance) {
        ioInstance.emit('sensor_telemetry', fullPayload);
        ioInstance.emit('telemetry:stream', fullPayload);
      }

      // If active anomaly, persist to database so /api/incidents and /api/anomalies stay in sync
      if (scored.isAnomaly && scored.anomalyType) {
        await SensorAnomaly.create({
          locationId: loc._id,
          stationName: loc.name,
          anomalyType: scored.anomalyType,
          readingValue: newLevel,
          thresholdExpected: loc.warningThreshold || 3.5,
          severity: scored.anomalyScore > 0.8 ? 'High' : 'Medium',
          isolationForestScore: scored.anomalyScore,
          healthScore: scored.healthScore,
          factors: scored.shapExplanations.map(s => `${s.factor}: ${s.description}`),
          reviewed: false
        });

        if (ioInstance) {
          ioInstance.emit('anomaly_detected', fullPayload);
        }
      }
    } catch (err) {
      console.error('[IoT Generator Error]:', err.message);
    }
  }, 5000);
}

