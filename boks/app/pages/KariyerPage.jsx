// ============================================================
// GÖLGE BOKS — Kariyer sayfası (kalıcı dövüşçü profili)
// Tüm geçmiş roundlar birleştirilerek stil kimliği, tekrarlayan açıklar,
// gelişim trendi, profesyonel dövüşçü eşleşmesi, rozetler ve günlük seri.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBoks } from "../BoksApp.jsx";
import { kariyerGetir, kariyerOnbellek } from "../../lib/depo.js";
import { kariyerAnalizi, ZAYIFLIKLAR, YUMRUK_TR } from "../../engine/antrenorAnalizi.js";
import { ROZETLER } from "../../engine/ilerleme.js";

const VEKTOR_AD = {
  gard: "Gard disiplini",
  baski: "Baskı",
  cesitlilik: "Silah çeşitliliği",
  tempo: "İş hacmi",
  guc: "Vuruş yoğunluğu",
  kontra: "Kontra eğilimi",
  hareket: "Hareketlilik",
  kombinasyon: "Kombinasyon",
};

// Basit sparkline: son roundların bir ölçüsünü çizgi olarak gösterir.
function Sparkline({ veriler, renk = "#2dd4ff" }) {
  if (!veriler || veriler.length < 2) return null;
  const en = Math.max(...veriler, 1);
  const W = 260;
  const H = 48;
  const adim = W / (veriler.length - 1);
  const d = veriler
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * adim).toFixed(1)},${(H - (v / en) * (H - 6) - 3).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="bx-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={renk} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function KariyerPage() {
  const { tercih } = useBoks();
  const [veri, setVeri] = useState(() => kariyerOnbellek());
  const [durum, setDurum] = useState("yukleniyor");

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const d = await kariyerGetir();
        if (!iptal) {
          setVeri(d);
          setDurum("hazir");
        }
      } catch (e) {
        console.error("[Boks] Kariyer yüklenemedi:", e);
        if (!iptal) setDurum("hata");
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  const kariyer = veri?.kariyer || null;
  const analiz = useMemo(
    () => kariyerAnalizi(kariyer, { durus: tercih.durus }),
    [kariyer, tercih.durus],
  );

  const roundlar = veri?.son_roundlar || [];
  const trendYumruk = useMemo(
    () => roundlar.slice().reverse().map((r) => r.toplam_yumruk || 0),
    [roundlar],
  );
  const trendGard = useMemo(
    () =>
      roundlar
        .slice()
        .reverse()
        .map((r) => (r.gard_olcu_sure > 0 ? Math.round((1 - r.gard_dusuk_sure / r.gard_olcu_sure) * 100) : 0)),
    [roundlar],
  );

  const zayifliklar = veri?.zayifliklar || [];
  const aktif = zayifliklar.filter((z) => z.durum === "aktif");
  const duzelen = zayifliklar.filter((z) => z.durum === "duzeldi");
  const rozetler = veri?.rozetler || [];

  return (
    <div className="bx-sayfa">
      <div className="bx-sayfa-ust">
        <Link to="/boks" className="bx-geri">← Menü</Link>
        <h2>🧬 Kariyer</h2>
      </div>

      {durum === "yukleniyor" && !veri && <div className="bx-bos">Yükleniyor…</div>}
      {durum === "hata" && !veri && <div className="bx-bos">Kariyer verisi yüklenemedi.</div>}

      {!analiz.hazir && durum !== "yukleniyor" && (
        <section className="bx-kart">
          <p className="bx-ozet-metin">{analiz.ozet}</p>
          <Link to="/boks" className="bx-btn bx-btn-ana">🥊 Antrenmana Başla</Link>
        </section>
      )}

      {analiz.hazir && (
        <>
          {/* ---- streak + toplamlar ---- */}
          <section className="bx-kart">
            <div className="bx-metrik-grid">
              <div><b>🔥 {kariyer.seri_gun}</b><small>günlük seri</small></div>
              <div><b>{kariyer.en_uzun_seri}</b><small>en uzun seri</small></div>
              <div><b>{kariyer.toplam_round}</b><small>round</small></div>
              <div><b>{kariyer.toplam_yumruk}</b><small>yumruk</small></div>
              <div><b>{Math.round(kariyer.toplam_sure / 60)}</b><small>dakika</small></div>
              <div><b>{kariyer.toplam_kalori}</b><small>kcal</small></div>
            </div>
          </section>

          {/* ---- dövüşçü kimliği ---- */}
          <section className="bx-kart">
            <h3 className="bx-kart-baslik">Dövüşçü Kimliğin</h3>
            <div className="bx-arketip">
              <b>{analiz.arketip.ad}</b>
              <p>{analiz.arketip.aciklama}</p>
            </div>
            <p className="bx-ozet-metin">{analiz.ozet}</p>
            <div className="bx-vektor">
              {Object.keys(VEKTOR_AD).map((k) => (
                <div key={k} className="bx-vektor-satir">
                  <span className="bx-vektor-ad">{VEKTOR_AD[k]}</span>
                  <span className="bx-vektor-cubuk"><i style={{ width: `${analiz.vektor[k]}%` }} /></span>
                  <span className="bx-vektor-deger">{analiz.vektor[k]}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ---- yumruk dağılımı (kariyer) ---- */}
          <section className="bx-kart">
            <h3 className="bx-kart-baslik">Kariyer Yumruk Dağılımı</h3>
            <div className="bx-dagilim">
              {[1, 2, 3, 4, 5, 6].map((no) => {
                const sayi = analiz.ist.yumruk[no] || 0;
                const oran = Math.round((sayi / Math.max(1, analiz.ist.toplamYumruk)) * 100);
                return (
                  <div key={no} className="bx-dagilim-satir">
                    <span className="bx-dagilim-no">{no}</span>
                    <span className="bx-dagilim-ad">{YUMRUK_TR[no]}</span>
                    <span className="bx-dagilim-cubuk"><i style={{ width: `${oran}%` }} /></span>
                    <span className="bx-dagilim-deger">{sayi} · %{oran}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---- gelişim trendi ---- */}
          {trendYumruk.length >= 2 && (
            <section className="bx-kart">
              <h3 className="bx-kart-baslik">Gelişim Trendi (son {trendYumruk.length} round)</h3>
              <div className="bx-trend">
                <span className="bx-trend-ad">Round başına yumruk</span>
                <Sparkline veriler={trendYumruk} renk="#ff4d3d" />
              </div>
              <div className="bx-trend">
                <span className="bx-trend-ad">Gard disiplini (%)</span>
                <Sparkline veriler={trendGard} renk="#2dd4ff" />
              </div>
            </section>
          )}

          {/* ---- koçluk döngüsü ---- */}
          <section className="bx-kart">
            <h3 className="bx-kart-baslik">Takip Edilen Açıklar</h3>
            {aktif.length === 0 && duzelen.length === 0 && (
              <p className="bx-not">Henüz takip edilen bir kalıp yok. Birkaç round sonra burada birikmeye başlar.</p>
            )}
            {aktif.map((z) => {
              const t = ZAYIFLIKLAR[z.kod];
              if (!t) return null;
              return (
                <div key={z.kod} className="bx-zayiflik">
                  <div className="bx-zayiflik-ust">
                    <b>{t.ad}</b>
                    <span className="bx-olcum">{z.gorulme_sayisi} antrenmandır</span>
                  </div>
                  <p className="bx-zayiflik-aciklama">{z.son_olcum || t.aciklama}</p>
                  <p className="bx-zayiflik-tavsiye">🎯 {t.tavsiye}</p>
                </div>
              );
            })}
            {duzelen.map((z) => {
              const t = ZAYIFLIKLAR[z.kod];
              if (!t) return null;
              return (
                <div key={z.kod} className="bx-duzeldi">
                  ✅ <b>{t.ad}</b> — son antrenmanlarda ölçülmedi. Daha önce {z.gorulme_sayisi} kez görülmüştü;
                  düzeltmişsin, bu alışkanlığı koru.
                </div>
              );
            })}
          </section>

          {/* ---- dövüşçü eşleşmesi ---- */}
          {analiz.eslesme?.length > 0 && (
            <section className="bx-kart">
              <h3 className="bx-kart-baslik">Stilin En Çok Kime Benziyor?</h3>
              <p className="bx-not">
                {analiz.dovuscuSayisi} profesyonel dövüşçünün kamuya açık stil özellikleriyle karşılaştırıldı.
                Yalnız tarz benzerliğidir; yetenek/seviye kıyaslaması değildir.
              </p>
              {analiz.eslesme.map((d, i) => (
                <div key={d.ad} className={"bx-dovuscu" + (i === 0 ? " ilk" : "")}>
                  <div className="bx-dovuscu-ust">
                    <b>{d.ad}</b>
                    <span className="bx-benzerlik">%{d.benzerlik}</span>
                  </div>
                  <small>{d.sporAd} · {d.durusAd}</small>
                  <p>{d.not}</p>
                </div>
              ))}
            </section>
          )}

          {/* ---- rozetler ---- */}
          <section className="bx-kart">
            <h3 className="bx-kart-baslik">Rozetler ({rozetler.length}/{Object.keys(ROZETLER).length})</h3>
            <div className="bx-rozet-grid">
              {Object.entries(ROZETLER).map(([kod, r]) => {
                const kazanildi = rozetler.some((x) => x.kod === kod);
                return (
                  <div key={kod} className={"bx-rozet" + (kazanildi ? "" : " kilitli")}>
                    <span>{r.ikon}</span>
                    <b>{r.ad}</b>
                    <small>{r.aciklama}</small>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <div className="bx-alt-linkler">
        <Link to="/boks" className="bx-btn bx-btn-ana">🥊 Antrenmana Başla</Link>
        <Link to="/boks/siralama" className="bx-btn bx-btn-ikincil">🏆 Sıralama</Link>
      </div>
    </div>
  );
}
