-- ============================================================
-- Kurduğun grup/hızlı maç davetini iptal etme
--
-- "Kurduğun Gruplar (yanıt bekleniyor)" listesinde davet geri alınamıyordu;
-- yanıt vermeyen bir davet sonsuza kadar listede kalıyordu.
-- Yalnız KURUCU ve yalnız maç henüz başlamadıysa iptal edebilir.
-- ============================================================

create or replace function public.grup_mac_iptal(p_group_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  g public.group_matches%rowtype;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  select * into g from public.group_matches where id = p_group_match_id for update;
  if not found then raise exception 'Grup maçı bulunamadı'; end if;
  if g.kurucu <> v_me then raise exception 'Yalnızca kuran kişi iptal edebilir'; end if;
  if g.durum <> 'bekliyor' then raise exception 'Başlamış maç iptal edilemez'; end if;

  update public.group_matches set durum = 'iptal' where id = p_group_match_id;
end;
$$;

revoke execute on function public.grup_mac_iptal(uuid) from public, anon;
grant execute on function public.grup_mac_iptal(uuid) to authenticated;

create or replace function public.hizli_mac_iptal(p_hizli_mac_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  h public.hizli_maclar%rowtype;
begin
  if v_me is null then raise exception 'Giriş gerekli'; end if;

  select * into h from public.hizli_maclar where id = p_hizli_mac_id for update;
  if not found then raise exception 'Hızlı maç bulunamadı'; end if;
  if h.kurucu <> v_me then raise exception 'Yalnızca kuran kişi iptal edebilir'; end if;
  if h.durum <> 'bekliyor' then raise exception 'Başlamış yarış iptal edilemez'; end if;

  update public.hizli_maclar set durum = 'iptal' where id = p_hizli_mac_id;
end;
$$;

revoke execute on function public.hizli_mac_iptal(uuid) from public, anon;
grant execute on function public.hizli_mac_iptal(uuid) to authenticated;
