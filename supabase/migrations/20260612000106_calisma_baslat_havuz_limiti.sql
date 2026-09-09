-- ============================================================================
-- BİLDİM — "Hatalarım": calisma_baslat havuz doldurma düzeltmesi
--
-- HATA: havuzdan tamamlama sorgusunda `limit v_eksik`, array_agg'ın DIŞ
-- sorgusuna uygulanıyordu. Toplama tek satır döndürdüğü için limit hiçbir şeyi
-- kısıtlamıyor, soru_sec'in döndürdüğü tüm id'ler oturuma giriyordu
-- (istenen 10 soru yerine 15 soruluk tur açılıyordu).
--
-- ÇÖZÜM: limit, id'lerin satır satır açıldığı iç sorguya taşındı.
-- Doğrulama: bildim/_test/hatalarim-test.mjs → test 8.
-- ============================================================================

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

  -- Bankadan: öğrenilmemiş; eski yanlışlar ve çok yanlışlananlar önce
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

  -- Yetmezse normal havuzdan (soru_sec görülmemişleri öne alır).
  -- LIMIT, id'lerin satır satır açıldığı iç sorguda olmalı.
  if v_eksik > 0 then
    select coalesce(array_agg(t.x), '{}'::uuid[]) into v_havuz
    from (
      select s.x
      from (
        select unnest(
          public.soru_sec(
            v_kat,
            v_eksik + coalesce(array_length(v_banka, 1), 0) + 5,
            array[v_me]
          )
        ) as x
      ) s
      where not (s.x = any(v_banka))
      limit v_eksik
    ) t;
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
