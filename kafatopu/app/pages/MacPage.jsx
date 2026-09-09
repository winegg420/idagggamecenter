// ============================================================
// KAFA TOPU — maç ekranı.
// İki mod:
//  - /kafatopu/mac/bot?mod=1v1|2v2 → yerel antrenman (rakip/eş botlar)
//  - /kafatopu/mac/<uuid>          → online maç (Realtime, host-otoriter)
// Host (slot 0) simülasyonu çalıştırır ve 20Hz "durum" yayınlar;
// misafirler girdi yollar ve interpolasyonla render eder.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../../src/lib/supabase.js";
import { useKT } from "../KafaTopuApp.jsx";
import { macKur, macTick, girdiAyarla, anlikDurum } from "../../engine/oyun.js";
import { botDurumKur, botGirdiHesapla } from "../../engine/bot.js";
import { girdiKur, dokunmatikVarMi } from "../../engine/girdi.js";
import { sahneCiz, duzArkaplanAyarla, pisirikBosalt } from "../../engine/render.js";
import { macKanaliKur } from "../../net/kanal.js";
import { interpKur } from "../../net/interpolasyon.js";
import { kafaBul, KURGUSAL_KAFALAR, fotoKafalariYukle } from "../../shared/karakterler.js";
import { SAHA, AG, MAC, OYUNCU } from "../../shared/sabitler.js";
import { TAKIM_RENK, kafaOnbellegiBosalt } from "../../engine/kafaCizim.js";

// Geliştirici hesabı (migration'lardaki sabit UUID ile aynı) — maç içi
// admin gücü (yetenek soğuması ~0) host simülasyonunda buna göre açılır.
const ADMIN_UUID = "e4f6006f-d6bb-4ca8-be67-3bdf9efc9708";

const BOT_ADLAR = ["Robo", "Cıvata", "Piksel"];

export default function MacPage() {
  const { id } = useParams();
  const [arama] = useSearchParams();
  const navigate = useNavigate();
  const { user, profil, profilYukle } = useKT();

  const botMu = id === "bot";
  const botMod = arama.get("mod") === "2v2" ? "2v2" : "1v1";
  const tekrarAnahtari = arama.get("r") || "0";

  const [asama, setAsama] = useState("yukleniyor"); // yukleniyor|bekleme|oyun|sonuc|hata
  const [hataMesaj, setHataMesaj] = useState("");
  const [hud, setHud] = useState({ skor: [0, 0], saniye: MAC.SURE_SN, faz: "geri_sayim", geriSayim: 3, yb: 0 });
  const [golFlash, setGolFlash] = useState(0);
  const [sonuc, setSonuc] = useState(null); // { skor, kazanan, benimTakim, puanDegisim, tur }
  const [kopuk, setKopuk] = useState(false);
  const [bitirmeHakki, setBitirmeHakki] = useState(false);
  const [cikisOnay, setCikisOnay] = useState(false);

  const canvasRef = useRef(null);
  const macRef = useRef(null);          // host/bot simülasyonu
  const metaRef = useRef(null);         // [{slot,takim,kafa,yetenek,ad,userId,adminGuc,kafaKaydi}]
  const kanalRef = useRef(null);
  const interpRef = useRef(null);
  const girdiRef = useRef(null);
  const rafRef = useRef(0);
  const hostMuRef = useRef(false);
  const slotRef = useRef(0);
  const macBilgiRef = useRef(null);     // DB satırı (online)
  const sonSnapRef = useRef(null);
  const bittiRef = useRef(false);
  const kopmaBaslangicRef = useRef(0);
  const hudRef = useRef(hud);

  // ---- HUD'u sadece değişince güncelle (render maliyetini sınırla) ----
  const hudGuncelle = useCallback((snap, benimSlot) => {
    const yeni = {
      skor: snap.skor,
      saniye: Math.max(0, Math.ceil(snap.kalan / 1000)),
      faz: snap.faz,
      geriSayim: Math.max(0, Math.ceil((snap.fazSonu - snap.t) / 1000)),
      yb: snap.oy?.[benimSlot]?.yb ?? 0,
    };
    const eski = hudRef.current;
    if (
      eski.skor[0] !== yeni.skor[0] || eski.skor[1] !== yeni.skor[1] ||
      eski.saniye !== yeni.saniye || eski.faz !== yeni.faz ||
      eski.geriSayim !== yeni.geriSayim || Math.abs(eski.yb - yeni.yb) > 400
    ) {
      hudRef.current = yeni;
      setHud(yeni);
    }
  }, []);

  const olaylariIsle = useCallback((olaylar) => {
    for (const o of olaylar || []) {
      if (o.tip === "gol") {
        setGolFlash(o.takim);
        setTimeout(() => setGolFlash(0), 1400);
      }
    }
  }, []);

  // ---- Skor raporu (anti-cheat: her oyuncu kendi gördüğü skoru bildirir) ----
  // Sunucu iki takımdan uyuşan rapor gelmeden kesinleştirmez; 'onay_bekliyor'
  // dönerse (rakip henüz raporlamadı/koptu) aralıklarla yeniden denenir.
  const raporlaRef = useRef(false);
  const raporla = useCallback(
    async (skor) => {
      if (botMu || raporlaRef.current) return;
      raporlaRef.current = true;
      for (let deneme = 0; deneme < 12; deneme++) {
        try {
          const { data, error } = await supabase.rpc("kafatopu_sonuc_kaydet", {
            p_mac_id: id,
            p_skor1: skor[0],
            p_skor2: skor[1],
          });
          if (error) throw error;
          if (data === "bitti" || data === "iptal") return data;
        } catch (e) {
          console.error("KafaTopu skor raporu hatası:", e);
          return null;
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
      return null;
    },
    [botMu, id]
  );

  // ---- Sonuç kapanışı ----
  const sonucuGoster = useCallback(
    async (skor, tur) => {
      if (bittiRef.current) return;
      bittiRef.current = true;
      raporla(skor); // arka planda sürer; kesinleşme sunucuda
      const benimTakim = metaRef.current?.[slotRef.current]?.takim ?? 1;
      const kazanan = skor[0] > skor[1] ? 1 : skor[1] > skor[0] ? 2 : 0;
      let puanDegisim = null;

      if (!botMu && tur === "ranked") {
        // ELO sunucuda kesinleşince oku; iki taraflı onay mobil ağda birkaç
        // saniye sürebilir, o yüzden sabırlı poll.
        for (let deneme = 0; deneme < 8 && puanDegisim === null; deneme++) {
          try {
            await new Promise((r) => setTimeout(r, 900));
            const { data } = await supabase
              .from("kafatopu_mac_oyunculari")
              .select("puan_degisim, mac:kafatopu_maclar(durum)")
              .eq("mac_id", id)
              .eq("user_id", user.id)
              .single();
            if (data?.mac?.durum === "bitti") puanDegisim = data.puan_degisim;
          } catch (e) {
            console.error("KafaTopu puan değişimi okunamadı:", e);
            break;
          }
        }
        profilYukle?.();
      }
      setSonuc({ skor, kazanan, benimTakim, puanDegisim, tur });
      setAsama("sonuc");
    },
    [botMu, id, user?.id, profilYukle, raporla]
  );

  // Host: maç bitişini herkese duyur (skor kaydı raporla() ile herkesçe yapılır).
  const hostSonucKaydet = useCallback(
    (skor) => {
      kanalRef.current?.yayinla("bitti", { skor });
    },
    []
  );

  // ---- Kurulum ----
  useEffect(() => {
    let aktif = true;
    bittiRef.current = false;
    sonSnapRef.current = null;
    setSonuc(null);
    setAsama("yukleniyor");
    setKopuk(false);
    setBitirmeHakki(false);

    const girdi = girdiKur();
    girdiRef.current = girdi;

    const botDurumlari = new Map(); // slot → bot iç durumu

    // --- Ortak render döngüsü ---
    let sonZaman = performance.now();
    let sonYayin = 0;
    let sonGirdiYayin = 0;
    // Çizim ~60fps ile sınırlanır: 120Hz ProMotion iPhone'larda kare başına
    // tam sahne çizmek GPU'yu ikiye katlayıp ısınma/kısılma (kasma) yapıyordu.
    // 12ms eşiği: 120Hz'de her 2. kare çizilir, 60Hz'de her kare geçer.
    let sonCizim = 0;
    // ---- Uyarlanabilir kalite merdiveni (iPhone kasma düzeltmesi) ----
    // Ölçüt yalnız rAF hızı değil, ÇİZİM süresinin kendisi: 120Hz ProMotion
    // cihazlarda rAF 120'de kalıp çizim 16 ms'i aşabiliyor (rAF hızına bakan
    // eski ölçüt bunu göremiyordu). Adımlar en az görünür kayıptan başlar:
    //   1 → parallax kapalı (arka plan tek opak blit; 4 tam ekran işlem → 1)
    //   2,3 → çözünürlük %85 / %70
    const KALITE_ADIMI = [1, 1, 0.85, 0.7];
    let kaliteAdim = 0;
    let kalite = 1;
    let fpsKare = 0, fpsSure = 0, cizSure = 0, cizSayi = 0, kotuPencere = 0;
    let ctx = null;

    const kaliteDusur = () => {
      if (kaliteAdim >= KALITE_ADIMI.length - 1) return;
      kaliteAdim += 1;
      if (kaliteAdim >= 1) duzArkaplanAyarla(true);
      const yeni = KALITE_ADIMI[kaliteAdim];
      if (yeni !== kalite) {
        kalite = yeni;
        boyutlandir();
      }
    };

    const ciz = (view) => {
      const canvas = canvasRef.current;
      if (!canvas || !view) return;
      // Opak canvas: Safari/iOS'ta kompozit maliyetini ciddi düşürür.
      // Context bir kez alınıp saklanır (her karede getContext çağrılmaz).
      if (!ctx || ctx.canvas !== canvas) ctx = canvas.getContext("2d", { alpha: false });
      const t0 = performance.now();
      // Kaleler ekranın EN KENARINDA dursun: saha genişliğe tam oturtulur,
      // zemin alta sabitlenir. Ekran sahadan basıksa üstteki gökyüzü kırpılır
      // (fizik değişmez; top nadiren üstte kısa süre ekran dışına çıkabilir).
      const sc = canvas.width / SAHA.W;
      const ofY = canvas.height - SAHA.H * sc;
      ctx.setTransform(sc, 0, 0, sc, 0, ofY);
      // clearRect YOK: arka plan (pişirilmiş ya da doğrudan) her koşulda opak
      // olarak tüm ekranı kaplıyor — ayrı bir tam ekran temizleme işlemi
      // kare başına boşa gidiyordu.
      sahneCiz(ctx, view, metaRef.current || [], view.t || performance.now(), {
        sol: 0, sag: 0, ust: Math.max(0, ofY / sc), alt: 0,
      });
      cizSure += performance.now() - t0;
      cizSayi += 1;
    };

    // --- Misafir girdi gecikmesi maskeleme ---
    // Misafirin girdisi host'a gidip durumun geri gelmesi ~1 gidiş-dönüş sürer;
    // bu arada kafa "geç tepki veriyor" hissi verir. Kendi kafamıza yalnız GÖRSEL
    // bir yatay ofset uygulanır: tuşa basınca anında hareket başlar, host verisi
    // geldikçe ofset sönümlenerek erir (otorite host'ta kalır, sapma birikmez).
    let ongoruOfset = 0;
    const ongoruUygula = (view, g, dtMs) => {
      const kare = Math.min(4, dtMs / 16.67);
      const yon = (g.sag ? 1 : 0) - (g.sol ? 1 : 0);
      ongoruOfset += yon * OYUNCU.HIZ * kare;
      ongoruOfset *= Math.pow(0.94, kare); // ~120 ms'de yarıya iner
      const sinir = OYUNCU.KAFA_R * 1.1;
      ongoruOfset = Math.max(-sinir, Math.min(sinir, ongoruOfset));
      const ben = view.oy?.[slotRef.current];
      if (ben) ben.x += ongoruOfset;
    };

    const dongu = (simdi) => {
      if (!aktif) return;
      const dt = simdi - sonZaman;
      sonZaman = simdi;

      // Performans ölçümü (arka plan duraklamaları hariç): kare hızı + çizim
      // süresi. Tek kötü pencere (sekmeye dönüş vb.) kaliteyi düşürmesin diye
      // üst üste İKİ kötü pencere beklenir.
      if (dt > 0 && dt < 250) {
        fpsKare += 1;
        fpsSure += dt;
        if (fpsSure >= 1200) { // kısa pencere: kasma en fazla ~2.5 sn sürer
          const fps = (fpsKare * 1000) / fpsSure;
          const cizOrt = cizSayi ? cizSure / cizSayi : 0;
          fpsKare = 0; fpsSure = 0; cizSure = 0; cizSayi = 0;
          // 60 fps bütçesi 16.7 ms; çizim 11 ms'i aşarsa yer kalmıyor.
          // Kare hızı düşükken de ancak çizim payı anlamlıysa kalite verilir:
          // Düşük Güç Modu rAF'i 30Hz'e kilitler, orada kalite düşürmek boşa gider.
          if (cizOrt > 11 || (fps < 50 && cizOrt > 6)) {
            kotuPencere += 1;
            if (kotuPencere >= 2) {
              kotuPencere = 0;
              kaliteDusur();
            }
          } else {
            kotuPencere = 0;
          }
        }
      }

      const mac = macRef.current;

      if (mac) {
        // --- Host / bot simülasyonu ---
        girdiAyarla(mac, slotRef.current, girdi.oku());
        if (botMu) {
          for (const [slot, bd] of botDurumlari) {
            girdiAyarla(mac, slot, botGirdiHesapla(mac, slot, bd));
          }
        }
        macTick(mac, dt);

        // Ağ yayını + olay işleme (20Hz)
        if (simdi - sonYayin >= AG.DURUM_HZ_MS) {
          sonYayin = simdi;
          const snap = anlikDurum(mac, true);
          sonSnapRef.current = snap;
          olaylariIsle(snap.olaylar);
          if (!botMu) kanalRef.current?.yayinla("durum", snap);

          if (snap.faz === "bitti" && !bittiRef.current) {
            if (!botMu) hostSonucKaydet(snap.skor);
            sonucuGoster(snap.skor, botMu ? "hizli" : macBilgiRef.current?.tur);
          }
        }
        if (simdi - sonCizim >= 12) {
          sonCizim = simdi;
          const view = anlikDurum(mac, false);
          hudGuncelle(view, slotRef.current);
          ciz(view);
        }
      } else if (interpRef.current) {
        // --- Misafir: interpolasyonlu görünüm ---
        if (simdi - sonCizim >= 12) {
          const cizimDt = simdi - sonCizim;
          sonCizim = simdi;
          const view = interpRef.current.ornekle();
          if (view) {
            ongoruUygula(view, girdi.oku(), cizimDt);
            hudGuncelle(view, slotRef.current);
            ciz(view);
          }
        }
        // Girdi yayını (20Hz)
        if (simdi - sonGirdiYayin >= AG.GIRDI_HZ_MS) {
          sonGirdiYayin = simdi;
          kanalRef.current?.yayinla("girdi", { slot: slotRef.current, g: girdi.oku() });
        }
      }
    };

    // --- Canvas boyutlandırma: TÜM ekranı kapla ---
    // Saha çizim sırasında ortalanır, boşluklar sahneyle doldurulur;
    // böylece yatayda da dikeyde de siyah bant kalmaz.
    // visualViewport kullanılır (iOS adres çubuğu payı).
    const boyutlandir = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const vw = Math.max(200, Math.round(window.visualViewport?.width ?? window.innerWidth));
      const vh = Math.max(112, Math.round(window.visualViewport?.height ?? window.innerHeight));
      // Çözünürlük: dpr (en çok 2) × otomatik kalite; ayrıca toplam piksel
      // tavanı — büyük ekranlı telefon/tabletlerde GPU'yu boğmamak için.
      let dpr = Math.min(window.devicePixelRatio || 1, 2) * kalite;
      const TAVAN_PIKSEL = 1500000;
      if (vw * vh * dpr * dpr > TAVAN_PIKSEL) dpr = Math.sqrt(TAVAN_PIKSEL / (vw * vh));
      dpr = Math.max(0.85, dpr);
      const gw = Math.round(vw * dpr), gh = Math.round(vh * dpr);
      // iOS Safari, adres çubuğu/ekran klavyesi hareketinde visualViewport
      // resize'ı sürekli tetikler. canvas.width'e AYNI değeri atamak bile
      // arka tampon tahsisini sıfırlar (kare kaybı) — ölçü değişmediyse çık.
      if (
        canvas.width === gw && canvas.height === gh &&
        canvas.style.width === vw + "px" && canvas.style.height === vh + "px"
      ) return;
      canvas.style.width = vw + "px";
      canvas.style.height = vh + "px";
      canvas.width = gw;
      canvas.height = gh;
    };
    // Döndürme anında tarayıcılar bir süre ESKİ ölçüleri bildirir;
    // hemen + 300ms + 800ms sonra tekrar ölçülür.
    let boyutZamanlayicilar = [];
    const gecikmeliBoyutlandir = () => {
      boyutZamanlayicilar.forEach(clearTimeout);
      boyutlandir();
      boyutZamanlayicilar = [setTimeout(boyutlandir, 300), setTimeout(boyutlandir, 800)];
    };
    window.addEventListener("resize", gecikmeliBoyutlandir);
    window.addEventListener("orientationchange", gecikmeliBoyutlandir);
    window.visualViewport?.addEventListener("resize", gecikmeliBoyutlandir);
    document.addEventListener("fullscreenchange", gecikmeliBoyutlandir);
    document.addEventListener("webkitfullscreenchange", gecikmeliBoyutlandir);

    // --- Mobil GERÇEK tam ekran: tarayıcı çubuğu + sistem tuşları gizlenir ---
    // Tarayıcılar tam ekranı yalnızca kullanıcı hareketi sırasında verir;
    // bu yüzden maç ekranına İLK dokunuşta istenir, başarılınca yatay
    // kilit denenir (Android'de çalışır; iPhone Safari desteklemez —
    // orada tek yol uygulamayı ana ekrana eklemek).
    // iPhone Safari tam ekran API'sini (video dışında) HİÇ desteklemez.
    // Destek yoksa dinleyici bile bağlanmaz; yoksa her dokunuşta boşa
    // promise + orientation.lock denemesi yapılıyordu (oyun içi mikro takılma).
    const kokEl = document.documentElement;
    const tamEkranDestek = !!(kokEl.requestFullscreen || kokEl.webkitRequestFullscreen);
    const tamEkranIste = () => {
      // Safari webkit önekli fullscreenElement kullanır; kontrol edilmezse
      // HER dokunuşta yeniden tam ekran istenir (iPad/iPhone'da takılma +
      // yutulan tuş basışları). İki alanı da kontrol et.
      if (!dokunmatikVarMi() || document.fullscreenElement || document.webkitFullscreenElement) return;
      try {
        const istek = kokEl.requestFullscreen
          ? kokEl.requestFullscreen({ navigationUI: "hide" })
          : kokEl.webkitRequestFullscreen?.();
        Promise.resolve(istek)
          .then(() => {
            try { screen.orientation?.lock?.("landscape").catch(() => {}); } catch { /* desteklenmiyor */ }
          })
          .catch(() => {});
      } catch { /* desteklenmiyor — normal görünümde devam */ }
    };
    if (tamEkranDestek) {
      window.addEventListener("pointerdown", tamEkranIste);
      window.addEventListener("touchstart", tamEkranIste, { passive: true });
    }

    // --- Bot maçı kurulumu ---
    // Context'teki profil henüz yüklenmemiş olabilir (sayfa yenileme ile
    // doğrudan maça girilince); seçili kafayı sunucudan bekleyerek al.
    const botKur = async () => {
      let benimKafa = profil?.kafa ?? "volkan";
      let benimYetenek = profil?.yetenek ?? "ates_sutu";
      try {
        await fotoKafalariYukle();
        if (!profil) {
          const { data, error } = await supabase.rpc("kafatopu_profil_al");
          if (!error && data) {
            benimKafa = data.kafa;
            benimYetenek = data.yetenek;
          }
        }
      } catch (e) {
        console.error("KafaTopu bot maçı profil hatası:", e);
      }
      if (!aktif) return;
      const sayi = botMod === "2v2" ? 4 : 2;
      // Seçilen rakip kafa (?rakip=id); yoksa kurgusal roster'dan sırayla.
      const rakipId = arama.get("rakip");
      const meta = [];
      for (let s = 0; s < sayi; s++) {
        const takim = s % 2 === 0 ? 1 : 2;
        if (s === 0) {
          meta.push({
            slot: 0, takim, kafa: benimKafa, yetenek: benimYetenek,
            ad: "Sen", userId: user.id, adminGuc: user.id === ADMIN_UUID,
          });
        } else {
          const secilen = s === 1 && rakipId ? kafaBul(rakipId) : null;
          const rk = secilen ?? KURGUSAL_KAFALAR[s % KURGUSAL_KAFALAR.length];
          meta.push({
            slot: s, takim, kafa: rk.id,
            // Foto kafaların sabit yeteneği yok; bota rastgele bir güç ver.
            yetenek: rk.yetenek ?? KURGUSAL_KAFALAR[Math.floor(Math.random() * KURGUSAL_KAFALAR.length)].yetenek,
            ad: secilen ? rk.ad : BOT_ADLAR[(s - 1) % BOT_ADLAR.length],
            userId: null, adminGuc: false,
          });
          botDurumlari.set(s, botDurumKur());
        }
      }
      meta.forEach((m) => (m.kafaKaydi = kafaBul(m.kafa)));
      metaRef.current = meta;
      slotRef.current = 0;
      hostMuRef.current = true;
      macRef.current = macKur({ mod: botMod, meta });
      setAsama("oyun");
    };

    // --- Online maç kurulumu ---
    const onlineKur = async () => {
      try {
        // Foto kafa manifesti hazır olmadan kafaBul çağrılırsa foto kafalar
        // kurgusala düşer; önce manifesti bekle.
        await fotoKafalariYukle().catch(() => {});
        const [{ data: mac, error: e1 }, { data: oyuncular, error: e2 }] = await Promise.all([
          supabase.from("kafatopu_maclar").select("*").eq("id", id).single(),
          supabase.from("kafatopu_mac_oyunculari").select("*").eq("mac_id", id).order("slot"),
        ]);
        if (e1 || e2) throw e1 || e2;
        if (!aktif) return;
        if (!mac || !oyuncular?.length) throw new Error("Maç bulunamadı");
        macBilgiRef.current = mac;

        if (mac.durum === "iptal") {
          setHataMesaj("Bu maç iptal edilmiş.");
          setAsama("hata");
          return;
        }
        if (mac.durum === "bitti") {
          bittiRef.current = false;
          metaRef.current = oyuncular.map((o) => ({
            slot: o.slot, takim: o.takim, kafa: o.kafa, yetenek: o.yetenek,
            ad: "", userId: o.user_id, kafaKaydi: kafaBul(o.kafa),
          }));
          slotRef.current = oyuncular.find((o) => o.user_id === user.id)?.slot ?? 0;
          sonucuGoster([mac.skor1, mac.skor2], mac.tur);
          return;
        }

        const benimKayit = oyuncular.find((o) => o.user_id === user.id);
        if (!benimKayit) {
          setHataMesaj("Bu maçta değilsin.");
          setAsama("hata");
          return;
        }

        // Kullanıcı adları (FK auth.users'a olduğundan ayrı sorgu).
        let adlar = {};
        try {
          const { data: pr } = await supabase
            .from("profiles")
            .select("id, gorunen_ad")
            .in("id", oyuncular.map((o) => o.user_id));
          for (const p of pr ?? []) adlar[p.id] = p.gorunen_ad;
        } catch (e) {
          console.error("KafaTopu ad listesi hatası:", e);
        }

        const meta = oyuncular.map((o) => ({
          slot: o.slot, takim: o.takim, kafa: o.kafa, yetenek: o.yetenek,
          ad: adlar[o.user_id] ?? "Oyuncu", userId: o.user_id,
          adminGuc: o.user_id === ADMIN_UUID,
          kafaKaydi: kafaBul(o.kafa),
        }));
        metaRef.current = meta;
        slotRef.current = benimKayit.slot;
        hostMuRef.current = benimKayit.slot === 0;
        if (!hostMuRef.current) interpRef.current = interpKur();
        setAsama("bekleme");

        const beklenen = new Set(oyuncular.map((o) => o.user_id));
        let baslatildi = false;

        kanalRef.current = macKanaliKur(id, user.id, {
          onKatilim: (baglilar) => {
            if (!aktif) return;
            const hepsiBurada = [...beklenen].every((u) => baglilar.includes(u));
            // Host: herkes gelince simülasyonu başlat.
            if (hepsiBurada && hostMuRef.current && !baslatildi && !bittiRef.current) {
              baslatildi = true;
              macRef.current = macKur({ mod: mac.mod, meta });
              setAsama("oyun");
            }
            // Kopma takibi: beklenen biri yoksa sayaç başlar (beklemede
            // hiç gelmeyen rakip de, maç ortasında kopan da buna girer).
            const eksik = [...beklenen].some((u) => !baglilar.includes(u));
            if (eksik && !bittiRef.current) {
              if (!kopmaBaslangicRef.current) kopmaBaslangicRef.current = Date.now();
            } else {
              kopmaBaslangicRef.current = 0;
              setKopuk(false);
              setBitirmeHakki(false);
            }
          },
          onDurum: (snap) => {
            if (!aktif || hostMuRef.current) return;
            interpRef.current?.ekle(snap);
            olaylariIsle(snap.olaylar);
            sonSnapRef.current = snap;
            if (asamaRef.current !== "oyun" && !bittiRef.current) setAsama("oyun");
            if (snap.faz === "bitti") sonucuGoster(snap.skor, mac.tur);
          },
          onGirdi: (payload) => {
            if (!hostMuRef.current || !macRef.current) return;
            if (payload?.slot > 0) girdiAyarla(macRef.current, payload.slot, payload.g);
          },
          onBitti: (payload) => {
            if (!aktif || hostMuRef.current) return;
            // Host yayınının skoru kendi gördüğümüzle tutarlı mı? Kabul edilen
            // tek fark hükmen çekilme deseni; değilse KENDİ skorumuzu raporlarız
            // (uyuşmazlıkta sunucu maçı iptal eder, kimse ELO kazanamaz).
            const kendi = sonSnapRef.current?.skor ?? [0, 0];
            const p = Array.isArray(payload?.skor) ? payload.skor : kendi;
            const hukmen1 = p[1] === kendi[1] && p[0] === Math.max(3, kendi[0], kendi[1] + 1);
            const hukmen2 = p[0] === kendi[0] && p[1] === Math.max(3, kendi[1], kendi[0] + 1);
            const gecerli = (p[0] === kendi[0] && p[1] === kendi[1]) || hukmen1 || hukmen2;
            sonucuGoster(gecerli ? p : kendi, mac.tur);
          },
          onHata: () => {
            if (aktif && !bittiRef.current) setHataMesaj("Bağlantı sorunu — yeniden bağlanılıyor…");
          },
        });
      } catch (e) {
        console.error("KafaTopu maç kurulum hatası:", e);
        if (aktif) {
          setHataMesaj("Maç yüklenemedi.");
          setAsama("hata");
        }
      }
    };

    // Nabız: maç sürerken sunucuya canlılık kanıtı (anti-cheat — rakip
    // oyundayken tek taraflı skor kesinleştirilemez).
    const nabiz = setInterval(() => {
      if (!aktif || botMu || bittiRef.current) return;
      if (!macRef.current && !sonSnapRef.current) return; // maç henüz başlamadı
      supabase.rpc("kafatopu_nabiz", { p_mac_id: id }).then(
        () => {},
        (e) => console.error("KafaTopu nabız hatası:", e)
      );
    }, 10000);

    // Kopma sayacı (1 sn'de bir kontrol)
    const kopmaSayaci = setInterval(() => {
      if (!aktif || bittiRef.current || botMu) return;
      if (kopmaBaslangicRef.current) {
        const gecen = (Date.now() - kopmaBaslangicRef.current) / 1000;
        setKopuk(true);
        if (gecen >= MAC.RAKIP_KOPMA_SN) setBitirmeHakki(true);
      }
    }, 1000);

    // Mobil: maç sırasında ekran uykuya dalmasın (Wake Lock — destek yoksa
    // sessizce geçilir). Görünürlük geri gelince kilit yeniden alınır.
    let wakeLock = null;
    const kilitAl = async () => {
      try {
        wakeLock = await navigator.wakeLock?.request("screen");
      } catch { /* desteklenmiyor ya da izin yok — kritik değil */ }
    };
    kilitAl();

    // Uygulama arka plana geçince: takılı kalan tuşları bırak + kilidi tazele.
    const gorunurlukDegisti = () => {
      girdi.sifirla();
      if (document.visibilityState === "visible") kilitAl();
    };
    document.addEventListener("visibilitychange", gorunurlukDegisti);
    window.addEventListener("blur", gorunurlukDegisti);

    boyutlandir();
    if (botMu) botKur();
    else onlineKur();
    const rafDongu = (simdi) => {
      if (!aktif) return;
      rafRef.current = requestAnimationFrame(rafDongu);
      dongu(simdi);
    };
    rafRef.current = requestAnimationFrame(rafDongu);
    // Sekme arka plana alınınca rAF durur; host simülasyonu ve ağ yayını
    // donmasın diye interval yedeği devreye girer.
    const kalpAtisi = setInterval(() => {
      if (aktif && performance.now() - sonZaman > 300) dongu(performance.now());
    }, 200);

    return () => {
      aktif = false;
      cancelAnimationFrame(rafRef.current);
      clearInterval(kalpAtisi);
      clearInterval(nabiz);
      clearInterval(kopmaSayaci);
      window.removeEventListener("resize", gecikmeliBoyutlandir);
      window.removeEventListener("orientationchange", gecikmeliBoyutlandir);
      window.visualViewport?.removeEventListener("resize", gecikmeliBoyutlandir);
      document.removeEventListener("fullscreenchange", gecikmeliBoyutlandir);
      document.removeEventListener("webkitfullscreenchange", gecikmeliBoyutlandir);
      window.removeEventListener("pointerdown", tamEkranIste);
      window.removeEventListener("touchstart", tamEkranIste);
      boyutZamanlayicilar.forEach(clearTimeout);
      // Maçtan çıkınca tam ekrandan ve yatay kilitten çık (menü normal akar).
      try { screen.orientation?.unlock?.(); } catch { /* desteklenmiyor */ }
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      } else if (document.webkitFullscreenElement) {
        try { document.webkitExitFullscreen?.(); } catch { /* desteklenmiyor */ }
      }
      document.removeEventListener("visibilitychange", gorunurlukDegisti);
      window.removeEventListener("blur", gorunurlukDegisti);
      try { wakeLock?.release(); } catch { /* zaten bırakılmış */ }
      girdi.yokEt();
      kanalRef.current?.kapat();
      kanalRef.current = null;
      macRef.current = null;
      interpRef.current = null;
      kopmaBaslangicRef.current = 0;
      // Cihaz çözünürlüğündeki pişirilmiş tuvaller ~25 MB tutabiliyor;
      // maçtan çıkışta hemen bırak (iOS'ta bellek baskısı sekmeyi kastırıyor).
      // Sonraki maçta geri sayım sırasında yeniden pişer.
      pisirikBosalt();
      kafaOnbellegiBosalt();
      duzArkaplanAyarla(false); // kalite merdiveni her maçta baştan ölçülür
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tekrarAnahtari, user?.id]);

  // asama'yı ref'te tut (kanal callback'lerinde taze okumak için)
  const asamaRef = useRef(asama);
  useEffect(() => {
    asamaRef.current = asama;
  }, [asama]);

  // Rakip koptu → mevcut skorla maçı bitir. Kesinleşme sunucuda: rakibin
  // nabzı gerçekten kesilmişse ~15-25 sn içinde tek taraflı onaylanır
  // (raporla() arka planda denemeye devam eder).
  const kopukMaciBitir = async () => {
    const skor = sonSnapRef.current?.skor ?? [0, 0];
    const hicOynanmadi = !sonSnapRef.current;
    try {
      if (hicOynanmadi) {
        await supabase.rpc("kafatopu_mac_iptal", { p_mac_id: id });
        navigate("/kafatopu");
        return;
      }
    } catch (e) {
      console.error("KafaTopu kopuk maç kapatma hatası:", e);
    }
    kanalRef.current?.yayinla("bitti", { skor });
    sonucuGoster(skor, macBilgiRef.current?.tur);
  };

  // Maçtan çıkış: bot/bekleme = serbest; aktif online maç = hükmen mağlubiyet.
  const cikisYap = async () => {
    setCikisOnay(false);
    if (botMu) {
      navigate("/kafatopu");
      return;
    }
    try {
      if (!sonSnapRef.current || asama === "bekleme") {
        // Maç hiç oynanmadı: iptal, kimse puan kaybetmez.
        await supabase.rpc("kafatopu_mac_iptal", { p_mac_id: id });
      } else {
        // Hükmen: çekilen taraf kaybeder (rakip en az 3 ve önde olacak şekilde).
        // Rakip aynı hükmen skoru onaylayınca sunucu kesinleştirir.
        const skor = sonSnapRef.current.skor;
        const benTakim = metaRef.current?.[slotRef.current]?.takim ?? 1;
        let s1 = skor[0], s2 = skor[1];
        if (benTakim === 1) s2 = Math.max(3, s2, s1 + 1);
        else s1 = Math.max(3, s1, s2 + 1);
        kanalRef.current?.yayinla("bitti", { skor: [s1, s2] });
        raporla([s1, s2]); // arka planda onaya kadar dener
      }
    } catch (e) {
      console.error("KafaTopu maçtan çıkış hatası:", e);
    }
    navigate("/kafatopu");
  };

  const dokunmatik = dokunmatikVarMi();
  const meta = metaRef.current || [];
  const benimTakim = meta[slotRef.current]?.takim ?? 1;

  return (
    <div className="kt-mac-root">
      <div className="kt-canvas-sarici">
        <canvas ref={canvasRef} />

        {/* HUD: skor + süre */}
        <div className="kt-hud">
          <div className="kt-skor">
            <span className="k1">{hud.skor[0]}</span>
            <span className="sure">
              {Math.floor(hud.saniye / 60)}:{String(hud.saniye % 60).padStart(2, "0")}
            </span>
            <span className="k2">{hud.skor[1]}</span>
          </div>
        </div>
        {asama === "oyun" && (
          <div className="kt-yatay-ipucu">📱 Telefonu yan çevir — saha büyür</div>
        )}

        {/* Maçtan çıkış */}
        {asama !== "sonuc" && asama !== "hata" && (
          <button className="kt-cikis-btn" title="Maçtan çık" onClick={() => setCikisOnay(true)}>
            ✕
          </button>
        )}
        {cikisOnay && (
          <div className="kt-sonuc-panel" style={{ zIndex: 8 }}>
            <div style={{ fontSize: "2.2rem" }}>🚪</div>
            <div className="kt-sonuc-baslik" style={{ fontSize: "1.5rem" }}>Maçtan çıkılsın mı?</div>
            <div className="kt-alt-yazi" style={{ maxWidth: 320 }}>
              {botMu
                ? "Antrenman kaydedilmez, direkt menüye dönersin."
                : asama === "bekleme" || !sonSnapRef.current
                  ? "Maç başlamadığı için iptal edilir, kimse puan kaybetmez."
                  : "Çekilirsen hükmen mağlup sayılırsın (rakip kazanır)."}
            </div>
            <button className="kt-btn tehlike" onClick={cikisYap}>
              <span className="kt-btn-ikon">🚪</span><span>Evet, çık</span>
            </button>
            <button className="kt-btn" onClick={() => setCikisOnay(false)}>
              <span className="kt-btn-ikon">⚽</span><span>Devam et</span>
            </button>
          </div>
        )}

        <div className="kt-ust-bilgi">
          {botMu ? `🤖 Antrenman ${botMod}` : `${macBilgiRef.current?.tur === "ranked" ? "🏆 Ranked" : "⚡ Hızlı"} ${macBilgiRef.current?.mod ?? ""}`}
          {" · "}Sen: <b style={{ color: TAKIM_RENK[benimTakim]?.forma }}>{TAKIM_RENK[benimTakim]?.ad}</b>
        </div>

        {/* Orta mesajlar */}
        {asama === "yukleniyor" && (
          <div className="kt-orta-mesaj"><div className="kt-spinner" /></div>
        )}
        {asama === "bekleme" && (
          <div className="kt-orta-mesaj">
            <div className="kt-spinner" />
            <div style={{ fontWeight: 800 }}>Oyuncular bağlanıyor…</div>
            <div style={{ fontSize: ".85rem", opacity: 0.8 }}>
              {meta.map((m) => m.ad).join(" · ")}
            </div>
          </div>
        )}
        {asama === "oyun" && hud.faz === "geri_sayim" && hud.geriSayim > 0 && (
          <div className="kt-orta-mesaj">
            <div className="kt-geri-sayim">{hud.geriSayim}</div>
          </div>
        )}
        {/* Maç sonu yaklaşırken son 5 saniye ekranda sayılır */}
        {asama === "oyun" && hud.faz === "oyun" && hud.saniye <= 5 && hud.saniye > 0 && (
          <div className="kt-orta-mesaj">
            <div className="kt-geri-sayim son5">{hud.saniye}</div>
          </div>
        )}
        {golFlash > 0 && asama === "oyun" && (
          <div className="kt-orta-mesaj">
            <div className="kt-gol-yazi">GOOOL!</div>
            <div style={{ fontWeight: 800, color: TAKIM_RENK[golFlash]?.forma }}>
              {TAKIM_RENK[golFlash]?.ad} takım
            </div>
          </div>
        )}
        {asama === "hata" && (
          <div className="kt-sonuc-panel">
            <div style={{ fontSize: "2.4rem" }}>😵</div>
            <div>{hataMesaj}</div>
            <button className="kt-btn ikincil" onClick={() => navigate("/kafatopu")}>
              <span className="kt-btn-ikon">←</span><span>Menüye dön</span>
            </button>
          </div>
        )}

        {/* Kopma uyarısı */}
        {kopuk && asama !== "sonuc" && asama !== "hata" && (
          <div className="kt-orta-mesaj" style={{ justifyContent: "flex-end", paddingBottom: 20 }}>
            <div style={{ background: "rgba(140,40,20,.85)", padding: "8px 16px", borderRadius: 10, pointerEvents: "auto" }}>
              ⚠️ Bir oyuncunun bağlantısı koptu…
              {bitirmeHakki && (
                <button
                  className="kt-btn tehlike"
                  style={{ marginTop: 8, marginBottom: 0 }}
                  onClick={kopukMaciBitir}
                >
                  <span className="kt-btn-ikon">🏁</span>
                  <span>Maçı mevcut skorla bitir</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sonuç paneli */}
        {asama === "sonuc" && sonuc && (
          <div className="kt-sonuc-panel">
            <div style={{ fontSize: "3rem" }}>
              {sonuc.kazanan === 0 ? "🤝" : sonuc.kazanan === sonuc.benimTakim ? "🎉" : "😢"}
            </div>
            <div className="kt-sonuc-baslik">
              {sonuc.kazanan === 0
                ? "Berabere!"
                : sonuc.kazanan === sonuc.benimTakim
                  ? "Kazandın!"
                  : "Kaybettin"}
            </div>
            <div className="kt-skor" style={{ position: "static" }}>
              <span className="k1">{sonuc.skor[0]}</span>
              <span className="sure">-</span>
              <span className="k2">{sonuc.skor[1]}</span>
            </div>
            {sonuc.tur === "ranked" && sonuc.puanDegisim !== null && (
              <div className={`kt-puan-degisim ${sonuc.puanDegisim >= 0 ? "arti" : "eksi"}`}>
                {sonuc.puanDegisim >= 0 ? "+" : ""}
                {sonuc.puanDegisim} ELO puanı
              </div>
            )}
            {botMu && (
              <button
                className="kt-btn antrenman"
                onClick={() =>
                  navigate(
                    `/kafatopu/mac/bot?mod=${botMod}&r=${Date.now()}${arama.get("rakip") ? `&rakip=${arama.get("rakip")}` : ""}`,
                    { replace: true }
                  )
                }
              >
                <span className="kt-btn-ikon">🔄</span><span>Tekrar oyna</span>
              </button>
            )}
            <button className="kt-btn" onClick={() => navigate("/kafatopu")}>
              <span className="kt-btn-ikon">🏠</span><span>Menüye dön</span>
            </button>
          </div>
        )}

        {/* Dokunmatik kontroller */}
        {dokunmatik && asama === "oyun" && <DokunmatikKontroller girdiRef={girdiRef} yb={hud.yb} />}
        {/* Yetenek soğuma göstergesi (klavye için de) */}
        {asama === "oyun" && !dokunmatik && hud.yb > 0 && (
          <div className="kt-guc-bar" style={{ bottom: 14 }}>
            <div style={{ width: `${100 - Math.min(100, (hud.yb / 15000) * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

// Ekran üstü dokunmatik butonlar — girdi modülünün dokunma durumunu besler.
// iOS Safari'de bir tuş basılı tutulurken ikinci parmağın pointer olayları
// güvenilir gelmiyor (çoklu dokunuşta tuşlar "çalışmıyor" hissi); bu yüzden
// dokunuşlar native touch olaylarıyla (non-passive) işlenir. preventDefault,
// çift dokunuş zoom'unu, uzun basış büyütecini ve sentetik mouse'u da keser.
function DokunmatikKontroller({ girdiRef, yb }) {
  const [basili, setBasili] = useState({});
  const kokRef = useRef(null);

  useEffect(() => {
    const kok = kokRef.current;
    if (!kok) return;
    const dokunusTus = new Map(); // touch.identifier → tuş adı
    const ayarla = (ad, b) => {
      girdiRef.current?.tusAyarla(ad, b);
      setBasili((o) => (o[ad] === b ? o : { ...o, [ad]: b }));
    };
    const bas = (e) => {
      const ad = e.target?.closest?.("[data-tus]")?.dataset?.tus;
      if (!ad) return;
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        dokunusTus.set(e.changedTouches[i].identifier, ad);
      }
      ayarla(ad, true);
    };
    const birak = (e) => {
      let islendi = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const ad = dokunusTus.get(e.changedTouches[i].identifier);
        if (ad === undefined) continue;
        dokunusTus.delete(e.changedTouches[i].identifier);
        islendi = true;
        // Aynı tuşu başka bir parmak hâlâ basılı tutmuyorsa bırak
        if (![...dokunusTus.values()].includes(ad)) ayarla(ad, false);
      }
      if (islendi && e.cancelable) e.preventDefault();
    };
    kok.addEventListener("touchstart", bas, { passive: false });
    kok.addEventListener("touchend", birak, { passive: false });
    kok.addEventListener("touchcancel", birak, { passive: false });
    return () => {
      kok.removeEventListener("touchstart", bas);
      kok.removeEventListener("touchend", birak);
      kok.removeEventListener("touchcancel", birak);
    };
  }, [girdiRef]);

  // Masaüstü (mouse/kalem) için pointer olayları; dokunuşlar yukarıda işlenir.
  const tut = (ad) => ({
    // Uzun basışta bağlam menüsü / seçim açılmasın (mobil)
    onContextMenu: (e) => e.preventDefault(),
    onPointerDown: (e) => {
      if (e.pointerType === "touch") return;
      e.preventDefault();
      girdiRef.current?.tusAyarla(ad, true);
      setBasili((b) => ({ ...b, [ad]: true }));
    },
    onPointerUp: (e) => {
      if (e.pointerType === "touch") return;
      girdiRef.current?.tusAyarla(ad, false);
      setBasili((b) => ({ ...b, [ad]: false }));
    },
    onPointerCancel: (e) => {
      if (e.pointerType === "touch") return;
      girdiRef.current?.tusAyarla(ad, false);
      setBasili((b) => ({ ...b, [ad]: false }));
    },
    onPointerLeave: (e) => {
      if (e.pointerType === "touch") return;
      girdiRef.current?.tusAyarla(ad, false);
      setBasili((b) => ({ ...b, [ad]: false }));
    },
  });

  return (
    <div className="kt-dokunmatik" ref={kokRef}>
      <button data-tus="sol" className={`kt-tus sol ${basili.sol ? "basili" : ""}`} {...tut("sol")}>◀</button>
      <button data-tus="sag" className={`kt-tus sag ${basili.sag ? "basili" : ""}`} {...tut("sag")}>▶</button>
      <button data-tus="zipla" className={`kt-tus zipla ${basili.zipla ? "basili" : ""}`} {...tut("zipla")}>⬆</button>
      <button data-tus="vur" className={`kt-tus vur ${basili.vur ? "basili" : ""}`} {...tut("vur")}>⚽</button>
      {/* Soğuma ayrı bar yerine tuşun içinde sayılır (saha üstünde çizgi kalmasın) */}
      <button data-tus="guc" className={`kt-tus guc ${basili.guc ? "basili" : ""} ${yb > 0 ? "soguyor" : ""}`} {...tut("guc")}>
        {yb > 0 ? Math.ceil(yb / 1000) : "✨"}
      </button>
    </div>
  );
}
