-- Her maçta 50:50 jokeri artık ücretsiz (maç başına 1 hak, match_jokers PK zaten sınırlıyor)

create or replace function public.use_joker(p_match_id uuid, p_tip text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  q public.questions%rowtype;
  v_bedel int;
  v_kapali int[];
begin
  if p_tip not in ('elli', 'sure') then raise exception 'Geçersiz joker'; end if;
  v_bedel := case p_tip when 'elli' then 0 else 20 end;

  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Maç bulunamadı'; end if;
  if auth.uid() not in (m.oyuncu1, m.oyuncu2) then raise exception 'Bu maçta değilsin'; end if;
  if m.durum <> 'aktif' then raise exception 'Maç aktif değil'; end if;
  if now() > m.soru_baslangic + interval '16 seconds' then raise exception 'Süre doldu'; end if;
  if exists (
    select 1 from public.match_answers
    where match_id = p_match_id and user_id = auth.uid() and soru_index = m.aktif_soru
  ) then
    raise exception 'Bu soruyu zaten cevapladın';
  end if;

  if v_bedel > 0 and (select puan from public.profiles where id = auth.uid()) < v_bedel then
    raise exception 'Yetersiz puan (% gerekli)', v_bedel;
  end if;

  insert into public.match_jokers (match_id, user_id, tip, soru_index)
  values (p_match_id, auth.uid(), p_tip, m.aktif_soru);
  -- pk çakışırsa exception fırlar: maç başına her jokerden 1

  if v_bedel > 0 then
    update public.profiles set puan = puan - v_bedel where id = auth.uid();
  end if;

  if p_tip = 'elli' then
    select * into q from public.questions where id = m.soru_ids[m.aktif_soru + 1];
    select array_agg(x) into v_kapali from (
      select x from generate_series(0, 3) x
      where x <> q.dogru_cevap order by random() limit 2
    ) s;
    return jsonb_build_object('kapali', to_jsonb(v_kapali));
  else
    update public.matches
       set soru_baslangic = soru_baslangic + interval '10 seconds'
     where id = p_match_id;
    return jsonb_build_object('uzatildi', true);
  end if;
end;
$$;
