-- ============================================================
-- GÜVENLİK: CRON_SECRET ARTIK KOD İÇİNDE GÖMÜLÜ DEĞİL
--
-- BULGU (yayın öncesi denetim, 9 Eylül 2026):
-- `CRON_SECRET` değeri yedi migration dosyasının içine düz metin olarak
-- yazılmıştı ve depo GitHub'da **herkese açık**. Yani sır,
-- raw.githubusercontent.com üzerinden kimlik doğrulaması olmadan okunabiliyordu.
-- Doğrulandı: repodaki sırla `send-push` uç noktası 200 döndü
-- (yanlış sırla 401). Bu haliyle isteyen herkes:
--   * tüm kullanıcılara istediği push bildirimini gönderebilir,
--   * `generate-questions` fonksiyonunu tetikleyip Anthropic kredisi yakabilirdi.
--
-- ÇÖZÜM: sır artık RLS'li, hiçbir role açık olmayan bir tabloda duruyor;
-- veritabanı fonksiyonları oradan okuyor. Yeni sır repoya hiç girmiyor.
--
-- NOT: eski sır git geçmişinde kalacağı için MUTLAKA döndürülmeli.
-- İki adım (bkz. PROGRESS.md):
--   1) Supabase → Edge Functions → Secrets → CRON_SECRET yeni değere ayarlanır.
--   2) Aşağıdaki tabloya aynı değer yazılır (tek satır update).
-- ============================================================

create table if not exists public.sunucu_gizli (
  anahtar text primary key,
  deger text not null,
  guncellendi_at timestamptz not null default now()
);

comment on table public.sunucu_gizli is
  'Sunucu tarafı sırlar. RLS açık, politika YOK, tüm roller revoke: yalnız '
  'security definer fonksiyonlar okuyabilir. Değerler repoya girmez.';

alter table public.sunucu_gizli enable row level security;
revoke all on public.sunucu_gizli from public, anon, authenticated;

-- Sırrı okuyan tek kapı
create or replace function public.gizli_al(p_anahtar text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select deger from public.sunucu_gizli where anahtar = p_anahtar;
$$;

revoke execute on function public.gizli_al(text) from public, anon, authenticated;

-- Mevcut değerle tohumlanıyor ki bildirimler kesintiye uğramasın.
-- (Döndürme adımında bu satır güncellenecek.)
insert into public.sunucu_gizli (anahtar, deger)
values ('cron_secret', '6i81Q786ABf6QpRC9ZOnC0ZSD63iccQ')
on conflict (anahtar) do nothing;
