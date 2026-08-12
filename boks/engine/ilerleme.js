// ============================================================
// GÖLGE BOKS — ilerleme sistemi: başarım rozetleri, günlük seri (streak) ve
// kürasyonlu antrenman programları.
//
// Rozet kontrolü SAF fonksiyondur: oturum istatistiği + kariyer verisi girer,
// kazanılan rozet kodları çıkar. Kod listesi sunucuya gönderilir; sunucu zaten
// var olan rozeti tekrar yazmaz (boks_rozetler pk çakışması).
// ============================================================

export const ROZETLER = {
  ilk_antrenman: { ad: "İlk Zil", ikon: "🔔", aciklama: "İlk antrenmanını tamamladın." },
  ilk_pro: { ad: "Pro Round", ikon: "🥇", aciklama: "Pro zorlukta bir antrenman tamamladın." },
  jab_100: { ad: "100 Jab", ikon: "👊", aciklama: "Kariyerinde 100 doğru jab attın." },
  yumruk_1000: { ad: "1000 Yumruk", ikon: "💥", aciklama: "Kariyerinde 1000 yumruk kaydedildi." },
  yumruk_10000: { ad: "10.000 Yumruk", ikon: "🏆", aciklama: "Kariyerinde 10.000 yumruk kaydedildi." },
  combo_10: { ad: "Seri Ustası", ikon: "🔥", aciklama: "Tek antrenmanda 10'luk seri yaptın." },
  combo_20: { ad: "Kesintisiz", ikon: "⚡", aciklama: "Tek antrenmanda 20'lik seri yaptın." },
  gard_ustasi: { ad: "Gard Ustası", ikon: "🛡️", aciklama: "Bir antrenmanda gardını sürenin %92'sinde yukarıda tuttun." },
  cesitlilik: { ad: "Altı Silah", ikon: "🎯", aciklama: "Tek antrenmanda altı yumruk türünü de kullandın." },
  savunma_ustasi: { ad: "Gölge", ikon: "🌑", aciklama: "Savunma modunda %80 kaçınma oranına ulaştın." },
  ritim_ustasi: { ad: "Metronom", ikon: "🎵", aciklama: "Ritim modunda 20 mükemmel zamanlama yakaladın." },
  seri_3: { ad: "3 Gün Seri", ikon: "📅", aciklama: "Üst üste 3 gün antrenman yaptın." },
  seri_7: { ad: "7 Gün Seri", ikon: "🗓️", aciklama: "Üst üste 7 gün antrenman yaptın." },
  seri_30: { ad: "30 Gün Seri", ikon: "🔱", aciklama: "Üst üste 30 gün antrenman yaptın." },
  kalori_500: { ad: "500 Kalori", ikon: "🔥", aciklama: "Kariyerinde toplam 500 kalori yaktın." },
  stil_bulundu: { ad: "Stilini Buldun", ikon: "🧬", aciklama: "Kariyer analizinde stil profilin oluştu." },
  sert_vurus: { ad: "Ağır El", ikon: "🪨", aciklama: "Görece vuruş yoğunluğunda 95+ tepe değere ulaştın." },
  tam_kadraj: { ad: "Tam Kadraj", ikon: "🎥", aciklama: "Tüm vücudun kadrajdayken antrenman yaptın (duruş analizi açık)." },
};

/**
 * Bu oturumda kazanılan rozet kodlarını döndürür.
 * @param {object} ist  oturumun toplam istatistiği
 * @param {object} ctx  { zorluk, mod, kariyer, seriGun, kalori }
 */
export function rozetKontrol(ist, ctx = {}) {
  const k = ctx.kariyer || {};
  const kod = [];
  const ekle = (c) => kod.push(c);

  ekle("ilk_antrenman");
  if (ctx.zorluk === "pro") ekle("ilk_pro");

  const kariyerJab = (k.y1 || 0) + (ist.yumruk?.[1] || 0);
  if (kariyerJab >= 100) ekle("jab_100");
  const kariyerYumruk = (k.toplam_yumruk || 0) + ist.toplamYumruk;
  if (kariyerYumruk >= 1000) ekle("yumruk_1000");
  if (kariyerYumruk >= 10000) ekle("yumruk_10000");

  if (ist.enIyiCombo >= 10) ekle("combo_10");
  if (ist.enIyiCombo >= 20) ekle("combo_20");

  if (ist.gardOlcuSure > 30 && ist.gardDusukSure / ist.gardOlcuSure <= 0.08) ekle("gard_ustasi");

  let turSayisi = 0;
  for (let i = 1; i <= 6; i++) if ((ist.yumruk?.[i] || 0) > 0) turSayisi++;
  if (turSayisi === 6) ekle("cesitlilik");

  if (ist.kacinmaDeneme >= 8 && ist.kacinmaBasari / ist.kacinmaDeneme >= 0.8) ekle("savunma_ustasi");
  if (ist.ritimMukemmel >= 20) ekle("ritim_ustasi");

  const seri = ctx.seriGun || 0;
  if (seri >= 3) ekle("seri_3");
  if (seri >= 7) ekle("seri_7");
  if (seri >= 30) ekle("seri_30");

  if ((k.toplam_kalori || 0) + (ctx.kalori || 0) >= 500) ekle("kalori_500");
  if (ist.siddetMax >= 95) ekle("sert_vurus");
  if (ist.kapsam?.bacaklar) ekle("tam_kadraj");
  if ((k.toplam_round || 0) + 1 >= 12) ekle("stil_bulundu");

  return kod;
}

// ---------------------------------------------------------------
// Kürasyonlu antrenman programları (çok günlü yapılandırılmış planlar)
// ---------------------------------------------------------------
export const PROGRAMLAR = [
  {
    kod: "baslangic7",
    ad: "7 Günlük Başlangıç",
    ikon: "🌱",
    aciklama: "Temel duruş, jab-cross disiplini ve gard alışkanlığı kurar.",
    gunler: [
      { gun: 1, mod: "serbest", zorluk: "kolay", hedef: "Duruş ve gard: her yumruktan sonra eli yüzüne geri getir." },
      { gun: 2, mod: "koc", zorluk: "kolay", hedef: "1-2 kombinasyonunu refleks hâline getir." },
      { gun: 3, mod: "serbest", zorluk: "kolay", hedef: "Hook'u dağılıma sok: her seriyi 3 ya da 4 ile bitir." },
      { gun: 4, mod: "savunma", zorluk: "kolay", hedef: "Kafayı gövdeyle taşımayı öğren; yana çık." },
      { gun: 5, mod: "koc", zorluk: "orta", hedef: "Üç yumruklu kombinasyonlara geç." },
      { gun: 6, mod: "ritim", zorluk: "kolay", hedef: "Nefes ve tempo senkronu." },
      { gun: 7, mod: "serbest", zorluk: "orta", hedef: "Öğrendiklerini serbest round'da birleştir." },
    ],
  },
  {
    kod: "stil30",
    ad: "30 Günlük Stil Geliştirme",
    ikon: "🧬",
    aciklama: "Dört haftalık döngüyle silah çeşitliliğini, dayanıklılığı ve savunmayı birlikte geliştirir.",
    gunler: Array.from({ length: 30 }, (_, i) => {
      const g = i + 1;
      const dongu = i % 5;
      const mod = ["serbest", "koc", "savunma", "ritim", "koc"][dongu];
      const zorluk = g <= 8 ? "kolay" : g <= 18 ? "orta" : g <= 26 ? "zor" : "pro";
      const hedefler = [
        "Silah çeşitliliği: altı numarayı da kullan.",
        "Kombinasyon uzunluğu: en az üç yumrukluk seriler.",
        "Savunma: kaçınma oranını %70'in üstünde tut.",
        "Ritim: temponu round boyunca sabit tut.",
        "Gard disiplini: vuruş anında karşı el yukarıda kalsın.",
      ];
      return { gun: g, mod, zorluk, hedef: hedefler[dongu] };
    }),
  },
  {
    kod: "savunma14",
    ad: "14 Günlük Savunma Kampı",
    ikon: "🛡️",
    aciklama: "Kaçınma refleksi, gard disiplini ve mesafe okuma üzerine yoğunlaşır.",
    gunler: Array.from({ length: 14 }, (_, i) => {
      const g = i + 1;
      const mod = i % 3 === 2 ? "koc" : "savunma";
      const zorluk = g <= 5 ? "kolay" : g <= 10 ? "orta" : "zor";
      return {
        gun: g,
        mod,
        zorluk,
        hedef:
          mod === "savunma"
            ? "Geri değil YANA çık; merkez hattan ayrıl."
            : "Kombinasyon sonrası hemen gard pozisyonuna dön.",
      };
    }),
  },
];

/** Programda sıradaki günü döndürür (yerel ilerleme kaydından). */
export function programSonrakiGun(program, tamamlanan = 0) {
  const idx = Math.min(tamamlanan, program.gunler.length - 1);
  return program.gunler[idx];
}
