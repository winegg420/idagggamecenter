// ============================================================
// GÖLGE BOKS — ana menü
// Mod + zorluk seçimi, kişiselleştirme (duruş / eldiven / koç kişiliği / kilo),
// kürasyonlu programlar, seviye testi ve sayfa geçişleri.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBoks } from "../BoksApp.jsx";
import { MODLAR, ZORLUKLAR } from "../../engine/oyun.js";
import { PROGRAMLAR, programSonrakiGun } from "../../engine/ilerleme.js";
import { programDurum, programSec, programBirak, bekleyenSayisi } from "../../lib/depo.js";
import { DOVUSCU_SAYISI } from "../../engine/dovusculKutuphanesi.js";

// Takip modelleri + wasm CDN'den iner. Menüde düşük öncelikli ön-yükleme
// başlatılırsa "hazırlanıyor" beklemesi belirgin kısalır.
const ONYUKLE = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs",
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
];

const ELDIVEN_RENKLER = ["#ff4d3d", "#2dd4ff", "#d9a441", "#f5efe8", "#7a4bd8", "#16a06a"];

export default function MenuPage() {
  const git = useNavigate();
  const { tercih, tercihGuncelle, profile } = useBoks();
  const [mod, setMod] = useState("serbest");
  const [zorluk, setZorluk] = useState(tercih.onerilen_zorluk || "orta");
  const [ayarAcik, setAyarAcik] = useState(false);
  const [kilo, setKilo] = useState(tercih.kilo_kg || "");
  const [program, setProgram] = useState(() => programDurum());
  const bekleyen = bekleyenSayisi();

  useEffect(() => {
    const linkler = [];
    try {
      for (const href of ONYUKLE) {
        const l = document.createElement("link");
        l.rel = "prefetch";
        l.href = href;
        l.crossOrigin = "anonymous";
        document.head.appendChild(l);
        linkler.push(l);
      }
    } catch {
      /* ön-yükleme başarısız olsa da oyun normal açılır */
    }
    return () => linkler.forEach((l) => l.remove());
  }, []);

  useEffect(() => {
    if (tercih.onerilen_zorluk) setZorluk(tercih.onerilen_zorluk);
  }, [tercih.onerilen_zorluk]);

  const aktifProgram = useMemo(
    () => PROGRAMLAR.find((p) => p.kod === program.kod) || null,
    [program.kod],
  );
  const programGun = aktifProgram ? programSonrakiGun(aktifProgram, program.tamamlanan) : null;

  const basla = (m = mod, z = zorluk) => git(`/boks/oyun/${m}/${z}`);

  return (
    <div className="bx-menu">
      <Link to="/" className="bx-geri">← Oyun Merkezi</Link>

      <header className="bx-menu-baslik">
        <span className="bx-logo">🥊</span>
        <h1>GÖLGE BOKS</h1>
        <p>Kameranı aç, gerçek gölge boksu yap — sistem her yumruğunu okur ve seni bir antrenör gibi analiz eder.</p>
      </header>

      {bekleyen > 0 && (
        <div className="bx-bilgi-serit">
          ☁️ {bekleyen} antrenman çevrimdışı kaydedildi, internet gelince otomatik gönderilecek.
        </div>
      )}

      {/* ---- kürasyonlu program ---- */}
      {aktifProgram && programGun && (
        <section className="bx-program-aktif">
          <div className="bx-program-ust">
            <span className="bx-program-ikon">{aktifProgram.ikon}</span>
            <div>
              <b>{aktifProgram.ad}</b>
              <small>
                Gün {programGun.gun}/{aktifProgram.gunler.length} · {MODLAR[programGun.mod].ad} ·{" "}
                {ZORLUKLAR[programGun.zorluk].ad}
              </small>
            </div>
          </div>
          <p className="bx-program-hedef">🎯 {programGun.hedef}</p>
          <div className="bx-program-btnler">
            <button className="bx-btn bx-btn-ana" onClick={() => basla(programGun.mod, programGun.zorluk)}>
              Bugünün Antrenmanı ▶
            </button>
            <button
              className="bx-btn bx-btn-ince"
              onClick={() => {
                programBirak();
                setProgram(programDurum());
              }}
            >
              Programı bırak
            </button>
          </div>
        </section>
      )}

      {/* ---- mod seçimi ---- */}
      <section className="bx-bolum">
        <h2 className="bx-bolum-baslik">Antrenman Modu</h2>
        <div className="bx-mod-grid">
          {Object.entries(MODLAR).map(([k, m]) => (
            <button
              key={k}
              className={"bx-mod-kart" + (mod === k ? " aktif" : "")}
              onClick={() => setMod(k)}
            >
              <span className="bx-mod-ikon">{m.ikon}</span>
              <b>{m.ad}</b>
              <small>{m.aciklama}</small>
            </button>
          ))}
        </div>
      </section>

      {/* ---- zorluk ---- */}
      <section className="bx-bolum">
        <h2 className="bx-bolum-baslik">Zorluk</h2>
        <div className="bx-zorluk-satir">
          {["kolay", "orta", "zor", "pro"].map((k) => (
            <button
              key={k}
              className={"bx-zorluk" + (zorluk === k ? " aktif" : "") + (k === "pro" ? " pro" : "")}
              onClick={() => setZorluk(k)}
            >
              <b>{ZORLUKLAR[k].ad}</b>
              <small>
                {ZORLUKLAR[k].round} round · {ZORLUKLAR[k].sure} sn
              </small>
            </button>
          ))}
        </div>
        <p className="bx-not">Molalar {ZORLUKLAR[zorluk].mola} sn. İlk round öncesi otomatik ısınma vardır.</p>
      </section>

      <button className="bx-btn bx-btn-ana bx-genis" onClick={() => basla()}>
        🥊 ANTRENMANA BAŞLA
      </button>

      <div className="bx-hizli-satir">
        <button className="bx-btn bx-btn-ince" onClick={() => basla("serbest", "test")}>
          📏 Seviye Testi (30 sn)
        </button>
        <Link to="/boks/rehber" className="bx-btn bx-btn-ince">📖 Teknik Rehberi</Link>
      </div>

      {/* ---- kişiselleştirme ---- */}
      <section className="bx-bolum">
        <button className="bx-ayar-ac" onClick={() => setAyarAcik((a) => !a)}>
          ⚙️ Kişiselleştirme {ayarAcik ? "▲" : "▼"}
        </button>
        {ayarAcik && (
          <div className="bx-ayarlar">
            <div className="bx-ayar">
              <label>Duruş</label>
              <div className="bx-secim">
                <button
                  className={tercih.durus === "ortodoks" ? "aktif" : ""}
                  onClick={() => tercihGuncelle({ durus: "ortodoks" })}
                >
                  Ortodoks (sol önde)
                </button>
                <button
                  className={tercih.durus === "guney_pence" ? "aktif" : ""}
                  onClick={() => tercihGuncelle({ durus: "guney_pence" })}
                >
                  Güney Pençe (solak)
                </button>
              </div>
              <small className="bx-not">
                Pad numaralandırması ve analiz duruşuna göre aynalanır — solak boksörlerde yanlış "açık" tespiti yapılmaz.
              </small>
            </div>

            <div className="bx-ayar">
              <label>Eldiven</label>
              <div className="bx-secim">
                <button
                  className={tercih.eldiven_turu === "boks" ? "aktif" : ""}
                  onClick={() => tercihGuncelle({ eldiven_turu: "boks" })}
                >
                  🥊 Klasik Boks
                </button>
                <button
                  className={tercih.eldiven_turu === "mma" ? "aktif" : ""}
                  onClick={() => tercihGuncelle({ eldiven_turu: "mma" })}
                >
                  🤜 MMA (parmaksız)
                </button>
              </div>
              <div className="bx-renk-satir">
                {ELDIVEN_RENKLER.map((r) => (
                  <button
                    key={r}
                    className={"bx-renk" + (tercih.eldiven_renk === r ? " aktif" : "")}
                    style={{ background: r }}
                    onClick={() => tercihGuncelle({ eldiven_renk: r })}
                    aria-label={"Eldiven rengi " + r}
                  />
                ))}
              </div>
            </div>

            <div className="bx-ayar">
              <label>Koç kişiliği</label>
              <div className="bx-secim">
                <button
                  className={tercih.koc_kisilik === "agresif" ? "aktif" : ""}
                  onClick={() => tercihGuncelle({ koc_kisilik: "agresif" })}
                >
                  🔥 Agresif / motive edici
                </button>
                <button
                  className={tercih.koc_kisilik === "sakin" ? "aktif" : ""}
                  onClick={() => tercihGuncelle({ koc_kisilik: "sakin" })}
                >
                  🧊 Sakin / teknik
                </button>
              </div>
            </div>

            <div className="bx-ayar">
              <label>Kilo (kalori hesabı için · isteğe bağlı)</label>
              <div className="bx-kilo">
                <input
                  type="number"
                  min="25"
                  max="250"
                  value={kilo}
                  placeholder="örn. 74"
                  onChange={(e) => setKilo(e.target.value)}
                />
                <button
                  className="bx-btn bx-btn-ince"
                  onClick={() => tercihGuncelle({ kilo_kg: kilo ? Number(kilo) : null })}
                >
                  Kaydet
                </button>
              </div>
              <small className="bx-not">
                Girmezsen kalori ortalama bir değerle "tahmini" etiketiyle gösterilir — yanlış kesinlik iddia edilmez.
              </small>
            </div>
          </div>
        )}
      </section>

      {/* ---- programlar ---- */}
      {!aktifProgram && (
        <section className="bx-bolum">
          <h2 className="bx-bolum-baslik">Antrenman Programları</h2>
          <div className="bx-program-grid">
            {PROGRAMLAR.map((p) => (
              <button
                key={p.kod}
                className="bx-program-kart"
                onClick={() => {
                  programSec(p.kod);
                  setProgram(programDurum());
                }}
              >
                <span className="bx-program-ikon">{p.ikon}</span>
                <b>{p.ad}</b>
                <small>{p.aciklama}</small>
                <span className="bx-program-gun">{p.gunler.length} gün</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="bx-alt-linkler">
        <Link to="/boks/kariyer" className="bx-btn bx-btn-ikincil">🧬 Kariyer & Antrenör</Link>
        <Link to="/boks/siralama" className="bx-btn bx-btn-ikincil">🏆 Sıralama</Link>
      </div>

      {/* ---- güvenlik / alan kontrolü ---- */}
      <section className="bx-guvenlik">
        <h3>⚠️ Başlamadan önce</h3>
        <ul>
          <li><b>Alanını kontrol et:</b> kolunun uzanacağı mesafede eşya, lamba, duvar veya insan olmasın.</li>
          <li><b>Kadraj:</b> kameradan 1,5-2 metre uzaklaş; en azından kafan ve iki omzun görünsün. Tüm vücudun girerse duruş/denge analizi de açılır.</li>
          <li><b>Zemin:</b> kaygan olmayan bir yüzeyde, uygun ayakkabıyla çalış.</li>
          <li><b>Isınma:</b> ilk round öncesi otomatik ısınma fazı vardır, atlama.</li>
        </ul>
        <p className="bx-not">
          Bu oyun bir antrenman aracıdır; tıbbi tavsiye vermez. Rahatsızlık hissedersen ara ver.
        </p>
      </section>

      <footer className="bx-menu-alt">
        Stil eşleştirmesi {DOVUSCU_SAYISI} profesyonel dövüşçünün kamuya açık stil özellikleriyle yapılır.
        {profile?.username ? ` · ${profile.username}` : ""}
      </footer>
    </div>
  );
}
