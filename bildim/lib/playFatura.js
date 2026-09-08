// Google Play Billing — TWA içinde Digital Goods API + Payment Request API.
//
// NEDEN BU YOL: TWA (Trusted Web Activity) ile paketlenmiş web uygulamasında
// Play Billing'e erişimin desteklenen yolu Digital Goods API'dir. Bubblewrap ile
// paketlerken `--enablePlayBilling` bayrağı gerekir (bkz. PROGRESS.md).
//
// Tarayıcıda (Android uygulaması dışında) Digital Goods API yoktur; bu durumda
// `desteklenirMi()` false döner ve arayüz "Android uygulamasında satın alınabilir"
// der. BAŞKA ÖDEME SAĞLAYICI EKLENMEZ.
//
// Doğrulama daima sunucuda: satın alma sonrası purchaseToken Edge Function
// `satin_alma_dogrula`'ya gönderilir; joker envantere orada işlenir.

const PLAY_SERVICE = "https://play.google.com/billing";

export function desteklenirMi() {
  return (
    typeof window !== "undefined" &&
    "getDigitalGoodsService" in window &&
    typeof window.PaymentRequest === "function"
  );
}

async function servis() {
  if (!desteklenirMi()) throw new Error("Digital Goods API bu ortamda yok");
  return window.getDigitalGoodsService(PLAY_SERVICE);
}

/**
 * Play Console'daki fiyatları okur.
 * Dönüş: { [urun_id]: { fiyat: "₺29,99", ad, aciklama } }
 * Desteklenmiyorsa boş nesne döner (arayüz fiyat göstermez).
 */
export async function fiyatlariAl(urunKimlikleri) {
  try {
    const s = await servis();
    const detaylar = await s.getDetails(urunKimlikleri);
    const cikti = {};
    for (const d of detaylar ?? []) {
      const f = d.price;
      cikti[d.itemId] = {
        fiyat:
          f && f.value != null
            ? new Intl.NumberFormat("tr-TR", {
                style: "currency",
                currency: f.currency ?? "TRY",
              }).format(Number(f.value))
            : null,
        ad: d.title ?? null,
        aciklama: d.description ?? null,
      };
    }
    return cikti;
  } catch {
    return {};
  }
}

/**
 * Satın alma akışı. Başarılıysa { urun_id, purchase_token } döner.
 * Doğrulama YAPILMAZ — çağıran taraf Edge Function'a göndermelidir.
 */
export async function satinAl(urunId) {
  if (!desteklenirMi()) {
    throw new Error("Satın alma yalnızca Android uygulamasında yapılabilir.");
  }

  const istek = new window.PaymentRequest(
    [{ supportedMethods: PLAY_SERVICE, data: { sku: urunId } }],
    { total: { label: "Toplam", amount: { currency: "TRY", value: "0" } } }
  );

  const cevap = await istek.show();
  try {
    const jeton =
      cevap?.details?.purchaseToken ?? cevap?.details?.token ?? null;
    if (!jeton) throw new Error("Satın alma jetonu alınamadı");
    await cevap.complete("success");
    return { urun_id: urunId, purchase_token: jeton };
  } catch (e) {
    try {
      await cevap.complete("fail");
    } catch {
      /* yoksay */
    }
    throw e;
  }
}

/** Sunucuda işlendikten sonra ürünü tüketilebilir olarak işaretler. */
export async function tuket(jeton) {
  try {
    const s = await servis();
    if (s.consume) await s.consume(jeton);
  } catch {
    /* tüketim başarısızsa Play kendi kendine temizler */
  }
}
