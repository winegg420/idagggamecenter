# BİLDİM — GÖREV 10: "Hatalarım" çalışma modu

Oyuncunun tüm modlarda yanlış bildiği sorular kişisel bankada birikir; puansız, tek kişilik
çalışma turuyla eksikler kapatılır.

## FAZ 1 — Veritabanı (migration 20260612000104 / 105 / 106) — TAMAM
- [x] 1.1 `yanlis_sorular` tablosu + RLS (yalnız sahibi okur)
- [x] 1.2 `calisma_oturumlari` tablosu + RLS
- [x] 1.3 `yanlis_kaydet(question_id)` RPC (security definer)
- [x] 1.4 Cevap RPC'lerine kanca: `submit_match_answer`, `submit_group_match_answer`,
      `submit_tournament_answer`, `submit_hizli_cevap`, `hizli_mod_cevap`
- [x] 1.5 Geriye dönük doldurma (match_answers / group_match_answers /
      tournament_answers / hizli_cevaplar → soru_index eşlemesiyle)
- [x] 1.6 `calisma_baslat(p_kategori, p_soru_sayisi)`
- [x] 1.7 `calisma_soru(p_oturum_id)` — doğru cevap istemciye gönderilmez
- [x] 1.8 `calisma_cevap(p_oturum_id, p_soru_index, p_cevap)`
- [x] 1.9 `calisma_bitir(p_oturum_id)`
- [x] 1.10 `yanlis_bankam()` — toplam / öğrenilen / kategori kırılımı
- [x] 1.11 `mac_yanlis_sayim(p_mac_tur, p_mac_id)` — maç sonu satırı için

## FAZ 2 — Arayüz — TAMAM
- [x] 2.1 `bildim/pages/CalismaPage.jsx` — özet kart + kategori/soru sayısı seçici
- [x] 2.2 Çalışma ekranı: "ÇALIŞMA · puan verilmez" şeridi, 20 sn, joker yok
- [x] 2.3 Cevap sonrası geri bildirim (bankadan geldi / 1/2 doğru / öğrenildi)
- [x] 2.4 Sonuç ekranı (öğrenilen, bankada kalan, ustalık; lig puanı yok)
- [x] 2.5 Route `/bildim/calisma` + Home'a "Hatalarım" mod kartı + rozet
- [x] 2.6 Profil sayfasına "Öğrenilen / Bankada" bölümü
- [x] 2.7 Maç sonucuna "N soruyu yanlış bildin — Hatalarım'a eklendi" satırı
- [x] 2.8 CSS (`src/styles.css`) — çalışma şeridi, geri bildirim, mod kartı teması

## FAZ 3 — Doğrulama — TAMAM (10/10)
- [x] 3.1 5 yanlış üret → tur başlat → 2 kez doğru → bankadan çıktı
- [x] 3.2 Araya yanlış girerse çıkmadığını göster
- [x] 3.3 Boş bankada tur başlıyor, havuzdan soru geliyor
- [x] 3.4 `profiles.puan` / `puan_hafta` / `seri_gun` DEĞİŞMİYOR (öncesi/sonrası)
- [x] 3.5 Kategori ustalığı artıyor
- [x] 3.6 Sonuçlar PROGRESS.md'ye tablo

## KAPANIŞ — TAMAM
- [x] Build temiz
- [x] commit + PUSH
- [x] PROGRESS.md güncel

---

## Not: testin yakaladığı hata

Test 3.3 ilk çalıştırmada kaldı — 10 soru istenirken 15 soruluk tur açılıyordu.
`calisma_baslat` içindeki havuz doldurma sorgusunda `limit v_eksik`, `array_agg`'ın
dış sorgusuna uygulanıyordu; toplama tek satır döndürdüğü için limit hiçbir şeyi
kısıtlamıyordu. Limit iç sorguya taşındı → migration **20260612000106**.

## Ölçümler

| Ölçüm | Değer |
|---|---|
| Geriye dönük doldurma | 329 satır / 17 kullanıcı |
| Doğrulama testi | 10/10 geçti |
| `profiles.puan` değişimi | 0 → 0 (değişmedi) |
| `puan_hafta` değişimi | 0 → 0 (değişmedi) |
| `seri_gun` değişimi | 0 → 0 (değişmedi) |
| Kategori ustalığı | 0 → 9 doğru (arttı) |
| Yeni tablo | 2 |
| Yeni RPC | 7 |
| Kanca eklenen cevap RPC'si | 5 |
| CalismaPage bundle | 8.48 kB (gzip 2.92 kB) |
