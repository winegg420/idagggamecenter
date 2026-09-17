-- Paket 20 · IV.3 — İlk Düello maçında kategori seçimine ek süre
-- Oyuncu ilk maçında sayaç işlerken 10 kategori yüzdesini VE kuralları aynı anda okumaya çalışıyordu.
-- Hiç bitmiş düellosu olmayan GERÇEK oyuncu saldıran olduğunda kategori süresi + duello_ilk_mac_ek_sure (varsayılan 5 sn).
-- Botlar ek süre almaz (bot zamanlaması duello_tik_hepsi'de duello_kategori_sn'ye göre, dokunulmadı).
insert into public.oyun_ayarlari (anahtar, deger, aciklama)
values ('duello_ilk_mac_ek_sure', '5'::jsonb, 'İlk Düello maçında (bitmiş düellosu olmayan gerçek oyuncu) kategori seçimine eklenen saniye')
on conflict (anahtar) do nothing;

create or replace function public.duello_kategori_suresi(p_saldiran uuid)
 returns integer language sql stable security definer set search_path to 'public'
as $$
  select (public.ayar_sayi('duello_kategori_sn', 20)
    + case when exists (select 1 from public.profiles p where p.id = p_saldiran and not coalesce(p.is_bot, false))
            and not exists (select 1 from public.duellolar x where x.durum = 'bitti' and p_saldiran in (x.oyuncu1, x.oyuncu2))
           then public.ayar_sayi('duello_ilk_mac_ek_sure', 5) else 0 end)::int;
$$;
revoke all on function public.duello_kategori_suresi(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.duello_olustur(p_a uuid, p_b uuid, p_dereceli boolean, p_onceki uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_can int := public.ayar_sayi('duello_can', 3)::int;
  v_p1 jsonb;
  v_p2 jsonb;
begin
  -- Profil ve en zayıf kategori MAÇ BAŞINDA sabitlenir.
  select public.oyuncu_kategori_profili_ic(p_a) into v_p1;
  select public.oyuncu_kategori_profili_ic(p_b) into v_p2;

  insert into public.duellolar (oyuncu1, oyuncu2, dereceli, can1, can2, saldiran, faz, faz_bitis,
                                profil1, profil2, zayif1, zayif2, onceki_id)
  values (p_a, p_b, coalesce(p_dereceli, true), v_can, v_can, p_a, 'kategori',
          now() + make_interval(secs => public.duello_kategori_suresi(p_a)),   -- Paket 20 IV.3
          v_p1, v_p2, public.duello_en_zayif(p_a), public.duello_en_zayif(p_b), p_onceki)
  returning id into v_id;

  insert into public.duello_sinyal (duello_id, oyuncu1, oyuncu2) values (v_id, p_a, p_b);
  delete from public.duello_kuyrugu where user_id in (p_a, p_b);
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.duello_ilerlet(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.duellolar%rowtype;
  v_kat text;
  v_adim int := 0;
  v_savunan uuid;
begin
  loop
    v_adim := v_adim + 1;
    exit when v_adim > 12;
    select * into d from public.duellolar where id = p_id;
    exit when not found or d.durum <> 'aktif';

    if d.created_at < now() - make_interval(mins => public.ayar_sayi('duello_zaman_asimi_dk', 60)::int) then
      update public.duellolar set durum = 'iptal', bitis = now() where id = p_id;
      perform public.duello_sinyal_ver(p_id);
      exit;
    end if;

    exit when d.faz_bitis is not null and now() < d.faz_bitis
              and not (d.faz = 'cevap');
    if d.faz = 'cevap' then
      -- 1 sn ağ payı
      exit when now() <= d.faz_bitis + interval '1 second';
    end if;

    if d.faz = 'kategori' then
      -- Süre doldu: uygun kategorilerden, mümkünse riskli olmayan, rastgele
      v_savunan := case when d.saldiran = d.oyuncu1 then d.oyuncu2 else d.oyuncu1 end;
      select k into v_kat from unnest(public.duello_kategorileri()) k
       where public.duello_kategori_uygun_mu(p_id, d.saldiran, k)
       order by (k is not distinct from (case when v_savunan = d.oyuncu1 then d.zayif1 else d.zayif2 end)), random()
       limit 1;
      perform public.duello_kategori_uygula(p_id, v_kat);
    elsif d.faz = 'hazirlik' then
      update public.duellolar
         set faz = 'cevap',
             -- geç ilerletilse de savunan tam süresini alır
             faz_bitis = greatest(d.faz_bitis, now()) + make_interval(secs =>
               case when d.zaman_baskisi then public.ayar_sayi('duello_zaman_baskisi_sn', 10)
                    else public.ayar_sayi('duello_cevap_sn', 15) end),
             son_hareket = now()
       where id = p_id;
    elsif d.faz = 'cevap' then
      perform public.duello_cozumle(p_id, null);
    elsif d.faz = 'sonuc' then
      if d.saldiri_sirasi = 0 then
        update public.duellolar
           set saldiri_sirasi = 1, saldiran = oyuncu2, faz = 'kategori', kategori = null, soru_id = null,
               faz_bitis = now() + make_interval(secs => public.duello_kategori_suresi(d.oyuncu2)),   -- Paket 20 IV.3
               son_hareket = now()
         where id = p_id;
      else
        perform public.duello_tur_sonu(p_id);
      end if;
    elsif d.faz = 'altin' then
      perform public.duello_altin_degerlendir(p_id);
    end if;
    perform public.duello_sinyal_ver(p_id);
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.duello_tur_sonu(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.duellolar%rowtype;
  v_soru uuid;
begin
  select * into d from public.duellolar where id = p_id;
  if d.can1 > 0 and d.can2 > 0 and d.tur < public.ayar_sayi('duello_max_tur', 10) then
    update public.duellolar
       set tur = tur + 1, saldiri_sirasi = 0, saldiran = oyuncu1, faz = 'kategori',
           faz_bitis = now() + make_interval(secs => public.duello_kategori_suresi(d.oyuncu1)),   -- Paket 20 IV.3
           kategori = null, soru_id = null, son_hareket = now()
     where id = p_id;
    return;
  end if;

  if d.can1 <> d.can2 then
    perform public.duello_bitir(p_id, case when d.can1 > d.can2 then d.oyuncu1 else d.oyuncu2 end);
  elsif d.dogru1 <> d.dogru2 then
    perform public.duello_bitir(p_id, case when d.dogru1 > d.dogru2 then d.oyuncu1 else d.oyuncu2 end);
  else
    -- ALTIN SORU (turnuva mekaniği): kullanılmamış sorudan, jokersiz.
    select q.id into v_soru from public.questions q
     where q.aktif and not (q.id = any(d.kullanilan_sorular))
     order by random() limit 1;
    if v_soru is null then
      perform public.duello_bitir(p_id, d.oyuncu1);
      return;
    end if;
    update public.duellolar
       set faz = 'altin', soru_id = v_soru, kategori = (select kategori from public.questions where id = v_soru),
           altin_cevaplar = '{}'::jsonb, elli_kapali = null,
           kullanilan_sorular = kullanilan_sorular || v_soru,
           faz_bitis = now() + make_interval(secs => public.ayar_sayi('duello_altin_sn', 15)),
           son_hareket = now()
     where id = p_id;
  end if;
end $function$;
