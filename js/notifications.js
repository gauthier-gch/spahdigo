// js/notifications.js
// Novu push notifications - free tier
// WARNING: In production, the API calls should go through a backend
// For a friend app, this is acceptable

const NOVU_APP_ID = "DB7UUwovxbQp";
const NOVU_API_KEY = "290cef21ae0e59b0cb3fb7ecddfe1110";

// ── Register this device with Novu ─────────────────────────────
export async function registerForNotifications(user) {
  if (!user) return;

  // Ask notification permission first
  if (!("Notification" in window)) {
    console.log("Notifications not supported");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.log("Notification permission denied");
    return;
  }

  // Register/update subscriber in Novu
  try {
    await fetch(`https://api.novu.co/v1/subscribers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `ApiKey ${NOVU_API_KEY}`
      },
      body: JSON.stringify({
        subscriberId: user.uid,
        firstName: user.displayName || "Utilisateur",
        email: user.email || ""
      })
    });
    console.log("Novu subscriber registered");
  } catch(e) {
    console.error("Novu registration error:", e);
  }

  // Register service worker for push
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      console.log("Service worker ready for push:", reg);
    } catch(e) {
      console.error("SW error:", e);
    }
  }
}

// ── Send a notification to a user ─────────────────────────────
export async function sendNotification(toUid, senderName, type = "message") {
  const workflowId = type === "message" ? "new-message" : "friend-request";
  try {
    const res = await fetch(`https://api.novu.co/v1/events/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `ApiKey ${NOVU_API_KEY}`
      },
      body: JSON.stringify({
        name: workflowId,
        to: { subscriberId: toUid },
        payload: { senderName }
      })
    });
    const data = await res.json();
    console.log("Notification sent:", data);
  } catch(e) {
    console.error("Notification error:", e);
  }
}
