-- ============================================================
-- TURNUVA SAATLERİ — 13:00 ve 21:50 (TSİ), sabit
--
-- Turnuva saatleri oyuncunun YEREL saatine göre DEĞİL, Türkiye saatine
-- göre sabittir. Gerekçe: yerel saate göre yapılsaydı zaten ince olan
-- oyuncu havuzu saat dilimlerine bölünür ve turnuvalar boş kalırdı.
--
-- Saatler oyun_ayarlari'nda (turnuva_saat_sabah / turnuva_saat_aksam);
-- kod, geri sayımlar ve meydandaki kupa binası bu değerleri okur.
-- ============================================================

update public.oyun_ayarlari set deger = '"13:00"'::jsonb where anahtar = 'turnuva_saat_sabah';
update public.oyun_ayarlari set deger = '"21:50"'::jsonb where anahtar = 'turnuva_saat_aksam';

-- Sıradaki turnuvanın tarihi/seansı artık ayar tablosundan türer.
create or replace function public.sonraki_turnuva_bilgi(out o_tarih date, out o_seans text)
returns record language sql stable security definer set search_path to 'public' as $$
  select
    case when (now() at time zone 'Europe/Istanbul')::time < public.turnuva_saati('aksam')
         then (now() at time zone 'Europe/Istanbul')::date
         else (now() at time zone 'Europe/Istanbul')::date + 1 end,
    case when (now() at time zone 'Europe/Istanbul')::time < public.turnuva_saati('sabah') then 'sabah'
         when (now() at time zone 'Europe/Istanbul')::time < public.turnuva_saati('aksam') then 'aksam'
         else 'sabah' end;
$$;

create or replace function public.sonraki_turnuva_tarihi()
returns date language sql stable security definer set search_path to 'public' as $$
  select case
    when (now() at time zone 'Europe/Istanbul')::time < public.turnuva_saati('aksam')
      then (now() at time zone 'Europe/Istanbul')::date
    else (now() at time zone 'Europe/Istanbul')::date + 1
  end;
$$;

-- İstemci geri sayımı için: sıradaki turnuvanın TAM ANI (UTC damgası).
-- Böylece saat değişirse arayüz de kendiliğinden uyar.
create or replace function public.sonraki_turnuva_ani()
returns table(seans text, baslangic timestamptz, saat_sabah time, saat_aksam time)
language sql stable security definer set search_path to 'public' as $$
  select b.o_seans,
         (b.o_tarih + public.turnuva_saati(b.o_seans)) at time zone 'Europe/Istanbul',
         public.turnuva_saati('sabah'),
         public.turnuva_saati('aksam')
  from public.sonraki_turnuva_bilgi() b;
$$;

grant execute on function public.sonraki_turnuva_ani() to authenticated;

-- ---- Zamanlanmış işler yeni saatlere taşınır ----
-- Sunucu UTC; Türkiye yıl boyu UTC+3.
--   13:00 TSİ = 10:00 UTC · 21:50 TSİ = 18:50 UTC
--   Hatırlatma 45 dk önce · botlar 30 dk önce lobiye girer.
select cron.unschedule(j) from (values
  ('bildim-turnuva-baslat'), ('bildim-turnuva-baslat-sabah'),
  ('bildim-bot-turnuva'), ('bildim-bot-turnuva-sabah')
) t(j) where exists (select 1 from cron.job where jobname = t.j);

select cron.schedule('bildim-turnuva-baslat-sabah', '0 10 * * *',
                     'select public.start_tournament(''sabah'')');
select cron.schedule('bildim-turnuva-baslat', '50 18 * * *',
                     'select public.start_tournament(''aksam'')');
select cron.schedule('bildim-bot-turnuva-sabah', '30 9 * * *',
                     'select public.bot_join_tournament(''sabah'')');
select cron.schedule('bildim-bot-turnuva', '20 18 * * *',
                     'select public.bot_join_tournament(''aksam'')');

-- Hatırlatma push'ları yeniden TANIMLANMIYOR, yalnız saatleri değişiyor:
-- komutlarında cron gizli anahtarı var, depoya girmemeli.
select cron.alter_job(jobid, schedule => '15 9 * * *')
  from cron.job where jobname = 'bildim-turnuva-hatirlat-sabah';
select cron.alter_job(jobid, schedule => '5 18 * * *')
  from cron.job where jobname = 'bildim-turnuva-hatirlat';
