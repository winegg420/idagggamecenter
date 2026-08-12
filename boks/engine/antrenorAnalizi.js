// ============================================================
// GÖLGE BOKS — Antrenör Modu analiz motoru
//
// Ham sayaçları (bkz. oyun.js · bosIstatistik) profesyonel bir boks antrenörünün
// vereceği düzeyde, VERİYE DAYALI geri bildirime çevirir. Jenerik cümle yoktur:
// her yorum bir ölçüme ve eşiğe bağlıdır, metinde sayı geçer.
//
// KAPSAM KURALI: analiz yalnız kameranın GÖRDÜĞÜ bölgelere dayanır. `ist.kapsam`
// kalça/bacak görmediğini söylüyorsa duruş-denge bölümü hiç üretilmez —
// eksik veri asla varsayılmaz veya uydurulmaz.
//
// Üretilenler:
//   stilVektoru()      → 8 boyutlu stil profili (dövüşçü eşleştirmesinin girdisi)
//   stilArketip()      → "Rus amatör okulu", "Meksika baskı boksu" gibi tanım
//   roundAnalizi()     → round sonu rapor (özet + maddeler + tek somut ipucu)
//   oturumAnalizi()    → tüm antrenmanın raporu
//   zayiflikTespit()   → takip edilecek zayıflık kodları (koçluk döngüsü)
//   kariyerAnalizi()   → birikmiş veriden dövüşçü kimliği + gelişim trendi
//   zorlukOnerisi()    → seviye testinden zorluk kalibrasyonu
// ============================================================

import { enYakinDovuscular, DOVUSCU_SAYISI } from "./dovusculKutuphanesi.js";

const yuzde = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const sinir = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/** Kısa yumruk adları (metinlerde kullanılır). */
export const YUMRUK_TR = {
  1: "jab",
  2: "cross (arka düz)",
  3: "ön hook",
  4: "arka hook",
  5: "ön uppercut",
  6: "arka uppercut",
};

// ---------------------------------------------------------------
// 1) STİL VEKTÖRÜ — dövüşçü eşleştirmesinin ve arketipin girdisi
// ---------------------------------------------------------------
/**
 * Ham sayaçlardan 8 boyutlu (0-100) stil profili üretir.
 * @param {object} ist  oyun.js istatistiği (round ya da toplam)
 * @param {object} [ek] { sureSn } — verilmezse ist.sure kullanılır
 */
export function stilVektoru(ist, ek = {}) {
  const sure = Math.max(1, ek.sureSn || ist.sure || 1);
  const dk = sure / 60;
  const toplam = Math.max(1, ist.toplamYumruk);
  const y = ist.yumruk || {};

  const duz = (y[1] || 0) + (y[2] || 0);
  const hook = (y[3] || 0) + (y[4] || 0);
  const upper = (y[5] || 0) + (y[6] || 0);
  const ypm = ist.toplamYumruk / dk; // dakikadaki yumruk (iş hacmi)

  // Gard: düşük gard süresinin ölçülebilen süreye oranı → ters çevrilir.
  const gardOran = ist.gardOlcuSure > 0 ? ist.gardDusukSure / ist.gardOlcuSure : 0;
  const vurustaAcik = yuzde(ist.vurustaAcikGard, toplam) / 100;
  const gard = sinir(Math.round(100 - (gardOran * 0.68 + vurustaAcik * 0.32) * 145));

  // Baskı: hacim + isabet yoğunluğu (pas geçilen pad az) + kısa aralıklar.
  const baski = sinir(Math.round(ypm * 1.35 + yuzde(ist.isabet, toplam) * 0.28));

  // Çeşitlilik: Shannon benzeri dağılım genişliği (tek silaha bağımlılık cezalı).
  let cesitlilik = 0;
  for (let i = 1; i <= 6; i++) {
    const p = (y[i] || 0) / toplam;
    if (p > 0) cesitlilik -= p * Math.log(p);
  }
  cesitlilik = sinir(Math.round((cesitlilik / Math.log(6)) * 100));

  // Tempo: iş hacmi (dakikada 60+ yumruk çok yüksek kabul edilir).
  const tempo = sinir(Math.round((ypm / 62) * 100));

  // Güç: görece şiddet ortalaması + tepe değeri.
  const ortSiddet = ist.siddetToplam / toplam || 0;
  const guc = sinir(Math.round(ortSiddet * 0.72 + ist.siddetMax * 0.28));

  // Kontra eğilimi: düşük hacim + yüksek isabet + uzun bekleme (kaçırma az).
  const isabetOran = yuzde(ist.isabet, toplam);
  const kontra = sinir(Math.round(100 - ypm * 1.15 + (isabetOran - 50) * 0.5));

  // Hareket: savunma modu kaçış başarısı + genel devinim göstergesi.
  const kacinma = ist.kacinmaDeneme > 0 ? yuzde(ist.kacinmaBasari, ist.kacinmaDeneme) : null;
  const hareket = sinir(Math.round(kacinma == null ? 40 + tempo * 0.32 : kacinma * 0.8 + tempo * 0.2));

  // Kombinasyon: en iyi seri + ardışık isabet eğilimi.
  const kombinasyon = sinir(Math.round(ist.enIyiCombo * 7 + isabetOran * 0.3));

  return {
    gard,
    baski,
    cesitlilik,
    tempo,
    guc,
    kontra,
    hareket,
    kombinasyon,
    // yardımcı ham oranlar (metin üretiminde kullanılır)
    _duzOran: yuzde(duz, toplam),
    _hookOran: yuzde(hook, toplam),
    _upperOran: yuzde(upper, toplam),
    _ypm: Math.round(ypm),
    _gardDusukOran: Math.round(gardOran * 100),
    _isabetOran: isabetOran,
    _kacinma: kacinma,
  };
}

// ---------------------------------------------------------------
// 2) STİL ARKETİPİ
// ---------------------------------------------------------------
const ARKETIPLER = [
  {
    kod: "rus_amator",
    ad: "Rus / Doğu Avrupa amatör okulu",
    aciklama:
      "Yüksek ve dar gard, ölçülü iş hacmi, düz yumruk (jab-cross) hâkimiyeti. Puan boksuna yatkın, riski düşük tutan yapı.",
    test: (v) => v.gard >= 62 && v._duzOran >= 55 && v.tempo < 62,
  },
  {
    kod: "peekaboo",
    ad: "Peek-a-boo / baskı boksu",
    aciklama:
      "Çok yüksek gard, sürekli ilerleme ve kısa mesafede kanca üretimi. Kafa hareketiyle içeri girip seri açan agresif yapı.",
    test: (v) => v.gard >= 66 && v.baski >= 62 && v._hookOran >= 28,
  },
  {
    kod: "meksika",
    ad: "Meksika baskı boksu",
    aciklama:
      "Yüksek iş hacmi, gövde-kafa geçişleri ve kanca ağırlıklı kombinasyonlar. Karşılıklı çalışmayı seçen, tempoyu hiç düşürmeyen yapı.",
    test: (v) => v.tempo >= 62 && v._hookOran >= 25 && v.kombinasyon >= 45,
  },
  {
    kod: "kontra",
    ad: "Kontra / zamanlama boksu",
    aciklama:
      "Düşük hacim, yüksek isabet ve bekleyip cevaplama eğilimi. Rakibin hatasını bekleyen, ekonomik enerji kullanan yapı.",
    test: (v) => v.kontra >= 62 && v.tempo < 52,
  },
  {
    kod: "dusuk_gard",
    ad: "Düşük gard / refleks tarzı",
    aciklama:
      "Eller bel-göğüs hizasında, savunma refleks ve mesafeye emanet. Görsel olarak rahat ama açık veren, tecrübe isteyen bir yapı.",
    test: (v) => v.gard < 45,
  },
  {
    kod: "kickboks",
    ad: "Kickboks eğilimi",
    aciklama:
      "Dik duruş, uzun mesafe, geniş yaylı kancalar ve az uppercut. Eller arasındaki mesafe boks gardından daha açık.",
    test: (v) => v._upperOran < 10 && v._hookOran >= 30 && v.gard >= 50,
  },
  {
    kod: "muaythai",
    ad: "Muaythai eğilimi",
    aciklama:
      "Çok yüksek ve öne uzatılmış gard, düşük yumruk hacmi, tek ve seçici atışlar. Yumruk mesafesinden çok klinç-mesafe hissi veren yapı.",
    test: (v) => v.gard >= 70 && v.tempo < 45 && v.kombinasyon < 40,
  },
  {
    kod: "klasik",
    ad: "Klasik boks temeli",
    aciklama:
      "Dengeli gard, dengeli hacim ve jab üzerine kurulu düzenli yapı. Belirgin bir uca kaçmayan, sağlam temel.",
    test: () => true,
  },
];

/** Stil vektöründen arketip tanısı (ilk eşleşen kural). */
export function stilArketip(v) {
  return ARKETIPLER.find((a) => a.test(v)) || ARKETIPLER[ARKETIPLER.length - 1];
}

// ---------------------------------------------------------------
// 3) ZAYIFLIK KATALOĞU — koçluk geri bildirim döngüsünün omurgası
// ---------------------------------------------------------------
export const ZAYIFLIKLAR = {
  gard_dusuk: {
    ad: "Gard düşüyor",
    aciklama: "Eller çene hizasının belirgin altında kalıyor.",
    tavsiye:
      "Dirsekler kaburgaya yapışık, eldivenler elmacık kemiği hizasında kalsın. Her yumruktan sonra eli AYNI yoldan yüzüne geri getir — geri dönüş yolu, gidiş yolu kadar önemlidir.",
  },
  vurusta_acik: {
    ad: "Vuruş anında karşı el düşüyor",
    aciklama: "Bir el çalışırken diğeri savunma görevini bırakıyor.",
    tavsiye:
      "Jab atarken sağ el çeneye kilitli kalmalı (ortodoks). Aynada 30 saniye yalnız 'bir el vurur, diğeri kilitli' çalış — bu, kontra yiyen boksörlerin bir numaralı açığıdır.",
  },
  el_dengesizligi: {
    ad: "Tek el bağımlılığı",
    aciklama: "Yumrukların büyük çoğunluğu tek elden geliyor.",
    tavsiye:
      "Zayıf elle 20 tekrarlık jab serileri yap. Dengesiz el kullanımı hem tahmin edilebilir olmana hem de gövdenin tek yöne yorulmasına yol açar.",
  },
  cesitlilik_dusuk: {
    ad: "Silah çeşitliliği dar",
    aciklama: "Yumruk dağılımı birkaç numaraya sıkışmış.",
    tavsiye:
      "Her kombinasyonu farklı bir numarayla bitir. Tahmin edilebilirlik, teknikten önce gelen bir zayıflıktır: rakip üçüncü tekrarda ritmini okur.",
  },
  uppercut_yok: {
    ad: "Uppercut kullanılmıyor",
    aciklama: "Aparkat neredeyse hiç üretilmiyor.",
    tavsiye:
      "Dizlerden gelen kısa aparkatı 1-6-3 gibi kombinasyonlarla çalış. Uppercut, yakın mesafede gardı açan tek yumruktur; olmadan iç mesafede silahsız kalırsın.",
  },
  hook_yok: {
    ad: "Kanca (hook) kullanılmıyor",
    aciklama: "Yanal yumruklar dağılımda çok düşük.",
    tavsiye:
      "Ön ayak topuğunu döndürerek kısa hook çalış — güç kollardan değil kalça rotasyonundan gelir. Yalnız düz yumrukla çalışmak seni tek düzlemde bırakır.",
  },
  kombinasyon_kisa: {
    ad: "Kombinasyonlar kısa",
    aciklama: "Ardışık isabet serileri kopuyor.",
    tavsiye:
      "Tek yumrukla yetinme: her jab'ın ardından en az bir yumruk daha gelsin (1-2, 1-2-3). Seri kurmak, gerçek maçta açıklığı yaratan şeydir.",
  },
  isabet_dusuk: {
    ad: "İsabet oranı düşük",
    aciklama: "Atılan yumrukların önemli kısmı hedefe ulaşmıyor.",
    tavsiye:
      "Hedefe bakarak vur ve mesafeyi ayakla ayarla — kolu uzatarak değil. Yumruğu 'atmak' değil, mesafeyi doğru kurmak isabeti belirler.",
  },
  yanlis_tur: {
    ad: "Komut okuma hatası",
    aciklama: "Doğru pede yanlış türde yumruk gidiyor.",
    tavsiye:
      "Numaraları refleks hâline getir: 1 jab, 2 cross, 3-4 hook, 5-6 uppercut. Salon dilini bilmek, koçun tempoya müdahale edebilmesi demektir.",
  },
  tempo_dususu: {
    ad: "Round içinde tempo düşüşü",
    aciklama: "Round'un ikinci yarısında iş hacmi belirgin azalıyor.",
    tavsiye:
      "Nefesi vuruşla senkronla: her yumrukta kısa bir 'ss' nefes ver. Aerobik dayanıklılık için round süresini sabit tutup tempoyu kademeli artır.",
  },
  kacinma_zayif: {
    ad: "Kaçınma yetersiz",
    aciklama: "Gelen vuruşlardan çıkma oranı düşük.",
    tavsiye:
      "Kafayı gövdeyle birlikte taşı: dizlerden hafif çök, merkez hattan dışarı çık. Sadece geri kaçmak seni köşeye götürür — yana çıkmayı öğren.",
  },
  postur: {
    ad: "Gövde duruşu bozuluyor",
    aciklama: "Omuz-kalça ekseni dikey hattan belirgin sapıyor.",
    tavsiye:
      "Çeneyi göğse yakın, sırtı nötr tut; ağırlığı iki ayağa dengeli dağıt. Öne aşırı eğilmek hem dengeni hem gücünü kaybettirir.",
  },
};

/**
 * Sayaçlardan zayıflık kodlarını çıkarır (öncelik sırasıyla).
 * @returns {Array<{kod:string, siddet:number, olcum:string}>}
 */
export function zayiflikTespit(ist, v = null) {
  const vek = v || stilVektoru(ist);
  const toplam = Math.max(1, ist.toplamYumruk);
  const bulgular = [];
  const ekle = (kod, siddet, olcum) => bulgular.push({ kod, siddet: sinir(siddet), olcum });

  if (vek._gardDusukOran >= 22) {
    ekle("gard_dusuk", vek._gardDusukOran, `ölçülen sürenin %${vek._gardDusukOran}'inde gard düşük`);
  }
  const acikOran = yuzde(ist.vurustaAcikGard, toplam);
  if (acikOran >= 18) {
    ekle("vurusta_acik", acikOran, `${ist.vurustaAcikGard} vuruşta (%${acikOran}) karşı el düşüktü`);
  }
  const solOran = yuzde(ist.solYumruk, toplam);
  if (toplam >= 12 && (solOran >= 72 || solOran <= 28)) {
    ekle(
      "el_dengesizligi",
      Math.abs(solOran - 50) * 2,
      `sol %${solOran} · sağ %${100 - solOran}`,
    );
  }
  if (toplam >= 12 && vek.cesitlilik < 45) {
    ekle("cesitlilik_dusuk", 100 - vek.cesitlilik, `çeşitlilik skoru ${vek.cesitlilik}/100`);
  }
  if (toplam >= 15 && vek._upperOran < 6) {
    ekle("uppercut_yok", 70, `uppercut oranı %${vek._upperOran}`);
  }
  if (toplam >= 15 && vek._hookOran < 8) {
    ekle("hook_yok", 65, `hook oranı %${vek._hookOran}`);
  }
  if (toplam >= 10 && ist.enIyiCombo <= 2) {
    ekle("kombinasyon_kisa", 60, `en uzun seri ${ist.enIyiCombo}`);
  }
  if (toplam >= 12 && vek._isabetOran < 42) {
    ekle("isabet_dusuk", 100 - vek._isabetOran, `isabet %${vek._isabetOran}`);
  }
  if (ist.yanlisTur >= 4 && yuzde(ist.yanlisTur, toplam) >= 12) {
    ekle("yanlis_tur", yuzde(ist.yanlisTur, toplam) * 3, `${ist.yanlisTur} kez yanlış tür`);
  }
  if (ist.tempoDilim && ist.tempoDilim.length >= 3) {
    const ilk = ist.tempoDilim[0];
    const son = ist.tempoDilim[ist.tempoDilim.length - 1];
    if (ilk >= 6 && son < ilk * 0.65) {
      ekle("tempo_dususu", 70, `ilk dilim ${ilk} → son dilim ${son} yumruk`);
    }
  }
  if (ist.kacinmaDeneme >= 5) {
    const k = yuzde(ist.kacinmaBasari, ist.kacinmaDeneme);
    if (k < 55) ekle("kacinma_zayif", 100 - k, `kaçınma %${k}`);
  }
  if (ist.posturUyari >= 2 && ist.kapsam?.kalca) {
    ekle("postur", 60, `${ist.posturUyari} postür uyarısı`);
  }

  bulgular.sort((a, b) => b.siddet - a.siddet);
  return bulgular;
}

// ---------------------------------------------------------------
// 4) ROUND ANALİZİ
// ---------------------------------------------------------------
/**
 * @param {object} ist round istatistiği
 * @param {object} ctx { mod, zorluk, durus, roundNo, oncekiZayifliklar? }
 */
export function roundAnalizi(ist, ctx = {}) {
  const v = stilVektoru(ist);
  const arketip = stilArketip(v);
  const toplam = Math.max(1, ist.toplamYumruk);
  const bulgular = zayiflikTespit(ist, v);
  const madde = [];

  // --- yumruk dağılımı ---
  const dagilim = [];
  for (let i = 1; i <= 6; i++) {
    const s = ist.yumruk[i] || 0;
    if (s > 0) dagilim.push({ no: i, ad: YUMRUK_TR[i], sayi: s, oran: yuzde(s, toplam) });
  }
  dagilim.sort((a, b) => b.sayi - a.sayi);

  if (ist.toplamYumruk === 0) {
    return {
      arketip,
      vektor: v,
      dagilim,
      bulgular,
      ozet:
        "Bu round'da ölçülebilir yumruk kaydedilmedi. Kamera seni gövdenin üst yarısı kadraja girecek şekilde görmeli — bir adım geri git ve tekrar dene.",
      madde: [],
      ipucu: "Kameradan 1,5-2 metre uzaklaş; omuzların ve kafan aynı kadrajda olsun.",
      guclu: [],
    };
  }

  madde.push({
    baslik: "İş hacmi",
    metin: `Dakikada ${v._ypm} yumruk (toplam ${ist.toplamYumruk}). ${
      v._ypm >= 60
        ? "Bu, profesyonel round temposunun üst bandında bir hacim — bunu koruyabilmek dayanıklılık ister."
        : v._ypm >= 38
          ? "Sağlıklı bir çalışma temposu; kombinasyonları uzatarak yukarı taşıyabilirsin."
          : "Hacim düşük. Tek yumrukla yetinmeden her girişi en az iki vuruşla bitir."
    }`,
  });

  madde.push({
    baslik: "Yumruk dağılımı",
    metin:
      dagilim
        .slice(0, 4)
        .map((d) => `${d.ad} %${d.oran}`)
        .join(" · ") +
      ` — düz %${v._duzOran}, hook %${v._hookOran}, uppercut %${v._upperOran}. ` +
      (v.cesitlilik >= 65
        ? "Dağılım geniş: rakip senin bir sonraki yumruğunu okumakta zorlanır."
        : v.cesitlilik >= 45
          ? "Dağılım kabul edilebilir ama ağırlık birkaç silahta toplanıyor."
          : "Dağılım dar: ritmin tahmin edilebilir hâle geliyor."),
  });

  const gardMetin =
    v._gardDusukOran <= 12
      ? `Gard disiplinin iyi: ölçülen sürenin yalnız %${v._gardDusukOran}'inde eller hizanın altına indi.`
      : v._gardDusukOran <= 25
        ? `Gard çoğunlukla yerinde ama sürenin %${v._gardDusukOran}'inde düştü — genelde seri sonlarında.`
        : `Gard sürenin %${v._gardDusukOran}'inde düşük kaldı. Bu, gerçek sparringde kontra yeme sebebinin ta kendisidir.`;
  madde.push({
    baslik: "Gard ve savunma",
    metin:
      gardMetin +
      (ist.vurustaAcikGard > 0
        ? ` Ayrıca ${ist.vurustaAcikGard} vuruşta (%${yuzde(ist.vurustaAcikGard, toplam)}) sen vururken diğer elin aşağıdaydı.`
        : " Vuruş anında karşı el disiplinli kaldı — bu iyi bir alışkanlık."),
  });

  const ortSiddet = Math.round(ist.siddetToplam / toplam);
  madde.push({
    baslik: "Vuruş yoğunluğu",
    metin: `Ortalama görece yoğunluk ${ortSiddet}/100, tepe değer ${ist.siddetMax}/100. ${
      ortSiddet >= 70
        ? "Vuruşlarını tam uzanmayla ve net bir yavaşlamayla bitiriyorsun — teknik olarak doğru."
        : ortSiddet >= 45
          ? "Yoğunluk orta bantta; gücü kolla değil kalça rotasyonuyla üret."
          : "Yoğunluk düşük: yumruklar yarım uzanmayla kalıyor. Vuruşu hedefin biraz ARKASINDA bitir."
    } (Bu skor fiziksel kuvvet ölçümü değil, kendi ortalamana göre normalize edilmiş göreli bir değerdir.)`,
  });

  if (ist.kacinmaDeneme > 0) {
    const k = yuzde(ist.kacinmaBasari, ist.kacinmaDeneme);
    madde.push({
      baslik: "Kaçınma",
      metin: `${ist.kacinmaDeneme} gelen vuruşun %${k}'inden çıktın, ${ist.blok} tanesini gardla karşıladın. ${
        k >= 70
          ? "Refleks ve mesafe okuman iyi."
          : "Kafayı gövdeyle birlikte taşı; yalnız geri gitmek yerine merkez hattan yana çık."
      }`,
    });
  }

  // Kapsam kuralı: bacak/kalça görünmüyorsa duruş-denge yorumu ÜRETİLMEZ.
  if (ist.kapsam?.kalca) {
    madde.push({
      baslik: "Duruş ve denge",
      metin: ist.posturUyari
        ? `Gövde ekseni ${ist.posturUyari} kez dikey hattan belirgin saptı. Çeneyi göğse yakın, sırtı nötr tut.`
        : "Gövde ekseni round boyunca dengeli kaldı; ağırlık aktarımın düzgün.",
    });
  } else {
    madde.push({
      baslik: "Analiz kapsamı",
      metin:
        "Kamera bu round'da yalnız üst gövdeni gördü; duruş ve denge analizi bilinçli olarak üretilmedi. Bacakların da kadraja girerse ayak/denge raporu eklenir.",
    });
  }

  const guclu = [];
  if (v._gardDusukOran <= 12) guclu.push("gard disiplini");
  if (v.cesitlilik >= 62) guclu.push("silah çeşitliliği");
  if (v._ypm >= 55) guclu.push("iş hacmi");
  if (ist.enIyiCombo >= 6) guclu.push(`${ist.enIyiCombo}'lik seri kurabilme`);
  if (v._isabetOran >= 62) guclu.push("isabet");
  if (ist.kacinmaDeneme >= 4 && yuzde(ist.kacinmaBasari, ist.kacinmaDeneme) >= 70) {
    guclu.push("kaçınma refleksi");
  }

  const enBuyuk = bulgular[0];
  const ipucu = enBuyuk ? ZAYIFLIKLAR[enBuyuk.kod].tavsiye : "Bu round'da belirgin bir açık yok. Tempoyu bir kademe artırıp aynı disiplini koru.";

  const ozet =
    `${arketip.ad} çizgisinde bir round. ${arketip.aciklama} ` +
    `Toplam ${ist.toplamYumruk} yumruk, %${v._isabetOran} isabet, en uzun seri ${ist.enIyiCombo}. ` +
    (enBuyuk
      ? `Bu round'un öne çıkan açığı: ${ZAYIFLIKLAR[enBuyuk.kod].ad.toLowerCase()} (${enBuyuk.olcum}).`
      : "Belirgin bir teknik açık ölçülmedi.");

  return { arketip, vektor: v, dagilim, bulgular, ozet, madde, ipucu, guclu };
}

// ---------------------------------------------------------------
// 5) OTURUM (tüm antrenman) ANALİZİ
// ---------------------------------------------------------------
export function oturumAnalizi(toplamIst, ctx = {}) {
  const rapor = roundAnalizi(toplamIst, ctx);
  const eslesme = enYakinDovuscular(rapor.vektor, {
    durus: ctx.durus,
    adet: 3,
  });
  return { ...rapor, eslesme, dovuscuSayisi: DOVUSCU_SAYISI };
}

// ---------------------------------------------------------------
// 6) KARİYER ANALİZİ — birikmiş veriden dövüşçü kimliği
// ---------------------------------------------------------------
/**
 * @param {object} k kariyer satırı (boks_kariyer) — kümülatif sayaçlar
 * @param {object} [ctx] { durus, sonOturumlar: [{tarih, ist}], zayifliklar: [] }
 */
export function kariyerAnalizi(k, ctx = {}) {
  if (!k || !k.toplam_yumruk) {
    return {
      hazir: false,
      ozet:
        "Kariyer raporu için henüz yeterli veri yok. Birkaç round tamamladıktan sonra stil profilin, tekrarlayan açıkların ve gelişim eğrin burada oluşmaya başlar.",
    };
  }
  // Kariyer satırını istatistik biçimine çevir (analiz fonksiyonları ortak).
  const ist = {
    puan: k.toplam_puan || 0,
    yumruk: {
      1: k.y1 || 0,
      2: k.y2 || 0,
      3: k.y3 || 0,
      4: k.y4 || 0,
      5: k.y5 || 0,
      6: k.y6 || 0,
    },
    toplamYumruk: k.toplam_yumruk || 0,
    isabet: k.toplam_isabet || 0,
    kacirma: k.toplam_kacirma || 0,
    yanlisTur: k.toplam_yanlis_tur || 0,
    solYumruk: k.sol_yumruk || 0,
    sagYumruk: k.sag_yumruk || 0,
    siddetToplam: k.siddet_toplam || 0,
    siddetMax: k.siddet_max || 0,
    hizToplam: 0,
    dusukGardOlay: k.dusuk_gard_olay || 0,
    vurustaAcikGard: k.vurusta_acik_gard || 0,
    gardDusukSure: k.gard_dusuk_sure || 0,
    gardOlcuSure: k.gard_olcu_sure || 0,
    kacinmaDeneme: k.kacinma_deneme || 0,
    kacinmaBasari: k.kacinma_basari || 0,
    blok: k.blok || 0,
    posturUyari: k.postur_uyari || 0,
    enIyiCombo: k.en_iyi_combo || 0,
    ritimMukemmel: 0,
    sure: k.toplam_sure || 1,
    tempoDilim: [],
    kapsam: { ustGovde: true, kollar: true, kalca: !!k.kalca_gorundu, bacaklar: !!k.bacak_gorundu },
  };
  const v = stilVektoru(ist);
  const arketip = stilArketip(v);
  const eslesme = enYakinDovuscular(v, { durus: ctx.durus || k.durus, adet: 5 });
  const bulgular = zayiflikTespit(ist, v);

  const gunSayisi = k.antrenman_gun || 0;
  const roundSayisi = k.toplam_round || 0;

  const ozet =
    `${roundSayisi} round ve ${gunSayisi} antrenman gününden süzülen profilin: ${arketip.ad}. ${arketip.aciklama} ` +
    `Toplamda ${ist.toplamYumruk} yumruk kaydedildi; dağılımın düz %${v._duzOran}, hook %${v._hookOran}, uppercut %${v._upperOran}. ` +
    `Ortalama iş hacmin dakikada ${v._ypm} yumruk, isabet oranın %${v._isabetOran}.`;

  return {
    hazir: true,
    vektor: v,
    arketip,
    eslesme,
    bulgular,
    ozet,
    dovuscuSayisi: DOVUSCU_SAYISI,
    ist,
  };
}

// ---------------------------------------------------------------
// 7) KOÇLUK GERİ BİLDİRİM DÖNGÜSÜ
// ---------------------------------------------------------------
/**
 * Takip edilen zayıflıkların bu oturumda düzelip düzelmediğini söyler.
 * @param {Array} takip  DB'den gelen [{kod, gorulme_sayisi, son_olcum, durum}]
 * @param {Array} yeni   zayiflikTespit() çıktısı
 */
export function koclukKarsilastir(takip = [], yeni = []) {
  const yeniKod = new Set(yeni.map((z) => z.kod));
  const mesajlar = [];
  for (const t of takip) {
    const tanim = ZAYIFLIKLAR[t.kod];
    if (!tanim) continue;
    if (!yeniKod.has(t.kod) && (t.gorulme_sayisi || 0) >= 2) {
      mesajlar.push({
        tip: "duzeldi",
        kod: t.kod,
        metin: `"${tanim.ad}" bu antrenmanda ölçülmedi. Daha önce ${t.gorulme_sayisi} round üst üste görülmüştü — düzeltmişsin, bu alışkanlığı koru.`,
      });
    } else if (yeniKod.has(t.kod) && (t.gorulme_sayisi || 0) >= 3) {
      const z = yeni.find((y) => y.kod === t.kod);
      mesajlar.push({
        tip: "surekli",
        kod: t.kod,
        metin: `"${tanim.ad}" ${(t.gorulme_sayisi || 0) + 1} round'dur tekrar ediyor (${z.olcum}). ${tanim.tavsiye}`,
      });
    }
  }
  // Yeni ortaya çıkan açıklar
  for (const y of yeni) {
    if (!takip.some((t) => t.kod === y.kod)) {
      const tanim = ZAYIFLIKLAR[y.kod];
      if (tanim) {
        mesajlar.push({
          tip: "yeni",
          kod: y.kod,
          metin: `Yeni bir kalıp: "${tanim.ad}" (${y.olcum}). Takibe alındı; sonraki antrenmanlarda düzelip düzelmediğine bakacağım.`,
        });
      }
    }
  }
  return mesajlar;
}

// ---------------------------------------------------------------
// 8) OTOMATİK ZORLUK KALİBRASYONU (seviye testi)
// ---------------------------------------------------------------
export function zorlukOnerisi(ist) {
  const v = stilVektoru(ist);
  const skor =
    v._ypm * 1.0 +
    v._isabetOran * 0.55 +
    ist.enIyiCombo * 3.2 +
    (ist.siddetToplam / Math.max(1, ist.toplamYumruk)) * 0.25;
  let zorluk = "kolay";
  if (skor >= 118) zorluk = "pro";
  else if (skor >= 92) zorluk = "zor";
  else if (skor >= 62) zorluk = "orta";
  const ad = { kolay: "Kolay", orta: "Orta", zor: "Zor", pro: "Pro" }[zorluk];
  return {
    zorluk,
    skor: Math.round(skor),
    metin:
      `Test round'unda dakikada ${v._ypm} yumruk, %${v._isabetOran} isabet ve ${ist.enIyiCombo}'lik en uzun seri ölçüldü. ` +
      `Sana önerilen başlangıç seviyesi: ${ad}. İstediğin zaman menüden değiştirebilirsin.`,
  };
}

// ---------------------------------------------------------------
// 9) KISA YARDIMCILAR (arayüz için)
// ---------------------------------------------------------------
export function elDengesi(ist) {
  const toplam = Math.max(1, ist.solYumruk + ist.sagYumruk);
  const sol = yuzde(ist.solYumruk, toplam);
  return {
    sol,
    sag: 100 - sol,
    dengeli: Math.abs(sol - 50) <= 15,
    metin:
      Math.abs(sol - 50) <= 15
        ? `Sol %${sol} · sağ %${100 - sol} — dengeli kullanım.`
        : `Sol %${sol} · sağ %${100 - sol} — ${sol > 50 ? "sol" : "sağ"} el baskın; zayıf tarafı ayrıca çalış.`,
  };
}

export function yorgunlukYorumu(ist) {
  const d = ist.tempoDilim || [];
  if (d.length < 3) return null;
  const ilk = d[0];
  const son = d[d.length - 1];
  if (!(ilk > 0)) return null;
  const dususYuzde = Math.round((1 - son / ilk) * 100);
  if (dususYuzde >= 35) {
    return {
      dusus: dususYuzde,
      metin: `Round'un ilk 10 saniyesinde ${ilk}, son diliminde ${son} yumruk attın (%${dususYuzde} düşüş). Bu bir dayanıklılık sinyali: temponun tamamını başa yığmak yerine round'a yayarak çalış.`,
    };
  }
  if (dususYuzde <= 5) {
    return {
      dusus: dususYuzde,
      metin: `Tempon round boyunca sabit kaldı (ilk dilim ${ilk}, son dilim ${son}). Dayanıklılık tarafı sağlam.`,
    };
  }
  return { dusus: dususYuzde, metin: `Tempo düşüşü %${dususYuzde} — kabul edilebilir bir aralık.` };
}
