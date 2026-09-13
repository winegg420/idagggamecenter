-- ============================================================
-- TEST DÖNEMİ: TÜM KOZMETİKLER ÜCRETSİZ
--
-- Sahibinin kararı: "Bütün kişiselleştirme eşyalarını bedava yap.
-- Test etsin oynayanlar."
--
-- GERİ ALINABİLİR YAPILDI: fiyatlar `avatar3d_parcalar.coin_fiyat`
-- kolonunda OLDUĞU GİBİ DURUYOR, silinmedi. Tek anahtar çevrilir:
--
--   update oyun_ayarlari set deger='false' where anahtar='kozmetik_bedava_test';
--
-- Bu satır çalıştığı an fiyatlar geri gelir; arayüz de aynı anahtarı
-- okuduğu için "Ücretsiz" yazısı yerine fiyatı göstermeye döner.
--
-- Test süresince TURNUVA ÖDÜLLERİ DE (Taç, Pelerin) alınabilir —
-- "bütün eşyalar" denmişti. Nadirlik etiketi kartta duruyor ki oyuncu
-- normalde nasıl kazanılacağını görsün.
-- ============================================================

insert into public.oyun_ayarlari (anahtar, deger, aciklama)
values (
  'kozmetik_bedava_test',
  'true'::jsonb,
  'Test dönemi: 3B gardırop parçaları ücretsiz. false yapılınca coin_fiyat değerleri geri devreye girer (ödül eşyaları da yeniden kilitlenir).'
)
on conflict (anahtar) do update set aciklama = excluded.aciklama;

-- ------------------------------------------------------------
-- Arayüzün de anahtarı görmesi gerekiyor: katalog RPC'si taşısın
-- ------------------------------------------------------------
-- Donus tipine 'bedava_test' eklendi: once dusurulmesi gerekiyor.
drop function if exists public.avatar3d_katalogum();
create or replace function public.avatar3d_katalogum()
returns table(
  avatar3d_parcalar jsonb,
  avatar3d_sahip    text[],
  avatar3d_gorunum  jsonb,
  bakiye            bigint,
  bedava_test       boolean
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  return query
    select
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'ad', p.ad, 'yuva', p.yuva, 'deger', p.deger,
          'coin_fiyat', p.coin_fiyat, 'nadirlik', p.nadirlik,
          'aktif', p.aktif, 'sira', p.sira
        ) order by p.yuva, p.sira)
        from public.avatar3d_parcalar p where p.aktif
      ), '[]'::jsonb),
      coalesce((
        select array_agg(s.parca_id) from public.avatar3d_sahip s where s.oyuncu_id = v_me
      ), '{}'::text[]),
      coalesce((select pr.gorunum -> 'avatar3d' from public.profiles pr where pr.id = v_me), 'null'::jsonb),
      coalesce((select pr.coin from public.profiles pr where pr.id = v_me), 0),
      coalesce((select (o.deger)::boolean from public.oyun_ayarlari o
                 where o.anahtar = 'kozmetik_bedava_test'), false);
end;
$fn$;

grant execute on function public.avatar3d_katalogum() to authenticated;

-- ------------------------------------------------------------
-- SATIN AL — test açıkken coin düşmez, ödül eşyası da açılır
-- Karar SUNUCUDA: istemci "bedava" diye gönderse bile ayar kapalıysa
-- normal fiyat ve ödül kilidi uygulanır.
-- ------------------------------------------------------------
create or replace function public.avatar3d_satin_al(p_id text)
returns table(bakiye bigint, alinan_id text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me     uuid := auth.uid();
  v_parca  public.avatar3d_parcalar%rowtype;
  v_bakiye bigint;
  v_bedava boolean;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  perform public.hiz_siniri('avatar3d_satin_al', 30, interval '60 seconds');

  select coalesce((deger)::boolean, false) into v_bedava
    from public.oyun_ayarlari where anahtar = 'kozmetik_bedava_test';
  v_bedava := coalesce(v_bedava, false);

  select * into v_parca from public.avatar3d_parcalar where id = p_id and aktif;
  if not found then raise exception 'Parça bulunamadı'; end if;

  -- Ödül eşyası normalde satılmaz; test döneminde açılır.
  if v_parca.coin_fiyat is null and not v_bedava then
    raise exception 'Bu parça satın alınamaz, yalnız ödül olarak kazanılır';
  end if;

  if exists (select 1 from public.avatar3d_sahip s where s.oyuncu_id = v_me and s.parca_id = p_id) then
    raise exception 'Bu parça zaten sende';
  end if;

  if v_bedava or coalesce(v_parca.coin_fiyat, 0) = 0 then
    -- Coin'e dokunulmaz: bakiye olduğu gibi döner.
    select coin into v_bakiye from public.profiles where id = v_me;
  else
    v_bakiye := public.coin_harca(v_parca.coin_fiyat, 'avatar3d', p_id);
  end if;

  insert into public.avatar3d_sahip (oyuncu_id, parca_id, kaynak)
  values (v_me, p_id,
          case when v_bedava then 'bedava_test'
               when v_parca.coin_fiyat = 0 then 'baslangic'
               else 'satin' end)
  on conflict do nothing;

  return query select v_bakiye, p_id;
end;
$fn$;

grant execute on function public.avatar3d_satin_al(text) to authenticated;
