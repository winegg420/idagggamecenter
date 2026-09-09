import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Ikon from "./Ikon.jsx";

const TIP_IKON = {
  mac_daveti: "⚔️",
  rovans: "⚔️",
  grup_daveti: "👥",
  hizli_daveti: "⚡",
  lige_girdin: "🏙️",
  gecildin: "⚡",
  hafta_sonuc: "🏆",
  arkadas_istek: "🤝",
  arkadas_kabul: "🎉",
  seri_hatirlatma: "🔥",
};

// Öncelik: meydan okuma > rozet/seviye > seri > sıra sende.
// (Bot maçlarında "sıra sende" artık hiç üretilmiyor — bkz. migration 075 —
//  ama gerçek rakiplerden gelenler de gerçek olayların üstüne çıkmasın.)
const ONCELIK = {
  mac_daveti: 0,
  rovans: 0,
  grup_daveti: 0,
  hizli_daveti: 0,
  arkadas_istek: 0,
  ustalik: 1,
  lige_girdin: 1,
  hafta_sonuc: 1,
  arkadas_kabul: 1,
  seri: 2,
  seri_hatirlatma: 2,
  sira_sende: 3,
  gecildin: 3,
};
const oncelikNo = (tip) => (tip in ONCELIK ? ONCELIK[tip] : 2);

const oncelikSirala = (liste) =>
  [...liste].sort((a, b) => {
    // Okunmamışlar her zaman üstte
    if (Boolean(a.okundu) !== Boolean(b.okundu)) return a.okundu ? 1 : -1;
    const fark = oncelikNo(a.tip) - oncelikNo(b.tip);
    if (fark !== 0) return fark;
    return new Date(b.created_at) - new Date(a.created_at);
  });

// Aynı türden birden fazla OKUNMAMIŞ bildirim varsa tek satırda toplanır.
const TOPLAMA = {
  sira_sende: { metin: (n) => `${n} maçta sıra sende ⏳`, yol: "/bildim/meydan" },
  mac_daveti: { metin: (n) => `${n} yeni meydan okuma ⚔️`, yol: "/bildim/meydan" },
  rovans: { metin: (n) => `${n} rövanş isteği ⚔️`, yol: "/bildim/meydan" },
  grup_daveti: { metin: (n) => `${n} grup maçı daveti 👥`, yol: "/bildim/meydan" },
  hizli_daveti: { metin: (n) => `${n} hızlı maç daveti ⚡`, yol: "/bildim/meydan" },
  seri: { metin: (n) => `${n} seri bildirimi 🔥`, yol: "/bildim" },
  arkadas_istek: { metin: (n) => `${n} arkadaşlık isteği 🤝`, yol: "/bildim/arkadaslar" },
};

/** Okunmamış tekrarları tek satıra indirger; okunmuşlara dokunmaz. */
function grupla(liste) {
  const sayac = new Map();
  for (const b of liste) {
    if (b.okundu || !TOPLAMA[b.tip]) continue;
    sayac.set(b.tip, (sayac.get(b.tip) ?? 0) + 1);
  }
  const toplanan = new Set([...sayac.entries()].filter(([, n]) => n > 1).map(([t]) => t));
  if (toplanan.size === 0) return liste;

  const sonuc = [];
  const yazildi = new Set();
  for (const b of liste) {
    if (!b.okundu && toplanan.has(b.tip)) {
      if (yazildi.has(b.tip)) continue;
      yazildi.add(b.tip);
      const n = sayac.get(b.tip);
      sonuc.push({
        ...b,
        id: `toplu-${b.tip}`,
        metin: TOPLAMA[b.tip].metin(n),
        yol: TOPLAMA[b.tip].yol,
        adet: n,
      });
      continue;
    }
    sonuc.push(b);
  }
  return sonuc;
}

function zamanMetni(iso) {
  const fark = Date.now() - new Date(iso).getTime();
  const dk = Math.floor(fark / 60000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} saat önce`;
  return `${Math.floor(saat / 24)} gün önce`;
}

/** Üst çubuktaki bildirim zili: okunmamış sayısı + açılır liste. */
export default function BildirimZili() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [acik, setAcik] = useState(false);
  const [liste, setListe] = useState([]);
  const [okunmamis, setOkunmamis] = useState(0);
  // Panel body'ye portallanır; konumu zil düğmesinin ekrandaki yerine göre hesaplanır.
  const zilRef = useRef(null);
  const [konum, setKonum] = useState(null);

  const yukle = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("bildirimler")
        .select("id, tip, metin, yol, okundu, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setListe(grupla(oncelikSirala(data ?? [])));
      setOkunmamis((data ?? []).filter((b) => !b.okundu).length);
    } catch {
      /* tablo henüz yok (migration bekliyor) veya ağ hatası — sessiz geç */
    }
  }, [user]);

  useEffect(() => {
    yukle();
    if (!user) return;
    const kanal = supabase
      .channel("bildirimlerim")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bildirimler",
          filter: `user_id=eq.${user.id}`,
        },
        yukle
      )
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [user, yukle]);

  // Panelin ekran konumunu zil düğmesine göre ölç (sticky/başlık bloğu panelin
  // yarısını kırpıyordu; artık panel body'ye taşınıp fixed konumlanıyor).
  const konumOlc = useCallback(() => {
    const el = zilRef.current;
    if (!el) return;
    try {
      const r = el.getBoundingClientRect();
      // Yalnız DİKEY konum ölçülür. Yatay yerleşim CSS'e bırakıldı: mobilde
      // panel iki kenardan 8px boşlukla gerilir, geniş ekranda sağa yaslanır.
      // (Zile göre sabit genişlik vermek dar ekranlarda paneli sola taşırıyordu.)
      setKonum({ ust: Math.max(8, r.bottom + 8) });
    } catch {
      setKonum({ ust: 64 });
    }
  }, []);

  useEffect(() => {
    if (!acik) return;
    konumOlc();
    window.addEventListener("resize", konumOlc);
    window.addEventListener("scroll", konumOlc, true);
    return () => {
      window.removeEventListener("resize", konumOlc);
      window.removeEventListener("scroll", konumOlc, true);
    };
  }, [acik, konumOlc]);

  const ac = async () => {
    const yeniDurum = !acik;
    if (yeniDurum) konumOlc();
    setAcik(yeniDurum);
    if (yeniDurum && okunmamis > 0) {
      try {
        await supabase.rpc("bildirimleri_oku");
        setOkunmamis(0);
        setListe((l) => l.map((b) => ({ ...b, okundu: true })));
      } catch {
        /* sessiz geç */
      }
    }
  };

  const panel = (
    <>
      <div className="bd-zil-ortu" onClick={() => setAcik(false)} />
      <div
        className="bd-zil-liste"
        role="dialog"
        aria-label="Bildirimler"
        style={konum ? { top: konum.ust } : undefined}
      >
        <div className="bd-zil-baslik">Bildirimler</div>
        {liste.length === 0 ? (
          <div className="bd-zil-bos">
            Henüz bildirim yok.<br />
            Maç davetleri, lig hareketleri ve arkadaşlık istekleri burada görünür.
          </div>
        ) : (
          liste.map((b) => (
            <button
              key={b.id}
              className="bd-zil-satir"
              onClick={() => {
                setAcik(false);
                if (b.yol) navigate(b.yol);
              }}
            >
              <span className="ikon" aria-hidden="true">{TIP_IKON[b.tip] ?? "🔔"}</span>
              <span className="govde">
                <span className="metin">{b.metin}</span>
                <span className="zaman">{zamanMetni(b.created_at)}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="bd-zil-sarmal" ref={zilRef}>
      <button
        className="bd-zil"
        onClick={ac}
        aria-label={`Bildirimler${okunmamis > 0 ? `, ${okunmamis} okunmamış` : ""}`}
      >
        <Ikon ad="zil" boyut={19} />
        {okunmamis > 0 && <span className="bd-zil-rozet">{okunmamis > 9 ? "9+" : okunmamis}</span>}
      </button>

      {acik && typeof document !== "undefined" && createPortal(panel, document.body)}
    </div>
  );
}
