-- ============================================================
-- 196 — İkram kabul anı (Revizyon Paketi 12, madde 5)
--
-- Kabul edilen kahve/balon ikramında iki avatar birbirine yürüyüp yüz
-- yüze durur; oyuncu girdisi ~3,5 sn kilitlenir. Gösterinin iki
-- istemcide AYNI anda başlaması için ortak saat = sunucunun kabul anı
-- (`meydan_ikramlari.yanit_at`). Gizli bot kabulünde yanit_at ileri
-- tarihlidir (gerçekçi gecikme) — o an gelene kadar 'bekliyor' döner.
--
-- Eski ikram_durumu (yalnız metin) dokunulmadan kalır; bu fonksiyon hem
-- gönderene hem alana kabul anını ve sunucu saatini verir.
-- ============================================================

create or replace function public.ikram_kabul_bilgisi(p_id uuid)
returns table(durum text, yanit_at timestamptz, sunucu_zamani timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := auth.uid();
  r public.meydan_ikramlari%rowtype;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;
  select * into r from public.meydan_ikramlari where id = p_id;
  if not found or v_me not in (r.gonderen, r.alan) then raise exception 'Teklif bulunamadı'; end if;
  if r.durum = 'bekliyor' or (r.yanit_at is not null and r.yanit_at > now()) then
    return query select 'bekliyor'::text, null::timestamptz, now();
    return;
  end if;
  return query select r.durum, r.yanit_at, now();
end;
$$;

revoke all on function public.ikram_kabul_bilgisi(uuid) from public, anon;
grant execute on function public.ikram_kabul_bilgisi(uuid) to authenticated;
