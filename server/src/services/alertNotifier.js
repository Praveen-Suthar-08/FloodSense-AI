import { Subscriber, OutboundLog } from '../models.js';

/**
 * Outbound Alert Notification Service
 * Integrates MSG91 / Twilio for SMS, Interakt / WATI for WhatsApp, and Nodemailer/SES for Email.
 * Falls back gracefully to structured high-fidelity mock dispatch and database audit logging
 * when live credentials (e.g. TWILIO_AUTH_TOKEN, MSG91_AUTH_KEY) are not configured in .env.
 */

export async function sendSMS({ to, message, river, waterLevel, subscriberId }) {
  const msg91Auth = process.env.MSG91_AUTH_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  let provider = 'simulated';
  let status = 'sent';

  if (msg91Auth) {
    try {
      provider = 'msg91';
      // MSG91 Send SMS API
      const res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          'authkey': msg91Auth,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID || 'flood_alert_default',
          recipients: [{ mobiles: to, river, water_level: String(waterLevel) }]
        })
      });
      if (!res.ok) status = 'failed';
    } catch {
      status = 'failed';
    }
  } else if (twilioSid && twilioAuth && twilioFrom) {
    try {
      provider = 'twilio';
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const creds = Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const params = new URLSearchParams({ To: to, From: twilioFrom, Body: message });
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      if (!res.ok) status = 'failed';
    } catch {
      status = 'failed';
    }
  } else {
    // Audit-logged local simulation
    console.log(`[ALERT OUTBOUND SMS] -> Sent to ${to}: "${message}"`);
  }

  await OutboundLog.create({
    subscriberId,
    recipient: to,
    channel: 'sms',
    provider,
    status,
    message,
    river,
    waterLevel
  });

  return { channel: 'sms', provider, status, recipient: to };
}

export async function sendWhatsApp({ to, message, river, waterLevel, subscriberId }) {
  const watiToken = process.env.WATI_ACCESS_TOKEN;
  const watiEndpoint = process.env.WATI_API_ENDPOINT; // e.g. https://live-server-XXXX.wati.io
  const interaktKey = process.env.INTERAKT_API_KEY;

  let provider = 'simulated';
  let status = 'sent';

  if (watiToken && watiEndpoint) {
    try {
      provider = 'wati';
      const res = await fetch(`${watiEndpoint}/api/v1/sendTemplateMessage?whatsappNumber=${to}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${watiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          template_name: 'flood_evacuation_warning',
          parameters: [
            { name: 'river', value: river },
            { name: 'waterLevel', value: String(waterLevel) }
          ]
        })
      });
      if (!res.ok) status = 'failed';
    } catch {
      status = 'failed';
    }
  } else if (interaktKey) {
    try {
      provider = 'interakt';
      const res = await fetch('https://api.interakt.ai/v1/public/message/', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${interaktKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          countryCode: '+91',
          phoneNumber: to.replace(/^\+91/, ''),
          type: 'Template',
          template: {
            name: 'flood_alert_priority',
            params: [river, String(waterLevel)]
          }
        })
      });
      if (!res.ok) status = 'failed';
    } catch {
      status = 'failed';
    }
  } else {
    console.log(`[ALERT OUTBOUND WHATSAPP] -> Sent to ${to}: "${message}"`);
  }

  await OutboundLog.create({
    subscriberId,
    recipient: to,
    channel: 'whatsapp',
    provider,
    status,
    message,
    river,
    waterLevel
  });

  return { channel: 'whatsapp', provider, status, recipient: to };
}

export async function sendEmail({ to, subject, message, river, waterLevel, subscriberId }) {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  let provider = 'simulated';
  let status = 'sent';

  if (sendgridKey) {
    try {
      provider = 'sendgrid';
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.ALERT_FROM_EMAIL || 'alerts@floodsense.ai' },
          subject: subject || `CRITICAL FLOOD WARNING: ${river}`,
          content: [{ type: 'text/plain', value: message }]
        })
      });
      if (!res.ok) status = 'failed';
    } catch {
      status = 'failed';
    }
  } else {
    console.log(`[ALERT OUTBOUND EMAIL] -> Sent to ${to} (${subject}): "${message}"`);
  }

  await OutboundLog.create({
    subscriberId,
    recipient: to,
    channel: 'email',
    provider,
    status,
    message,
    river,
    waterLevel
  });

  return { channel: 'email', provider, status, recipient: to };
}

/**
 * Dispatch targeted flood alert notifications across all matching regional subscribers
 * with strict cooldown deduplication to prevent alert fatigue.
 */
export async function dispatchSubscribersAlert({ location, river, waterLevel, threshold, message }) {
  const riverKeywords = (river || location.river || location.name || '').toLowerCase().split(/[\s,]+/);
  const primaryRiver = riverKeywords[0] || 'river';

  // Search matching subscribers by region (e.g., "Brahmaputra Basin", "Assam", "Kamrup")
  const regex = new RegExp(primaryRiver, 'i');
  const subscribers = await Subscriber.find({
    isActive: true,
    $or: [
      { region: regex },
      { locationId: location._id }
    ]
  });

  const alertMsg = message || `CRITICAL: ${river || location.name} water level reached ${waterLevel}m (Threshold: ${threshold}m). Evacuate low-lying areas immediately.`;

  const results = [];
  const now = new Date();

  for (const sub of subscribers) {
    // 30 minute per-subscriber notification cooldown
    if (sub.lastNotifiedAt && (now.getTime() - new Date(sub.lastNotifiedAt).getTime()) < 30 * 60 * 1000) {
      continue;
    }

    if (sub.channel === 'sms' || sub.channel === 'all') {
      const res = await sendSMS({
        to: sub.phone,
        message: alertMsg,
        river: river || location.name,
        waterLevel,
        subscriberId: sub._id
      });
      results.push(res);
    }

    if (sub.channel === 'whatsapp' || sub.channel === 'all') {
      const res = await sendWhatsApp({
        to: sub.phone,
        message: alertMsg,
        river: river || location.name,
        waterLevel,
        subscriberId: sub._id
      });
      results.push(res);
    }

    if ((sub.channel === 'email' || sub.channel === 'all') && sub.email) {
      const res = await sendEmail({
        to: sub.email,
        subject: `CRITICAL FLOOD ALERT: ${river || location.name} Exceeded Danger Mark (${waterLevel}m)`,
        message: alertMsg,
        river: river || location.name,
        waterLevel,
        subscriberId: sub._id
      });
      results.push(res);
    }

    sub.lastNotifiedAt = now;
    await sub.save();
  }

  return { notifiedCount: results.length, totalSubscribers: subscribers.length, results };
}

