import { useState } from "react";
import Maskot from "./Maskot.jsx";
import Ikon from "./Ikon.jsx";

const KARTLAR = [
  {
    ikon: "kilic",
    poz: "selam",
    baslik: "Nasıl oynanır?",
    metin:
      "20 soruluk kapışmalarda rakibinle yarışırsın. Her doğru cevap 10 puan — " +
      "hızlı basmak fark etmez, bilmek yeter. Sıra beklemek yok: sen istediğin " +
      "zaman oynarsın, rakibin de kendi zamanında.",
    tema: "tema-meydan",
  },
  {
    ikon: "yildiz",
    poz: "dusunuyor",
    baslik: "On kategori",
    metin:
      "Genel Kültür, Bilim, Tarih, Coğrafya, Edebiyat, Spor, Sanat, Sinema, " +
      "Müzik ve Teknoloji. 5.000'den fazla doğrulanmış soru seni bekliyor.",
    tema: "tema-turnuva",
  },
  {
    ikon: "grafik",
    poz: "kutluyor",
    baslik: "Şehrini zirveye taşı",
    metin:
      "Kazandığın puanlar seni şehir, ülke ve dünya liglerinde yükseltir. " +
      "Her pazartesi yeni hafta başlar. Günlük turnuvalarda son kalan kazanır!",
    tema: "tema-lig",
  },
];

/**
 * İlk girişte gösterilen 3 kartlık tanıtım.
 * Kurulum sihirbazından ÖNCE gelir: kullanıcı ne oynayacağını bilmeden
 * takma ad/avatar/şehir soruları karşısına çıkmasın.
 */
export default function Tanitim({ onBitti }) {
  const [i, setI] = useState(0);
  const k = KARTLAR[i];
  const sonuncu = i === KARTLAR.length - 1;

  return (
    <div className="bd-tanitim-katman" role="dialog" aria-modal="true" aria-label="Tanıtım">
      <div className={`bd-tanitim ${k.tema}`}>
        <button className="bd-tanitim-atla" onClick={onBitti}>
          Atla
        </button>

        <div className="bd-tanitim-gorsel">
          <Maskot poz={k.poz} boyut={104} />
          <span className="bd-tanitim-ikon">
            <Ikon ad={k.ikon} boyut={24} />
          </span>
        </div>

        <div className="bd-tanitim-baslik">{k.baslik}</div>
        <p className="bd-tanitim-metin">{k.metin}</p>

        <div className="bd-tanitim-noktalar" aria-hidden="true">
          {KARTLAR.map((_, n) => (
            <span key={n} className={`nokta ${n === i ? "aktif" : ""}`} />
          ))}
        </div>

        <button
          className="btn"
          onClick={() => (sonuncu ? onBitti() : setI((x) => x + 1))}
        >
          {sonuncu ? "Hadi başlayalım!" : "Devam"}
        </button>
      </div>
    </div>
  );
}
