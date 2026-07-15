// ============================================================
// KAFA TOPU — oyun ana ekranı.
// Panel değil sahne: arkada canlı plaj sahnesi, senin karakterin topla
// sektirme yapar. Üstte lig/kısayollar, ortada logo, altta büyük oyun
// butonları. Oda kurma / kodla katılma / davet banner'ı buradadır.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../../src/lib/supabase.js";
import { useKT } from "../KafaTopuApp.jsx";
import { ligBul } from "../../shared/ligler.js";
import { kafaBul } from "../../shared/karakterler.js";
import { sahneCiz } from "../../engine/render.js";
import { SAHA, OYUNCU, TOP } from "../../shared/sabitler.js";

export default function MenuPage() {
  const { profil, adminMi, user } = useKT();
  const navigate = useNavigate();
  const lig = ligBul(profil?.puan ?? 1000);

  const [modal, setModal] = useState(null); // null | 'oyna' | 'oda' | 'katil'
  const [katilKod, setKatilKod] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [davetler, setDavetler] = useState([]);
  const canvasRef = useRef(null);

  // ---------- Canlı arka plan sahnesi: karakter top sektirir ----------
  useEffect(() => {
    let aktif = true;
    const zeminY = SAHA.ZEMIN_Y;
    const oyuncu = { x: 430, y: zeminY - OYUNCU.KAFA_R, vx: 0, vy: 0, va: -9999, ol: 1, ef: 0 };
    const top = { x: 430, y: 140, vx: 0.6, vy: 0, a: 0 };
    let simMs = 0;

    const dongu = () => {
      if (!aktif) return;
      requestAnimationFrame(dongu);
      simMs += 16.7;

      // Top: hafif yerçekimi + kafadan sekme (basit gösteri fiziği)
      top.vy += 0.32;
      top.x += top.vx;
      top.y += top.vy;
      top.a += top.vx * 0.04;
      if (top.x < 60 || top.x > SAHA.W - 60) top.vx *= -1;
      const kafaUst = oyuncu.y - OYUNCU.KAFA_R;
      if (top.y > kafaUst - TOP.R && Math.abs(top.x - oyuncu.x) < OYUNCU.KAFA_R + TOP.R && top.vy > 0) {
        top.vy = -9.5 - Math.random() * 1.5;
        top.vx = (Math.random() - 0.5) * 4;
        oyuncu.va = simMs; // vuruş animasyonu
      }
      if (top.y > zeminY - TOP.R) { // yere düşerse geri fırlat
        top.y = zeminY - TOP.R;
        top.vy = -10;
      }
      // Karakter topu tembelce takip eder
      oyuncu.vx = Math.max(-3.4, Math.min(3.4, (top.x - oyuncu.x) * 0.03));
      oyuncu.x = Math.max(80, Math.min(SAHA.W - 80, oyuncu.x + oyuncu.vx));

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const olcek = canvas.width / SAHA.W;
        ctx.setTransform(olcek, 0, 0, olcek, 0, 0);
        ctx.clearRect(0, 0, SAHA.W, SAHA.H);
        sahneCiz(
          ctx,
          { t: simMs, faz: "menu", skor: [0, 0], top, oy: [oyuncu], gucler: [] },
          [{ takim: 1, kafaKaydi: kafaBul(profil?.kafa ?? "volkan") }],
          simMs
        );
      }
    };

    const boyutlandir = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientWidth * (SAHA.H / SAHA.W) * dpr;
    };
    boyutlandir();
    window.addEventListener("resize", boyutlandir);
    const raf = requestAnimationFrame(dongu);
    return () => {
      aktif = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", boyutlandir);
    };
  }, [profil?.kafa]);

  // ---------- Bekleyen oda davetleri ----------
  const davetleriYukle = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("kafatopu_davetlerim");
      if (!error) setDavetler(data ?? []);
    } catch (e) {
      console.error("KafaTopu davet listesi hatası:", e);
    }
  }, []);

  useEffect(() => {
    davetleriYukle();
    const poll = setInterval(davetleriYukle, 8000);
    return () => clearInterval(poll);
  }, [davetleriYukle]);

  const davetYanitla = async (davet, kabul) => {
    try {
      const { data, error } = await supabase.rpc("kafatopu_davet_yanitla", {
        p_davet: davet.davet_id,
        p_kabul: kabul,
      });
      if (error) throw error;
      if (kabul && data?.[0]) navigate(`/kafatopu/oda/${data[0].kod}`);
      else davetleriYukle();
    } catch (e) {
      console.error("KafaTopu davet yanıtı hatası:", e);
      setMesaj("Davete katılınamadı — oda kapanmış olabilir.");
      davetleriYukle();
    }
  };

  // ---------- Oda kur / katıl ----------
  const odaKur = async (mod) => {
    try {
      const { data, error } = await supabase.rpc("kafatopu_oda_kur", { p_mod: mod });
      if (error) throw error;
      if (data?.[0]) navigate(`/kafatopu/oda/${data[0].kod}`);
    } catch (e) {
      console.error("KafaTopu oda kurma hatası:", e);
      setMesaj("Oda kurulamadı. (Veritabanı migration'ı eksik olabilir.)");
      setModal(null);
    }
  };

  const odayaKatil = async () => {
    if (!katilKod.trim()) return;
    try {
      const { data, error } = await supabase.rpc("kafatopu_odaya_katil", {
        p_kod: katilKod.trim(),
      });
      if (error) throw error;
      if (data?.[0]) navigate(`/kafatopu/oda/${data[0].kod}`);
    } catch (e) {
      console.error("KafaTopu odaya katılma hatası:", e);
      setMesaj("Oda bulunamadı — kodu kontrol et.");
      setModal(null);
    }
  };

  return (
    <div className="kt-menu-root">
      <canvas ref={canvasRef} className="kt-menu-sahne" />
      <div className="kt-menu-karartma" />

      {/* Üst şerit: lig + kısayollar */}
      <div className="kt-menu-ust">
        <span className="kt-lig-rozet" style={{ color: lig.renk }}>
          {lig.ikon} {lig.ad} · {profil?.puan ?? "…"}
        </span>
        <span className="kt-menu-ust-sag">
          <button className="kt-ikon-btn" title="Sıralama" onClick={() => navigate("/kafatopu/siralama")}>📊</button>
          <button className="kt-ikon-btn" title="Karakter" onClick={() => navigate("/kafatopu/karakter")}>🧑‍🎤</button>
          {adminMi && (
            <button className="kt-ikon-btn" title="Admin" onClick={() => navigate("/kafatopu/admin")}>👑</button>
          )}
        </span>
      </div>

      {/* Logo */}
      <div className="kt-menu-logo">
        <span className="kt-menu-logo-top">⚽</span> KAFA TOPU
        <div className="kt-menu-logo-alt">Club Afrodit Arena</div>
      </div>

      {/* Davet banner'ları */}
      {davetler.length > 0 && (
        <div className="kt-davet-kutusu">
          {davetler.map((d) => (
            <div key={d.davet_id} className="kt-davet-satir">
              <span>
                🎟 <b>{d.gonderen_ad}</b> seni {d.mod} odasına davet etti
              </span>
              <button className="kt-mini-btn kabul" onClick={() => davetYanitla(d, true)}>Katıl</button>
              <button className="kt-mini-btn" onClick={() => davetYanitla(d, false)}>✕</button>
            </div>
          ))}
        </div>
      )}
      {mesaj && (
        <div className="kt-davet-kutusu" onClick={() => setMesaj("")}>
          <div className="kt-davet-satir">{mesaj}</div>
        </div>
      )}

      {/* Alt buton paneli */}
      <div className="kt-menu-alt">
        <button className="kt-arcade-btn oyna" onClick={() => setModal("oyna")}>
          ▶ OYNA
        </button>
        <div className="kt-arcade-sira">
          <button className="kt-arcade-btn kucuk oda" onClick={() => setModal("oda")}>
            🏟 ODA KUR
          </button>
          <button className="kt-arcade-btn kucuk katil" onClick={() => setModal("katil")}>
            🔑 KODLA KATIL
          </button>
        </div>
        <Link to="/" className="kt-menu-geri">← Bildim!'e dön</Link>
      </div>

      {/* ---------- Modallar ---------- */}
      {modal === "oyna" && (
        <Modal baslik="Maç Türü Seç" kapat={() => setModal(null)}>
          <button className="kt-btn ranked" onClick={() => navigate("/kafatopu/kuyruk/1v1/ranked")}>
            <span className="kt-btn-ikon">🏆</span>
            <span>Ranked 1v1<span className="kt-btn-detay">ELO puanı için</span></span>
          </button>
          <button className="kt-btn ranked" onClick={() => navigate("/kafatopu/kuyruk/2v2/ranked")}>
            <span className="kt-btn-ikon">🏆</span>
            <span>Ranked 2v2<span className="kt-btn-detay">Takım halinde puanlı</span></span>
          </button>
          <button className="kt-btn hizli" onClick={() => navigate("/kafatopu/kuyruk/1v1/hizli")}>
            <span className="kt-btn-ikon">⚡</span>
            <span>Hızlı Maç 1v1<span className="kt-btn-detay">Puan etkilenmez</span></span>
          </button>
          <button className="kt-btn hizli" onClick={() => navigate("/kafatopu/kuyruk/2v2/hizli")}>
            <span className="kt-btn-ikon">⚡</span>
            <span>Hızlı Maç 2v2<span className="kt-btn-detay">2'ye 2 kapışma</span></span>
          </button>
          <button className="kt-btn antrenman" onClick={() => navigate("/kafatopu/mac/bot?mod=1v1")}>
            <span className="kt-btn-ikon">🤖</span>
            <span>Antrenman<span className="kt-btn-detay">Bota karşı çevrimdışı</span></span>
          </button>
        </Modal>
      )}

      {modal === "oda" && (
        <Modal baslik="Oda Kur" kapat={() => setModal(null)}>
          <div className="kt-alt-yazi" style={{ marginBottom: 10 }}>
            Arkadaşlarınla özel maç — kod paylaş ya da oyun içinden davet et.
            Puan etkilenmez.
          </div>
          <button className="kt-btn oda-btn" onClick={() => odaKur("1v1")}>
            <span className="kt-btn-ikon">🥊</span>
            <span>1v1 Odası<span className="kt-btn-detay">Sen + 1 arkadaş</span></span>
          </button>
          <button className="kt-btn oda-btn" onClick={() => odaKur("2v2")}>
            <span className="kt-btn-ikon">👥</span>
            <span>2v2 Odası<span className="kt-btn-detay">4 kişilik takım maçı</span></span>
          </button>
        </Modal>
      )}

      {modal === "katil" && (
        <Modal baslik="Kodla Katıl" kapat={() => setModal(null)}>
          <div className="kt-alt-yazi" style={{ marginBottom: 10 }}>
            Arkadaşının paylaştığı 6 haneli oda kodunu gir.
          </div>
          <div className="kt-form-satir">
            <input
              autoFocus
              maxLength={6}
              placeholder="ÖRN: K7X2MA"
              value={katilKod}
              onChange={(e) => setKatilKod(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && odayaKatil()}
              style={{ textAlign: "center", fontSize: "1.3rem", letterSpacing: 4, fontWeight: 800 }}
            />
          </div>
          <button className="kt-btn" onClick={odayaKatil}>
            <span className="kt-btn-ikon">🔑</span>
            <span>Odaya Gir</span>
          </button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ baslik, kapat, children }) {
  return (
    <div className="kt-modal-fon" onClick={kapat}>
      <div className="kt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kt-modal-baslik">
          <span>{baslik}</span>
          <button className="kt-ikon-btn" onClick={kapat}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
