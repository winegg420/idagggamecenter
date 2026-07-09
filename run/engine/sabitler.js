// ============================================================
// RUN — sabitler (PatiRun constants deseni). Tek-oyunculu + botlar,
// tek harita (Ofis), çoklu drone. Ağ katmanı (multiplayer) sonraki faz.
// ============================================================

// Oyuncu
export const OYUNCU_HIZ = 168;        // birim/sn (bir tık yavaşlatıldı)
export const OYUNCU_YARICAP = 15;

// Sınırlı görüş (fener) — tasarım 5
export const GORUS_YARICAP = 120;     // oyuncu çevresi yumuşak ışık
export const FENER_UZUNLUK = 340;     // ileri fener konisi menzili
export const FENER_ACI = Math.PI * 0.22; // koni yarı açısı (~40°)

// Işık/karanlık değişimi (tasarım 5) — aydınlık odalar periyodik değişir
export const ISIK_DEGISIM_ARALIK = 12; // sn

// Döngü
export const MAKS_DT = 0.05;

// Kadro (prototip)
export const BOT_SAYISI = 7;
export const BOT_HIZ = 140;
export const BOT_GRUP_MENZIL = 320;   // bu mesafeden uzaklaşırsa oyuncuya yaklaşır (görünür kalsın)

// Drone sayısı (birden fazla devriye — tasarım 7)
export const DRONE_SAYISI = 3;

// Drone (avcı) — tasarım 7. Prototipte tek drone, temas ile yakalar.
export const DRONE_DEVRIYE_HIZ = 122;
export const DRONE_KOVALA_HIZ = 196;      // aydınlıkta/kovalarken hızlanır
export const DRONE_GORUS = 300;           // aydınlıktaki oyuncuyu bu menzilde görür (GPS)
export const HEAT_YARICAP = 160;          // karanlıkta hareketsiz "ısı" algılama menzili
export const HEAT_SURE = 1.4;             // bu kadar hareketsiz kalınca ısı yakalanır
export const YAKALA_YARICAP = 30;         // bu mesafede temasla yakalar
export const KAYIP_SURE = 3.5;            // hedefi kaybedince devriyeye dönme süresi

// Drone ateş menzili (temastan önce menzilden vurma) — tasarım: zorluk eğrisi
export const ATES_MENZIL = 92;            // kilitlenip ateş edebildiği menzil
export const ATES_SURE = 1.05;            // kilit → ateş süresi (bu kadar menzilde tutarsa vurur)

// Zorluk eğrisi — zaman geçtikçe droneler hızlanır/görüşü artar
export const ZORLUK_ARALIK = 22;          // sn, her kademede zorluk artışı
export const ZORLUK_MAKS = 4;             // maks kademe (1..4)

// Beceriler — tasarım: sopa (bayılt+sat) + kalkan (dokunulmazlık)
export const SOPA_MENZIL = 52;            // sopa vuruş menzili
export const SOPA_ACI = Math.PI * 0.55;   // önde koni yarı açısı (~100°)
export const SOPA_BEKLEME = 2.4;          // cooldown (sn)
export const KALKAN_SURE = 3.0;           // dokunulmazlık süresi (sn)
export const KALKAN_BEKLEME = 8.0;        // cooldown (sn)

// AI ele geçirme — nesneler aktifleşir, drone o bölgeye çekilir (tasarım 6)
export const NESNE_AKTIF_ARALIK = 8;      // sn, yeni bir nesne aktifleşir
export const NESNE_AKTIF_SURE = 7;        // aktif kalma süresi
export const NESNE_CEK_MENZIL = 760;      // aktif nesne bu menzildeki boş drone'u çeker

// Botların çıkışa yönelmesi (round çözülsün) — bu süreden sonra kaçışa geçerler
export const BOT_KACIS_ZAMANI = 18;       // sn
// İzleyici modunda round'u sonlandıran güvenlik süresi
export const IZLEYICI_MAKS = 26;          // sn

// Kapılar — oda duvarlarındaki geçitler. Kapalı kapı enerji perdesi olur:
// insanlar geçer, drone geçemez (kırması gerekir) → kaçış aracı.
export const KAPI_GENISLIK = 96;          // geçit boşluğu
export const KAPI_KALINLIK = 14;          // duvar/kapı kalınlığı
export const KAPI_MENZIL = 82;            // oyuncu bu mesafedeki kapıyı kapatabilir
export const KAPI_BEKLEME = 3.0;          // kapı kapatma cooldown (sn)
export const KAPI_ACILMA = 12;            // kapalı kapı bu süre sonra kendiliğinden açılır
export const KAPI_KIRILMA = 2.2;          // drone kapalı kapıyı bu sürede kırar

// Etkileşimli makine (ele geçirme / hack) — tasarım 6 devamı.
// Aktif nesneyi basılı tutarak ele geçirirsin: ödül + yakındaki droneler sersemler.
// Bedeli: hack sırasında duruyorsun → drone ısı algılamasına açıksın.
export const HACK_MENZIL = 64;            // nesneye bu mesafede hack başlar
export const HACK_SURE = 1.6;             // tamamlanma süresi (sn)
export const HACK_SERSEM_MENZIL = 320;    // tamamlanınca bu menzildeki droneler sersemler
export const SERSEM_SURE = 2.6;           // drone sersemleme süresi (sn)

// Parçacıklar (vuruş/hack/ateş/kapı efektleri)
export const PARCACIK_MAKS = 220;         // aynı anda en fazla parçacık
