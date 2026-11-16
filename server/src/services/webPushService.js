import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const webpush = require('web-push');
import { Subscriber } from '../models.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BOVS6VFRjGKPt9TXJQfpHpgh6TUGNmNXJTbc3zvkB_bsGj5MnzganSvmmHqoKuHTr3bM7BQ_Kchu8mC0KyrbRT4';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'dGWL78X5vq4gQMF0oauKtasAmdn0RhirJxrv6d8fPIE';
const VAPID_MAILTO = process.env.VAPID_MAILTO || 'mailto:admin@floodsense.ai';

webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export { VAPID_PUBLIC_KEY };

/**
 * Broadcast critical native web push evacuation alerts to all residents
 * whose registered PIN codes match the affected flood inundation zone.
 */
export async function broadcastWebPushByPinCodes({ pinCodes = [], title, body, alertId, river, waterLevel }) {
  const query = { isActive: true };
  if (pinCodes && pinCodes.length > 0) {
    query.pinCode = { $in: pinCodes };
  }

  const subscribers = await Subscriber.find(query);

  const payload = JSON.stringify({
    title: title || `CRITICAL FLOOD EVACUATION: ${river || 'River Basin'}`,
    body: body || `Water level reached ${waterLevel}m crossing danger mark. Evacuate low-lying zones immediately!`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: `flood-evac-${alertId || Date.now()}`,
    data: {
      alertId,
      river,
      waterLevel,
      url: '/'
    }
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    if (!sub.pushSubscription || !sub.pushSubscription.endpoint) continue;
    try {
      await webpush.sendNotification(sub.pushSubscription, payload);
      sent++;
      sub.lastNotifiedAt = new Date();
      await sub.save();
    } catch (err) {
      failed++;
      // If subscription expired or unsubscribed, disable subscriber
      if (err.statusCode === 410 || err.statusCode === 404) {
        sub.isActive = false;
        await sub.save();
      }
    }
  }

  return { totalMatched: subscribers.length, sent, failed, pinCodes };
}

