// Quiz Square — push bildirim gönderici
// Çağıran: pg_net (cron / trigger), x-cron-secret ile doğrulanır.
// Gövde: { user_ids?: string[], baslik: string, govde: string, url?: string }
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("Yetkisiz", { status: 401 });
  }

  const { user_ids, baslik, govde, url } = await req.json();

  webpush.setVapidDetails(
    "mailto:idagureli@gmail.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let sorgu = db.from("push_subscriptions").select("*");
  if (Array.isArray(user_ids) && user_ids.length > 0) {
    sorgu = sorgu.in("user_id", user_ids);
  }
  const { data: abonelikler, error } = await sorgu;
  if (error) {
    return new Response(JSON.stringify({ hata: error.message }), { status: 500 });
  }

  let basarili = 0;
  let basarisiz = 0;

  await Promise.all(
    (abonelikler ?? []).map(async (abone) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: abone.endpoint,
            keys: { p256dh: abone.p256dh, auth: abone.auth },
          },
          JSON.stringify({ baslik, govde, url: url ?? "/" }),
        );
        basarili++;
      } catch (hata) {
        basarisiz++;
        const kod = (hata as { statusCode?: number })?.statusCode;
        if (kod === 404 || kod === 410) {
          // Ölü abonelik: temizle
          await db.from("push_subscriptions").delete().eq("endpoint", abone.endpoint);
        }
      }
    }),
  );

  return new Response(JSON.stringify({ basarili, basarisiz }), {
    headers: { "Content-Type": "application/json" },
  });
});
