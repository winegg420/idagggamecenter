-- ============================================================
-- 55 — Akşam seri hatırlatması (20:00 TSİ)
--
-- Bugün hiç maç bitirmemiş ve serisi devam eden oyunculara hatırlatma.
-- Push aboneliği varsa push, her hâlükârda uygulama içi bildirim yazılır.
-- ============================================================

create or replace function public.seri_hatirlat()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  r record;
begin
  for r in
    select p.id, p.seri_gun
    from public.profiles p
    where coalesce(p.is_bot, false) = false
      and coalesce(p.seri_gun, 0) > 0
      and (p.seri_son_gun is null or p.seri_son_gun < v_bugun)   -- bugün oynamadı
  loop
    perform public.bildirim_yaz(
      r.id, 'seri',
      '🔥 ' || r.seri_gun || ' günlük serin tehlikede! Bugün bir maç yap, bozulmasın.',
      '/bildim'
    );

    -- Push aboneliği varsa ayrıca bildirim gönder
    if exists (select 1 from public.push_subscriptions ps where ps.user_id = r.id) then
      begin
        perform net.http_post(
          url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
          headers := jsonb_build_object(
            'x-cron-secret', '6i81Q786ABf6QpRC9ZOnC0ZSD63iccQ',
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'user_ids', jsonb_build_array(r.id),
            'baslik', '🔥 Serin tehlikede!',
            'govde', r.seri_gun || ' günlük serini bozma — bir maç yeter.',
            'url', '/bildim'
          )
        );
      exception when others then
        raise notice 'seri_hatirlat push hatası (%): %', r.id, sqlerrm;
      end;
    end if;
  end loop;
end;
$$;

revoke execute on function public.seri_hatirlat() from public, anon, authenticated;

do $$
begin
  begin perform cron.unschedule('bildim-seri-hatirlat'); exception when others then null; end;
  -- 20:00 TSİ = 17:00 UTC
  perform cron.schedule('bildim-seri-hatirlat', '0 17 * * *', 'select public.seri_hatirlat()');
exception when others then
  raise notice 'pg_cron kurulamadı (yerel ortamda normal): %', sqlerrm;
end $$;
