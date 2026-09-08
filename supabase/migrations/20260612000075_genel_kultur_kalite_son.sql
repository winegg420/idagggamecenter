-- Genel kültür kalite revizyonu — son tarama (074'ün devamı).
-- 074'ten sonra kategoride kalan gündelik ev eşyası / basit gözlem soruları
-- pasife alınır. Gerçek genel kültür sayılabilecek olanlar (IBAN, ABS, GPS,
-- kara kutu, sigorta, prototip, gündem, IP, işletim sistemi, toplanma alanı)
-- KORUNUR; bunlar kavram bilgisidir, ezber değil.
update public.questions
   set aktif = false
 where kategori = 'genel_kultur'
   and id in (
     '38589ea7-1221-4ded-a412-ca6909bff616', -- Ayakkabı bakımında kalıp
     'fa00f01f-3056-4a1a-ab08-32f164f321a3', -- Bulaşık makinesinde parlatıcı
     '88a440bb-21ac-4a6c-adab-4d431677dafa', -- Buzdolabının arkasındaki ızgara
     '9aa762b9-149f-4717-a391-2b9cfb202907', -- Diş ipi
     'd3d7b70d-0bf9-47c2-8fda-5f8c60abe8b7'  -- Yaya geçidi deseni
   );
