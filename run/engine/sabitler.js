// ============================================================
// RUN — sabitler (PatiRun constants deseni). Tek-oyunculu + botlar,
// tek harita (Ofis), çoklu drone. Ağ katmanı (multiplayer) sonraki faz.
// ============================================================

// Oyuncu
export const OYUNCU_HIZ = 168;        // birim/sn (bir tık yavaşlatıldı)
export const OYUNCU_YARICAP = 15;

// Sınırlı görüş (fener) — tasarım 5
export const GORUS_YARICAP = 150;     // oyuncu çevresi yumuşak ışık
export const FENER_UZUNLUK = 360;     // ileri fener konisi menzili
export const FENER_ACI = Math.PI * 0.22; // koni yarı açısı (~40°)
export const KARANLIK_ALFA = 0.85;    // stealth örtüsü (0.92 fazla boğucuydu — İda geri bildirimi)

// Işık/karanlık değişimi (tasarım 5) — aydınlık odalar periyodik değişir
export const ISIK_DEGISIM_ARALIK = 12; // sn

// Döngü
export const MAKS_DT = 0.05;

// Kadro (prototip)
export const BOT_SAYISI = 7;
export const BOT_HIZ = 140;
export const BOT_GRUP_MENZIL = 320;   // bu mesafeden uzaklaşırsa oyuncuya yaklaşır (görünür kalsın)

// Drone sayısı (birden fazla devriye — tasarım 7)
export const DRONE_SAYISI = 6;

// Drone (avcı) — tasarım 7.
export const DRONE_DEVRIYE_HIZ = 122;
export const DRONE_KOVALA_HIZ = 196;      // aydınlıkta/kovalarken hızlanır
export const DRONE_GORUS = 300;           // aydınlıktaki oyuncuyu bu menzilde görür (GPS)
export const HEAT_YARICAP = 160;          // karanlıkta hareketsiz "ısı" algılama menzili
export const HEAT_SURE = 1.4;             // bu kadar hareketsiz kalınca ısı yakalanır
export const YAKALA_YARICAP = 34;         // bu mesafede temasla yakalar (drone büyüdü)
export const KAYIP_SURE = 3.5;            // hedefi kaybedince devriyeye dönme süresi

// Kırmızı tarama konisi — devriye drone önünde salınan arama ışığı.
// Koninin içine giren (ve arada duvar olmayan) oyuncu ANINDA fark edilir.
export const TARAMA_MENZIL = 270;         // koni menzili
export const TARAMA_ACI = 0.34;           // koni yarı açısı (rad, ~19.5°)
export const TARAMA_SALINIM = 0.85;       // gövde yönü etrafında salınım genliği (rad)

// Kaçış kanalı — çıkışta bu kadar bekleyince kaçarsın (dümdüz koşup çıkma olmasın)
export const CIKIS_SURE = 1.6;            // sn

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

// Kapılar — oda duvarlarındaki geçitler. Kapalı kapı FİZİKSEL engeldir:
// oyuncular ve botlar da geçemez (Q ile aç/kapa). Drone yarım saniyede açar.
export const KAPI_GENISLIK = 96;          // geçit boşluğu
export const KAPI_KALINLIK = 14;          // duvar/kapı kalınlığı
export const KAPI_MENZIL = 82;            // oyuncu bu mesafedeki kapıyı açıp kapatabilir
export const KAPI_BEKLEME = 1.2;          // kapı aç/kapa cooldown (sn)
export const KAPI_ACILMA = 14;            // kapalı kapı bu süre sonra kendiliğinden açılır
export const KAPI_KIRILMA = 0.5;          // drone kapalı kapıyı bu sürede açar
export const KAPI_BOT_ACMA = 0.7;         // bot kapalı kapıyı iterek bu sürede açar

// Etkileşimli makine (ele geçirme / hack) — tasarım 6 devamı.
// Aktif nesneyi basılı tutarak ele geçirirsin: ödül + yakındaki droneler sersemler.
// Bedeli: hack sırasında duruyorsun → drone ısı algılamasına açıksın.
export const HACK_MENZIL = 64;            // nesneye bu mesafede hack başlar
export const HACK_SURE = 1.6;             // tamamlanma süresi (sn)
export const HACK_SERSEM_MENZIL = 320;    // tamamlanınca bu menzildeki droneler sersemler
export const SERSEM_SURE = 2.6;           // drone sersemleme süresi (sn)

// Parçacıklar (vuruş/hack/ateş/kapı efektleri)
export const PARCACIK_MAKS = 220;         // aynı anda en fazla parçacık
