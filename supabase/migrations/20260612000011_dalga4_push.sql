-- ============================================================
-- Dalga 4: Web push bildirimleri
-- ============================================================

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subs_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from authenticated, anon;

create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth;
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
revoke execute on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- ---------- Meydan okuma gelince bildir ----------

create or replace function public.notify_new_challenge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gonderen text;
begin
  if new.durum = 'bekliyor'
     and not exists (select 1 from public.profiles where id = new.oyuncu2 and is_bot)
     and exists (select 1 from public.push_subscriptions where user_id = new.oyuncu2)
  then
    select username into v_gonderen from public.profiles where id = new.oyuncu1;
    perform net.http_post(
      url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'x-cron-secret', '6i81Q786ABf6QpRC9ZOnC0ZSD63iccQ',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_ids', jsonb_build_array(new.oyuncu2),
        'baslik', '⚔️ Meydan okuma!',
        'govde', coalesce(v_gonderen, 'Biri') || ' sana meydan okudu. Kabul ediyor musun?',
        'url', '/meydan'
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_challenge on public.matches;
create trigger trg_notify_challenge
  after insert on public.matches
  for each row execute function public.notify_new_challenge();

-- ---------- Turnuva hatırlatması: her gece 21:45 TSİ (18:45 UTC) ----------

do $$
begin
  begin
    perform cron.unschedule('bildim-turnuva-hatirlat');
  exception when others then null;
  end;
  perform cron.schedule('bildim-turnuva-hatirlat', '45 18 * * *',
    $cron$select net.http_post(
      url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
      headers := '{"x-cron-secret": "6i81Q786ABf6QpRC9ZOnC0ZSD63iccQ", "Content-Type": "application/json"}'::jsonb,
      body := '{"baslik": "🌙 Gece turnuvası yaklaşıyor!", "govde": "Büyük turnuva 22:00''de başlıyor. Lobideki yerini al! 🏆", "url": "/turnuva"}'::jsonb
    )$cron$);
exception when others then
  raise notice 'pg_cron kurulamadı (yerel ortamda normal): %', sqlerrm;
end $$;
