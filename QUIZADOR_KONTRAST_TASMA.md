# GÖREV: Kontrast düzeltmeleri + yatay kaydırma

Canlı sitede (quizador.pages.dev) tarayıcıdan **ölçülen** değerler. Hepsi
WCAG AA eşiğinin altında; açık zeminde soluk kaldıkları için okunmuyorlar.

**KURAL: yalnız renk ve genişlik düzelt. Yapı, metin, oyun mantığı değişmeyecek.
Minimal diff.**

---

## 1. Yatay kaydırma — ÖNCE BUNU DÜZELT

Sayfada yatay kaydırma çubuğu var. Sebep: **`.bd-ust-blok` ekrandan 7px geniş**
(ölçüm: eleman sağ kenarı 1528px, ekran 1521px).

Neredeyse kesin sebep: `width: 100vw`. `100vw` dikey kaydırma çubuğunun
genişliğini de sayar, bu yüzden her zaman taşar.

```css
.bd-ust-blok{
  width: 100%;      /* 100vw DEĞİL */
  max-width: 100%;
}
```
`tema.css` içinde başka `100vw` kullanımı varsa hepsini aynı şekilde düzelt
(`grep -n "100vw" bildim/styles/tema.css`). Tam ekran gereken yerlerde
`width:100%` + `position:fixed; left:0; right:0` kullan.

---

## 2. Kontrast düzeltmeleri

Ölçülen oran → hedef. Küçük metinde en az **4.5**, 24px+ veya 19px+ kalın
metinde en az **3.0**.

| # | Ne | Şu anki renk | Oran | Yapılacak |
|---|---|---|---|---|
| 1 | **Logo "Quizador"** (üst bar, 30px) | `#F7CB77` | **1.53** | Turuncuya çevir: `var(--bd-vurgu)` `#F4701F` → oran 3.4. Altın kalsın isteniyorsa koyu altın `#B8860B` kullan. |
| 2 | "Gizlilik Politikası" / alt bilgi linkleri | `#F7CB77` | 1.53 | `var(--bd-vurgu)` + `text-decoration: underline` |
| 3 | Görev sayacı "1/3" (`.sayac`) | `#FFC53D` | 1.58 | `var(--bd-metin-2)` `#5A7089`; "ödül hazır" durumunda `var(--bd-basari)` koyu yeşil `#1D8A50` |
| 4 | Haftalık geri sayım "2 gün 8 saat" | `#B3C2D8` | 1.81 | `var(--bd-metin-2)` |
| 5 | Profil kategori alt yazıları "781 soru" (`.bd-kat-alt`) | `#B3C2D8` | 1.81 | `var(--bd-metin-2)` |
| 6 | "GECE TURNUVASI" etiketi (`.bd-turnuva-etiket`) | `#C99A00` | 2.59 | `#8A6A00` (koyu altın) |
| 7 | Rütbe adı "Üstat" | `#4A9DD9` | 2.95 | `#2B6BA3` |
| 8 | Lig şeridi "Balıkesir / Ülke / Dünya" (`.bd-lig-serit-hucre em`) | `#6E86A0` | 3.76 | `var(--bd-metin-2)` `#5A7089` |
| 9 | "1 turnuva kaldı" (`.etiket`) | `#6E86A0` | 3.76 | `var(--bd-metin-2)` |

**Not:** rütbe renkleri `bildim/lib/ranks.js` içinden geliyor olabilir. Oradaki
renkler açık zeminde okunmuyorsa, **rütbe kimliğini koru** ama her rütbe için
metin olarak kullanılan tonu koyulaştır: ya `ranks.js`'e bir `metinRenk` alanı
ekle, ya da CSS'te rütbe metnine `filter: brightness(.72)` yerine doğrudan koyu
varyant ver. Rozet/çip dolgusu açık ton kalabilir, sadece **yazı** koyulaşsın.

---

## 3. Genel tarama

Düzeltmeleri yaptıktan sonra aynı hatayı başka ekranlarda ara. Her sayfada
tarayıcı konsolunda şunu çalıştır, **boş dizi** dönmeli:

```js
(function(){
 function rel(c){const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(m[0])+0.7152*f(m[1])+0.0722*f(m[2]);}
 const out=[];
 document.querySelectorAll('*').forEach(el=>{
  if(el.children.length||!el.textContent.trim())return;
  const c=getComputedStyle(el),r=el.getBoundingClientRect();
  if(r.width<8||r.height<6)return;
  let p=el,bg=null;
  while(p){const s=getComputedStyle(p);
   if(s.backgroundImage!=='none')return;
   if(s.backgroundColor!=='rgba(0, 0, 0, 0)'){bg=s.backgroundColor;break;}
   p=p.parentElement;}
  if(!bg)return;
  const L1=rel(c.color),L2=rel(bg);
  const o=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
  const fs=parseFloat(c.fontSize),bold=+c.fontWeight>=600;
  if(o<((fs>=24||(fs>=18.66&&bold))?3:4.5))
   out.push(el.textContent.trim().slice(0,24)+' ['+el.className+'] '+o.toFixed(2));
 });
 return [...new Set(out)];
})()
```

Gezilecek sayfalar: `/`, `/siralama`, `/arkadaslar`, `/joker`, `/profil`,
`/meydan`, `/turnuva`, `/hizli-mod`, `/calisma` ve bir maç ekranı.

Yatay kaydırma kontrolü (her sayfada `false` dönmeli):
```js
document.body.scrollWidth > document.documentElement.clientWidth + 1
```

---

## KURALLAR
- Sadece renk ve genişlik. Metin, yapı, oyun mantığı, RPC, migration değişmez.
- Renkleri mümkünse token üzerinden ver, sabit hex yazma.
- Türkçe yaz.
- Durma, onay isteme. Bitince tek kısa özet: hangi sınıflar değişti, taramada
  kaç ek sorun bulundu, `npm run build` sonucu.
