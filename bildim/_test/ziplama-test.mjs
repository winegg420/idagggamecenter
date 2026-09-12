import { ziplamaKur, ZIPLAMA, ziplamaYuksekligi } from "../harita/ziplama.js";
const z = ziplamaKur();
console.log("yerde basla:", z.basla(), "| havada:", z.havada);
console.log("havadayken ikinci zipla:", z.basla(), "(false olmali)");
let t = 0, enYuksek = 0, kare = 0;
const dt = 1 / 60;
while (z.havada && kare < 200) { const h = z.ilerlet(dt); enYuksek = Math.max(enYuksek, h); t += dt; kare++; }
console.log("tepe:", enYuksek.toFixed(3), "hedef:", ZIPLAMA.yukseklik, "| sure:", t.toFixed(2), "sn");
console.log("yere indi, tekrar ziplayabilir:", z.basla());
console.log("egri 0/0.5/1:", ziplamaYuksekligi(0), ziplamaYuksekligi(0.5), ziplamaYuksekligi(1));
