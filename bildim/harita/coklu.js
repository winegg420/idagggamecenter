// ============================================================
// MEYDAN (The Square) — ÇOK OYUNCULU KATMAN
//
// Supabase Realtime, tek kanal: "meydan".
//   presence  → kim meydanda (track ile girilir, sync ile okunur)
//   broadcast → "poz" (konum, saniyede en fazla 8) ve "emoji"
//
// Veritabanına hiçbir şey yazılmaz; konum kalıcı değildir.
//
// Dayanıklılık kuralları:
//   • Kanal kopsa bile sahne çalışır — oyuncu tek başına dolaşır, üstte
//     "bağlantı yok" uyarısı çıkar (onDurum(false)).
//   • Sekme arka plana geçince konum yayını durur, dönünce sürer.
//   • Kanal düşerse artan aralıkla (3 → 15 sn) yeniden bağlanır.
//   • Tüm Supabase çağrıları try-catch içinde; hiçbiri sahneyi düşürmez.
// ============================================================

const POZ_ARALIK_MS = 100;      // saniyede en fazla 10 konum paketi
// Oyuncu dursa bile bu aralıkta bir "hâlâ buradayım" paketi gider: alıcı
// tarafta ara değerleme tamponu boşalmasın, son karede zıplama olmasın.
const POZ_CANLI_MS = 1000;
const EMOJI_ARALIK_MS = 2000;   // oyuncu başına 2 saniyede 1 emoji
// Dans 6 saniye oynuyor (bkz. danslar.js DANS_SURESI); yenisi ancak bittikten
// sonra başlatılabilsin ki kimse dansı sürekli baştan tetikleyip titretmesin.
const DANS_ARALIK_MS = 6500;
const YENIDEN_BAGLAN_MIN = 3000;
const YENIDEN_BAGLAN_MAX = 15000;

/**
 * @param {object} o
 * @param {import("@supabase/supabase-js").SupabaseClient} o.supabase
 * @param {{id:string, ad:string, renk:number, sac:number}} o.ben
 * @param {(id:string, bilgi:object) => void} o.onKatilim
 * @param {(id:string) => void} o.onAyrilma
 * @param {(id:string, poz:{x:number,z:number,y:number}) => void} o.onPoz
 * @param {(id:string, e:string) => void} o.onEmoji
 * @param {(id:string, kod:string) => void} o.onDans
 * @param {(id:string, gorunum:object|null) => void} o.onGorunum
 * @param {(bagli:boolean, sayi:number) => void} o.onDurum
 */
export function meydanBaglan(o) {
  const { supabase, ben } = o;
  let kanal = null;
  let kapandi = false;
  let bagli = false;
  let yenidenZamanlayici = null;
  let yenidenBekleme = YENIDEN_BAGLAN_MIN;

  // Presence'ta bildiğimiz kimlikler; sync geldiğinde farkı hesaplarız.
  const bilinen = new Set();

  // Konum yayını için son gönderilen değer + zaman
  let sonPoz = { x: NaN, z: NaN, y: NaN };
  let sonPozZamani = 0;
  // DİKKAT — başlangıç değeri 0 DEĞİL. Hız sınırı performance.now() ile
  // ölçülüyor ve o sayaç sayfa açılışında 0'dan başlıyor; 0 yazılırsa
  // "son gönderim sayfa açılışında oldu" sayılıyor ve oyuncunun İLK dansı
  // (6.5 sn) ile ilk emojisi (2 sn) sessizce yutuluyordu. Meydana girip
  // hemen dans düğmesine basan oyuncu "hiçbir şey olmuyor" diyordu.
  let sonEmojiZamani = -Infinity;
  let sonDansZamani = -Infinity;
  // Uzak oyuncuların emoji/dans hızı (kötü niyetli spam sahneyi boğmasın)
  const uzakEmojiZamani = new Map();
  const uzakDansZamani = new Map();

  function durumBildir(yeni) {
    bagli = yeni;
    let sayi = 0;
    try { sayi = kanal ? Object.keys(kanal.presenceState()).length : 0; } catch { sayi = 0; }
    try { o.onDurum?.(bagli, sayi); } catch (e) { console.error("[Meydan] onDurum:", e); }
  }

  function senkronla() {
    let state = {};
    try { state = kanal.presenceState(); } catch (e) { console.error("[Meydan] presenceState:", e); return; }
    const simdi = new Set(Object.keys(state));

    // Yeni gelenler
    for (const id of simdi) {
      if (id === ben.id || bilinen.has(id)) continue;
      const kayit = Array.isArray(state[id]) ? state[id][0] : null;
      if (!kayit) continue;
      bilinen.add(id);
      try { o.onKatilim?.(id, kayit); } catch (e) { console.error("[Meydan] onKatilim:", e); }
    }
    // Ayrılanlar
    for (const id of [...bilinen]) {
      if (simdi.has(id)) continue;
      bilinen.delete(id);
      uzakEmojiZamani.delete(id);
      try { o.onAyrilma?.(id); } catch (e) { console.error("[Meydan] onAyrilma:", e); }
    }
    durumBildir(true);
  }

  function yenidenBaglanmayiPlanla() {
    if (kapandi || yenidenZamanlayici) return;
    yenidenZamanlayici = setTimeout(() => {
      yenidenZamanlayici = null;
      yenidenBekleme = Math.min(YENIDEN_BAGLAN_MAX, yenidenBekleme * 1.6);
      kanalKur();
    }, yenidenBekleme);
  }

  function kanalKur() {
    if (kapandi) return;
    try {
      if (kanal) { try { supabase.removeChannel(kanal); } catch { /* zaten kapalı */ } kanal = null; }
      // Kanal yeniden kurulunca presence sıfırdan gelir; herkesi "yeni" say.
      for (const id of [...bilinen]) {
        bilinen.delete(id);
        try { o.onAyrilma?.(id); } catch { /* yut */ }
      }

      kanal = supabase.channel("meydan", { config: { presence: { key: ben.id } } });
      kanal
        .on("presence", { event: "sync" }, senkronla)
        .on("broadcast", { event: "poz" }, ({ payload }) => {
          if (!payload || payload.id === ben.id) return; // kendi mesajımız
          if (!bilinen.has(payload.id)) return;            // presence'ta olmayanı çizme
          try { o.onPoz?.(payload.id, payload); } catch (e) { console.error("[Meydan] onPoz:", e); }
        })
        .on("broadcast", { event: "gorunum" }, ({ payload }) => {
          // Oyuncu kıyafet değiştirdi: tek mesaj, avatar sahnede yenilenir.
          if (!payload || payload.id === ben.id) return;
          if (!bilinen.has(payload.id)) return;
          try { o.onGorunum?.(payload.id, payload.g ?? null); }
          catch (e) { console.error("[Meydan] onGorunum:", e); }
        })
        .on("broadcast", { event: "emoji" }, ({ payload }) => {
          if (!payload || payload.id === ben.id) return;
          if (!bilinen.has(payload.id)) return;
          const t = performance.now();
          if (t - (uzakEmojiZamani.get(payload.id) ?? -Infinity) < EMOJI_ARALIK_MS) return;
          uzakEmojiZamani.set(payload.id, t);
          try { o.onEmoji?.(payload.id, String(payload.e ?? "")); } catch (e) { console.error("[Meydan] onEmoji:", e); }
        })
        .on("broadcast", { event: "dans" }, ({ payload }) => {
          if (!payload || payload.id === ben.id) return;
          if (!bilinen.has(payload.id)) return;
          const t = performance.now();
          if (t - (uzakDansZamani.get(payload.id) ?? -Infinity) < DANS_ARALIK_MS) return;
          uzakDansZamani.set(payload.id, t);
          try { o.onDans?.(payload.id, String(payload.d ?? "")); }
          catch (e) { console.error("[Meydan] onDans:", e); }
        })
        .subscribe(async (durum) => {
          if (kapandi) return;
          if (durum === "SUBSCRIBED") {
            yenidenBekleme = YENIDEN_BAGLAN_MIN;
            try {
              // Görünüm presence yükünde BİR KEZ gider; kare kare değil.
              await kanal.track({
                id: ben.id, ad: ben.ad, renk: ben.renk, sac: ben.sac,
                gorunum: ben.gorunum ?? null,
              });
            } catch (e) {
              console.error("[Meydan] track:", e);
            }
            durumBildir(true);
            sonPoz = { x: NaN, z: NaN, y: NaN }; // ilk konum hemen gitsin
          } else if (durum === "CHANNEL_ERROR" || durum === "TIMED_OUT" || durum === "CLOSED") {
            console.warn("[Meydan] kanal dustu:", durum);
            durumBildir(false);
            yenidenBaglanmayiPlanla();
          }
        });
    } catch (e) {
      console.error("[Meydan] kanal kurulamadi:", e);
      durumBildir(false);
      yenidenBaglanmayiPlanla();
    }
  }

  // Sekme görünür olunca bekleyen konumu hemen gönder
  const gorunurluk = () => {
    if (document.visibilityState === "visible") sonPoz = { x: NaN, z: NaN, y: NaN };
  };
  document.addEventListener("visibilitychange", gorunurluk);

  kanalKur();

  return {
    /** Konum yayını — yalnız değiştiyse ve 125 ms geçtiyse gider. */
    pozGonder(x, z, y) {
      if (!bagli || !kanal || kapandi) return;
      if (document.hidden) return; // arka planda yayın yok
      const t = performance.now();
      if (t - sonPozZamani < POZ_ARALIK_MS) return;
      // DİKKAT: sonPoz "henüz gönderilmedi" anlamında NaN tutuluyor. NaN ile
      // yapılan her karşılaştırma false döner (Math.abs(x - NaN) > 0.01 →
      // false); bu yüzden "değişti mi" sorusundan ÖNCE ayrıca bakılmalı,
      // yoksa ilk paket hiç gitmez ve sonrakiler de hep "değişmedi" sayılır.
      const ilkPaket = !Number.isFinite(sonPoz.x);
      const degisti = ilkPaket ||
        Math.abs(x - sonPoz.x) > 0.01 || Math.abs(z - sonPoz.z) > 0.01 || Math.abs(y - sonPoz.y) > 0.02;
      // Durduğunda da saniyede bir paket: karşı taraftaki ara değerleme
      // tamponu kurumasın (kuruyunca son adım zıplama gibi görünüyordu).
      if (!degisti && t - sonPozZamani < POZ_CANLI_MS) return;
      sonPoz = { x, z, y }; sonPozZamani = t;
      try {
        kanal.send({
          type: "broadcast", event: "poz",
          // t: GÖNDEREN saatiyle damga. Alıcı varış zamanını kullanamaz —
          // ağ gecikmesindeki değişim hareketin kendisine karışır ve avatar
          // sıçrar (ölçüldü: varış damgasıyla hız sapması 16.0, gönderen
          // damgasıyla 0.4). Saatler farklı; alıcı farkı kendi kestiriyor.
          payload: { id: ben.id, x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(3), t },
        });
      } catch (e) { console.error("[Meydan] poz:", e); }
    },

    /**
     * Kıyafet değişimini duyurur — TEK MESAJ. Konum gibi kare kare gitmez.
     * Presence yükü de güncellenir ki sonradan gelenler doğru görsün.
     */
    async gorunumGonder(gorunum) {
      ben.gorunum = gorunum ?? null;
      if (!bagli || !kanal || kapandi) return;
      try {
        kanal.send({ type: "broadcast", event: "gorunum", payload: { id: ben.id, g: ben.gorunum } });
        await kanal.track({ id: ben.id, ad: ben.ad, renk: ben.renk, sac: ben.sac, gorunum: ben.gorunum });
      } catch (e) { console.error("[Meydan] gorunum:", e); }
    },

    /** Emoji yayını — 2 sn'de bir. Gönderildiyse true (yerel balon da o zaman çıkar). */
    emojiGonder(e) {
      const t = performance.now();
      if (t - sonEmojiZamani < EMOJI_ARALIK_MS) return false;
      sonEmojiZamani = t;
      if (bagli && kanal && !kapandi) {
        try { kanal.send({ type: "broadcast", event: "emoji", payload: { id: ben.id, e } }); }
        catch (err) { console.error("[Meydan] emoji:", err); }
      }
      return true; // bağlantı yokken de kendi balonu görsün
    },

    /** Dans yayını — 6.5 sn'de bir. Gönderildiyse true (kendi avatarı da oynar). */
    dansGonder(kod) {
      const t = performance.now();
      if (t - sonDansZamani < DANS_ARALIK_MS) return false;
      sonDansZamani = t;
      if (bagli && kanal && !kapandi) {
        try { kanal.send({ type: "broadcast", event: "dans", payload: { id: ben.id, d: kod } }); }
        catch (err) { console.error("[Meydan] dans:", err); }
      }
      return true;   // bağlantı yokken de kendi avatarı dans etsin
    },

    get bagli() { return bagli; },

    kapat() {
      kapandi = true;
      document.removeEventListener("visibilitychange", gorunurluk);
      if (yenidenZamanlayici) { clearTimeout(yenidenZamanlayici); yenidenZamanlayici = null; }
      if (kanal) {
        try { kanal.untrack(); } catch { /* zaten kopmuş */ }
        try { supabase.removeChannel(kanal); } catch (e) { console.error("[Meydan] removeChannel:", e); }
        kanal = null;
      }
      bilinen.clear();
      uzakEmojiZamani.clear();
      uzakDansZamani.clear();
    },
  };
}
