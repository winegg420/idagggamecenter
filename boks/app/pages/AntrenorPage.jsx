// ============================================================
// GÖLGE BOKS — Antrenör Modu raporu (antrenman sonu)
// Oyun ekranı, biten antrenmanın raporunu sessionStorage'a yazar; bu sayfa onu
// okuyup profesyonel bir antrenör raporu olarak sunar. Sayfa doğrudan açılırsa
// (rapor yoksa) kullanıcı kariyer sayfasına yönlendirilir.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBoks } from "../BoksApp.jsx";
import { ZAYIFLIKLAR, elDengesi, yorgunlukYorumu, YUMRUK_TR } from "../../engine/antrenorAnalizi.js";
import { ROZETLER } from "../../engine/ilerleme.js";
import { kartPaylas } from "../../engine/paylasim.js";

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

export default function AntrenorPage() {
  const git = useNavigate();
  const { profile } = useBoks();
  const [paylasimDurum, setPaylasimDurum] = useState("");

  const veri = useMemo(() => {
    try {
      const ham = sessionStorage.getItem("boks_son_rapor");
      return ham ? JSON.parse(ham) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!veri) {
      const z = setTimeout(() => git("/boks/kariyer", { replace: true }), 2200);
      return () => clearTimeout(z);
    }
  }, [veri, git]);

  if (!veri) {
    return (
      <div className="bx-sayfa">
        <Link to="/boks" className="bx-geri">← Menü</Link>
        <div className="bx-bos">
          Görüntülenecek bir antrenman raporu yok. Kariyer sayfasına yönlendiriliyorsun…
        </div>
      </div>
    );
  }

  const { rapor, toplam, kalori, roundlar, mod, zorluk, yeniRozetler } = veri;
  const isabet = Math.round((toplam.isabet / Math.max(1, toplam.toplamYumruk)) * 100);
  const denge = elDengesi(toplam);
  const yorgunluk = yorgunlukYorumu(toplam);

  const paylas = async () => {
    setPaylasimDurum("hazirlaniyor");
    const r = await kartPaylas({
      ad: profile?.username || veri.ad || "Oyuncu",
      puan: toplam.puan,
      yumruk: toplam.toplamYumruk,
      isabetYuzde: isabet,
      combo: toplam.enIyiCombo,
      kalori: kalori.deger,
      kaloriTahmini: kalori.tahmini,
      stil: rapor.arketip?.ad,
      dovuscu: rapor.eslesme?.[0]?.ad,
      benzerlik: rapor.eslesme?.[0]?.benzerlik,
      mod,
      zorluk,
      seriGun: veri.seriGun,
    });
    setPaylasimDurum(r.ok ? (r.yol === "indirildi" ? "indirildi" : "paylasildi") : r.iptal ? "" : "hata");
  };

  return (
    <div className="bx-sayfa bx-antrenor">
      <div className="bx-sayfa-ust">
        <Link to="/boks" className="bx-geri">← Menü</Link>
        <h2>🧠 Antrenör Raporu</h2>
      </div>

      {/* ---- üst özet ---- */}
      <section className="bx-kart bx-ozet-kart">
        <div className="bx-ozet-ust">
          <span className="bx-etiket">{mod} · {zorluk}</span>
          <span className="bx-etiket bx-etiket-analiz">{roundlar.length} round</span>
        </div>
        <div className="bx-metrik-grid">
          <div><b>{toplam.puan}</b><small>puan</small></div>
          <div><b>{toplam.toplamYumruk}</b><small>yumruk</small></div>
          <div><b>%{isabet}</b><small>isabet</small></div>
          <div><b>{toplam.enIyiCombo}</b><small>en iyi seri</small></div>
          <div><b>{kalori.deger}</b><small>kcal{kalori.tahmini ? " (tahmini)" : ""}</small></div>
          <div><b>{Math.round(toplam.sure / 60)}</b><small>dakika</small></div>
        </div>
        <p className="bx-not">
          MET tabanlı hesap ({kalori.met} MET). {kalori.tahmini ? "Kilonu girersen kalori kişiselleşir." : ""}
        </p>
      </section>

      {/* ---- stil profili ---- */}
      <section className="bx-kart">
        <h3 className="bx-kart-baslik">Stil Profili</h3>
        <div className="bx-arketip">
          <b>{rapor.arketip.ad}</b>
          <p>{rapor.arketip.aciklama}</p>
        </div>
        <p className="bx-ozet-metin">{rapor.ozet}</p>
        <div className="bx-vektor">
          {Object.keys(VEKTOR_AD).map((k) => (
            <div key={k} className="bx-vektor-satir">
              <span className="bx-vektor-ad">{VEKTOR_AD[k]}</span>
              <span className="bx-vektor-cubuk">
                <i style={{ width: `${rapor.vektor[k]}%` }} />
              </span>
              <span className="bx-vektor-deger">{rapor.vektor[k]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- yumruk dağılımı ---- */}
      <section className="bx-kart">
        <h3 className="bx-kart-baslik">Yumruk Dağılımı</h3>
        {rapor.dagilim.length === 0 ? (
          <p className="bx-not">Bu antrenmanda ölçülebilir yumruk kaydedilmedi.</p>
        ) : (
          <div className="bx-dagilim">
            {rapor.dagilim.map((d) => (
              <div key={d.no} className="bx-dagilim-satir">
                <span className="bx-dagilim-no">{d.no}</span>
                <span className="bx-dagilim-ad">{YUMRUK_TR[d.no]}</span>
                <span className="bx-dagilim-cubuk">
                  <i style={{ width: `${d.oran}%` }} />
                </span>
                <span className="bx-dagilim-deger">{d.sayi} · %{d.oran}</span>
              </div>
            ))}
          </div>
        )}
        <p className="bx-not">{denge.metin}</p>
      </section>

      {/* ---- teknik maddeler ---- */}
      <section className="bx-kart">
        <h3 className="bx-kart-baslik">Teknik Değerlendirme</h3>
        {rapor.madde.map((m, i) => (
          <div key={i} className="bx-madde">
            <b>{m.baslik}</b>
            <p>{m.metin}</p>
          </div>
        ))}
        {yorgunluk && (
          <div className="bx-madde">
            <b>Dayanıklılık</b>
            <p>{yorgunluk.metin}</p>
          </div>
        )}
      </section>

      {/* ---- açıklar ---- */}
      <section className="bx-kart">
        <h3 className="bx-kart-baslik">Açıklar ve Düzeltme</h3>
        {rapor.bulgular.length === 0 ? (
          <p className="bx-ozet-metin">
            Ölçülen verilerde belirgin bir teknik açık yok. Bir üst zorluğa geçip aynı disiplini korumayı dene.
          </p>
        ) : (
          rapor.bulgular.slice(0, 4).map((b) => {
            const z = ZAYIFLIKLAR[b.kod];
            if (!z) return null;
            return (
              <div key={b.kod} className="bx-zayiflik">
                <div className="bx-zayiflik-ust">
                  <b>{z.ad}</b>
                  <span className="bx-olcum">{b.olcum}</span>
                </div>
                <p className="bx-zayiflik-aciklama">{z.aciklama}</p>
                <p className="bx-zayiflik-tavsiye">🎯 {z.tavsiye}</p>
              </div>
            );
          })
        )}
        {rapor.guclu.length > 0 && (
          <p className="bx-guclu">✅ Güçlü yönlerin: {rapor.guclu.join(" · ")}</p>
        )}
      </section>

      {/* ---- dövüşçü eşleşmesi ---- */}
      {rapor.eslesme?.length > 0 && (
        <section className="bx-kart">
          <h3 className="bx-kart-baslik">Stil Eşleşmesi</h3>
          <p className="bx-not">
            Stil vektörün {rapor.dovuscuSayisi} profesyonel dövüşçünün kamuya açık stil özellikleriyle karşılaştırıldı.
            Bu bir yetenek kıyaslaması değil, tarz benzerliğidir.
          </p>
          {rapor.eslesme.map((d, i) => (
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
      {yeniRozetler?.length > 0 && (
        <section className="bx-kart">
          <h3 className="bx-kart-baslik">Yeni Rozetler</h3>
          <div className="bx-rozet-grid">
            {yeniRozetler.map((k) => (
              <div key={k} className="bx-rozet">
                <span>{ROZETLER[k]?.ikon || "🏅"}</span>
                <b>{ROZETLER[k]?.ad || k}</b>
                <small>{ROZETLER[k]?.aciklama || ""}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="bx-alt-linkler">
        <button className="bx-btn bx-btn-ana" onClick={paylas}>
          📤 Paylaşım Kartı
        </button>
        <Link to="/boks/kariyer" className="bx-btn bx-btn-ikincil">🧬 Kariyer</Link>
        <Link to="/boks" className="bx-btn bx-btn-ikincil">🏠 Menü</Link>
      </div>
      {paylasimDurum === "hazirlaniyor" && <p className="bx-not">Kart hazırlanıyor…</p>}
      {paylasimDurum === "indirildi" && <p className="bx-not">✅ Kart indirildi.</p>}
      {paylasimDurum === "paylasildi" && <p className="bx-not">✅ Paylaşıldı.</p>}
      {paylasimDurum === "hata" && <p className="bx-not">⚠️ Kart oluşturulamadı.</p>}
    </div>
  );
}
