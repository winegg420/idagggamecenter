// Quiz Square — Google Play satın alma doğrulama
//
// Akış: Android (TWA) istemcisi Digital Goods API + Payment Request ile satın
// alır, elindeki purchaseToken'ı buraya gönderir. Burada Play Developer API
// (purchases.products.get) ile makbuz DOĞRULANIR, sonra joker envantere işlenir.
//
// Gerekli secret:
//   PLAY_SERVICE_ACCOUNT  → Google Cloud servis hesabı JSON'u (tek satır)
//   PLAY_PACKAGE_NAME     → Android uygulama paketi (ör. com.idagg.bildim)
//
// PLAY_SERVICE_ACCOUNT yoksa fonksiyon AÇIK HATA döner; sahte onay VERMEZ.
//
// Çağrı: POST { urun_id, purchase_token }  + Authorization: Bearer <user JWT>
import { createClient } from "npm:@supabase/supabase-js@2";

const KOSE = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function yanit(govde: unknown, durum = 200) {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { ...KOSE, "Content-Type": "application/json" },
  });
}

// --- Servis hesabı JSON'undan Google erişim jetonu (JWT bearer akışı) ---
async function googleErisimJetonu(sa: { client_email: string; private_key: string }) {
  const simdi = Math.floor(Date.now() / 1000);
  const baslik = { alg: "RS256", typ: "JWT" };
  const iddia = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    exp: simdi + 3600,
    iat: simdi,
  };
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const govde = `${b64(baslik)}.${b64(iddia)}`;

  const pem = sa.private_key.replace(/\\n/g, "\n");
  const ham = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const ikili = Uint8Array.from(atob(ham), (c) => c.charCodeAt(0));
  const anahtar = await crypto.subtle.importKey(
    "pkcs8",
    ikili,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const imza = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    anahtar,
    new TextEncoder().encode(govde),
  );
  const imzaB64 = btoa(String.fromCharCode(...new Uint8Array(imza)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const cevap = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${govde}.${imzaB64}`,
    }),
  });
  if (!cevap.ok) {
    throw new Error("Google jetonu alınamadı: " + (await cevap.text()).slice(0, 200));
  }
  const veri = await cevap.json();
  return veri.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: KOSE });
  if (req.method !== "POST") return yanit({ hata: "Yalnızca POST" }, 405);

  try {
    const saHam = Deno.env.get("PLAY_SERVICE_ACCOUNT");
    const paket = Deno.env.get("PLAY_PACKAGE_NAME");
    if (!saHam || !paket) {
      // Sahte onay YOK: yapılandırma eksikse açıkça söyle.
      return yanit(
        {
          hata: "Satın alma doğrulaması yapılandırılmamış.",
          detay: "PLAY_SERVICE_ACCOUNT ve PLAY_PACKAGE_NAME secret'ları eksik.",
        },
        503,
      );
    }

    // --- Kullanıcıyı JWT'den çöz ---
    const yetki = req.headers.get("Authorization") ?? "";
    if (!yetki.startsWith("Bearer ")) return yanit({ hata: "Giriş gerekli" }, 401);

    const kullaniciDb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: yetki } } },
    );
    const { data: { user }, error: kimlikHata } = await kullaniciDb.auth.getUser();
    if (kimlikHata || !user) return yanit({ hata: "Geçersiz oturum" }, 401);

    const { urun_id, purchase_token } = await req.json();
    if (!urun_id || !purchase_token) {
      return yanit({ hata: "urun_id ve purchase_token zorunlu" }, 400);
    }

    // --- Play Developer API ile makbuzu doğrula ---
    const sa = JSON.parse(saHam);
    const jeton = await googleErisimJetonu(sa);
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(paket)}/purchases/products/` +
      `${encodeURIComponent(urun_id)}/tokens/${encodeURIComponent(purchase_token)}`;

    const playCevap = await fetch(url, { headers: { Authorization: `Bearer ${jeton}` } });
    if (!playCevap.ok) {
      return yanit(
        { hata: "Satın alma doğrulanamadı", detay: (await playCevap.text()).slice(0, 300) },
        402,
      );
    }
    const makbuz = await playCevap.json();

    // purchaseState: 0 = satın alındı, 1 = iptal, 2 = beklemede
    if (makbuz.purchaseState !== 0) {
      return yanit({ hata: "Satın alma tamamlanmamış", durum: makbuz.purchaseState }, 402);
    }
    // consumptionState: 0 = tüketilmedi (bizde tüketilebilir ürünler)
    if (makbuz.acknowledgementState === 0) {
      // Onaylama işlemi istemcide (Digital Goods API) yapılır; burada engel değil.
    }

    // --- Envantere işle (token tekrarı DB'de unique kısıtla reddedilir) ---
    const yonetimDb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Ürün hangi katalogda? Coin paketleri coin_satin_alma_isle'a, eski joker
    // paketleri mevcut satin_alma_isle'a gider. İkisi de service_role ile
    // çağrılır; hangi RPC'nin çalışacağına ÜRÜN KİMLİĞİ değil KATALOG karar
    // verir (istemci ürün türü uyduramasın).
    const { data: coinPaketi } = await yonetimDb
      .from("coin_paketleri")
      .select("urun_id")
      .eq("urun_id", urun_id)
      .eq("aktif", true)
      .maybeSingle();

    const { data, error } = coinPaketi
      ? await yonetimDb.rpc("coin_satin_alma_isle", {
        p_user: user.id,
        p_urun_id: urun_id,
        p_token: purchase_token,
      })
      : await yonetimDb.rpc("satin_alma_isle", {
        p_user: user.id,
        p_urun_id: urun_id,
        p_play_token: purchase_token,
      });
    if (error) {
      const zaten = /zaten işlendi|duplicate key/i.test(error.message);
      return yanit({ hata: error.message }, zaten ? 409 : 400);
    }

    return yanit({ tamam: true, sonuc: data });
  } catch (e) {
    return yanit({ hata: String(e instanceof Error ? e.message : e) }, 500);
  }
});
