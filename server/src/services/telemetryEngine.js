import { Location, Alert } from '../models.js';
import { dispatchSubscribersAlert } from './alertNotifier.js';

// Cooldown map: locationId -> timestamp in ms (default 30 mins)
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const locationAlertCooldowns = new Map();

/**
 * Evaluates real-time water level data against defined thresholds.
 * Emits WebSocket live updates and triggers outbound SMS/WhatsApp/Email
 * notifications with automated cooldown to prevent alert spam.
 */
export async function evaluateWaterLevelTelemetry({ locationId, sensorId, waterLevel, river, source = 'telemetry', io }) {
  let location = null;
  if (locationId) {
    location = await Location.findById(locationId);
  } else if (sensorId) {
    location = await Location.findOne({
      $or: [
        { sensorId: sensorId },
        { name: new RegExp(sensorId, 'i') }
      ]
    });
  } else if (river) {
    location = await Location.findOne({
      $or: [
        { river: new RegExp(river, 'i') },
        { name: new RegExp(river, 'i') }
      ]
    });
  }

  if (!location) {
    throw new Error('Location not found for telemetry payload (verify sensorId, locationId, or river name)');
  }

  const prevLvl = location.currentWaterLevel || 2.5;
  const numWaterLevel = Number(waterLevel);
  location.currentWaterLevel = numWaterLevel;

  const warnThresh = location.warningThreshold || 3.5;
  const critThresh = location.criticalThreshold || 4.0;

  let severity = 'Normal';
  if (numWaterLevel >= critThresh) {
    severity = 'Critical';
    location.sensorStatus = 'Critical';
  } else if (numWaterLevel >= warnThresh) {
    severity = 'Warning';
    location.sensorStatus = 'Warning';
  } else {
    severity = 'Normal';
    location.sensorStatus = 'Active';
  }

  await location.save();

  // 1. Emit live water level update via Socket.IO
  const telemetryEvent = {
    locationId: location._id,
    river: location.river || location.name,
    waterLevel: numWaterLevel,
    previousWaterLevel: prevLvl,
    warningThreshold: warnThresh,
    criticalThreshold: critThresh,
    severity,
    source,
    timestamp: new Date().toISOString()
  };

  if (io) {
    io.emit('waterLevelUpdate', telemetryEvent);
    io.emit('stats:update');
  }

  // 2. Alert Trigger & Deduplication Engine
  let alertRecord = null;
  let outboundResult = null;

  if (severity === 'Critical' || severity === 'Warning') {
    const locKey = String(location._id);
    const lastAlertTime = locationAlertCooldowns.get(locKey) || 0;
    const nowMs = Date.now();

    // Check for existing ongoing/active alert for this location to deduplicate/debounce
    const existingActiveAlert = await Alert.findOne({
      locationId: location._id,
      status: { $in: ['Active', 'Acknowledged'] }
    }).sort({ createdAt: -1 });

    if (existingActiveAlert) {
      // Update existing ongoing incident instead of spamming duplicates
      const peak = Math.max(existingActiveAlert.peakWaterLevel || existingActiveAlert.waterLevel || 0, numWaterLevel);
      existingActiveAlert.waterLevel = numWaterLevel;
      existingActiveAlert.peakWaterLevel = peak;
      existingActiveAlert.severity = severity;
      existingActiveAlert.lastUpdated = new Date();
      existingActiveAlert.message = `${location.river || location.name} - ${severity} since ${new Date(existingActiveAlert.ongoingSince || existingActiveAlert.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} - Peak: ${peak}m`;
      await existingActiveAlert.save();

      alertRecord = existingActiveAlert;
      if (io) {
        io.emit('alert_updated', existingActiveAlert);
        io.emit('alert:updated', existingActiveAlert);
      }
    } else {
      // Create new incident with cooldown
      locationAlertCooldowns.set(locKey, nowMs);

      const alertMsg = `${location.river || location.name} - ${severity} since ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} - Peak: ${numWaterLevel}m`;

      alertRecord = await Alert.create({
        locationId: location._id,
        locationName: location.name,
        river: location.river || location.name,
        district: location.district,
        state: location.state,
        severity,
        status: 'Active',
        waterLevel: numWaterLevel,
        peakWaterLevel: numWaterLevel,
        ongoingSince: new Date(),
        lastUpdated: new Date(),
        previousWaterLevel: prevLvl,
        threshold: severity === 'Critical' ? critThresh : warnThresh,
        message: alertMsg,
        createdAt: new Date()
      });

      if (io) {
        io.emit('alert:new', alertRecord);
        io.emit('critical_alert', alertRecord);
      }

      // 3. Fire outbound alerts (SMS / WhatsApp / Email)
      outboundResult = await dispatchSubscribersAlert({
        location,
        river: location.river || location.name,
        waterLevel: numWaterLevel,
        threshold: severity === 'Critical' ? critThresh : warnThresh,
        message: alertMsg
      });
    }
  }

  return {
    telemetry: telemetryEvent,
    alert: alertRecord,
    outbound: outboundResult,
    cooldownActive: severity !== 'Normal' && !alertRecord
  };
}

