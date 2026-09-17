import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { tt } from "../lib/dil.js";

/**
 * Paket 20 I.3 — Maç sonu ödül dökümü (satır satır).
 * Kalemler SUNUCUDAN gelir (`odul_dokumu`): ödülü yazan fonksiyon kalemini de yazar. Burada hiçbir ödül
 * yeniden hesaplanmaz — ekrandaki toplam ile hesaba geçen miktar ayrışamaz.
 *
 * kaynak: "mac:<id>" · "duello:<id>" · "hizli:<id>" · "turnuva:<id>" · "grup:<id>"
 * onToplam({lig, coin}): sayfanın üstteki kazanç satırı aynı toplamı göstersin diye.
 */
const INDIRIM = {
  serbest: "serbest maç — coin yarı",
  cift_yari: "çift koruması — %50",
  cift_odulsuz: "aynı rakiple bugün çok maç — ödülsüz",
  acik_bot: "açık bot — coin yarı",
};

function kalemAdi(k) {
  const d = k.detay ?? {};
  switch (k.kalem) {
    case "galibiyet": return tt("Galibiyet");
    case "beraberlik": return tt("Beraberlik");
    case "seri": return tt("Günlük seri ({gun} gün)", { gun: d.gun ?? 1 });
    case "hizli_dogru": return tt("{dogru} doğru cevap", { dogru: d.dogru ?? 0 });
    case "turnuva_derece": return tt("Turnuva: {sira}. sıra", { sira: d.sira ?? "?" });
    case "turnuva_katilim": return tt("Turnuvaya katılım");
    case "turnuva_giysi_tekrar": return tt("Turnuva giysisi zaten sende");
    default: return k.kalem;
  }
}

function miktar(k) {
  const p = [];
  if (k.lig) p.push(tt("+{lig} lig", { lig: k.lig }));
  if (k.coin) p.push(tt("+{coin} coin", { coin: k.coin }));
  return p.length ? p.join(" · ") : "0";
}

export default function OdulDokumu({ kaynak, onToplam, gorevleriGoster = true }) {
  const [dokum, setDokum] = useState(null);

  useEffect(() => {
    if (!kaynak) return;
    let aktif = true;
    let zamanlayici = null;
    // Ödül maçı bitiren işlemle aynı anda yazılır; sonuç ekranı çok erken açılırsa iki kez daha bakılır.
    const bekle = [0, 1500, 4000];
    const dene = async (i) => {
      try {
        const { data, error } = await supabase.rpc("odul_dokumu", { p_kaynak: kaynak });
        if (error) throw error;
        if (!aktif) return;
        setDokum(data);
        if (data?.hazir && data.toplam && onToplam) onToplam(data.toplam);
        if (!data?.hazir && i + 1 < bekle.length) zamanlayici = setTimeout(() => dene(i + 1), bekle[i + 1]);
      } catch (e) {
        console.error("[Bildim] odul_dokumu başarısız:", e);
      }
    };
    dene(0);
    return () => { aktif = false; if (zamanlayici) clearTimeout(zamanlayici); };
    // onToplam her çizimde yeni fonksiyon olabilir; yalnız kaynak değişince yeniden okunur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kaynak]);

  if (!dokum) return null;
  const kalemler = dokum.kalemler ?? [];
  const rozetler = dokum.rozetler ?? [];
  const gorevler = gorevleriGoster ? (dokum.gorevler ?? []).filter((g) => !g.alindi) : [];
  if (!kalemler.length && !rozetler.length && !gorevler.length) return null;

  return (
    <div className="bd-odul-dokum" aria-label={tt("Ödül dökümü")}>
      {kalemler.map((k) => (
        <div key={k.kalem} className="bd-odul-satir">
          <span className="ad">
            {kalemAdi(k)}
            {k.detay?.indirim && INDIRIM[k.detay.indirim] && (
              <span className="bd-odul-indirim">{tt(INDIRIM[k.detay.indirim])}</span>
            )}
            {k.detay?.tavan && <span className="bd-odul-indirim">{tt("günlük coin tavanı doldu")}</span>}
          </span>
          <span className="deger">{miktar(k)}</span>
        </div>
      ))}
      {kalemler.length > 1 && (
        <div className="bd-odul-satir toplam">
          <span className="ad">{tt("Toplam")}</span>
          <span className="deger">{miktar(dokum.toplam ?? {})}</span>
        </div>
      )}
      {rozetler.map((r) => (
        <div key={r.id} className="bd-odul-satir bilgi">
          <span className="ad">{tt("Açılan rozet: {ad}", { ad: `${r.ikon ?? ""} ${tt(r.ad)}`.trim() })}</span>
        </div>
      ))}
      {gorevler.map((g) => (
        <div key={g.id} className="bd-odul-satir bilgi">
          <span className="ad">{tt("Günlük görev: {ad}", { ad: tt(g.ad) })}</span>
          <span className="deger">{g.ilerleme}/{g.hedef}</span>
        </div>
      ))}
    </div>
  );
}
