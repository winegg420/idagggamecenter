-- ============================================================
-- 208 — Çeviri dışı bırakılan sorular (Paket 15, A)
--
-- Bazı sorular dile bağlıdır (Türkçe dilbilgisi, yazım, deyim, ek) ve
-- İngilizceye çevrilince anlamını yitirir. Bunlar çevrilmez; nedeniyle
-- burada tutulur ki çeviri taraması tekrar önüne getirmesin. İngilizce
-- oyuncunun havuzuna zaten girmez (soru_sec çeviri ister).
-- ============================================================

create table if not exists public.ceviri_atlanan (
  question_id uuid primary key references public.questions(id) on delete cascade,
  dil text not null default 'en',
  neden text not null,
  created_at timestamptz not null default now()
);
alter table public.ceviri_atlanan enable row level security;
revoke all on public.ceviri_atlanan from anon, authenticated;
