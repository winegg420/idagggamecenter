-- Kalan ilkokul seviyesi sorular (renk karışımı, gün/saat, gökkuşağı rengi) ve
-- birebir tekrar eden bir tarih sorusu pasife alınır. Silinmez: geçmiş maç
-- kayıtları questions satırına bağlıdır.
update public.questions
   set aktif = false
 where id in (
     '6fd60db1-e8c6-48c6-8306-94fe16b2cf02', -- Bir gün kaç saattir?
     'aa0fada0-48d5-477b-86a6-4f7d7ab30bc6', -- Dünyanın kendi ekseni etrafındaki dönüşü kaç saat sürer?
     'c69eb4f1-0453-4786-a4cd-6c17104f60c2', -- Gökkuşağında geleneksel olarak kaç renk sayılır?
     '9d6393c7-2400-4f8e-a99c-21155a65386c', -- Gökkuşağında kaç renk olduğu kabul edilir?
     'bd3fcb8f-94b6-4168-a4b9-0b5e895d14af', -- İstanbul'un ilk adı neydi?
     '7de084af-4d09-4bbd-b2cf-d7b476507a86', -- Kırmızı ile mavi karıştırılırsa hangi renk oluşur?
     'c0b5e25d-92d0-42a4-be6b-477ca135e34f', -- Kırmızı ile mavinin karışımından hangi renk oluşur?
     '4299e56e-4f8e-42ea-8b5f-990de4855eec', -- Kırmızı ile sarı karıştırılırsa hangi renk elde edilir?
     'a339443b-ec75-4dbd-a95a-748541d82f67', -- Kırmızı ile sarının karışımından hangi renk oluşur?
     'b57d5af0-be86-4684-917d-d41eb25d8dce' -- Mavi ile sarının karışımından hangi renk oluşur?
   );
