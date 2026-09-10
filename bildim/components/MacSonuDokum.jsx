import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { rutbeBul, sonrakiRutbe } from "../lib/ranks.js";
import { hareketAzalt } from "../lib/geriBildirim.js";

/**
 * Maç sonu ekranındaki döküm bloğu:
 *  - tur tur doğru/yanlış noktaları
 *  - rütbe ilerleme çubuğu ve bu maçla gelen artış
 *
 * NOT: match_answers RLS'i yalnız KENDİ cevaplarını gösteriyor (bkz.
 * match_answers_select_own), bu yüzden döküm oyuncunun kendi turlarıdır.
 * Rakibin tur dökümü için ayrı bir RPC gerekirdi; bu görev arayüz işi
 * olduğu için sunucu tarafına dokunulmadı.
 */
export default function MacSonuDokum({ macId, kazanilanPuan = 0 }) {
  const [turlar, setTurlar] = useState(null);
  const [puan, setPuan] = useState(null);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("match_answers")
          .select("soru_index, dogru, cevap")
          .eq("match_id", macId)
          .order("soru_index");
        if (!error && aktif) setTurlar(data ?? []);
      } catch {
        /* migration/RLS engeli — blok sessizce gizlenir */
      }
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) return;
        const p = await supabase
          .from("profiles")
          .select("puan")
          .eq("id", data.user.id)
          .maybeSingle();
        if (!p.error && aktif) setPuan(p.data?.puan ?? null);
      } catch {
        /* sessiz geç */
      }
    })();
    return () => {
      aktif = false;
    };
  }, [macId]);

  if (!turlar || turlar.length === 0) return null;

  const dogruSayisi = turlar.filter((t) => t.dogru).length;

  // Rütbe ilerlemesi: çubuk maç ÖNCESİ değerden başlar, sonra bu maçın
  // kazancı kadar dolar — artış gözle görülsün.
  let ilerlemeBlok = null;
  if (puan != null) {
    const oncesi = Math.max(0, puan - kazanilanPuan);
    const rutbe = rutbeBul(puan);
    const sonraki = sonrakiRutbe(puan);
    const yuzde = (p) => {
      if (!sonraki) return 100;
      const aralik = sonraki.min - rutbe.min;
      if (aralik <= 0) return 100;
      return Math.max(0, Math.min(100, ((p - rutbe.min) / aralik) * 100));
    };
    ilerlemeBlok = (
      <div className="bd-sonuc-rutbe" style={{ "--rutbe": rutbe.renk }}>
        <div className="bd-sonuc-rutbe-ust">
          <span className="bd-sonuc-rutbe-ad">{rutbe.ad}</span>
          {sonraki ? (
            <span className="bd-sonuc-rutbe-kalan">
              {sonraki.ad} rütbesine {Math.max(0, sonraki.min - puan)} puan
            </span>
          ) : (
            <span className="bd-sonuc-rutbe-kalan">En yüksek rütbe</span>
          )}
        </div>
        <div className="bd-sonuc-rutbe-bar">
          {/* Önceki seviye sabit; üstündeki katman animasyonla yeni değere gider */}
          <div className="eski" style={{ width: `${yuzde(oncesi)}%` }} />
          <div
            className={`dolgu ${hareketAzalt() ? "" : "artiyor"}`}
            style={{
              "--baslangic": `${yuzde(oncesi)}%`,
              "--bitis": `${yuzde(puan)}%`,
              width: `${yuzde(puan)}%`,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bd-sonuc-dokum">
      <div className="bd-dokum-baslik">
        Turların — <b>{dogruSayisi}</b>/{turlar.length} doğru
      </div>
      <div className="bd-dokum-turlar">
        {turlar.map((t) => (
          <span
            key={t.soru_index}
            className={`bd-tur-nokta ${
              t.dogru ? "dogru" : t.cevap === -1 ? "sure" : "yanlis"
            }`}
            title={`${t.soru_index + 1}. soru: ${
              t.dogru ? "doğru" : t.cevap === -1 ? "süre doldu" : "yanlış"
            }`}
          >
            {t.soru_index + 1}
          </span>
        ))}
      </div>
      {ilerlemeBlok}
    </div>
  );
}
