-- ============================================================================
-- RPC HIZ SINIRI — altyapı (sayaç tablosu + yardımcı fonksiyon)
--
-- AMAÇ: bir oyuncunun cevap/joker uçlarını döngüye sokmasını engellemek.
-- Sınırlar bu dosyada DEĞİL, çağıran RPC'lerde verilir (bkz. migration 116).
--
-- TASARIM KARARLARI
--
-- 1) auth.uid() NULL ise sınır UYGULANMAZ ve sessizce çıkılır.
--    Bu bilinçli: bot maçları (bot_oyna), zamanlayıcıyla ilerleyen akışlar
--    (advance_*) ve cron işleri oturumsuz çalışır. Sınır YALNIZ kullanıcı
--    tetikli çağrılara uygulanmalı — aksi halde botlar sınıra takılıp maçlar
--    yarım kalırdı.
--
-- 2) Limit aşılınca exception atılır ve çağıran işlem GERİ ALINIR. Bu, sayacın
--    da geri alınması demektir; yani sayaç limitin bir üstünde takılı kalır ve
--    pencere dolana kadar HER çağrı reddedilir. İstenen davranış budur.
--
-- 3) Kayan pencere değil, SABİT pencere: ilk çağrı pencereyi başlatır, pencere
--    dolunca sayaç sıfırlanır. Basit ve ucuz; kilit yalnız (user_id, uc_adi)
--    satırında olduğu için oyuncular birbirini beklemez.
--
-- 4) Hata mesajı Türkçe ve kullanıcıya gösterilebilir; istemcideki hataMesaji()
--    zaten sunucu metnini olduğu gibi gösteriyor.
-- ============================================================================

create table if not exists public.rpc_sayac (
  user_id uuid not null references auth.users(id) on delete cascade,
  uc_adi text not null,
  pencere_baslangic timestamptz not null default now(),
  sayi int not null default 0,
  primary key (user_id, uc_adi)
);

alter table public.rpc_sayac enable row level security;
-- Politika YOK: tabloya yalnız security definer fonksiyon üzerinden erişilir.
-- (Depodaki questions / sunucu_gizli tablolarıyla aynı desen.)

comment on table public.rpc_sayac is
  'RPC hız sınırı sayaçları. Yalnız public.hiz_siniri() yazar/okur.';

create or replace function public.hiz_siniri(
  p_uc text,
  p_limit int,
  p_pencere interval
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_sayi int;
begin
  -- Oturumsuz çağrılar (bot, cron, advance_*) sınıra TAKILMAZ.
  if v_me is null then
    return;
  end if;

  insert into public.rpc_sayac as s (user_id, uc_adi, pencere_baslangic, sayi)
  values (v_me, p_uc, now(), 1)
  on conflict (user_id, uc_adi) do update
    set sayi = case
                 when s.pencere_baslangic < now() - p_pencere then 1
                 else s.sayi + 1
               end,
        pencere_baslangic = case
                              when s.pencere_baslangic < now() - p_pencere then now()
                              else s.pencere_baslangic
                            end
  returning s.sayi into v_sayi;

  if v_sayi > p_limit then
    raise exception 'Çok hızlı işlem yapıyorsun, biraz bekle.';
  end if;
end;
$function$;

revoke execute on function public.hiz_siniri(text, int, interval) from public, anon;
-- authenticated'a da verilmiyor: yalnız diğer security definer fonksiyonlar
-- (aynı sahiple çalıştığı için) çağırabilir. İstemci doğrudan çağıramaz.
