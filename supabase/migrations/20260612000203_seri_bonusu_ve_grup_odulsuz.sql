-- ============================================================
-- 203 — Günlük seri bonusu gerçekten ödensin + grup maçı seri/coin vermesin
--       (Paket 14, aşama 3 — canlıda ölçülen iki hata)
--
-- ÖLÇÜLEN 1: Maç bitince `trg_mac_bitti` → mac_sayaci_arttir → seri_guncelle
-- çalışıyor ve profiles.son_seri_tarihi'ni BUGÜNE çekiyor. mac_sonuclandir'daki
-- lig seri bonusu da aynı sütuna bakıp "bugün zaten verildi" sanıyordu →
-- 1v1'de lig seri bonusu hiç ödenmiyordu (tetikleyici update'te bonustan önce
-- çalışır). Çözüm: bonus kendi damgasını tutar (seri_bonus_tarihi) ve seri
-- günü olarak seri_guncelle'nin güncel seri_gun değerini kullanır.
--
-- ÖLÇÜLEN 2: Grup maçı bitince `trg_grup_bitti` de seri_guncelle çağırıyordu:
-- günlük seri günü ilerliyor ve seri coin'i (coin_seri_*) yazılıyordu.
-- "Ödülsüz arkadaş modu" bu kapıyı da kapatmalı: grup maçı yalnız
-- toplam_mac sayar, seriyi ilerletmez, coin vermez.
-- ============================================================

alter table public.profiles add column if not exists seri_bonus_tarihi date;

create or replace function public.gunluk_seri_bonusu(p_user uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  p public.profiles%rowtype;
  v_gun int;
  v_bonus int;
begin
  select * into p from public.profiles where id = p_user for update;
  if not found or coalesce(p.is_bot, false) then return 0; end if;
  if p.seri_bonus_tarihi is not distinct from v_bugun then return 0; end if;

  -- Seri günü seri_guncelle'den (maç bitiş tetikleyicisi) gelir; tetikleyici
  -- bir sebeple çalışmadıysa burada ilerletilir.
  if p.seri_son_gun is distinct from v_bugun then
    perform public.seri_guncelle(p_user);
    select * into p from public.profiles where id = p_user;
  end if;
  v_gun := greatest(1, coalesce(p.seri_gun, 1));

  v_bonus := least(v_gun * public.ayar_sayi('seri_carpan', 3),
                   public.ayar_sayi('seri_tavan', 15))::int;
  update public.profiles
     set seri_bonus_tarihi = v_bugun,
         puan = puan + v_bonus, puan_hafta = puan_hafta + v_bonus
   where id = p_user;
  return v_bonus;
end;
$$;
revoke execute on function public.gunluk_seri_bonusu(uuid) from public, anon, authenticated;

-- Maç sayacı: seri ilerletmeden de çağrılabilsin
create or replace function public.mac_sayaci_arttir(p_user uuid, p_seri boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yeni int;
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.profiles where id = p_user and coalesce(is_bot, false)) then
    return;
  end if;

  update public.profiles
     set toplam_mac = toplam_mac + 1
   where id = p_user
  returning toplam_mac into v_yeni;

  if v_yeni = 1 then
    perform public.bildirim_yaz(
      p_user, 'lige_girdin',
      'İlk maçını tamamladın — artık şehir, ülke ve dünya liglerindesin! 🏙️',
      '/bildim/siralama'
    );
  end if;

  -- Günlük seri (Europe/Istanbul) — ödüllü modlarda
  if coalesce(p_seri, true) then
    perform public.seri_guncelle(p_user);
  end if;
end;
$$;
revoke execute on function public.mac_sayaci_arttir(uuid, boolean) from public, anon, authenticated;

create or replace function public.mac_sayaci_arttir(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select public.mac_sayaci_arttir(p_user, true);
$$;

create or replace function public.trg_grup_bitti()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if new.durum = 'bitti' and coalesce(old.durum, '') <> 'bitti' then
    for r in
      select gmp.user_id from public.group_match_players gmp
      where gmp.group_match_id = new.id and gmp.davet_durumu = 'kabul'
    loop
      -- Grup maçı ödülsüz arkadaş modu: maç sayılır, seri/coin yok.
      perform public.mac_sayaci_arttir(r.user_id, false);
    end loop;
  end if;
  return new;
end;
$$;
