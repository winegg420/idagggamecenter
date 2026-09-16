import { tt } from "./dil.js";
// Açık botun zorluk etiketi — isabetten türetilir. ChallengesPage'teki bot
// listesi ve "Beklemeden bot ile oyna" seçimi (RakipAra) aynı eşikleri
// kullansın diye tek yerde (Paket 12, madde 6).
//
// Girdi yalnız AÇIK bota ait türetilmiş `acik_bot_isabet` (migration 192);
// ham `bot_isabet` istemciye kapalı — gizli botları ele verir.
//
// Beş bot var (isabet 0.25 · 0.40 · 0.55 · 0.70 · 0.90); eşikler beşi de
// ayrı gösterecek şekilde ayarlandı — önceden üçü aynı etikete düşüyordu.
export const botZorluk = (isabet) =>
  isabet <= 0.30
    ? { etiket: tt("Çok kolay"), renk: "var(--bd-basari-metin)" }
    : isabet <= 0.45
      ? { etiket: tt("Kolay"), renk: "var(--bd-basari-metin)" }
      : isabet <= 0.60
        ? { etiket: tt("Orta"), renk: "var(--bd-odul-metin)" }
        : isabet <= 0.75
          ? { etiket: tt("Zor"), renk: "var(--bd-vurgu-metin)" }
          : { etiket: tt("Çok zor"), renk: "var(--bd-hata-metin)" };
