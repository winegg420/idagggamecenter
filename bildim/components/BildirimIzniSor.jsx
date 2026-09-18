import { useEffect, useState } from "react";
import Ikon from "./Ikon.jsx";
import { pushDestekleniyor, bildirimleriAc, iosSekmesi } from "../lib/push.js";
import { hataMesaji } from "../lib/hata.js";
import { tt } from "../lib/dil.js";

// Paket 19 §F: anahtar sürümlendi (_v2). Paket 17 §B öncesi kod teknik hatada da "bir daha sorma" işaretini
// koyuyordu; eski işaretli herkes kartı bir kez daha görür. Eski anahtar (`bildim_bildirim_sorma`) yok sayılır.
const DEPO = "bildim_bildirim_sorma_v2";
const DEPO_IOS = "bildim_bildirim_ios_ipucu";
const oku = (k) => { try { return localStorage.getItem(k); } catch { return null; /* özel mod: her oturumda sorulur */ } };
const yaz = (k) => { try { localStorage.setItem(k, "1"); } catch { /* özel mod */ } };

/**
 * Bildirim izni ilk açılışta DEĞİL, maç sonucu ekranında sorulur (Klasik Mod, Düello, Hızlı Mod).
 * (Oyuncu oyunu görmeden izin istemek reddedilme oranını artırıyordu.)
 *
 * Paket 17 §B: eskiden hata `catch {}` ile yutuluyor VE "bir daha sorma" işareti yine konuyordu —
 * tek bir teknik hata oyuncuyu kalıcı olarak bildirimsiz bırakıyordu, kimse de görmüyordu.
 * Şimdi: işaret yalnız oyuncu "Şimdi değil" derse, izni reddederse ya da abonelik başarılı olursa konur;
 * teknik hata konsola yazılır, kartta gösterilir, tekrar denenebilir.
 * iPhone Safari sekmesinde push yok (Apple) → kart yerine "ana ekrana ekle" ipucu (bir kez).
 */
export default function BildirimIzniSor() {
  const [durum, setDurum] = useState(null);   // null | "sor" | "ios" | "acik"
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    if (!pushDestekleniyor()) {
      if (iosSekmesi() && !oku(DEPO_IOS)) setDurum("ios");
      return;
    }
    if (Notification.permission !== "default") return;
    if (oku(DEPO)) return;
    setDurum("sor");
  }, []);

  if (!durum) return null;

  if (durum === "acik") {
    return (
      <div className="bd-izin-kart">
        <div className="ikon" aria-hidden="true"><Ikon ad="zil" boyut={22} /></div>
        <div className="govde"><div className="bd-izin-baslik">{tt("Bildirimler açık")}</div></div>
      </div>
    );
  }

  if (durum === "ios") {
    return (
      <div className="bd-izin-kart">
        <div className="ikon" aria-hidden="true"><Ikon ad="zil" boyut={22} /></div>
        <div className="govde">
          <div className="bd-izin-baslik">{tt("iPhone'da bildirim almak için")}</div>
          <div className="alt-yazi">
            {tt("Quiz Tactics'i ana ekrana ekle (Paylaş → Ana Ekrana Ekle) ve oradan aç. Apple bildirimleri yalnız ana ekrandaki uygulamaya izin veriyor.")}
          </div>
        </div>
        <div className="bd-izin-butonlar">
          <button className="btn kucuk ikincil" onClick={() => { yaz(DEPO_IOS); setDurum(null); }}>{tt("Anladım")}</button>
        </div>
      </div>
    );
  }

  const kapat = () => { yaz(DEPO); setDurum(null); };

  return (
    <div className="bd-izin-kart">
      <div className="ikon" aria-hidden="true"><Ikon ad="zil" boyut={22} /></div>
      <div className="govde">
        <div className="bd-izin-baslik">{tt("Bir sonraki maçı kaçırma")}</div>
        <div className="alt-yazi">
          {tt("Sana meydan okunduğunda, turnuva başladığında ve haftalık lig sonuçlandığında haber verelim mi?")}
        </div>
        {hata && <div className="hata-kutu" style={{ marginTop: 6 }}>{hata}</div>}
      </div>
      <div className="bd-izin-butonlar">
        <button
          className="btn kucuk"
          disabled={calisiyor}
          onClick={async () => {
            setCalisiyor(true);
            setHata(null);
            try {
              await bildirimleriAc();
              yaz(DEPO);
              setDurum("acik");
            } catch (e) {
              console.error("[Bildim] bildirim aboneliği başarısız:", e);
              if (typeof Notification !== "undefined" && Notification.permission === "denied") kapat();   // oyuncu reddetti
              else setHata(hataMesaji(e, tt("Bildirimler açılamadı. Tekrar dene.")));
            } finally {
              setCalisiyor(false);
            }
          }}
        >
          {tt("Bildirimleri aç")}
        </button>
        <button className="btn kucuk ikincil" onClick={kapat}>
          {tt("Şimdi değil")}
        </button>
      </div>
    </div>
  );
}
