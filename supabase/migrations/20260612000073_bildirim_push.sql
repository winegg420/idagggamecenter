-- ============================================================
-- BİLDİRİM ARTIK TELEFONA DA GİDİYOR
--
-- Şimdiye kadar `bildirim_yaz` yalnız `bildirimler` tablosuna yazıyordu:
-- uygulama içi zil çalışıyor ama telefon bildirimi gitmiyordu. Meydan okuma
-- gelip de uygulama kapalıysa kullanıcının haberi olmuyordu.
--
-- Artık tek kaynak: `bildirim_yaz` hem tabloya yazar hem `send-push` Edge
-- Function'ını çağırır (pg_net ile, ateşle-unut). Push başarısız olsa bile
-- uygulama içi bildirim her hâlükârda düşer.
--
-- Ayrıca sıra karşı tarafa geçtiğinde bildirim: asenkron maçta rakip kendi
-- sorusunu bitirince "sıra sende" haberi gider.
-- ============================================================

create or replace function public.bildirim_yaz(
  p_user uuid, p_tip text, p_metin text, p_yol text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot boolean;
  v_baslik text;
begin
  if p_user is null then return; end if;

  -- Botlara bildirim yazılmaz
  select coalesce(is_bot, false) into v_bot from public.profiles where id = p_user;
  if coalesce(v_bot, false) then return; end if;

  insert into public.bildirimler (user_id, tip, metin, yol)
  values (p_user, p_tip, p_metin, p_yol);

  -- Telefon bildirimi (ateşle-unut; hata oyunu etkilemez)
  v_baslik := case p_tip
    when 'mac_daveti'      then '⚔️ Meydan okuma!'
    when 'rovans'          then '⚔️ Rövanş isteği'
    when 'grup_daveti'     then '👥 Grup maçı daveti'
    when 'hizli_daveti'    then '⚡ Hızlı maç daveti'
    when 'sira_sende'      then '⏳ Sıra sende!'
    when 'arkadas_istek'   then '🤝 Arkadaşlık isteği'
    when 'arkadas_kabul'   then '🎉 Yeni arkadaş'
    when 'gecildin'        then '⚡ Sıran düştü'
    when 'hafta_sonuc'     then '🏆 Hafta bitti'
    when 'ustalik'         then '🎖️ Ustalık'
    when 'seri'            then '🔥 Serin'
    when 'lige_girdin'     then '🏙️ Ligdesin'
    else 'Bildim!'
  end;

  begin
    perform net.http_post(
      url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'x-cron-secret', '6i81Q786ABf6QpRC9ZOnC0ZSD63iccQ',
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_ids', jsonb_build_array(p_user),
        'baslik', v_baslik,
        'govde', p_metin,
        'url', coalesce(p_yol, '/bildim')
      )
    );
  exception when others then
    -- pg_net yoksa ya da çağrı başarısızsa uygulama içi bildirim yine durur
    null;
  end;
end;
$$;

revoke execute on function public.bildirim_yaz(uuid, text, text, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Asenkron maçta "sıra sende" bildirimi
-- Rakip kendi sırasını ilerlettiğinde, henüz oynamamış tarafa haber gider.
-- Aynı maç için en fazla saatte bir (spam olmasın).
-- ------------------------------------------------------------
create or replace function public.trg_mac_sira_bildir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bekleyen uuid;
  v_ilerleyen uuid;
  v_ad text;
  v_toplam int;
begin
  if new.durum <> 'aktif' then return new; end if;
  v_toplam := coalesce(array_length(new.soru_ids, 1), 0);
  if v_toplam = 0 then return new; end if;

  -- Kim ilerledi, kim geride kaldı?
  if new.oyuncu1_soru > old.oyuncu1_soru and new.oyuncu2_soru < v_toplam
     and new.oyuncu1_soru > new.oyuncu2_soru then
    v_ilerleyen := new.oyuncu1; v_bekleyen := new.oyuncu2;
  elsif new.oyuncu2_soru > old.oyuncu2_soru and new.oyuncu1_soru < v_toplam
     and new.oyuncu2_soru > new.oyuncu1_soru then
    v_ilerleyen := new.oyuncu2; v_bekleyen := new.oyuncu1;
  else
    return new;
  end if;

  -- Saatte bir defadan fazla rahatsız etme
  if exists (
    select 1 from public.bildirimler b
    where b.user_id = v_bekleyen and b.tip = 'sira_sende'
      and b.yol = '/bildim/mac/' || new.id::text
      and b.created_at > now() - interval '1 hour'
  ) then
    return new;
  end if;

  select gorunen_ad into v_ad from public.profiles where id = v_ilerleyen;

  perform public.bildirim_yaz(
    v_bekleyen, 'sira_sende',
    coalesce(v_ad, 'Rakibin') || ' hamlesini yaptı — sıra sende! ⏳',
    '/bildim/mac/' || new.id::text
  );
  return new;
end;
$$;

drop trigger if exists trg_matches_sira_bildir on public.matches;
create trigger trg_matches_sira_bildir
  after update of oyuncu1_soru, oyuncu2_soru on public.matches
  for each row execute function public.trg_mac_sira_bildir();
