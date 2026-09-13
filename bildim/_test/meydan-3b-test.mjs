// ============================================================
// MEYDAN 3B GÖVDE TESTİ
//
// Meydan sekmesi gizliyken tarayıcı render'ı durduruyor (HaritaSayfasi.jsx
// `document.hidden` kontrolü), bu yüzden otomasyonla ekrandan doğrulanamıyor.
// Ölçülebilir olan her şey burada ölçülüyor: model kuruluyor mu, yürüyor mu,
// zıplıyor mu, dans duruşa dönüyor mu, bellek bırakılıyor mu.
//
// İsim etiketi canvas istediği için `ad: null` ile kuruluyor — etiketin
// kendisi ortak.js'in işi, burada sınanmıyor.
//
// Çalıştır: node bildim/_test/meydan-3b-test.mjs
// ============================================================
import * as THREE from "three";
import { meydanModelKur, meydanModelSil, meydanModelDegistir, meydanModelYuru } from "../avatar3d/meydan-model.js";
import { dansBaslat, dansKaresi, dansiDurdur } from "../harita/danslar.js";

let hata = 0;
const kontrol = (kosul, ad) => {
  if (kosul) { console.log("  ✓", ad); return; }
  console.error("  ✗", ad);
  hata++;
};

const kur = (gorunum = {}) => meydanModelKur({ ad: null, gorunum, etiketRenk: "#20324A" });

// ---- 1. Model kuruluyor ve eski avatar sözleşmesini taşıyor ----
console.log("1. Model kurulumu");
{
  const g = kur();
  const u = g.userData;
  kontrol(u.gercek3d === true, "gercek3d bayrağı var (çizim yolu bunu okuyor)");
  kontrol(!!(u.kok && u.govde && u.kafa && u.kollar && u.bacaklar),
    "danslar.js'in beklediği gruplar yerinde");
  kontrol(typeof u.kafaY === "number" && u.kafaY > 0, "kafaY saklanmış: " + u.kafaY?.toFixed(2));
  kontrol(u.kafaY !== 3.05, "kafaY eski 3.05 değil — dans sıfırlaması bunu kullanmalı");
  kontrol(Array.isArray(u.eklemler) && u.eklemler.length === 2, "iki bacak/kol eklemi var");

  g.updateMatrixWorld(true);
  const kutu = new THREE.Box3().setFromObject(g);
  const boy = kutu.max.y - kutu.min.y;
  // Meydan dünyası ~3.7 birimlik karaktere göre kurulu (isim etiketi y=4.15).
  kontrol(boy > 3.2 && boy < 4.4, "boy meydan ölçeğinde: " + boy.toFixed(2));
  kontrol(Math.abs(kutu.min.y) < 0.3, "ayaklar zeminde: min.y " + kutu.min.y.toFixed(2));
  meydanModelSil(g);
}

// ---- 2. Yürüme ----
console.log("2. Yürüme");
{
  const g = kur();
  const bacak = g.userData.eklemler[0].bac;
  const acilar = new Set();
  for (let i = 0; i < 90; i++) {
    meydanModelYuru(g, 1 / 60, 0.9, 0);
    acilar.add(bacak.rotation.x.toFixed(3));
  }
  kontrol(acilar.size > 10, "bacak salınıyor (" + acilar.size + " farklı açı)");

  const duruk = new Set();
  for (let i = 0; i < 60; i++) {
    meydanModelYuru(g, 1 / 60, 0, 0);
    duruk.add(bacak.rotation.x.toFixed(3));
  }
  kontrol(duruk.size <= 2, "dururken bacak sabit (" + duruk.size + " açı)");
  meydanModelSil(g);
}

// ---- 3. Zıplama ----
console.log("3. Zıplama");
{
  const g = kur();
  meydanModelYuru(g, 1 / 60, 0.5, 1.4);
  kontrol(Math.abs(g.position.y - 1.4) < 1e-6, "zıplama yüksekliği gövdeye yazıldı");
  kontrol(g.userData.eklemler[0].diz.rotation.x > 0.5, "havada dizler toplandı");
  meydanModelYuru(g, 1 / 60, 0.5, 0);
  kontrol(Math.abs(g.position.y) < 1e-6, "yere inince y sıfırlandı");
  meydanModelSil(g);
}

// ---- 4. Dans ----
console.log("4. Dans");
{
  const kodlar = Array.from({ length: 14 }, (_, i) => "dns_" + String(i + 1).padStart(2, "0"));
  let calisan = 0, kafaTasti = 0;
  for (const kod of kodlar) {
    const g = kur();
    const { kafa, kafaY } = g.userData;
    if (!dansBaslat(g, kod)) { meydanModelSil(g); continue; }
    let surdu = true, kare = 0;
    try {
      while (surdu && kare < 200) { surdu = dansKaresi(g, 0.05); kare++; }
      calisan++;
      // Dans figürleri kafayı eski 3.05 tabanına göre oynatıyor; 3B modelde
      // kafa yerel olarak ~1.1'de. Fark geri eklenmezse kafa gövdeden fırlar.
      if (kafa.position.y > kafaY + 1.5) kafaTasti++;
    } catch (e) {
      console.error("  ✗", kod, "patladı:", e.message);
      hata++;
    }
    dansiDurdur(g);
    kontrol(Math.abs(kafa.position.y - kafaY) < 1e-6, kod + ": duruşta kafa kendi yerine döndü");
    meydanModelSil(g);
  }
  kontrol(calisan === 14, "14 dansın hepsi oynadı (" + calisan + ")");
  kontrol(kafaTasti === 0, "hiçbir dansta kafa gövdeden fırlamadı");
}

// ---- 5. Görünüm değişimi ve bellek ----
console.log("5. Görünüm değişimi ve bellek");
{
  const g = kur();
  const oncekiCocuk = g.children.length;
  meydanModelDegistir(g, { avatar3d: { sac: "rasta", bas: "kep", kiyafet: "ceket", pelerin: true } });
  kontrol(g.userData.gercek3d === true, "değişimden sonra da 3B model");
  kontrol(g.children.length > 0 && oncekiCocuk > 0, "grup boş kalmadı");
  kontrol(typeof g.userData.yokEt === "function", "yeni modelin yokEt'i devralındı");

  let birakildi = false;
  const gercek = g.userData.yokEt;
  g.userData.yokEt = () => { birakildi = true; gercek(); };
  meydanModelSil(g);
  kontrol(birakildi, "meydanModelSil geometri/malzemeyi bıraktı");
}

console.log(hata === 0 ? "\nSONUÇ: TEMİZ" : `\nSONUÇ: ${hata} hata`);
process.exit(hata === 0 ? 0 : 1);
