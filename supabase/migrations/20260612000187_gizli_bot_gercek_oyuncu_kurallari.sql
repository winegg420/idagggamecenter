-- ============================================================
-- GİZLİ BOT HER ALANDA GERÇEK OYUNCU KURALINA TABİ
--
-- Sahibinin kuralı (14 Eyl 2026): iki bot türü var — AÇIK botlar
-- (ToyBot, ÇaylakBot, ÜstatBot, EfsaneBot; adından belli) ve GİZLİ botlar
-- (insan adlı). Gizli bot oyunun her yerinde gerçek oyuncu gibi davranır;
-- gerçek oyuncudan farklı her kural botu ele verir.
--
-- ÖLÇÜLEN SIZINTILAR ve DÜZELTMELER
--   1) `oynanabilir_mi` her botu (gizli dahil) arkadaşlık şartından
--      muaf tutuyordu → haritada/listede arkadaş olmayan gizli bota meydan
--      okunabiliyor, gruba/hızlı maça çağrılabiliyordu; gerçek oyuncuya
--      okunamıyordu. Artık yalnız AÇIK bot muaf.
--      (create_challenge, create_group_challenge, create_hizli_mac bunu kullanır.)
--   2) `sesli_sohbet_izni` gizli bot rakibe "Rakibin bir bot" diyordu.
--      Artık bu yalnız açık botta; gizli bot gerçek oyuncu gibi arkadaşlık
--      kontrolüne düşer ("yalnız arkadaşlarınla").
--   3) `oyuncu_ara` tüm botları gizliyordu; çevrimiçi gerçek oyuncular
--      çıkarken gizli botlar hiç çıkmıyordu. Artık yalnız açık bot hariç.
--   4) Gizli botların `last_seen`'i hiç güncellenmiyordu (155 botun son
--      10 dk'da görüleni 0) → meydandayken/maçtayken bile oyuncu kartında
--      çevrimdışı. Yeni `gizli_bot_nabiz()` dakikada bir: meydan nöbetinde,
--      aktif 1v1/grup/hızlı maçta veya açık turnuvada olan gizli botları
--      "şu an oyunda" yapar.
--   5) Gizli bot bütün kahve/balon ikramlarını kabul eder
--      (`ikram_bot_kabul_yuzde` 85 → 100; migration 186).
-- ============================================================

-- ---- 1) Meydan okuma / davet izni ----
create or replace function public.oynanabilir_mi(p_hedef uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select
    -- Yalnız AÇIK bot herkese açık; gizli bot gerçek oyuncu gibi arkadaşlık ister.
    coalesce((select public.acik_bot_mu(p.is_bot, p.bot_turu)
                from public.profiles p where p.id = p_hedef), false)
    or exists (
      select 1 from public.friendships f
      where f.durum = 'arkadas'
        and ((f.requester = auth.uid() and f.addressee = p_hedef)
          or (f.requester = p_hedef and f.addressee = auth.uid()))
    );
$fn$;

-- ---- 2) Sesli sohbet ----
create or replace function public.sesli_sohbet_izni(p_match_id uuid)
returns table(izinli boolean, neden text, rakip_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := auth.uid();
  m public.matches%rowtype;
  v_rakip uuid;
  v_acik_bot boolean;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  select * into m from public.matches where id = p_match_id;
  if not found then
    return query select false, 'Maç bulunamadı', null::uuid; return;
  end if;
  if v_me not in (m.oyuncu1, m.oyuncu2) then
    return query select false, 'Bu maçta değilsin', null::uuid; return;
  end if;
  if m.durum <> 'aktif' then
    return query select false, 'Maç aktif değil', null::uuid; return;
  end if;

  v_rakip := case when m.oyuncu1 = v_me then m.oyuncu2 else m.oyuncu1 end;

  -- Yalnız AÇIK bot "bot" diye söylenir. Gizli bot aşağıdaki arkadaşlık
  -- kontrolüne gerçek oyuncu gibi düşer (gizli botlar arkadaş olmaz).
  select public.acik_bot_mu(is_bot, bot_turu) into v_acik_bot from public.profiles where id = v_rakip;
  if coalesce(v_acik_bot, false) then
    return query select false, 'Rakibin bir bot', v_rakip; return;
  end if;

  if not exists (
    select 1 from public.friendships f
    where f.durum = 'arkadas'
      and ((f.requester = v_me and f.addressee = v_rakip)
        or (f.requester = v_rakip and f.addressee = v_me))
  ) then
    return query select false, 'Sesli sohbet yalnız arkadaşlarınla açılabilir', v_rakip; return;
  end if;

  return query select true, null::text, v_rakip;
end;
$fn$;

-- ---- 3) Oyuncu arama ----
create or replace function public.oyuncu_ara(p_arama text)
returns table(id uuid, username text, avatar_url text, puan integer, online boolean)
language sql
security definer
set search_path to 'public'
as $fn$
  select
    p.id,
    p.username,
    p.avatar_url,
    p.puan,
    (p.last_seen > now() - interval '2 minutes') as online
  from public.profiles p
  where p.id <> auth.uid()
    -- ESKİDEN: tüm botlar hariç. Gizli bot gerçek oyuncu gibi aranabilir.
    and not public.acik_bot_mu(p.is_bot, p.bot_turu)
    and not (coalesce(p.is_bot, false) and not coalesce(p.bot_aktif, true))
    and length(coalesce(p_arama, '')) >= 2
    and p.username ilike '%' || p_arama || '%'
    and (
      public.hileli_mi()                                   -- admin: herkesi görür
      or p.last_seen > now() - interval '2 minutes'        -- normal: yalnız online
    )
  order by (p.last_seen > now() - interval '2 minutes') desc, p.username asc
  limit 20;
$fn$;

-- ---- 4) Gizli bot çevrimiçi nabzı ----
create or replace function public.gizli_bot_nabiz()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_n int;
begin
  update public.profiles p
     set last_seen = now()
   where coalesce(p.is_bot, false) and p.bot_turu = 'gizli' and coalesce(p.bot_aktif, true)
     and (
       exists (select 1 from public.meydan_bot_nobeti n where n.bot_id = p.id and n.bitis > now())
       or exists (select 1 from public.matches m
                   where m.durum in ('aktif','bekliyor') and p.id in (m.oyuncu1, m.oyuncu2))
       or exists (select 1 from public.group_match_players gp
                    join public.group_matches g on g.id = gp.group_match_id
                   where gp.user_id = p.id and g.durum in ('lobi','bekliyor','aktif')
                     and gp.terk_at is null)
       or exists (select 1 from public.hizli_oyuncular ho
                    join public.hizli_maclar h on h.id = ho.hizli_mac_id
                   where ho.user_id = p.id and h.durum in ('lobi','bekliyor','aktif')
                     and ho.terk_at is null)
       or exists (select 1 from public.tournament_players tp
                    join public.tournaments t on t.id = tp.tournament_id
                   where tp.user_id = p.id and t.durum in ('lobi','aktif'))
     );
  get diagnostics v_n = row_count;
  return v_n;
end;
$fn$;

revoke all on function public.gizli_bot_nabiz() from public, authenticated, anon;

do $$
begin
  perform cron.unschedule('bildim-gizli-bot-nabiz');
exception when others then
  null;   -- yoksa sorun değil
end $$;

-- Dakikada bir: "şu an oyunda" eşiği 2 dk (OyuncuKarti, oyuncu_ara).
select cron.schedule('bildim-gizli-bot-nabiz', '* * * * *', 'select public.gizli_bot_nabiz()');

select public.gizli_bot_nabiz();

-- ---- 5) Gizli bot bütün ikramları kabul eder ----
update public.oyun_ayarlari
   set deger = '100'::jsonb,
       aciklama = 'Meydanda bota yapılan kahve/balon ikramını kabul yüzdesi. Gizli botlar gerçek oyuncu gibi davranır ve hepsini kabul eder (coin harcanır).'
 where anahtar = 'ikram_bot_kabul_yuzde';
