-- ============================================================================
-- MARKA: QuizzExam → Quizador
--
-- Push bildirimlerinin varsayılan başlığı 'QuizzExam' idi; 'Quizador' oldu.
-- Tip'e özel başlıklar (⚔️ Meydan okuma! vb.) marka adı içermediği için
-- olduğu gibi korundu.
--
-- Gövde 20260612000107 ile birebir aynı; tek fark varsayılan başlık.
-- (107 de kendi içinde açıkladığı gibi 073'ten değil, CANLI tanımdan
-- alınmıştı: 073'te CRON_SECRET sabit gömülüydü, canlıda ise
-- public.gizli_al('cron_secret') kullanılıyor. O düzeltme burada da korunuyor.)
--
-- Mevcut migration'lar değiştirilmedi.
-- ============================================================================

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
    else 'Quizador'
  end;

  begin
    perform net.http_post(
      url := 'https://zfpnxzybcpkxsotwdsey.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'x-cron-secret', public.gizli_al('cron_secret'),
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

revoke execute on function public.bildirim_yaz(uuid, text, text, text)
  from public, anon, authenticated;
