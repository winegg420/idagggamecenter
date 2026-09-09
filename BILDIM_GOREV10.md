# BİLDİM — GÖREV 10: "Hatalarım" çalışma modu

Oyuncunun tüm modlarda yanlış bildiği sorular kişisel bankada birikir; puansız, tek kişilik
çalışma turuyla eksikler kapatılır.

## FAZ 1 — Veritabanı (migration 20260612000104)
- [ ] 1.1 `yanlis_sorular` tablosu + RLS (yalnız sahibi okur)
- [ ] 1.2 `calisma_oturumlari` tablosu + RLS
- [ ] 1.3 `yanlis_kaydet(question_id)` RPC (security definer)
- [ ] 1.4 Cevap RPC'lerine kanca: `submit_match_answer`, `submit_group_match_answer`,
      `submit_tournament_answer`, `submit_hizli_cevap`, `hizli_mod_cevap`
- [ ] 1.5 Geriye dönük doldurma (match_answers / group_match_answers /
      tournament_answers / hizli_cevaplar → soru_index eşlemesiyle)
- [ ] 1.6 `calisma_baslat(p_kategori, p_soru_sayisi)`
- [ ] 1.7 `calisma_soru(p_oturum_id)` — doğru cevap istemciye gönderilmez
- [ ] 1.8 `calisma_cevap(p_oturum_id, p_soru_index, p_cevap)`
- [ ] 1.9 `calisma_bitir(p_oturum_id)`
- [ ] 1.10 `yanlis_bankam()` — toplam / öğrenilen / kategori kırılımı
- [ ] 1.11 `mac_yanlis_sayim(p_mac_tur, p_mac_id)` — maç sonu satırı için

## FAZ 2 — Arayüz
- [ ] 2.1 `bildim/pages/CalismaPage.jsx` — özet kart + kategori/soru sayısı seçici
- [ ] 2.2 Çalışma ekranı: "ÇALIŞMA · puan verilmez" şeridi, 20 sn, joker yok
- [ ] 2.3 Cevap sonrası geri bildirim (bankadan geldi / 1/2 doğru / öğrenildi)
- [ ] 2.4 Sonuç ekranı (öğrenilen, bankada kalan, ustalık; lig puanı yok)
- [ ] 2.5 Route `/bildim/calisma` + Home'a "Hatalarım" mod kartı + rozet
- [ ] 2.6 Profil sayfasına "Öğrenilen / Bankada" bölümü
- [ ] 2.7 Maç sonucuna "N soruyu yanlış bildin — Hatalarım'a eklendi" satırı
- [ ] 2.8 CSS (`src/styles.css`) — çalışma şeridi, geri bildirim, mod kartı teması

## FAZ 3 — Doğrulama
- [ ] 3.1 5 yanlış üret → tur başlat → 2 kez doğru → bankadan çıktı
- [ ] 3.2 Araya yanlış girerse çıkmadığını göster
- [ ] 3.3 Boş bankada tur başlıyor, havuzdan soru geliyor
- [ ] 3.4 `profiles.puan` / `puan_hafta` / `seri_gun` DEĞİŞMİYOR (öncesi/sonrası)
- [ ] 3.5 Kategori ustalığı artıyor
- [ ] 3.6 Sonuçlar PROGRESS.md'ye tablo

## KAPANIŞ
- [ ] Build temiz
- [ ] commit + PUSH
- [ ] PROGRESS.md güncel
