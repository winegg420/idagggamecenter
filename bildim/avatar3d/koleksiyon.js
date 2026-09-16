import { tt } from "../lib/dil.js";
// Hazır görünüm tarifleri; aynı gövde ve ekipman ölçü sözleşmesini paylaşırlar.
// Mağaza kimliği veya sahiplik kaydı değildir; yalnız yerel sanat kataloğu.
export const YUZLER = { dengeli: tt("Dengeli"), yumusak: tt("Yumuşak"), koseli: tt("Köşeli"), ince: tt("İnce") };

// Revizyon Paketi 7, madde 1 — sahibinin şikâyeti: "Hazır görünümlerde bir
// sürü insan ismi var, saçma duruyor, sayısı fazla."
// ESKİDEN: 24 tarif, her biri insan isimli (Deniz, Ada…), çoğu yalnız ten/saç
// rengiyle ayrışıyordu. ŞİMDİ: 12 görünüm = 4 yüz tipi × 3 ten; ekrandaki ad
// yüz tipi + ten tonundan ÜRETİLİR ("Köşeli yüz · Esmer").
// Etikette saç stili YOK: gardırop hazır görünümden yalnız ten/yüz/saç rengini
// uygular, saç stili ayrı satılan bir parçadır — yazılsa yanıltırdı.
// Vücut tipi (boy/kilo) YOK: model.js tek sabit gövde; bu ayrı, büyük bir iş.
const YUZ_ETIKET = { dengeli: tt("Dengeli yüz"), yumusak: tt("Yumuşak hatlı"), koseli: tt("Köşeli yüz"), ince: tt("İnce yüz") };
const TEN_ADLARI = [tt("Çok açık"), tt("Açık"), tt("Buğday"), tt("Esmer"), tt("Koyu"), tt("Çok koyu")];

// [id, ten(0-5), sac, sacRenk(0-4), yuz] — id'ler eski tariflerden korunur.
// Her yüz tipinde üç farklı ten; altı tenin her biri iki yüz tipinde geçer.
const tarifler = [
 ['deniz', 0,'kisa', 0,'dengeli'], ['lina', 2,'uzun', 2,'dengeli'], ['can', 4,'yok', 1,'dengeli'],
 ['ela',   1,'uzun', 3,'yumusak'], ['baran',3,'kisa', 0,'yumusak'], ['aylin',5,'rasta',4,'yumusak'],
 ['ege',   0,'kisa', 2,'koseli'],  ['eren', 3,'rasta',1,'koseli'],  ['toprak',5,'kisa',0,'koseli'],
 ['duru',  1,'uzun', 0,'ince'],    ['mert', 2,'yok', 1,'ince'],     ['nova', 4,'uzun', 3,'ince'],
];
const tenler=['#f3d6bc','#e8b68e','#c58b62','#995f3c','#70442f','#422c25'];
const saclar=['#30211c','#141318','#cba44d','#9e4026','#ddd2c3'];
export const KOLEKSIYON=tarifler.map(([id,ten,sac,renk,yuz])=>({
 id,
 ad:`${YUZ_ETIKET[yuz]} · ${TEN_ADLARI[ten]}`,
 kimlik:{ten:tenler[ten],sac,sacRenk:saclar[renk],yuz},
}));
export function karakterUygula(ayar,karakter){return {...ayar,...karakter.kimlik};}
