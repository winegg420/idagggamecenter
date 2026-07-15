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
import { sahneCiz } from "../../engine/render.js";
import { macKanaliKur } from "../../net/kanal.js";
import { interpKur } from "../../net/interpolasyon.js";
import { kafaBul, KURGUSAL_KAFALAR, fotoKafalariYukle } from "../../shared/karakterler.js";
import { SAHA, AG, MAC } from "../../shared/sabitler.js";
import { TAKIM_RENK } from "../../engine/kafaCizim.js";

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

  // ---- Sonuç kapanışı ----
  const sonucuGoster = useCallback(
    async (skor, tur) => {
      if (bittiRef.current) return;
      bittiRef.current = true;
      const benimTakim = metaRef.current?.[slotRef.current]?.takim ?? 1;
      const kazanan = skor[0] > skor[1] ? 1 : skor[1] > skor[0] ? 2 : 0;
      let puanDegisim = null;

      if (!botMu && tur === "ranked") {
        // ELO sunucuda işlendi; kendi değişimimizi oku (kısa gecikmeyle dene).
        for (let deneme = 0; deneme < 4 && puanDegisim === null; deneme++) {
          try {
            await new Promise((r) => setTimeout(r, 700));
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
    [botMu, id, user?.id, profilYukle]
  );

  // Host: sonucu veritabanına yaz + herkese duyur.
  const hostSonucKaydet = useCallback(
    async (skor) => {
      try {
        const { error } = await supabase.rpc("kafatopu_sonuc_kaydet", {
          p_mac_id: id,
          p_skor1: skor[0],
          p_skor2: skor[1],
        });
        if (error) throw error;
      } catch (e) {
        console.error("KafaTopu sonuç kaydı hatası:", e);
      }
      kanalRef.current?.yayinla("bitti", { skor });
    },
    [id]
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

    const ciz = (view) => {
      const canvas = canvasRef.current;
      if (!canvas || !view) return;
      const ctx = canvas.getContext("2d");
      const olcek = canvas.width / SAHA.W;
      ctx.setTransform(olcek, 0, 0, olcek, 0, 0);
      ctx.clearRect(0, 0, SAHA.W, SAHA.H);
      sahneCiz(ctx, view, metaRef.current || [], view.t || performance.now());
    };

    const dongu = (simdi) => {
      if (!aktif) return;
      const dt = simdi - sonZaman;
      sonZaman = simdi;

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
        const view = anlikDurum(mac, false);
        hudGuncelle(view, slotRef.current);
        ciz(view);
      } else if (interpRef.current) {
        // --- Misafir: interpolasyonlu görünüm ---
        const view = interpRef.current.ornekle();
        if (view) {
          hudGuncelle(view, slotRef.current);
          ciz(view);
        }
        // Girdi yayını (20Hz)
        if (simdi - sonGirdiYayin >= AG.GIRDI_HZ_MS) {
          sonGirdiYayin = simdi;
          kanalRef.current?.yayinla("girdi", { slot: slotRef.current, g: girdi.oku() });
        }
      }
    };

    // --- Canvas boyutlandırma ---
    const boyutlandir = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const geniş = Math.min(canvas.parentElement.clientWidth, 1200);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = geniş * dpr;
      canvas.height = geniş * (SAHA.H / SAHA.W) * dpr;
      canvas.style.height = "auto";
    };
    window.addEventListener("resize", boyutlandir);

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
      const meta = [];
      for (let s = 0; s < sayi; s++) {
        const takim = s % 2 === 0 ? 1 : 2;
        if (s === 0) {
          meta.push({
            slot: 0, takim, kafa: benimKafa, yetenek: benimYetenek,
            ad: "Sen", userId: user.id, adminGuc: user.id === ADMIN_UUID,
          });
        } else {
          const rk = KURGUSAL_KAFALAR[s % KURGUSAL_KAFALAR.length];
          meta.push({
            slot: s, takim, kafa: rk.id, yetenek: rk.yetenek,
            ad: BOT_ADLAR[(s - 1) % BOT_ADLAR.length], userId: null, adminGuc: false,
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
            .select("id, username")
            .in("id", oyuncular.map((o) => o.user_id));
          for (const p of pr ?? []) adlar[p.id] = p.username;
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
            sonucuGoster(payload.skor, mac.tur);
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

    // Kopma sayacı (1 sn'de bir kontrol)
    const kopmaSayaci = setInterval(() => {
      if (!aktif || bittiRef.current || botMu) return;
      if (kopmaBaslangicRef.current) {
        const gecen = (Date.now() - kopmaBaslangicRef.current) / 1000;
        setKopuk(true);
        if (gecen >= MAC.RAKIP_KOPMA_SN) setBitirmeHakki(true);
      }
    }, 1000);

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
      clearInterval(kopmaSayaci);
      window.removeEventListener("resize", boyutlandir);
      girdi.yokEt();
      kanalRef.current?.kapat();
      kanalRef.current = null;
      macRef.current = null;
      interpRef.current = null;
      kopmaBaslangicRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tekrarAnahtari, user?.id]);

  // asama'yı ref'te tut (kanal callback'lerinde taze okumak için)
  const asamaRef = useRef(asama);
  useEffect(() => {
    asamaRef.current = asama;
  }, [asama]);

  // Rakip koptu → mevcut skorla maçı bitir (kalan herhangi bir oyuncu yapabilir).
  const kopukMaciBitir = async () => {
    const skor = sonSnapRef.current?.skor ?? [0, 0];
    const hicOynanmadi = !sonSnapRef.current;
    try {
      if (hicOynanmadi) {
        await supabase.rpc("kafatopu_mac_iptal", { p_mac_id: id });
        navigate("/kafatopu");
        return;
      }
      await supabase.rpc("kafatopu_sonuc_kaydet", {
        p_mac_id: id, p_skor1: skor[0], p_skor2: skor[1],
      });
    } catch (e) {
      console.error("KafaTopu kopuk maç kapatma hatası:", e);
    }
    kanalRef.current?.yayinla("bitti", { skor });
    sonucuGoster(skor, macBilgiRef.current?.tur);
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
                  navigate(`/kafatopu/mac/bot?mod=${botMod}&r=${Date.now()}`, { replace: true })
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
function DokunmatikKontroller({ girdiRef, yb }) {
  const [basili, setBasili] = useState({});
  const tut = (ad) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      girdiRef.current?.tusAyarla(ad, true);
      setBasili((b) => ({ ...b, [ad]: true }));
    },
    onPointerUp: () => {
      girdiRef.current?.tusAyarla(ad, false);
      setBasili((b) => ({ ...b, [ad]: false }));
    },
    onPointerCancel: () => {
      girdiRef.current?.tusAyarla(ad, false);
      setBasili((b) => ({ ...b, [ad]: false }));
    },
    onPointerLeave: () => {
      girdiRef.current?.tusAyarla(ad, false);
      setBasili((b) => ({ ...b, [ad]: false }));
    },
  });

  return (
    <div className="kt-dokunmatik">
      <button className={`kt-tus sol ${basili.sol ? "basili" : ""}`} {...tut("sol")}>◀</button>
      <button className={`kt-tus sag ${basili.sag ? "basili" : ""}`} {...tut("sag")}>▶</button>
      <button className={`kt-tus zipla ${basili.zipla ? "basili" : ""}`} {...tut("zipla")}>⬆</button>
      <button className={`kt-tus vur ${basili.vur ? "basili" : ""}`} {...tut("vur")}>⚽</button>
      <button className={`kt-tus guc ${basili.guc ? "basili" : ""}`} {...tut("guc")}>✨</button>
      <div className="kt-guc-bar">
        <div style={{ width: `${100 - Math.min(100, (yb / 15000) * 100)}%` }} />
      </div>
    </div>
  );
}
