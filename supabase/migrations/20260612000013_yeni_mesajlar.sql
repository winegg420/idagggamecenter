-- Maç içi hazır mesajlara iki yeni kalıp: AĞLAMA 😂 ve HAHAHAHAHA

create or replace function public.izinli_mesajlar()
returns text[]
language sql
immutable
as $$
  select array[
    '👍','😂','😮','😡','🔥','😎',
    'İyi şanslar!','Bunu biliyordum!','Şanslıydın! 😏',
    'İyi oyun!','Hadi bakalım!','Vay be! 🤯',
    'AĞLAMA 😂','HAHAHAHAHA'
  ];
$$;
