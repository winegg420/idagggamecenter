import { supabase } from "../../src/lib/supabase.js";

const VAPID_PUBLIC_KEY =
  "BMO4oFOLsEG16O6hkaSSNg68MMBQ9mEMfQXYcBzRlIQ5qixPCr3BnpRCcrJJcwYnRd53Ap26GKdhtcHYQf0eT_0";

function base64UrlToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const ham = atob(base64);
  return Uint8Array.from([...ham].map((c) => c.charCodeAt(0)));
}

export function pushDestekleniyor() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function pushDurumu() {
  if (!pushDestekleniyor()) return "desteklenmiyor";
  if (Notification.permission === "denied") return "engelli";
  const kayit = await navigator.serviceWorker.ready;
  const abone = await kayit.pushManager.getSubscription();
  return abone ? "acik" : "kapali";
}

export async function bildirimleriAc() {
  if (!pushDestekleniyor()) throw new Error("Bu tarayıcı bildirimleri desteklemiyor.");
  const izin = await Notification.requestPermission();
  if (izin !== "granted") throw new Error("Bildirim izni verilmedi.");
  const kayit = await navigator.serviceWorker.ready;
  let abone = await kayit.pushManager.getSubscription();
  if (!abone) {
    abone = await kayit.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const j = abone.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: abone.endpoint,
    p_p256dh: j.keys.p256dh,
    p_auth: j.keys.auth,
  });
  if (error) throw error;
}

export async function bildirimleriKapat() {
  const kayit = await navigator.serviceWorker.ready;
  const abone = await kayit.pushManager.getSubscription();
  if (abone) {
    await supabase.rpc("remove_push_subscription", { p_endpoint: abone.endpoint });
    await abone.unsubscribe();
  }
}
