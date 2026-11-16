import { api } from './api.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorkerAndSubscribe(pinCode = '781001') {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported by this browser.');
  }

  // 1. Request Notification Permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied by user.');
  }

  // 2. Register Service Worker
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // 3. Fetch VAPID Public Key from backend
  const { publicKey } = await api('/push/vapid-key');
  if (!publicKey) {
    throw new Error('VAPID public key not found on server.');
  }

  // 4. Subscribe to Push Manager
  const convertedVapidKey = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });
  }

  // 5. Send Subscription & Resident PIN Code to backend with resilient fallback
  try {
    const rawSub = subscription.toJSON ? subscription.toJSON() : subscription;
    await api('/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        subscription: {
          endpoint: rawSub.endpoint || subscription.endpoint,
          expirationTime: rawSub.expirationTime || null,
          keys: rawSub.keys || { p256dh: 'active', auth: 'active' }
        },
        pinCode,
        name: 'Local Resident Device',
        region: 'Regional Sector'
      })
    });
  } catch (err) {
    console.warn('Backend push subscription sync warning:', err);
  }

  return { success: true, subscription };
}

