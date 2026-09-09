-- ============================================================================
-- BİLDİM — "Hatalarım" çalışma modu
-- Oyuncunun tüm modlarda YANLIŞ bildiği sorular kişisel bir bankada birikir;
-- puansız, tek kişilik çalışma turuyla eksikler kapatılır.
--
-- Kesin kurallar:
--  * Tek kişilik, rakipsiz, botsuz.
--  * Lig puanı VERMEZ: profiles.puan / puan_hafta / seri_gun DEĞİŞMEZ.
--    Yalnız kategori ustalığı (kategori_dogru) ve "öğrenilen soru" sayacına işler.
--  * Banka boş/yetersizse normal havuzdan tamamlanır (mod her zaman oynanabilir).
--  * Bir soru üst üste 2 kez doğru bilinirse "öğrenildi" ve bankadan çıkar;
--    araya bir yanlış girerse seri sıfırlanır ve soru bankada kalır.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Kişisel yanlış bankası
-- ---------------------------------------------------------------------------
create table if not exists public.yanlis_sorular (
  user_id        uuid not null references auth.users(id) on delete cascade,
  question_id    uuid not null references public.questions(id) on delete cascade,
  yanlis_sayisi  int not null default 1,
  dogru_serisi   int not null default 0,
  son_yanlis_at  timestamptz not null default now(),
  ogrenildi_at   timestamptz null,
  created_at     timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- Banka sorgusu: öğrenilmemişler, eskiden yeniye
create index if not exists yanlis_sorular_banka_idx
  on public.yanlis_sorular (user_id, ogrenildi_at, son_yanlis_at);

alter table public.yanlis_sorular enable row level security;

-- Yalnız sahibi okur. Yazım security-definer RPC ile yapılır (INSERT/UPDATE
-- politikası bilerek verilmedi).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'yanlis_sorular'
      and policyname = 'yanlis_sorular_sahibi_okur'
  ) then
    create policy yanlis_sorular_sahibi_okur on public.yanlis_sorular
      for select to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Çalışma oturumları — süre ve cevap doğrulaması SUNUCUDA
-- ---------------------------------------------------------------------------
create table if not exists public.calisma_oturumlari (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  kategori       text null,
  soru_ids       uuid[] not null,
  -- soru_ids içinden bankadan gelenler (geri bildirim ve istatistik için)
  banka_ids      uuid[] not null default '{}'::uuid[],
  aktif_soru     int not null default 0,
  soru_baslangic timestamptz not null default now(),
  baslangic      timestamptz not null default now(),
  bitis          timestamptz null,
  dogru          int not null default 0,
  yanlis         int not null default 0,
  ogrenilen      int not null default 0,
  durum          text not null default 'aktif',
  created_at     timestamptz not null default now()
);

create index if not exists calisma_oturumlari_user_idx
  on public.calisma_oturumlari (user_id, durum, baslangic desc);

alter table public.calisma_oturumlari enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'calisma_oturumlari'
      and policyname = 'calisma_oturumlari_sahibi_okur'
  ) then
    create policy calisma_oturumlari_sahibi_okur on public.calisma_oturumlari
      for select to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) yanlis_kaydet — tüm modlardaki cevap RPC'leri buraya yazar
-- ---------------------------------------------------------------------------
create or replace function public.yanlis_kaydet(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null or p_question_id is null then return; end if;
  -- Botların bankası olmaz
  if exists (select 1 from public.profiles where id = v_me and coalesce(is_bot, false)) then
    return;
  end if;
  -- Soru havuzdan kalkmış olabilir
  if not exists (select 1 from public.questions where id = p_question_id) then
    return;
  end if;

  insert into public.yanlis_sorular
    (user_id, question_id, yanlis_sayisi, dogru_serisi, son_yanlis_at, ogrenildi_at)
  values (v_me, p_question_id, 1, 0, now(), null)
  on conflict (user_id, question_id) do update
    set yanlis_sayisi = public.yanlis_sorular.yanlis_sayisi + 1,
        dogru_serisi  = 0,
        son_yanlis_at = now(),
        ogrenildi_at  = null;
exception when others then
  -- Kayıt tutulamazsa maç akışı bozulmasın
  return;
end;
$function$;

revoke all on function public.yanlis_kaydet(uuid) from public;
grant execute on function public.yanlis_kaydet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) yanlis_bankam — özet + kategori kırılımı
-- ---------------------------------------------------------------------------
create or replace function public.yanlis_bankam()
returns table(
  toplam         int,
  ogrenilen      int,
  bekleyen       int,
  kategori       text,
  kategori_adet  int
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_toplam int;
  v_ogrenilen int;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  select count(*)::int,
         count(*) filter (where ys.ogrenildi_at is not null)::int
    into v_toplam, v_ogrenilen
  from public.yanlis_sorular ys
  where ys.user_id = v_me;

  return query
  select v_toplam,
         v_ogrenilen,
         (v_toplam - v_ogrenilen),
         q.kategori,
         count(*)::int
  from public.yanlis_sorular ys
  join public.questions q on q.id = ys.question_id
  where ys.user_id = v_me and ys.ogrenildi_at is null
  group by q.kategori
  order by count(*) desc;

  -- Banka tamamen boşsa yine tek satır dönsün (arayüz sıfırları göstersin)
  if v_toplam = 0 then
    return query select 0, 0, 0, null::text, 0;
  end if;
end;
$function$;

revoke all on function public.yanlis_bankam() from public;
grant execute on function public.yanlis_bankam() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) calisma_baslat — önce bankadan, yetmezse havuzdan tamamla
-- ---------------------------------------------------------------------------
create or replace function public.calisma_baslat(
  p_kategori text default null,
  p_soru_sayisi int default 10
)
returns table(
  oturum_id      uuid,
  soru_sayisi    int,
  bankadan       int,
  havuzdan       int,
  soru_sure_sn   int
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_kat text;
  v_adet int;
  v_banka uuid[] := '{}'::uuid[];
  v_havuz uuid[] := '{}'::uuid[];
  v_tum uuid[] := '{}'::uuid[];
  v_eksik int;
  v_id uuid;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  v_adet := least(50, greatest(5, coalesce(p_soru_sayisi, 10)));
  v_kat := nullif(btrim(coalesce(p_kategori, '')), '');
  if v_kat is not null
     and not exists (select 1 from public.questions q where q.aktif and q.kategori = v_kat) then
    raise exception 'Geçersiz kategori';
  end if;

  -- Aynı anda tek aktif oturum
  update public.calisma_oturumlari
     set durum = 'bitti', bitis = coalesce(bitis, now())
   where user_id = v_me and durum = 'aktif';

  -- 5a) Bankadan: öğrenilmemiş, eski yanlışlar ve çok yanlışlananlar önce
  select coalesce(array_agg(s.question_id), '{}'::uuid[]) into v_banka
  from (
    select ys.question_id
    from public.yanlis_sorular ys
    join public.questions q on q.id = ys.question_id
    where ys.user_id = v_me
      and ys.ogrenildi_at is null
      and q.aktif
      and (v_kat is null or q.kategori = v_kat)
    order by ys.son_yanlis_at asc, ys.yanlis_sayisi desc
    limit v_adet
  ) s;

  v_eksik := v_adet - coalesce(array_length(v_banka, 1), 0);

  -- 5b) Yetmezse normal havuzdan (soru_sec görülmemişleri öne alır)
  if v_eksik > 0 then
    select coalesce(array_agg(x), '{}'::uuid[]) into v_havuz
    from (
      select unnest(public.soru_sec(v_kat, v_eksik + coalesce(array_length(v_banka,1),0) + 5,
                                    array[v_me])) as x
    ) t
    where not (t.x = any(v_banka))
    limit v_eksik;
  end if;

  v_tum := v_banka || coalesce(v_havuz, '{}'::uuid[]);

  if coalesce(array_length(v_tum, 1), 0) = 0 then
    raise exception 'Çalışılacak soru bulunamadı';
  end if;

  insert into public.calisma_oturumlari (user_id, kategori, soru_ids, banka_ids)
  values (v_me, v_kat, v_tum, v_banka)
  returning id into v_id;

  return query
  select v_id,
         coalesce(array_length(v_tum, 1), 0),
         coalesce(array_length(v_banka, 1), 0),
         coalesce(array_length(v_havuz, 1), 0),
         20;
end;
$function$;

revoke all on function public.calisma_baslat(text, int) from public;
grant execute on function public.calisma_baslat(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) calisma_soru — doğru cevap İSTEMCİYE GÖNDERİLMEZ
-- ---------------------------------------------------------------------------
create or replace function public.calisma_soru(p_oturum_id uuid)
returns table(
  question_id      uuid,
  soru             text,
  secenekler       jsonb,
  kategori         text,
  soru_index       int,
  toplam           int,
  bankadan         boolean,
  onceki_yanlis    int,
  dogru_serisi     int,
  baslangic        timestamptz,
  sunucu_zamani    timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o public.calisma_oturumlari%rowtype;
  v_qid uuid;
  v_bankadan boolean;
  v_yanlis int := 0;
  v_seri int := 0;
begin
  select * into o from public.calisma_oturumlari where id = p_oturum_id;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;
  if o.aktif_soru >= coalesce(array_length(o.soru_ids, 1), 0) then
    raise exception 'Tur bitti';
  end if;

  v_qid := o.soru_ids[o.aktif_soru + 1];
  v_bankadan := v_qid = any(o.banka_ids);

  select ys.yanlis_sayisi, ys.dogru_serisi into v_yanlis, v_seri
  from public.yanlis_sorular ys
  where ys.user_id = o.user_id and ys.question_id = v_qid;

  -- Her soruda süre yeniden başlar
  update public.calisma_oturumlari set soru_baslangic = now() where id = p_oturum_id;

  return query
  select q.id, q.soru, q.secenekler, q.kategori,
         o.aktif_soru,
         coalesce(array_length(o.soru_ids, 1), 0),
         v_bankadan,
         coalesce(v_yanlis, 0),
         coalesce(v_seri, 0),
         now(), now()
  from public.questions q
  where q.id = v_qid;
end;
$function$;

revoke all on function public.calisma_soru(uuid) from public;
grant execute on function public.calisma_soru(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) calisma_cevap — puan YOK, yalnız banka + kategori ustalığı
-- ---------------------------------------------------------------------------
create or replace function public.calisma_cevap(
  p_oturum_id uuid,
  p_soru_index int,
  p_cevap smallint
)
returns table(
  dogru        boolean,
  dogru_cevap  smallint,
  bankadan     boolean,
  yeni_seri    int,
  ogrenildi    boolean,
  onceki_yanlis int,
  bitti        boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  o public.calisma_oturumlari%rowtype;
  q public.questions%rowtype;
  v_dogru boolean;
  v_bankadan boolean;
  v_seri int := 0;
  v_yanlis int := 0;
  v_ogrenildi boolean := false;
  v_bitti boolean := false;
  v_var boolean;
begin
  select * into o from public.calisma_oturumlari where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;
  if o.durum <> 'aktif' then raise exception 'Oturum bitti'; end if;
  if p_soru_index <> o.aktif_soru then raise exception 'Soru değişti'; end if;

  select * into q from public.questions where id = o.soru_ids[o.aktif_soru + 1];
  v_bankadan := q.id = any(o.banka_ids);

  -- Süre 20 sn (+1 sn ağ payı); geçtiyse yanlış sayılır
  if now() > o.soru_baslangic + interval '21 seconds' then
    v_dogru := false;
  else
    v_dogru := (p_cevap = q.dogru_cevap);
  end if;

  -- Bankadaki satırın önceki durumunu al
  select true, ys.yanlis_sayisi, ys.dogru_serisi
    into v_var, v_yanlis, v_seri
  from public.yanlis_sorular ys
  where ys.user_id = o.user_id and ys.question_id = q.id;

  if v_dogru then
    -- Kategori ustalığı: çalışma modunda da doğrular sayılır
    perform public.kategori_dogru_arttir(o.user_id, q.kategori);

    if coalesce(v_var, false) then
      v_seri := coalesce(v_seri, 0) + 1;
      if v_seri >= 2 then
        v_ogrenildi := true;
        update public.yanlis_sorular ys
           set dogru_serisi = v_seri, ogrenildi_at = now()
         where ys.user_id = o.user_id and ys.question_id = q.id;
      else
        update public.yanlis_sorular ys
           set dogru_serisi = v_seri, ogrenildi_at = null
         where ys.user_id = o.user_id and ys.question_id = q.id;
      end if;
    end if;
    -- Havuzdan gelen soru doğru bilindiyse bankaya hiç girmez.
  else
    -- Yanlış: seri sıfırlanır, banka satırı açılır/güncellenir
    perform public.yanlis_kaydet(q.id);
    v_seri := 0;
    v_yanlis := coalesce(v_yanlis, 0) + 1;
    v_ogrenildi := false;
  end if;

  update public.calisma_oturumlari c
     set dogru = c.dogru + (case when v_dogru then 1 else 0 end),
         yanlis = c.yanlis + (case when v_dogru then 0 else 1 end),
         ogrenilen = c.ogrenilen + (case when v_ogrenildi then 1 else 0 end),
         aktif_soru = c.aktif_soru + 1,
         soru_baslangic = now()
   where c.id = p_oturum_id
  returning c.* into o;

  if o.aktif_soru >= coalesce(array_length(o.soru_ids, 1), 0) then
    v_bitti := true;
  end if;

  return query select v_dogru, q.dogru_cevap, v_bankadan,
                      coalesce(v_seri, 0), v_ogrenildi,
                      coalesce(v_yanlis, 0), v_bitti;
end;
$function$;

revoke all on function public.calisma_cevap(uuid, int, smallint) from public;
grant execute on function public.calisma_cevap(uuid, int, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) calisma_bitir — tur özeti
-- ---------------------------------------------------------------------------
create or replace function public.calisma_bitir(p_oturum_id uuid)
returns table(
  dogru           int,
  yanlis          int,
  ogrenilen       int,
  bankada_kalan   int,
  toplam_ogrenilen int
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  o public.calisma_oturumlari%rowtype;
  v_kalan int;
  v_ogr int;
begin
  select * into o from public.calisma_oturumlari where id = p_oturum_id for update;
  if not found then raise exception 'Oturum bulunamadı'; end if;
  if o.user_id <> auth.uid() then raise exception 'Bu oturum senin değil'; end if;

  if o.durum = 'aktif' then
    update public.calisma_oturumlari
       set durum = 'bitti', bitis = now()
     where id = p_oturum_id
    returning * into o;
  end if;

  select count(*) filter (where ys.ogrenildi_at is null)::int,
         count(*) filter (where ys.ogrenildi_at is not null)::int
    into v_kalan, v_ogr
  from public.yanlis_sorular ys
  where ys.user_id = o.user_id;

  return query select o.dogru, o.yanlis, o.ogrenilen,
                      coalesce(v_kalan, 0), coalesce(v_ogr, 0);
end;
$function$;

revoke all on function public.calisma_bitir(uuid) from public;
grant execute on function public.calisma_bitir(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) mac_yanlis_sayim — maç sonu "N soruyu yanlış bildin" satırı için
-- ---------------------------------------------------------------------------
create or replace function public.mac_yanlis_sayim(p_mac_tur text, p_mac_id uuid)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_n int := 0;
begin
  if v_me is null or p_mac_id is null then return 0; end if;

  if p_mac_tur = '1v1' then
    select count(*)::int into v_n from public.match_answers a
     where a.match_id = p_mac_id and a.user_id = v_me and not a.dogru;
  elsif p_mac_tur = 'grup' then
    select count(*)::int into v_n from public.group_match_answers a
     where a.group_match_id = p_mac_id and a.user_id = v_me and not a.dogru;
  elsif p_mac_tur = 'turnuva' then
    select count(*)::int into v_n from public.tournament_answers a
     where a.tournament_id = p_mac_id and a.user_id = v_me and not a.dogru;
  elsif p_mac_tur = 'hizli' then
    select count(*)::int into v_n from public.hizli_cevaplar a
     where a.hizli_mac_id = p_mac_id and a.user_id = v_me and not a.dogru;
  end if;

  return coalesce(v_n, 0);
exception when others then
  return 0;
end;
$function$;

revoke all on function public.mac_yanlis_sayim(text, uuid) from public;
grant execute on function public.mac_yanlis_sayim(text, uuid) to authenticated;
