// danslar.js birim testi — tarayıcı sekmesi kısıldığı için dansın 6 saniyede
// bittiğini ve gövdenin duruşa döndüğünü burada ölçüyoruz.
import * as THREE from "three";
import { DANS_SURESI, dansBaslat, dansKaresi, dansiDurdur } from "../harita/danslar.js";

function sahteAvatar() {
  const g = new THREE.Group();
  const kok = new THREE.Group(); g.add(kok);
  const bacaklar = new THREE.Group(); kok.add(bacaklar);
  for (let i = 0; i < 2; i++) bacaklar.add(new THREE.Object3D());
  const govde = new THREE.Object3D(); kok.add(govde);
  const kollar = new THREE.Group(); kok.add(kollar);
  for (let i = 0; i < 2; i++) {
    const t = new THREE.Group();
    t.add(new THREE.Object3D()); t.add(new THREE.Object3D());
    kollar.add(t);
  }
  const kafa = new THREE.Object3D(); kafa.position.y = 3.05; kok.add(kafa);
  g.userData = { kok, bacaklar, kollar, govde, kafa, dans: null, yurumeFaz: 0 };
  return g;
}

const kodlar = ["dns_01", "dns_02", "dns_03", "dns_04", "dns_05", "dns_06", "dns_07"];
let hataSayisi = 0;
for (const kod of kodlar) {
  const av = sahteAvatar();
  const { kok, kollar, bacaklar, kafa } = av.userData;
  if (!dansBaslat(av, kod)) { console.error(kod, "baslamadi"); hataSayisi++; continue; }

  let kare = 0, surdu = true, enBuyukY = 0, hareketVar = false;
  const ilk = [];
  while (surdu && kare < 400) {
    surdu = dansKaresi(av, 0.05);
    kare++;
    if (kare === 10) ilk.push(kollar.children[1].rotation.z, kollar.children[1].rotation.x, kok.rotation.y, kok.rotation.z, av.position.y);
    if (kare === 25) {
      // 10. ve 25. kare aynıysa dans donuk demektir
      const simdi = [kollar.children[1].rotation.z, kollar.children[1].rotation.x, kok.rotation.y, kok.rotation.z, av.position.y];
      hareketVar = simdi.some((v, i) => Math.abs(v - ilk[i]) > 1e-4);
    }
    enBuyukY = Math.max(enBuyukY, av.position.y);
  }
  const sn = kare * 0.05;
  const durusta =
    kok.rotation.x === 0 && kok.rotation.y === 0 && kok.rotation.z === 0 &&
    kok.position.x === 0 && kok.position.y === 0 &&
    kollar.children.every((t) => t.rotation.x === 0 && t.rotation.y === 0 && t.rotation.z === 0) &&
    bacaklar.children.every((b) => b.rotation.x === 0) &&
    kafa.position.y === 3.05 && av.position.y === 0;

  const tamam = Math.abs(sn - (DANS_SURESI + 0.05)) < 0.2 && durusta && hareketVar && av.userData.dans === null;
  if (!tamam) hataSayisi++;
  console.log(
    (tamam ? "OK  " : "HATA") + ` ${kod}  süre=${sn.toFixed(2)}sn  hareket=${hareketVar}` +
    `  duruşa döndü=${durusta}  en yüksek sıçrama=${enBuyukY.toFixed(2)}`
  );
}

// Yürümeye başlayınca dans kesilir (dunya.js bunu çağırıyor)
const av2 = sahteAvatar();
dansBaslat(av2, "dns_05");
dansKaresi(av2, 0.05);
dansiDurdur(av2);
const kesildi = av2.userData.dans === null && av2.userData.kok.rotation.y === 0;
console.log((kesildi ? "OK  " : "HATA") + " yürüyünce dans kesiliyor");
if (!kesildi) hataSayisi++;

console.log(hataSayisi === 0 ? "\nTÜMÜ GEÇTİ" : `\n${hataSayisi} HATA`);
process.exitCode = hataSayisi ? 1 : 0;
