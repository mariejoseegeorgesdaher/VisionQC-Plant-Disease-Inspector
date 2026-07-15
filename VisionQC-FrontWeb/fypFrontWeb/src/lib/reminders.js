import { apiRequest } from "./api";

const PUSH_WORKER_PATH = "/push-sw.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getPushPublicKey() {
  const payload = await apiRequest("/api/v1/push/public-key", {
    method: "GET",
  });

  const publicKey = payload?.publicKey || "";
  if (!publicKey) {
    throw new Error("Web push public key is unavailable.");
  }

  return publicKey;
}

export async function registerPushWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  return navigator.serviceWorker.register(PUSH_WORKER_PATH);
}

async function getReadyRegistration() {
  const registration = await registerPushWorker();
  if (registration) {
    return registration;
  }

  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    throw new Error("Service workers are not supported in this browser.");
  }

  return navigator.serviceWorker.ready;
}

export async function ensurePushSubscription() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("Notifications are not supported in this browser.");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notifications are blocked in this browser.");
  }

  const registration = await getReadyRegistration();
  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    await apiRequest("/api/v1/push/subscriptions", {
      method: "POST",
      body: JSON.stringify(existingSubscription.toJSON()),
    });

    return existingSubscription;
  }

  const publicKey = await getPushPublicKey();
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  await apiRequest("/api/v1/push/subscriptions", {
    method: "POST",
    body: JSON.stringify(subscription.toJSON()),
  });

  return subscription;
}

export async function enablePushReminder(scanId) {
  if (!scanId) {
    throw new Error("Scan id is required to enable the reminder.");
  }

  const reminderResponse = await apiRequest(`/api/v1/push/reminders/${scanId}/enable`, {
    method: "POST",
  });

  try {
    await ensurePushSubscription();
    return {
      ...reminderResponse,
      pushReady: true,
    };
  } catch (error) {
    return {
      ...reminderResponse,
      pushReady: false,
      pushError:
        error instanceof Error ? error.message : "Browser push notifications are unavailable.",
    };
  }
}

export async function fetchReminders() {
  const reminders = await apiRequest("/api/v1/push/reminders", {
    method: "GET",
  });

  if (!Array.isArray(reminders)) {
    return [];
  }

  return reminders.map((reminder) => ({
    id: reminder.id,
    scanId: reminder.scanId,
    alias: reminder.plantAlias || "Unknown plant",
    location: reminder.location || "",
    disease: reminder.disease || "Unknown disease",
    rescanReason: reminder.rescanReason || "",
    rescanDays: typeof reminder.rescanDays === "number" ? reminder.rescanDays : 0,
    scannedAt: reminder.scannedAt || "",
    dueAt: reminder.dueAt || "",
    enabledAt: reminder.enabledAt || "",
    sentAt: reminder.sentAt || "",
    isEnabled: reminder.isEnabled !== false,
    lastError: reminder.lastError || "",
    imageUrl: reminder.imageUrl || "",
  }));
}
