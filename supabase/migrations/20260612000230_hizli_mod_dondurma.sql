-- ============================================================
-- Paket 24 · B — HIZLI MOD DONDURULUYOR (sahibinin kararı)
--
-- Geriye Normal Maç + Düello kalır (Turnuva etkinlik, Grup Maçı ödülsüz arkadaş modu).
-- DONDURMA = SİLME DEĞİL. Eski gardırop ve "Hızlı Olan Kazanır" aynı şekilde donduruldu:
-- dosyalar durur, arayüzden giriş yoktur, veri boşaltılmaz.
--
-- ÖLÇÜLDÜ (18 Eyl 2026): Hızlı Mod son 30 günde 4 oturum / 2 oyuncu. Aktif oturum yok.
-- "Hızlı Olan Kazanır" (hizli_maclar/hizli_oyuncular): 0 kayıt. Hızlı Mod'a ait cron YOK.
--
-- YÖNTEM — neden trigger, neden RPC gövdesi değil:
-- hizli_mod_baslat / create_hizli_mac gövdelerini kopyalayıp başlarına kapı koymak,
-- 100+ satırlık ödül ve soru seçme mantığını yeniden yazmak demekti (kopyalama hatası
-- riski). Bunun yerine tabloya BEFORE INSERT kapısı kondu: YENİ oturum açılmaz,
-- DEVAM EDEN oturum sorunsuz biter (update/delete serbest), hangi yoldan gelinirse
-- gelinsin aynı kapı çalışır. Geri açmak tek satır: ayarı true yap.
--
-- VERİ: hizli_mod_oturumlar, hizli_mod_skorlar, hizli_maclar, hizli_oyuncular
-- silinmez, boşaltılmaz. Görev/ustalık sayaçları (gorev_sayaci) MODA ÖZEL DEĞİLDİR —
-- mac_oyna_3 / mac_kazan_5 / dogru_25 tüm modları toplar; Hızlı Mod yalnız bir kaynaktı.
-- Oyuncu aynı görevi Normal Maç, Düello, Grup, Turnuva ile tamamlar. Açık kalmadı.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama) values
  ('hizli_mod_acik', 'false'::jsonb, 'Hızlı Mod yeni oturum kabul ediyor mu (Paket 24: donduruldu; true yapmak modu geri açar)'),
  ('hizli_mac_acik', 'false'::jsonb, '"Hızlı Olan Kazanır" yeni maç kabul ediyor mu (donduruldu; true yapmak geri açar)')
on conflict (anahtar) do nothing;

-- Dondurulmuş modda yeni kayıt açılmasın. Devam edenler etkilenmez (yalnız INSERT).
create or replace function public.trg_donmus_mod_engelle()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_anahtar text := tg_argv[0];
begin
  if not coalesce((select deger::text = 'true' from public.oyun_ayarlari where anahtar = v_anahtar), false) then
    raise exception 'Bu mod şu an kapalı';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_hizli_mod_donmus on public.hizli_mod_oturumlar;
create trigger trg_hizli_mod_donmus
  before insert on public.hizli_mod_oturumlar
  for each row execute function public.trg_donmus_mod_engelle('hizli_mod_acik');

drop trigger if exists trg_hizli_mac_donmus on public.hizli_maclar;
create trigger trg_hizli_mac_donmus
  before insert on public.hizli_maclar
  for each row execute function public.trg_donmus_mod_engelle('hizli_mac_acik');

revoke all on function public.trg_donmus_mod_engelle() from public, anon, authenticated;
