-- ============================================================
-- DÜELLO DAVETİ — arkadaşına (ve açık bota) DÜELLO modunda meydan okuma
--
-- Sorun: Düello yalnız rastgele eşleşmeyle (duello_kuyrugu) oynanabiliyordu; meydan okuma akışında
-- düello modu hiç yoktu, oyuncu arkadaşını düelloya çağıramıyordu.
-- Çözüm: create_challenge/respond_challenge ile AYNI kalıpta davet tablosu + üç RPC. Düellonun kendisi
-- değişmedi; kabul edilince mevcut public.duello_olustur() çağrılır.
-- ============================================================

create table if not exists public.duello_davetleri (
  id uuid primary key default gen_random_uuid(),
  kuran uuid not null references public.profiles(id) on delete cascade,
  rakip uuid not null references public.profiles(id) on delete cascade,
  dereceli boolean not null default true,
  durum text not null default 'bekliyor' check (durum in ('bekliyor','kabul','red','iptal')),
  duello_id uuid references public.duellolar(id) on delete set null,
  created_at timestamptz not null default now(),
  yanit_at timestamptz,
  check (kuran <> rakip)
);
create index if not exists idx_duello_davet_rakip on public.duello_davetleri (rakip, durum, created_at desc);
create index if not exists idx_duello_davet_kuran on public.duello_davetleri (kuran, durum, created_at desc);

alter table public.duello_davetleri enable row level security;
revoke all on public.duello_davetleri from anon, authenticated;
grant select on public.duello_davetleri to authenticated;   -- yazma yalnız RPC ile (security definer)

drop policy if exists "duello daveti taraflar gorur" on public.duello_davetleri;
create policy "duello daveti taraflar gorur" on public.duello_davetleri
  for select to authenticated
  using (kuran = auth.uid() or rakip = auth.uid());

-- Realtime: iki taraf da daveti anında görsün (matches ile aynı düzen)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duello_davetleri')
  then
    execute 'alter publication supabase_realtime add table public.duello_davetleri';
  end if;
end $$;

-- ------------------------------------------------------------ davet gönder
-- Dönüş: { davet_id uuid, duello_id uuid|null }. Açık bot davet edilirse bot ANINDA kabul eder
-- (create_challenge'daki bot davranışının aynısı) ve düello id'si döner.
create or replace function public.duello_davet_et(p_rakip uuid, p_dereceli boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_davet uuid;
  v_duello uuid;
  v_bot boolean;
begin
  perform public.hiz_siniri('duello_davet_et', 30, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  if p_rakip = v_me then raise exception 'Kendine meydan okuyamazsın'; end if;
  if not exists (select 1 from public.profiles where id = p_rakip) then
    raise exception 'Oyuncu bulunamadı';
  end if;
  if not public.oynanabilir_mi(p_rakip) then
    raise exception 'Yalnız arkadaşlarına ve botlara meydan okuyabilirsin.';
  end if;

  -- 24 saatten eski yanıtlanmamış davetler kendiliğinden düşer (eski_davetleri_temizle ile aynı ilke)
  delete from public.duello_davetleri
   where durum = 'bekliyor' and created_at < now() - interval '24 hours';

  if exists (select 1 from public.duellolar
              where durum = 'aktif' and (v_me in (oyuncu1, oyuncu2) or p_rakip in (oyuncu1, oyuncu2))) then
    raise exception 'Devam eden bir düello var';
  end if;
  if exists (select 1 from public.duello_davetleri
              where durum = 'bekliyor'
                and ((kuran = v_me and rakip = p_rakip) or (kuran = p_rakip and rakip = v_me))) then
    raise exception 'Bu oyuncuyla bekleyen bir düello davetin zaten var';
  end if;

  perform public.mac_kotasi_kontrol();

  insert into public.duello_davetleri (kuran, rakip, dereceli)
  values (v_me, p_rakip, coalesce(p_dereceli, true))
  returning id into v_davet;

  -- Açık bot: bekletmeden kabul et. (Gizli botlar meydan okuma listesinde görünmez; is_bot istemciye sızmaz.)
  select coalesce(is_bot, false) and coalesce(acik_bot, false) into v_bot
    from public.profiles where id = p_rakip;
  if coalesce(v_bot, false) then
    v_duello := public.duello_olustur(v_me, p_rakip, coalesce(p_dereceli, true));
    update public.duello_davetleri
       set durum = 'kabul', duello_id = v_duello, yanit_at = now()
     where id = v_davet;
  end if;

  return jsonb_build_object('davet_id', v_davet, 'duello_id', v_duello);
end;
$$;

-- ------------------------------------------------------------ daveti yanıtla (davet edilen)
create or replace function public.duello_davet_cevap(p_id uuid, p_kabul boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  d public.duello_davetleri%rowtype;
  v_duello uuid;
begin
  perform public.hiz_siniri('duello_davet_cevap', 60, interval '60 seconds');
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  select * into d from public.duello_davetleri where id = p_id for update;
  if not found then raise exception 'Davet bulunamadı'; end if;
  if d.rakip <> v_me then raise exception 'Bu davet sana ait değil'; end if;
  if d.durum <> 'bekliyor' then raise exception 'Davet zaten yanıtlanmış'; end if;

  if not coalesce(p_kabul, false) then
    update public.duello_davetleri set durum = 'red', yanit_at = now() where id = p_id;
    return null;
  end if;

  if exists (select 1 from public.duellolar
              where durum = 'aktif' and (v_me in (oyuncu1, oyuncu2) or d.kuran in (oyuncu1, oyuncu2))) then
    raise exception 'Devam eden bir düello var';
  end if;
  perform public.mac_kotasi_kontrol();

  -- Daveti KURAN saldırıyla başlar (duello_olustur ilk oyuncuyu saldıran yapar)
  v_duello := public.duello_olustur(d.kuran, v_me, d.dereceli);
  update public.duello_davetleri
     set durum = 'kabul', duello_id = v_duello, yanit_at = now()
   where id = p_id;
  return v_duello;
end;
$$;

-- ------------------------------------------------------------ daveti geri al (kuran)
create or replace function public.duello_davet_iptal(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  update public.duello_davetleri
     set durum = 'iptal', yanit_at = now()
   where id = p_id and kuran = v_me and durum = 'bekliyor';
end;
$$;

revoke execute on function public.duello_davet_et(uuid, boolean) from public, anon;
revoke execute on function public.duello_davet_cevap(uuid, boolean) from public, anon;
revoke execute on function public.duello_davet_iptal(uuid) from public, anon;
grant execute on function public.duello_davet_et(uuid, boolean) to authenticated;
grant execute on function public.duello_davet_cevap(uuid, boolean) to authenticated;
grant execute on function public.duello_davet_iptal(uuid) to authenticated;
