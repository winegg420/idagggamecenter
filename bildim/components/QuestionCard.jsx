import { useEffect, useRef, useState } from "react";
import Ikon from "./Ikon.jsx";
import { supabase } from "../../src/lib/supabase.js";
import { kalanSure, sunucuOffsetMs } from "../lib/zaman.js";
import JokerCubugu from "./JokerCubugu.jsx";
import Konfeti from "./Konfeti.jsx";
import CevapEfekti from "./CevapEfekti.jsx";
import { sesTik, sesSureDoldu, sesDogru, sesYanlis, sesDokunus, sesKilidiAc } from "../lib/ses.js";
import { titret, macPuani } from "../lib/geriBildirim.js";

const HARFLER = ["A", "B", "C", "D"];
const SURE = 15;

/**
 * Ortak soru ekranı (turnuva + 1v1).
 * soru: { question_id, soru, secenekler, soru_index, baslangic, sunucu_zamani, dogru_cevap? }
 * dogru_cevap yalnızca yetkili hesaplarda dolu gelir; herhangi bir şık 3 sn basılı
 * tutulursa doğru cevap otomatik seçilir.
 * onCevapla(cevapIndex) -> { dogru, dogru_cevap } döndüren async fonksiyon
 * onSureDoldu() -> süre bitince çağrılır (advance tetikler)
 */
export default function QuestionCard({
  soru,
  onCevapla,
  onSureDoldu,
  jokerler,
  // Yeni joker ekonomisi: macTur + macId verilirse sunucu tabanlı çubuk çizilir.
  macTur,
  macId,
  onPas,
  // Kazanılan puanı uçan rozet olarak göstermek için. null verilirse rozet
  // çizilmez (hızlı maçta soru başına puan yok — sahte sayı gösterilmez).
  puanHesapla = macPuani,
}) {
  const [kalan, setKalan] = useState(SURE);
  const [secim, setSecim] = useState(null);
  const [sonuc, setSonuc] = useState(null); // { dogru, dogru_cevap }
  const [oy, setOy] = useState(null);
  const [kapali, setKapali] = useState([]); // 50:50 ile elenen şıklar
  // Geri bildirim penceresi: kazanılan puan + üst üste doğru serisi
  const [puan, setPuan] = useState(0);
  const [seri, setSeri] = useState(0);
  const [sarsil, setSarsil] = useState(false);
  const kalanRef = useRef(SURE);
  const sureDolduMu = useRef(false);
  const basiliTutTimer = useRef(null);
  // Ses: son 5 saniyede saniyede bir tik. Efekt içinden okunabilmesi için ref.
  const cevapVerildiRef = useRef(false);
  const sonTikRef = useRef(null);

  // Yeni soru geldiğinde durumu sıfırla
  useEffect(() => {
    setSecim(null);
    setSonuc(null);
    setOy(null);
    setKapali([]);
    setPuan(0);
    setSarsil(false);
    sureDolduMu.current = false;
    cevapVerildiRef.current = false;
    sonTikRef.current = null;
    clearTimeout(basiliTutTimer.current);
  }, [soru?.question_id, soru?.soru_index]);

  // İlk kullanıcı hareketinde ses motoru açılsın (mobil tarayıcı kuralı)
  useEffect(() => { sesKilidiAc(); }, []);

  useEffect(() => () => clearTimeout(basiliTutTimer.current), []);

  useEffect(() => {
    if (!soru) return;
    // Saat farkını soru geldiği anda bir kez sabitle; tik başına yeniden
    // hesaplanırsa sayaç donar.
    const offset = sunucuOffsetMs(soru.sunucu_zamani);
    let id;
    const tik = () => {
      const k = kalanSure(soru.baslangic, offset, SURE);
      setKalan(k);
      if (!cevapVerildiRef.current) kalanRef.current = k;
      // Son 5 saniye: her tam saniyede bir tik sesi (cevap verildiyse susar)
      if (k > 0 && k <= 5 && !cevapVerildiRef.current) {
        const sn = Math.ceil(k);
        if (sonTikRef.current !== sn) {
          sonTikRef.current = sn;
          sesTik(sn);
        }
      }
      if (k <= 0 && !sureDolduMu.current) {
        sureDolduMu.current = true;
        clearInterval(id);
        if (!cevapVerildiRef.current) sesSureDoldu();
        onSureDoldu?.();
      }
    };
    tik();
    if (!sureDolduMu.current) id = setInterval(tik, 100);
    return () => clearInterval(id);
  }, [soru, onSureDoldu]);

  if (!soru) return null;

  const cevapla = async (i) => {
    if (secim !== null || kalan <= 0) return;
    const kalanAn = kalanRef.current;
    setSecim(i);
    cevapVerildiRef.current = true;
    // 0 ms: dokunma anı — kısa klik + 10 ms titreşim (şık CSS ile küçülür)
    sesDokunus();
    titret(10);
    try {
      const r = await onCevapla(i);
      if (r) {
        setSonuc(r);
        const dogruMu = r.dogru_cevap === i;
        // 120 ms: renk geri bildirimi CSS'te; ses ve seri burada
        if (dogruMu) {
          sesDogru();
          titret(10);
          setSeri((s) => s + 1);
          if (puanHesapla) setPuan(puanHesapla(kalanAn, true));
        } else {
          sesYanlis();
          titret(30);
          setSeri(0);
          setPuan(0);
          // Yanlışta kart iki kez hafifçe sarsılır (±4px, 180 ms)
          setSarsil(true);
          setTimeout(() => setSarsil(false), 380);
        }
      }
    } catch {
      // süre dolmuş olabilir; sonuç ekranı advance ile gelir
    }
  };

  const basiliTutmayaBasla = () => {
    if (soru.dogru_cevap == null || secim !== null || kalan <= 0) return;
    clearTimeout(basiliTutTimer.current);
    basiliTutTimer.current = setTimeout(() => cevapla(soru.dogru_cevap), 3000);
  };
  const basiliTutmayiBirak = () => clearTimeout(basiliTutTimer.current);

  // Sunucudan gelen joker etkisini uygula
  const jokerEtkisi = (sonuc) => {
    if (!sonuc) return;
    if (sonuc.tur === "elli" && Array.isArray(sonuc.kapali)) {
      setKapali(sonuc.kapali);
    } else if (sonuc.tur === "pas") {
      cevapVerildiRef.current = true;
      setSecim(-1);
      setSonuc({ dogru: false, dogru_cevap: sonuc.dogru_cevap });
      onPas?.(sonuc);
    }
    // 'sure' etkisi sunucuda soru_baslangic'ı uzatır; sayaç bir sonraki
    // yoklamada kendiliğinden güncellenir.
  };

  const oyVer = async (adil) => {
    setOy(adil);
    await supabase.rpc("vote_question", {
      p_question_id: soru.question_id,
      p_adil: adil,
    });
  };

  const secenekler = Array.isArray(soru.secenekler)
    ? soru.secenekler
    : JSON.parse(soru.secenekler);

  const oran = Math.max(0, Math.min(1, kalan / SURE));
  const CEVRE = 2 * Math.PI * 20; // r=20 halka çevresi
  const halkaRenk =
    kalan <= 5 ? "var(--bd-hata)" : kalan <= 9 ? "var(--bd-odul)" : "var(--bd-basari)";

  const dogruCevapVerdim = Boolean(sonuc) && secim === sonuc.dogru_cevap;
  const yanlisCevapVerdim = Boolean(sonuc) && secim !== null && secim !== sonuc.dogru_cevap;

  // Son 5 saniye: ekran kenarları kızarır, sayaç kalp gibi atar, geri sayım büyür.
  // Cevap verildikten sonra tetiklenmez (heyecan değil, rahatsızlık olurdu).
  const sonDuzluk = kalan > 0 && kalan <= 5 && secim === null && !sonuc;
  const geriSayim = Math.ceil(kalan);

  return (
    <div
      key={`${soru.question_id}-${soru.soru_index}`}
      className={`bd-soru bd-soru-giris ${dogruCevapVerdim ? "bd-dogru-cevap" : ""} ${yanlisCevapVerdim ? "bd-yanlis-cevap" : ""} ${sonDuzluk ? "bd-son-saniyeler" : ""} ${sarsil ? "bd-sarsil" : ""}`}
    >
      <Konfeti aktif={dogruCevapVerdim} />
      <CevapEfekti dogru={dogruCevapVerdim} puan={puan} seri={seri} />

      {/* Son 5 saniye: kızaran kenarlar + ortada büyük geri sayım */}
      {sonDuzluk && (
        <>
          <div className="bd-son-perde" aria-hidden="true" />
          <div className="bd-geri-sayim" key={geriSayim} aria-hidden="true">
            {geriSayim}
          </div>
        </>
      )}

      {/* Üst şerit: soru numarası + kalan süre halkası + ilerleme çubuğu */}
      <div className="bd-soru-ust">
        <div className="bd-soru-no">Soru {soru.soru_index + 1}</div>
        <div className="bd-sure-halka" aria-label={`${Math.ceil(kalan)} saniye kaldı`}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <circle className="iz" cx="24" cy="24" r="20" />
            <circle
              className="dolgu"
              cx="24"
              cy="24"
              r="20"
              stroke={halkaRenk}
              strokeDasharray={CEVRE}
              strokeDashoffset={CEVRE * (1 - oran)}
            />
          </svg>
          <span className={`bd-sure-sayi ${kalan <= 5 ? "kritik" : ""}`}>
            {Math.ceil(kalan)}
          </span>
        </div>
      </div>
      <div className="bd-soru-bar">
        {/* Renk yeşil → sarı → kırmızı; süre azaldıkça sınıf değişir */}
        <div
          className={`dolgu ${oran > 0.5 ? "iyi" : oran > 0.25 ? "orta" : "kritik"}`}
          style={{ width: `${oran * 100}%` }}
        />
      </div>

      <div className="bd-soru-metin">{soru.soru}</div>

      <div className="bd-secenekler">
        {secenekler.map((s, i) => {
          const elendi = kapali.includes(i);
          let sinif = "bd-secenek";
          if (sonuc) {
            if (i === sonuc.dogru_cevap) sinif += " dogru";
            else if (i === secim) sinif += " yanlis";
            else sinif += " solgun";
          } else if (i === secim) {
            sinif += " secili";
          }
          if (elendi) sinif += " elendi";
          return (
            <button
              key={i}
              className={sinif}
              disabled={secim !== null || kalan <= 0 || elendi}
              onClick={() => cevapla(i)}
              onPointerDown={basiliTutmayaBasla}
              onPointerUp={basiliTutmayiBirak}
              onPointerLeave={basiliTutmayiBirak}
              onPointerCancel={basiliTutmayiBirak}
            >
              <span className="bd-harf">{HARFLER[i]}</span>
              <span className="bd-secenek-metin">{s}</span>
              {sonuc && i === sonuc.dogru_cevap && <span className="bd-isaret"><Ikon ad="onay" boyut={16} /></span>}
              {sonuc && i === secim && i !== sonuc.dogru_cevap && (
                <span className="bd-isaret"><Ikon ad="carpi" boyut={16} /></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Yeni joker ekonomisi (sunucu tabanlı).
          "Hızlı Olan Kazanır" modunda joker YOK: mod "ilk doğru cevap kazanır"
          üzerine kurulu; 50:50 ya da +10 sn adaleti doğrudan bozar. Meydan Oku
          açıklamasındaki "Joker yok!" cümlesiyle tutarlı olsun diye çubuk
          bu modda hiç çizilmez. */}
      {macTur && macTur !== "hizli" && macId && !sonuc && secim === null && kalan > 0 && (
        <JokerCubugu
          macTur={macTur}
          macId={macId}
          soruIndex={soru.soru_index}
          onEtki={jokerEtkisi}
        />
      )}

      {/* Eski joker çubuğu — yalnız macTur verilmeyen ekranlarda (geriye uyum) */}
      {!macTur && jokerler && !sonuc && secim === null && kalan > 0 && (
        <div className="joker-bar">
          <button
            disabled={jokerler.kullanildi.elli || kapali.length > 0}
            onClick={async () => {
              const r = await jokerler.onKullan("elli");
              if (r?.kapali) setKapali(r.kapali);
            }}
          >
            <Ikon ad="terazi" boyut={16} /> 50:50 <span className="bedel">Ücretsiz</span>
          </button>
          <button
            disabled={jokerler.kullanildi.sure}
            onClick={() => jokerler.onKullan("sure")}
          >
            <Ikon ad="saat" boyut={16} /> +10 sn <span className="bedel">20 puan</span>
          </button>
        </div>
      )}

      {sonuc && (
        <div className="adil-oylama">
          <span>Bu soru adil miydi?</span>
          <button className={oy === true ? "secildi" : ""} onClick={() => oyVer(true)}>
            <Ikon ad="onay" boyut={17} />
          </button>
          <button className={oy === false ? "secildi" : ""} onClick={() => oyVer(false)}>
            <Ikon ad="carpi" boyut={17} />
          </button>
        </div>
      )}
    </div>
  );
}
