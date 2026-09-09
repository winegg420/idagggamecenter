// ============================================================
// HATA İZLEME (Sentry) — TAMAMEN İSTEĞE BAĞLI
//
// Kural: VITE_SENTRY_DSN boşsa Sentry HİÇ kurulmaz. Paket dinamik import ile
// yükleniyor, yani DSN yokken @sentry/react ağdan bile çekilmez — ayrı bir
// parça (chunk) olarak kalır. Konsola da hiçbir şey basılmaz; DSN'siz çalışmak
// bir hata değil, normal durumdur (şu an site böyle çalışıyor).
//
// GİZLİLİK: Bu oyunun açık bir vaadi var — "gerçek adın hiçbir zaman
// gösterilmez". Hata raporları bu vaadin kaçak yolu OLMAMALI:
//   • sendDefaultPii: false        → IP/çerez/kullanıcı bilgisi gönderilmez
//   • beforeSend içinde temizlik   → davet kodları ve e-posta benzeri
//                                    dizgiler olaydan silinir
// Davet kodu kişiye özeldir (profiles.davet_kodu) ve URL'de taşınır
// (?davet=XXXXXXXX); rapora sızarsa kim olduğu anlaşılabilir.
// ============================================================

const DSN = import.meta.env.VITE_SENTRY_DSN;

/** Sentry kuruldu mu? Kurulmadıysa hataBildir sessizce hiçbir şey yapmaz. */
let sentry = null;

// --- Temizlik (saf mantık; _test/hata-izleme-test.mjs bunu doğrudan sınar) ---

/** E-posta benzeri dizgiler. */
const EPOSTA = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// URL'deki davet kodu: ?davet=... , &davet=... ve metnin BAŞINDA davet=...
//
// Baştaki hâli şart: Sentry `request.query_string` alanını başında "?" OLMADAN
// gönderiyor ("davet=09RP84K3"). İlk sürümde yalnız [?&] aranıyordu ve kod
// tam da bu alandan sızıyordu — testte yakalandı.
const DAVET = /((?:^|[?&])davet=)[^&#\s]*/gi;

/** Tek bir metni temizler: davet kodu ve e-posta çıkarılır. */
export function temizleMetin(m) {
  if (typeof m !== "string" || !m) return m;
  return m.replace(DAVET, "$1[gizlendi]").replace(EPOSTA, "[e-posta]");
}

/** Nesne ağacındaki tüm string alanları temizler (derinlik sınırlı). */
function temizleDerin(nesne, derinlik = 0) {
  if (derinlik > 6 || nesne == null) return nesne;
  if (typeof nesne === "string") return temizleMetin(nesne);
  if (Array.isArray(nesne)) return nesne.map((x) => temizleDerin(x, derinlik + 1));
  if (typeof nesne === "object") {
    const cikti = {};
    for (const [k, v] of Object.entries(nesne)) cikti[k] = temizleDerin(v, derinlik + 1);
    return cikti;
  }
  return nesne;
}

/**
 * Sentry olayını göndermeden önce temizler.
 * Dışa açık ki test edilebilsin — Sentry'ye beforeSend olarak verilir.
 */
export function temizleOlay(olay) {
  if (!olay) return olay;

  // Kullanıcı kimliği taşınmasın: e-posta/IP asla, id bile gerekmiyor.
  if (olay.user) {
    delete olay.user.email;
    delete olay.user.ip_address;
    delete olay.user.username;
  }

  if (olay.request) {
    olay.request.url = temizleMetin(olay.request.url);
    if (olay.request.headers) olay.request.headers = temizleDerin(olay.request.headers);
    // Sorgu dizgisi ayrı alanda da gelebilir
    olay.request.query_string = temizleDerin(olay.request.query_string);
    delete olay.request.cookies;
  }

  if (olay.message) olay.message = temizleDerin(olay.message);
  if (olay.breadcrumbs) olay.breadcrumbs = temizleDerin(olay.breadcrumbs);
  if (olay.extra) olay.extra = temizleDerin(olay.extra);
  if (olay.exception?.values) olay.exception.values = temizleDerin(olay.exception.values);

  return olay;
}

// --- Kurulum ---------------------------------------------------------------

/**
 * DSN varsa Sentry'yi kurar. DSN yoksa hiçbir şey yapmaz (uyarı da basmaz).
 * main.jsx'ten ateşle-unut olarak çağrılır; başarısız olursa oyun etkilenmez.
 */
export async function hataIzlemeKur() {
  if (!DSN) return false;
  try {
    const S = await import("@sentry/react");
    S.init({
      dsn: DSN,
      // Kişisel veri gönderme (IP, çerez, başlıklar)
      sendDefaultPii: false,
      // Performans örneklemesi düşük: ücretsiz kota hızla dolmasın
      tracesSampleRate: 0.1,
      // Oturum tekrarı KAPALI: ekran kaydı gizlilik açısından en riskli veri
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeSend: temizleOlay,
      beforeSendTransaction: temizleOlay,
    });
    sentry = S;
    return true;
  } catch {
    // Sentry yüklenemezse oyun normal çalışmaya devam eder.
    return false;
  }
}

/**
 * Yakalanmış bir hatayı raporlar. Sentry kurulu değilse sessizce geçer.
 * HataSiniri buradan çağırır; bileşenin davranışı değişmez.
 */
export function hataBildir(hata, bilgi) {
  if (!sentry) return;
  try {
    sentry.captureException(hata, {
      contexts: bilgi?.componentStack
        ? { react: { componentStack: temizleMetin(String(bilgi.componentStack)) } }
        : undefined,
    });
  } catch {
    // Raporlama hatası kullanıcıya yansımaz.
  }
}
