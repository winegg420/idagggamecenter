// "Hızlı Olan Kazanır" bot dengesi simülasyonu (Revize #3 · madde 1).
//
// KÖK NEDEN
// ---------
// Eski kural:  `and now() >= hm.soru_baslangic + (2 + random() * 4) * interval '1 second'`
// Bu koşul `bot_oyna` HER çalıştığında yeniden değerlendirilir ve random() her
// seferinde yeniden çekilir. Yani bot "2-6 sn arası" beklemez; her yoklamada
// yeni bir zar atar ve ilk tutan zarda basar. Yoklama ne kadar sıklaşırsa
// gerçekleşen gecikme o kadar 2.0 sn tabanına yığılır — cron 7 saniyede bir
// planlanmış olsa da fonksiyon uzun sürdüğünde arka arkaya çalışır, bu da
// pratikte sürekli yoklama demektir. Sonuç: bot her soruda ~2.0 sn'de basıyor,
// 2 sn'de cevaplayan insan ağ gecikmesi yüzünden HER ZAMAN geç kalıyordu.
//
// Yeni kural: gecikme zorluk penceresinden çekilir ve (maç, soru, bot) üçlüsü
// için md5 ile SABİTLENİR (public.bot_gecikme_sn). Kaç kez yoklanırsa yoklansın
// aynı değeri döndürür; yığılma ortadan kalkar.
//
// Çalıştır: node bildim/_test/hizli-bot-simulasyon.mjs

const SORU_SAYISI = 20;
const TUR = 3000;          // Monte Carlo tur sayısı
const INSAN_TEPKI = 2.0;   // oyuncu şıkka basma süresi (sn)
// bot_gecikme_sn içindeki kavrama payı: gecikme penceresi oyuncunun soruyu
// GÖRDÜĞÜ andan sayılsın diye sunucu tarafında eklenen sabit.
const KAVRAMA_PAYI = 1.0;

// Migration 20260612000074 ile yazılan değerler
const YENI_BOTLAR = [
  { ad: "ÇaylakBot", seviye: "kolay", isabet: 0.45, min: 4.5, max: 7.0 },
  { ad: "AcemiBot", seviye: "kolay", isabet: 0.45, min: 4.5, max: 7.0 },
  { ad: "BilgeBot", seviye: "orta", isabet: 0.65, min: 3.0, max: 5.0 },
  { ad: "KurtBot", seviye: "orta", isabet: 0.65, min: 3.0, max: 5.0 },
  { ad: "UstaBot", seviye: "zor", isabet: 0.85, min: 2.0, max: 3.5 },
];

// Eski değerler: gecikme penceresi herkes için aynı (2-6), isabet 0.25-0.90
const ESKI_BOTLAR = [
  { ad: "ÇaylakBot", isabet: 0.4, min: 2, max: 6 },
  { ad: "AcemiBot", isabet: 0.25, min: 2, max: 6 },
  { ad: "BilgeBot", isabet: 0.7, min: 2, max: 6 },
  { ad: "KurtBot", isabet: 0.55, min: 2, max: 6 },
  { ad: "UstaBot", isabet: 0.9, min: 2, max: 6 },
];

/**
 * Botun gerçekte bastığı an.
 * yenidenCek=true  → eski kural: her yoklamada yeni zar (tabana yığılır)
 * yenidenCek=false → yeni kural: gecikme bir kez çekilir, sabit kalır
 */
function botAni(bot, yoklamaAraligi, yenidenCek) {
  if (!yenidenCek) {
    const gecikme = KAVRAMA_PAYI + bot.min + Math.random() * (bot.max - bot.min);
    let t = yoklamaAraligi * Math.random(); // ilk yoklamanın faz farkı
    while (t < gecikme) t += yoklamaAraligi;
    return t;
  }
  let t = yoklamaAraligi * Math.random();
  for (let i = 0; i < 4000; i++) {
    const esik = bot.min + Math.random() * (bot.max - bot.min);
    if (t >= esik) return t;
    t += yoklamaAraligi;
  }
  return Infinity;
}

/** Bir soruyu kim kapar? true = insan */
function soru(botlar, yoklama, yenidenCek, insanAn, insanDogru) {
  let enErken = Infinity;
  for (const b of botlar) {
    if (Math.random() >= b.isabet) continue; // bot bu soruyu bilemedi
    const t = botAni(b, yoklama, yenidenCek);
    if (t < enErken) enErken = t;
  }
  return insanDogru && insanAn < enErken;
}

function calistir(botlar, yoklama, yenidenCek, agGecikme, insanIsabet = 1.0) {
  const insanAn = INSAN_TEPKI + agGecikme;
  let toplam = 0;
  let enDusuk = SORU_SAYISI;
  let hicKazanmadi = 0;
  for (let t = 0; t < TUR; t++) {
    let kazanilan = 0;
    for (let s = 0; s < SORU_SAYISI; s++) {
      if (soru(botlar, yoklama, yenidenCek, insanAn, Math.random() < insanIsabet)) kazanilan++;
    }
    toplam += kazanilan;
    if (kazanilan < enDusuk) enDusuk = kazanilan;
    if (kazanilan === 0) hicKazanmadi++;
  }
  return { ortalama: toplam / TUR, enDusuk, hicKazanmama: (hicKazanmadi / TUR) * 100 };
}

const yaz = (etiket, r) =>
  console.log(
    `  ${etiket.padEnd(6)}→ ortalama ${r.ortalama.toFixed(1)}/20 · ` +
      `en kötü tur ${String(r.enDusuk).padStart(2)}/20 · hiç kazanamama %${r.hicKazanmama.toFixed(1)}`
  );

console.log("Hızlı Olan Kazanır — bot dengesi simülasyonu");
console.log(`${SORU_SAYISI} soru · ${TUR} tur · oyuncu şıkka ${INSAN_TEPKI} sn'de basıyor ve soruyu biliyor`);
console.log("");

// Yoklama sıklığı: 0.5 sn = fonksiyon arka arkaya çalışıyor (gözlenen durum),
// 7 sn = cron planındaki ideal aralık.
for (const yoklama of [0.5, 7]) {
  for (const ag of [0.5, 1.5]) {
    console.log(
      `Yoklama ${yoklama} sn · ağ/render gecikmesi ${ag} sn ` +
        `(oyuncu sunucu saatiyle ${(INSAN_TEPKI + ag).toFixed(1)}. sn'de basıyor)`
    );
    yaz("ESKİ", calistir(ESKI_BOTLAR, yoklama, true, ag));
    yaz("YENİ", calistir(YENI_BOTLAR, yoklama, false, ag));
    console.log("");
  }
}

// Kabul ölçütü: 2 sn'de cevaplayan ve soruları bilen bir oyuncu 20 soruda
// en az 6-8 soruyu kapmalı. En zorlu senaryo ile ölçülür:
// sürekli yoklama (0.5 sn) + 1.5 sn ağ gecikmesi.
const olcut = calistir(YENI_BOTLAR, 0.5, false, 1.5);
const gecti = olcut.ortalama >= 8 && olcut.enDusuk >= 6;
console.log(
  `${gecti ? "SONUÇ: GEÇTİ" : "SONUÇ: KALDI"} — en zorlu senaryoda (sürekli yoklama + 1.5 sn ağ) ` +
    `ortalama ${olcut.ortalama.toFixed(1)}/20, en kötü tur ${olcut.enDusuk}/20 (hedef: ortalama ≥8, en kötü ≥6)`
);
process.exit(gecti ? 0 : 1);
