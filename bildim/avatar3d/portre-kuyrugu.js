// ============================================================
// PORTRE KUYRUĞU — kare başına en fazla bir render
//
// Bir 3B portre ~55 ms sürüyor (ölçüldü); 16.7 ms'lik kare bütçesine
// sığmıyor. Hepsini üst üste üretmek sayfayı dondurur, o yüzden istekler
// bu tek kuyruğa girer ve teker teker BOŞ ZAMANDA işlenir.
//
// Gardırop kartları (ParcaPortresi.jsx) ve listelerdeki avatarlar
// (src/components/Avatar.jsx) AYNI kuyruğu paylaşır: lig tablosu açıkken
// gardıroba geçilse bile toplam yük kare başına bir render olarak kalır.
// ============================================================
const kuyruk = [];
let bekleyen = 0;

// BOŞ ZAMAN + GARANTİLİ YEDEK.
// `requestIdleCallback` tek başına yetmiyor: sekme arka plandayken (ya da
// sayfa sürekli meşgulken) tarayıcı onu kısıyor ve kuyruk saatlerce
// ilerlemiyordu — ölçüldü, 12 saniyede 3 portrede takılı kaldı.
// Bu yüzden idle ile birlikte bir `setTimeout` de kurulur; hangisi önce
// gelirse iş o zaman çalışır, diğeri iptal edilir.
let idleKimlik = 0;
let saatKimlik = 0;

function iptal() {
  if (idleKimlik && typeof cancelIdleCallback === "function") cancelIdleCallback(idleKimlik);
  if (saatKimlik) clearTimeout(saatKimlik);
  idleKimlik = 0; saatKimlik = 0;
}

function bosZamanda(fn) {
  const tetikle = () => { iptal(); fn(); };
  if (typeof requestIdleCallback === "function") {
    idleKimlik = requestIdleCallback(tetikle, { timeout: 300 });
  }
  // Yedek: idle gelmezse en geç 350 ms sonra yine de çalışsın.
  saatKimlik = setTimeout(tetikle, 350);
  // Sıfırdan farklı bir "bekliyor" işareti yeter.
  return 1;
}

// `calisiyor`: bir iş yürürken o işin içinden `siraya` çağrılırsa ikinci bir
// boşaltma zinciri başlıyordu; iki zincir birbirini besleyip işi katlıyordu.
// Bu bayrak tek zincir garantisi verir.
let calisiyor = false;

function isle() {
  bekleyen = 0;
  calisiyor = true;
  const is = kuyruk.shift();
  if (is) {
    try { is(); } catch (e) { console.error("[Portre] kuyruk isi:", e); }
  }
  calisiyor = false;
  if (kuyruk.length && !bekleyen) bekleyen = bosZamanda(isle);
}

/**
 * İşi kuyruğa alır; sırası gelince boş zamanda çalıştırılır.
 * @param {Function} is
 * @param {boolean} [oncelikli=false] kuyruğun BAŞINA girer.
 *   Paket 10: dükkânda karakter portresi 56 eşya görselinin ARKASINDA
 *   kalıyordu — gerçek GPU'da 3,4. sn'de 27/56 görsel dolu, portre boş;
 *   ancak hepsi bitince (7,4. sn) çiziliyordu. Sayfanın konusu olan
 *   tek görsel öncelikli girer.
 */
export function siraya(is, oncelikli = false) {
  if (oncelikli) kuyruk.unshift(is); else kuyruk.push(is);
  if (!bekleyen && !calisiyor) bekleyen = bosZamanda(isle);
}
