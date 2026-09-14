-- ============================================================
-- TURNUVAYA AÇIK BOT KATILMAZ
--
-- Sahibinin bildirimi (14 Eyl 2026): turnuvaya ÜstatBot gibi açık botlar
-- katılmış; artık katılmasınlar.
--
-- ÖLÇÜLEN: bütün turnuva bot katılımı (bot_turnuva_katilim_tik,
-- turnuva_lobi_botlari) `turnuva_bot_havuzu`'ndan geçiyor. Havuz migration
-- 173'ten beri AÇIK botlara öncelik veriyordu (oncelik 0). Gece lobisinde
-- 2 açık + 14 gizli bot vardı.
--
-- YENİ: havuz yalnız GİZLİ botlardan kurulur (gerçek oyuncu gibi dururlar).
-- Hedef sayı (`turnuva_hedef_bot`) değişmedi. Henüz BAŞLAMAMIŞ lobilerdeki
-- açık botlar çıkarılır; aktif/bitmiş turnuvalara dokunulmaz.
-- ============================================================

create or replace function public.turnuva_bot_havuzu(p_tournament_id uuid)
returns table(bot_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select s.id
    from (
      select p.id,
             public.bot_rasgele(p_tournament_id::text || p.id::text) as sira
        from public.profiles p
       where p.is_bot and coalesce(p.bot_aktif, true)
         and p.bot_turu = 'gizli'          -- ESKİDEN: açık botlar öncelikliydi
       order by sira
       limit (select public.turnuva_hedef_bot(p_tournament_id))
    ) s;
$fn$;

delete from public.tournament_players tp
 using public.tournaments t, public.profiles p
 where t.id = tp.tournament_id and t.durum = 'lobi'
   and p.id = tp.user_id and public.acik_bot_mu(p.is_bot, p.bot_turu);

-- Çıkan yerleri gizli botlar doldursun (anı gelmiş olanlar hemen girer).
select public.bot_turnuva_katilim_tik();
