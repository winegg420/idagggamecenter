/**
 * KATEGORİ PROFİLİ (Paket 14, 4.8 / 4.10) — oyuncu kartı ve profil.
 * Sunucu: oyuncu_kategori_profili (asgari örneklemin altında yüzde gelmez).
 * Hiç maçı yoksa "Hiç maç yapmadı, istatistiği yok"; varsa kaç maç yaptığı
 * ve kaç maçın istatistiği olduğu yazar. En güçlü kategori unvan olur.
 */
import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import KategoriIkon from "./KategoriIkon.jsx";
import { kategoriAdi, kategorileriSirala } from "../lib/kategoriler.js";
import { unvanAdi } from "../lib/unvanlar.js";
import { useDil } from "../lib/dilKanca.js";

export default function KategoriProfili({ userId, profil: disaridan = null, kucuk = false }) {
  const { ceviri } = useDil();
  const [profil, setProfil] = useState(disaridan);
  const [hata, setHata] = useState(false);

  useEffect(() => {
    if (disaridan) { setProfil(disaridan); return; }
    if (!userId) return;
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("oyuncu_kategori_profili", { p_user: userId });
        if (error) throw error;
        if (aktif) setProfil(data ?? null);
      } catch (e) {
        console.error("[Bildim] kategori profili alinamadi:", e);
        if (aktif) setHata(true);
      }
    })();
    return () => { aktif = false; };
  }, [userId, disaridan]);

  if (hata) return null;
  if (!profil) return <div className="bd-kprofil bd-kprofil-yukleniyor" aria-busy="true" />;

  const toplamMac = Number(profil.toplam_mac ?? 0);
  const istatistikli = Number(profil.istatistikli_mac ?? 0);
  const unvan = unvanAdi(profil.unvan);

  if (toplamMac === 0 && istatistikli === 0) {
    return (
      <div className="bd-kprofil">
        <div className="bd-kprofil-bos">{ceviri("Hiç maç yapmadı, istatistiği yok")}</div>
      </div>
    );
  }

  const satirlar = kategorileriSirala(
    (profil.kategoriler ?? []).filter((k) => k.kategori !== "genel" && k.kategori !== "karisik")
  );

  return (
    <div className={`bd-kprofil ${kucuk ? "kucuk" : ""}`}>
      <div className="bd-kprofil-ust">
        {unvan && <span className="bd-unvan">{ceviri(unvan)}</span>}
        <span className="bd-kprofil-mac">
          {ceviri("{mac} maç · {istatistikli} maçın istatistiği", { mac: toplamMac, istatistikli })}
        </span>
      </div>
      {satirlar.length === 0 ? (
        <div className="bd-kprofil-bos">{ceviri("Henüz kategori istatistiği yok")}</div>
      ) : (
        <ul className="bd-kprofil-liste">
          {satirlar.map((k) => (
            <li key={k.kategori} className="bd-kprofil-satir">
              <KategoriIkon anahtar={k.kategori} boyut={18} plaka />
              <span className="bd-kprofil-ad">{ceviri(kategoriAdi(k.kategori))}</span>
              {k.yuzde === null || k.yuzde === undefined ? (
                <span className="bd-kprofil-veri-yok">{ceviri("veri yok")}</span>
              ) : (
                <>
                  <span className="bd-kprofil-bar" aria-hidden="true">
                    <span className="dolgu" style={{ width: `${k.yuzde}%` }} />
                  </span>
                  <span className="bd-kprofil-yuzde">%{k.yuzde}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
