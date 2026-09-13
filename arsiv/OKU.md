# Arşiv — Codex'in ayrık klasörlerinden kurtarılan iş

**14 Eylül 2026.** Codex, `Documents\Codex\2026-09-12\...\work\` altında iki
ayrı klasörde çalışmıştı. O klasörlerin git bağı koparıldı (bkz.
`CLAUDE.md` › "ÇALIŞMA KLASÖRÜ — TEK KURAL"); orada commit edilmemiş ne
varsa **kaybolmadan** buraya alındı.

Bu dosyalar **uygulanmadı** — yalnız saklandı. Gerekirse `git apply` ile
denenebilir, ama hepsi bugünkü `main`'den eski bir tabana göre yazıldığı
için doğrudan uymayabilir.

---

## 1. `quizsquare-yayin` worktree'si (HEAD: `3ef8ecf`)

Codex'in 3B avatar işinin yapıldığı yer. **Kaynak kodu kaybolmadı**:
`bildim/avatar3d/` klasörünün tamamı 13 Eylül'de `e8c9169` ile ana depoya
alındı ve o günden beri geliştirildi.

| Dosya | Ne |
|---|---|
| `codex-worktree-quizsquare-yayin.patch` | O worktree'de commit edilmemiş 9 dosyalık değişiklik: 2B sayfalarının boşaltılması (`AvatarVitrin`, `GorunumDukkani`, `KarakterPage`, `GorunumPage`), `karakterGorsel`/`dunya`/`danslar`/`gorunum` içindeki 3B köprüleri ve `vercel.json`'ın çok girişli derleme komutu. |
| `codex-worktree-quizsquare-yayin-YAYIN-DURUMU.md` | Codex'in o günkü yayın durumu notu. |
| `codex-worktree-avatar3d-orijinal-fark.patch` | Codex'in `bildim/avatar3d/` **orijinal** hâli ile bugünkü ana depo arasındaki fark. Farkların tamamı sonraki geliştirmelerdir (`ParcaPortresi.jsx`, `portre-kuyrugu.js`, portre/sahne/gardırop iyileştirmeleri). Kayıp yok; tarihe kayıt olsun diye duruyor. |

**Not:** Bu yamadaki `vercel.json` değişikliği canlıda hub'ı bozmuştu
(hub adresinde Quiz Square açılıyordu). Düzeltildi — `9140ecf`. Yamayı
uygularken o satırı **alma**.

---

## 2. `quizsquare` kopyası (git'e hiç bağlı değildi)

Sıradan bir klasör kopyasıydı, worktree bile değildi. İçinde **git
geçmişinde hiç yer almamış**, yani gerçekten kaybolmak üzere olan iki
dosya vardı:

| Dosya | Ne |
|---|---|
| `codex-kopya-quizsquare-square.css` | 181 satırlık yeni bir görsel katman denemesi (`html.qs-theme`). |
| `codex-kopya-quizsquare-DEVAM_TASARIM.md` | Codex'in devam notu: işin **tamamlanmadığını** ve *"kullanıcı tasarımı görüp beğenmeden push ve yayın YAPILMAYACAK"* dediğini kaydeder. |
| `codex-kopya-quizsquare-tasarim-denemesi.patch` | Aynı denemenin `Home.jsx`, `Layout.jsx`, `Login.jsx`, `main.jsx` üzerindeki değişiklikleri. |

**Karar gerekiyor:** Bu tasarım denemesi sahibine hiç gösterilmedi ve
onaylanmadı. Ayrıca `CLAUDE.md`'deki "Reddedilmiş fikirler — tekrar
önerme" listesinde *"Nötr gri/mavi palet, düzleşmiş butonlar"* maddesi
var; `square.css` sakin/nötr bir palet öneriyor ve gölgeleri kaldırıyor
(`--bd-golge-yumusak: none`). Uygulanıp uygulanmayacağı **sahibinin
kararı** — bu yüzden dokunulmadı, yalnız saklandı.
