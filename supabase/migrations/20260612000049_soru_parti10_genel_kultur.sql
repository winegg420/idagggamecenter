-- ============================================================
-- Soru Partisi 10 — GENEL KÜLTÜR (500 soru)
-- Zorluk: %40 kolay (200) / %40 orta (200) / %20 zor (100)
-- Kategori: genel_kultur  ('genel' kategorisine dokunulmadı)
--
-- Kalite: tek ve tartışmasız doğru cevap; zamanla değişen bilgi yok;
-- yoruma açık ifade yok; mevcut havuzla tekrar yok (anahtar kelime taraması
-- yapıldı); şıklar kısa. Doğru şık dağılımı dengeli, migration sonunda
-- YALNIZ bu partinin şıkları karıştırılır.
-- ============================================================

insert into public.questions (soru, secenekler, dogru_cevap, kategori) values

-- ===================== KOLAY (200) =====================

-- Türkiye coğrafyası
('Kapadokya hangi bölgemizdedir?', '["İç Anadolu","Ege","Akdeniz","Karadeniz"]'::jsonb, 0, 'genel_kultur'),
('Kayak merkeziyle bilinen Uludağ hangi bölgemizdedir?', '["Ege","Marmara","Akdeniz","Karadeniz"]'::jsonb, 1, 'genel_kultur'),
('Karadeniz''e kıyısı olan ilimiz hangisidir?', '["Konya","Muğla","Rize","Mardin"]'::jsonb, 2, 'genel_kultur'),
('Türkiye''nin en batıdaki ili hangisidir?', '["Çanakkale","Tekirdağ","İzmir","Edirne"]'::jsonb, 3, 'genel_kultur'),
('Fethiye ilçesi hangi ilimize bağlıdır?', '["Muğla","Antalya","Aydın","Denizli"]'::jsonb, 0, 'genel_kultur'),
('Türkiye''nin en kuzeydeki ili hangisidir?', '["Samsun","Sinop","Kastamonu","Zonguldak"]'::jsonb, 1, 'genel_kultur'),
('Sultanahmet Camii hangi adla da bilinir?', '["Beyaz Cami","Yeşil Cami","Mavi Cami","Altın Cami"]'::jsonb, 2, 'genel_kultur'),
('Türkiye''yi ikiye ayıran boğazlardan biri hangisidir?', '["Süveyş","Cebelitarık","Panama","Çanakkale Boğazı"]'::jsonb, 3, 'genel_kultur'),
('Manyas Gölü hangi ilimizdedir?', '["Balıkesir","Bursa","Çanakkale","Manisa"]'::jsonb, 0, 'genel_kultur'),

-- Dünya coğrafyası
('Amazon Nehri hangi kıtadadır?', '["Asya","Güney Amerika","Afrika","Avustralya"]'::jsonb, 1, 'genel_kultur'),
('Hangi ülke hem Avrupa hem Asya kıtasındadır?', '["İtalya","Yunanistan","Türkiye","Mısır"]'::jsonb, 2, 'genel_kultur'),
('Dünyanın en kalabalık kıtası hangisidir?', '["Amerika","Afrika","Avrupa","Asya"]'::jsonb, 3, 'genel_kultur'),
('Kutup ayıları hangi kutupta yaşar?', '["Kuzey Kutbu","Güney Kutbu","İkisinde de","Hiçbirinde"]'::jsonb, 0, 'genel_kultur'),
('Penguenler doğal olarak hangi kutupta yaşar?', '["Kuzey Kutbu","Güney Kutbu","İkisinde de","Hiçbirinde"]'::jsonb, 1, 'genel_kultur'),
('Dünyada kaç kıta vardır?', '["6","5","7","8"]'::jsonb, 2, 'genel_kultur'),
('Everest Dağı hangi sıradağlardadır?', '["Kayalık Dağlar","Alpler","Andlar","Himalayalar"]'::jsonb, 3, 'genel_kultur'),
('Venedik hangi ülkededir?', '["İtalya","Fransa","İspanya","Yunanistan"]'::jsonb, 0, 'genel_kultur'),
('Amsterdam hangi ülkenin şehridir?', '["Belçika","Hollanda","Danimarka","Almanya"]'::jsonb, 1, 'genel_kultur'),
('Hangi ülke ada ülkesidir?', '["Avusturya","Almanya","Japonya","Macaristan"]'::jsonb, 2, 'genel_kultur'),
('Akdeniz''e kıyısı olmayan ülke hangisidir?', '["İtalya","İspanya","Fransa","Portekiz"]'::jsonb, 3, 'genel_kultur'),

-- Vücut ve sağlık
('Solunumu sağlayan organ hangisidir?', '["Akciğer","Mide","Böbrek","Dalak"]'::jsonb, 0, 'genel_kultur'),
('Görme duyusu hangi organla sağlanır?', '["Kulak","Göz","Burun","Dil"]'::jsonb, 1, 'genel_kultur'),
('C vitamini en çok hangi besinde bulunur?', '["Ekmek","Pirinç","Portakal","Tereyağı"]'::jsonb, 2, 'genel_kultur'),
('Kemiklerin güçlenmesi için gereken mineral hangisidir?', '["Çinko","Demir","Sodyum","Kalsiyum"]'::jsonb, 3, 'genel_kultur'),
('Kanın kırmızı rengini veren madde hangisidir?', '["Hemoglobin","İnsülin","Kolajen","Keratin"]'::jsonb, 0, 'genel_kultur'),
('İnsan vücudunun normal sıcaklığı yaklaşık kaç derecedir?', '["35","37","39","41"]'::jsonb, 1, 'genel_kultur'),
('Besinlerin sindirimi hangi organda başlar?', '["Mide","İnce bağırsak","Ağız","Kalın bağırsak"]'::jsonb, 2, 'genel_kultur'),
('Vücutta oksijeni taşıyan hücreler hangileridir?', '["Sinir hücreleri","Akyuvarlar","Kas hücreleri","Alyuvarlar"]'::jsonb, 3, 'genel_kultur'),
('Diş çürümesini en çok artıran şey nedir?', '["Şeker","Su","Süt","Sebze"]'::jsonb, 0, 'genel_kultur'),
('İnsan iskeletindeki en uzun kemik hangisidir?', '["Kaburga","Uyluk kemiği","Köprücük kemiği","Kol kemiği"]'::jsonb, 1, 'genel_kultur'),
('Tat alma duyusu hangi organla sağlanır?', '["Burun","Kulak","Dil","Deri"]'::jsonb, 2, 'genel_kultur'),
('Vücudu mikroplara karşı koruyan hücreler hangileridir?', '["Kan pulcukları","Alyuvarlar","Yağ hücreleri","Akyuvarlar"]'::jsonb, 3, 'genel_kultur'),

-- Doğa ve hayvanlar
('Kelebekler hangi evreden sonra kelebek olur?', '["Krizalit","Yumurta","Larva","Yavru"]'::jsonb, 0, 'genel_kultur'),
('Balıklar solunumu hangi organla yapar?', '["Akciğer","Solungaç","Deri","Trake"]'::jsonb, 1, 'genel_kultur'),
('Hangi hayvan grubu yumurtayla çoğalır?', '["Balinalar","Memeliler","Kuşlar","Yarasalar"]'::jsonb, 2, 'genel_kultur'),
('Yarasalar yön bulmak için ne kullanır?', '["Manyetik taş","Koku","Işık","Ses dalgaları"]'::jsonb, 3, 'genel_kultur'),
('Bukalemunun bilinen özelliği nedir?', '["Renk değiştirmesi","Uçması","Zıplaması","Yüzmesi"]'::jsonb, 0, 'genel_kultur'),
('Arıların yaşadığı yapıya ne denir?', '["İn","Kovan","Yuva","Kümes"]'::jsonb, 1, 'genel_kultur'),
('Hangi hayvan sadece bitkiyle beslenir?', '["Kurt","Aslan","İnek","Kaplan"]'::jsonb, 2, 'genel_kultur'),
('Kurbağalar hangi hayvan grubundandır?', '["Kuşlar","Sürüngenler","Memeliler","İki yaşamlılar"]'::jsonb, 3, 'genel_kultur'),
('Devekuşu neyiyle bilinir?', '["Uçamamasıyla","Yüzmesiyle","Tırmanmasıyla","Kazmasıyla"]'::jsonb, 0, 'genel_kultur'),
('Yılanlar hangi hayvan grubundandır?', '["Kuşlar","Sürüngenler","Memeliler","Balıklar"]'::jsonb, 1, 'genel_kultur'),
('Zürafanın en belirgin özelliği nedir?', '["Kabuğu","Hortumu","Uzun boynu","Yelesi"]'::jsonb, 2, 'genel_kultur'),
('Hangi hayvan gece avlanan bir kuştur?', '["Papağan","Serçe","Güvercin","Baykuş"]'::jsonb, 3, 'genel_kultur'),
('Yunuslar hangi hayvan grubundandır?', '["Memeliler","Balıklar","Sürüngenler","İki yaşamlılar"]'::jsonb, 0, 'genel_kultur'),

-- Uzay ve takvim
('Dünya''nın tek doğal uydusu nedir?', '["Titan","Ay","Venüs","Mars"]'::jsonb, 1, 'genel_kultur'),
('Halkalarıyla bilinen gezegen hangisidir?', '["Mars","Venüs","Satürn","Merkür"]'::jsonb, 2, 'genel_kultur'),
('Mars''ın yüzeyinin kızıl görünmesinin sebebi nedir?', '["Buz","Bakır","Kükürt","Demir oksit"]'::jsonb, 3, 'genel_kultur'),
('Dünya Güneş etrafındaki turunu yaklaşık ne kadarda tamamlar?', '["1 yıl","1 ay","1 hafta","1 gün"]'::jsonb, 0, 'genel_kultur'),
('Gece ve gündüzün oluşmasının sebebi nedir?', '["Ayın hareketi","Dünyanın kendi ekseninde dönmesi","Güneşin sönmesi","Bulutlar"]'::jsonb, 1, 'genel_kultur'),
('Ay tutulması nasıl oluşur?', '["Ay söndüğünde","Güneş battığında","Dünya, Güneş ile Ay arasına girince","Bulutlar kapatınca"]'::jsonb, 2, 'genel_kultur'),
('Bir yılda kaç hafta vardır (yaklaşık)?', '["60","48","44","52"]'::jsonb, 3, 'genel_kultur'),
('Bir asırda kaç on yıl vardır?', '["10","5","20","100"]'::jsonb, 0, 'genel_kultur'),
('Hangi ay 30 gün çeker?', '["Ocak","Nisan","Mart","Mayıs"]'::jsonb, 1, 'genel_kultur'),
('Yılın ilk ayı hangisidir?', '["Aralık","Şubat","Ocak","Mart"]'::jsonb, 2, 'genel_kultur'),
('Sonbahardan sonra hangi mevsim gelir?', '["Yaz","İlkbahar","Sonbahar","Kış"]'::jsonb, 3, 'genel_kultur'),
('Hangi gezegende yaşam olduğu bilinmektedir?', '["Dünya","Mars","Venüs","Jüpiter"]'::jsonb, 0, 'genel_kultur'),

-- Günlük hayat ve ölçüler
('Bir tonda kaç kilogram vardır?', '["100","1000","500","10000"]'::jsonb, 1, 'genel_kultur'),
('Bir yüzyıl kaç yıldır?', '["10","50","100","1000"]'::jsonb, 2, 'genel_kultur'),
('Bir metrekare kaç desimetrekaredir?', '["50","10","1000","100"]'::jsonb, 3, 'genel_kultur'),
('Sıcaklığı ölçen alete ne denir?', '["Termometre","Barometre","Higrometre","Manometre"]'::jsonb, 0, 'genel_kultur'),
('Ağırlık ölçmek için kullanılan alet hangisidir?', '["Cetvel","Terazi","Pergel","Gönye"]'::jsonb, 1, 'genel_kultur'),
('Suyun kaynama sıcaklığı normal şartlarda kaç derecedir?', '["80","50","100","120"]'::jsonb, 2, 'genel_kultur'),
('Bir çeyrek saat kaç dakikadır?', '["10","20","30","15"]'::jsonb, 3, 'genel_kultur'),
('Bir buçuk saat kaç dakikadır?', '["90","60","120","75"]'::jsonb, 0, 'genel_kultur'),
('Bir gün kaç dakikadır?', '["720","1440","1200","2400"]'::jsonb, 1, 'genel_kultur'),
('Mesafe ölçmede kullanılan birim hangisidir?', '["Saniye","Litre","Metre","Gram"]'::jsonb, 2, 'genel_kultur'),
('Sıvı ölçüsü hangisidir?', '["Saniye","Metre","Kilogram","Litre"]'::jsonb, 3, 'genel_kultur'),
('Bir düzine yumurta kaç tanedir?', '["12","10","6","24"]'::jsonb, 0, 'genel_kultur'),
('Yüzde 50 kaçta kaça eşittir?', '["Tam","Yarım","Üçte bir","Çeyrek"]'::jsonb, 1, 'genel_kultur'),

-- Trafik, güvenlik, vatandaşlık
('Trafikte yeşil ışık ne anlama gelir?', '["Bekle","Dur","Geç","Yavaşla"]'::jsonb, 2, 'genel_kultur'),
('Yayaların karşıdan karşıya geçtiği yere ne denir?', '["Refüj","Kavşak","Banket","Yaya geçidi"]'::jsonb, 3, 'genel_kultur'),
('Arabada güvenlik için takılan şey nedir?', '["Emniyet kemeri","Ayna","Klima","Radyo"]'::jsonb, 0, 'genel_kultur'),
('Motosiklet sürerken takılması zorunlu olan nedir?', '["Şapka","Kask","Eldiven","Gözlük"]'::jsonb, 1, 'genel_kultur'),
('Yangın söndürmede en yaygın kullanılan madde nedir?', '["Benzin","Yağ","Su","Alkol"]'::jsonb, 2, 'genel_kultur'),
('Deprem anında yapılması gereken davranış hangisidir?', '["Koşmak","Balkona çıkmak","Asansöre binmek","Çök-kapan-tutun"]'::jsonb, 3, 'genel_kultur'),
('Türkiye''de oy kullanma yaşı kaçtır?', '["18","16","20","21"]'::jsonb, 0, 'genel_kultur'),
('Türkiye''de zorunlu eğitim kaç yıldır?', '["6","12","10","8"]'::jsonb, 1, 'genel_kultur'),
('Kimlik kartını veren kurum hangisidir?', '["Valilik","Belediye","Nüfus müdürlüğü","Kaymakamlık"]'::jsonb, 2, 'genel_kultur'),
('Bir ülkenin en temel yasasına ne denir?', '["Yönetmelik","Tüzük","Genelge","Anayasa"]'::jsonb, 3, 'genel_kultur'),
('Belediye başkanını kim seçer?', '["Halk","Vali","Bakan","Meclis"]'::jsonb, 0, 'genel_kultur'),
('Trafikte kırmızı ışıkta ne yapılır?', '["Korna çalınır","Durulur","Hızlanılır","Geçilir"]'::jsonb, 1, 'genel_kultur'),
('İtfaiye hangi durumda aranır?', '["Hastalık","Hırsızlık","Yangın","Kaza tespiti"]'::jsonb, 2, 'genel_kultur'),
('Türkiye''de trafik hangi yönde akar?', '["Soldan","Değişken","Ortadan","Sağdan"]'::jsonb, 3, 'genel_kultur'),
('Bir yerleşim yerinin en küçük yönetim birimi hangisidir?', '["Muhtarlık","Valilik","Bakanlık","Belediye"]'::jsonb, 0, 'genel_kultur'),

-- Teknoloji temelleri
('Bilgisayarın beyni sayılan parça hangisidir?', '["Fare","İşlemci","Klavye","Ekran"]'::jsonb, 1, 'genel_kultur'),
('İnternete bağlanmak için gereken cihaz hangisidir?', '["Tarayıcı","Yazıcı","Modem","Hoparlör"]'::jsonb, 2, 'genel_kultur'),
('Klavyede harfleri büyütmek için kullanılan tuş hangisidir?', '["Alt","Ctrl","Tab","Shift"]'::jsonb, 3, 'genel_kultur'),
('Dosyaları silmeden saklamak için ne yapılır?', '["Yedeklenir","Silinir","Kapatılır","Yenilenir"]'::jsonb, 0, 'genel_kultur'),
('Telefonlardaki dokunmatik ekran ne ile kullanılır?', '["Kalem ucu","Parmak","Anahtar","Bozuk para"]'::jsonb, 1, 'genel_kultur'),
('Bilgisayarda geçici belleğin kısaltması nedir?', '["GPU","ROM","RAM","LAN"]'::jsonb, 2, 'genel_kultur'),
('Kablosuz internet bağlantısının yaygın adı nedir?', '["VGA","USB","HDMI","Wi-Fi"]'::jsonb, 3, 'genel_kultur'),
('Şifrelerin güçlü olması için ne önerilir?', '["Uzun ve karışık olması","Doğum tarihi olması","1234 olması","Adınız olması"]'::jsonb, 0, 'genel_kultur'),
('Bir megabayt kaç kilobayttır (yaklaşık)?', '["100","1024","10","10000"]'::jsonb, 1, 'genel_kultur'),
('Yazıcı ne işe yarar?', '["İnternete bağlar","Ses çıkarır","Belge basar","Görüntü kaydeder"]'::jsonb, 2, 'genel_kultur'),
('Fotoğraf çekmeye yarayan cihaz hangisidir?', '["Klavye","Mikrofon","Hoparlör","Kamera"]'::jsonb, 3, 'genel_kultur'),
('Sanal ortamda zararlı yazılımlara ne denir?', '["Virüs","Sürücü","Simge","Klasör"]'::jsonb, 0, 'genel_kultur'),
('Bir dosyayı taşımak için hangi işlem yapılır?', '["Yazdır","Kes-yapıştır","Kaydet","Kapat"]'::jsonb, 1, 'genel_kultur'),

-- Mutfak ve besinler
('Ekmek yapımında kullanılan temel malzeme nedir?', '["Tuz","Şeker","Un","Yağ"]'::jsonb, 2, 'genel_kultur'),
('Zeytinyağı hangi meyveden elde edilir?', '["Ceviz","Üzüm","İncir","Zeytin"]'::jsonb, 3, 'genel_kultur'),
('Peynir hangi besinden yapılır?', '["Süt","Un","Yumurta","Et"]'::jsonb, 0, 'genel_kultur'),
('Şekerin ana kaynaklarından biri hangisidir?', '["Buğday","Şeker pancarı","Mısır koçanı","Nohut"]'::jsonb, 1, 'genel_kultur'),
('Çayın ana malzemesi nedir?', '["Kakao","Kahve çekirdeği","Çay yaprağı","Nane kökü"]'::jsonb, 2, 'genel_kultur'),
('Hangi besin protein bakımından zengindir?', '["Nişasta","Şeker","Yağ","Et"]'::jsonb, 3, 'genel_kultur'),
('Pilav yapımında kullanılan temel malzeme nedir?', '["Pirinç","Un","Mısır","Arpa"]'::jsonb, 0, 'genel_kultur'),
('Yoğurt neyden yapılır?', '["Un","Süt","Su","Yağ"]'::jsonb, 1, 'genel_kultur'),
('Hangi meyve turunçgildir?', '["Armut","Elma","Limon","Kiraz"]'::jsonb, 2, 'genel_kultur'),
('Patates hangi bitki kısmıdır?', '["Çiçek","Meyve","Yaprak","Yumru kök"]'::jsonb, 3, 'genel_kultur'),
('Hangi baharat yemeklere acılık verir?', '["Kırmızı biber","Tarçın","Vanilya","Kekik"]'::jsonb, 0, 'genel_kultur'),
('Hamurun kabarmasını sağlayan madde nedir?', '["Tuz","Maya","Şeker","Su"]'::jsonb, 1, 'genel_kultur'),
('Bal hangi çiçek ürününden yapılır?', '["Kök","Yaprak","Nektar","Tohum"]'::jsonb, 2, 'genel_kultur'),
('Hangi içecek kafein içerir?', '["Şalgam suyu","Ayran","Limonata","Kahve"]'::jsonb, 3, 'genel_kultur'),
('Tereyağı neyden elde edilir?', '["Sütten","Zeytinden","Mısırdan","Ayçiçeğinden"]'::jsonb, 0, 'genel_kultur'),

-- Spor
('Basketbolda bir takımda sahada kaç oyuncu vardır?', '["7","5","6","4"]'::jsonb, 1, 'genel_kultur'),
('Voleybolda bir takımda sahada kaç oyuncu vardır?', '["8","5","6","7"]'::jsonb, 2, 'genel_kultur'),
('Futbolda oyunu yöneten kişiye ne denir?', '["Menajer","Antrenör","Kaptan","Hakem"]'::jsonb, 3, 'genel_kultur'),
('Yüzme hangi ortamda yapılan spordur?', '["Suda","Karda","Buzda","Havada"]'::jsonb, 0, 'genel_kultur'),
('Türkiye''nin milli sporu hangisidir?', '["Tenis","Güreş","Basketbol","Futbol"]'::jsonb, 1, 'genel_kultur'),
('Tenis hangi aletle oynanır?', '["Eldiven","Sopa","Raket","Top ağı"]'::jsonb, 2, 'genel_kultur'),
('Boks hangi tür spordur?', '["Su sporu","Takım sporu","Kış sporu","Dövüş sporu"]'::jsonb, 3, 'genel_kultur'),
('Kayak hangi mevsimde yapılan bir spordur?', '["Kış","Yaz","İlkbahar","Sonbahar"]'::jsonb, 0, 'genel_kultur'),
('Futbolda kaleye atılan gol nasıl sayılır?', '["Topun direğe çarpmasıyla","Topun çizgiyi tamamen geçmesiyle","Kalecinin düşmesiyle","Hakemin düdüğüyle"]'::jsonb, 1, 'genel_kultur'),
('Bir satranç takımında kaç taş vardır?', '["12","20","16","8"]'::jsonb, 2, 'genel_kultur'),
('Bisiklet yarışlarında kullanılan araç nedir?', '["Kaykay","Motosiklet","Paten","Bisiklet"]'::jsonb, 3, 'genel_kultur'),
('Olimpiyat bayrağında kaç halka vardır?', '["5","4","6","3"]'::jsonb, 0, 'genel_kultur'),

-- Sanat, müzik, edebiyat
('Piyano hangi çalgı grubundandır?', '["Telli üflemeli","Tuşlu","Vurmalı davul","Nefesli"]'::jsonb, 1, 'genel_kultur'),
('Davul hangi çalgı grubundandır?', '["Telli","Nefesli","Vurmalı","Tuşlu"]'::jsonb, 2, 'genel_kultur'),
('Bağlama hangi ülkenin halk çalgısıdır?', '["Brezilya","Japonya","İskoçya","Türkiye"]'::jsonb, 3, 'genel_kultur'),
('Bir müzik eserinin yazarına ne denir?', '["Besteci","Ressam","Heykeltıraş","Mimar"]'::jsonb, 0, 'genel_kultur'),
('Şiir yazan kişiye ne denir?', '["Ressam","Şair","Oyuncu","Mimar"]'::jsonb, 1, 'genel_kultur'),
('Roman yazan kişiye ne denir?', '["Şair","Besteci","Romancı","Ressam"]'::jsonb, 2, 'genel_kultur'),
('Tiyatroda sahnede oynayan kişiye ne denir?', '["Yazar","Yönetmen","Suflör","Oyuncu"]'::jsonb, 3, 'genel_kultur'),
('Bina tasarlayan meslek sahibine ne denir?', '["Mimar","Ressam","Şair","Heykeltıraş"]'::jsonb, 0, 'genel_kultur'),
('Resim yapmak için kullanılan yüzeye ne denir?', '["Perde","Tuval","Sahne","Kürsü"]'::jsonb, 1, 'genel_kultur'),
('Bir filmi yöneten kişiye ne denir?', '["Oyuncu","Yapımcı","Yönetmen","Kurgucu"]'::jsonb, 2, 'genel_kultur'),
('Ana renklerden biri hangisidir?', '["Turuncu","Yeşil","Mor","Mavi"]'::jsonb, 3, 'genel_kultur'),
('Heykel yapan sanatçıya ne denir?', '["Heykeltıraş","Şair","Besteci","Yazar"]'::jsonb, 0, 'genel_kultur'),
('Notaların yazıldığı beş çizgiye ne denir?', '["Anahtar","Porte","Ölçü","Nota"]'::jsonb, 1, 'genel_kultur'),
('Bir kitabın bölümlerine genel olarak ne denir?', '["Cilt","Kapak","Bölüm","Dizin"]'::jsonb, 2, 'genel_kultur'),
('Halk arasında anlatılan kısa öğüt verici sözlere ne denir?', '["Şiir","Roman","Deneme","Atasözü"]'::jsonb, 3, 'genel_kultur'),

-- Türkçe ve dil
('Türk alfabesinde kaç harf vardır?', '["29","26","31","28"]'::jsonb, 0, 'genel_kultur'),
('Türkçede kaç sesli harf vardır?', '["6","8","10","5"]'::jsonb, 1, 'genel_kultur'),
('"Kitap" kelimesi hangi tür sözcüktür?', '["Fiil","Sıfat","İsim","Zarf"]'::jsonb, 2, 'genel_kultur'),
('Cümlenin sonuna konan noktalama işareti hangisidir?', '["İki nokta","Virgül","Tire","Nokta"]'::jsonb, 3, 'genel_kultur'),
('Soru cümlelerinin sonuna hangi işaret konur?', '["Soru işareti","Ünlem","Nokta","Virgül"]'::jsonb, 0, 'genel_kultur'),
('"Güzel" kelimesi hangi tür sözcüktür?', '["Fiil","Sıfat","Bağlaç","Ünlem"]'::jsonb, 1, 'genel_kultur'),
('Aynı anlama gelen kelimelere ne denir?', '["Zıt anlamlı","Eş sesli","Eş anlamlı","Türemiş"]'::jsonb, 2, 'genel_kultur'),
('Zıt anlamlı kelimelere örnek hangisidir?', '["Okul-mektep","Ev-konut","Al-kırmızı","Uzun-kısa"]'::jsonb, 3, 'genel_kultur'),
('Türkçe hangi dil ailesindendir?', '["Ural-Altay","Hint-Avrupa","Sami","Bantu"]'::jsonb, 0, 'genel_kultur'),
('Alfabede ilk harf hangisidir?', '["B","A","C","Z"]'::jsonb, 1, 'genel_kultur'),
('"Koşmak" kelimesi hangi tür sözcüktür?', '["İsim","Sıfat","Fiil","Edat"]'::jsonb, 2, 'genel_kultur'),
('Sözlükte kelimeler nasıl sıralanır?', '["Rastgele","Uzunluğa göre","Anlamına göre","Alfabetik"]'::jsonb, 3, 'genel_kultur'),
('Bir metnin ana fikrine ne denir?', '["Ana düşünce","Başlık","Dipnot","Özet"]'::jsonb, 0, 'genel_kultur'),
('Türkçede büyük harfle başlayan sözcük türü hangisidir?', '["Fiil","Özel isim","Sıfat","Zamir"]'::jsonb, 1, 'genel_kultur'),
('İki cümleyi bağlayan sözcüklere ne denir?', '["İsim","Fiil","Bağlaç","Sıfat"]'::jsonb, 2, 'genel_kultur'),

-- Genel bilgi karışık kolay
('Gökyüzü genellikle hangi renkte görünür?', '["Kırmızı","Yeşil","Mor","Mavi"]'::jsonb, 3, 'genel_kultur'),
('Yağmuru oluşturan doğa olayı nedir?', '["Yoğuşma","Erime","Donma","Süblimleşme"]'::jsonb, 0, 'genel_kultur'),
('Rüzgârı ölçen alete ne denir?', '["Termometre","Anemometre","Barometre","Higrometre"]'::jsonb, 1, 'genel_kultur'),
('Şimşekten sonra duyulan sese ne denir?', '["Yankı","Uğultu","Gök gürültüsü","Çınlama"]'::jsonb, 2, 'genel_kultur'),
('Kar hangi mevsimde yaygın olarak yağar?', '["İlkbahar","Yaz","Sonbahar","Kış"]'::jsonb, 3, 'genel_kultur'),
('Denizlerin suyu nasıldır?', '["Tuzlu","Tatlı","Şekerli","Acı"]'::jsonb, 0, 'genel_kultur'),
('Ağaçların yapraklarını döktüğü mevsim hangisidir?', '["İlkbahar","Sonbahar","Yaz","Kış"]'::jsonb, 1, 'genel_kultur'),
('Bitkilerin besin ürettiği olaya ne denir?', '["Solunum","Terleme","Fotosentez","Çimlenme"]'::jsonb, 2, 'genel_kultur'),
('Bir bitkinin su ve mineral aldığı kısım hangisidir?', '["Çiçek","Yaprak","Meyve","Kök"]'::jsonb, 3, 'genel_kultur'),
('Doğada suyun buharlaşıp tekrar yağmasına ne denir?', '["Su döngüsü","Erozyon","Deprem","Heyelan"]'::jsonb, 0, 'genel_kultur'),
('Toprağın rüzgâr ve suyla taşınmasına ne denir?', '["Fotosentez","Erozyon","Yoğuşma","Buharlaşma"]'::jsonb, 1, 'genel_kultur'),
('Geri dönüşüm neden yapılır?', '["Çöpü artırmak için","Enerji harcamak için","Kaynakları korumak için","Kirletmek için"]'::jsonb, 2, 'genel_kultur'),
('Cam şişeler hangi kutuya atılır?', '["Plastik","Kâğıt","Metal","Cam"]'::jsonb, 3, 'genel_kultur'),
('Ormanları yok eden en büyük tehlikelerden biri nedir?', '["Yangın","Yağmur","Kar","Rüzgâr gülü"]'::jsonb, 0, 'genel_kultur'),
('Hangi enerji kaynağı yenilenebilirdir?', '["Kömür","Güneş","Petrol","Doğal gaz"]'::jsonb, 1, 'genel_kultur'),
('Elektrik enerjisi üreten rüzgâr yapısına ne denir?', '["Baraj","Reaktör","Rüzgâr türbini","Kazan"]'::jsonb, 2, 'genel_kultur'),
('Su kaynaklarını korumak için ne yapılmalıdır?', '["Kirletmek","Boşa akıtmak","Depolamamak","Tasarruflu kullanmak"]'::jsonb, 3, 'genel_kultur'),
('Işığı olmayan bir odada ne görürüz?', '["Karanlık","Renkler","Gölge","Gökkuşağı"]'::jsonb, 0, 'genel_kultur'),
('Mıknatıs hangi maddeyi çeker?', '["Tahta","Demir","Cam","Plastik"]'::jsonb, 1, 'genel_kultur'),
('Buz eridiğinde ne olur?', '["Buhar olur","Kar olur","Su olur","Taş olur"]'::jsonb, 2, 'genel_kultur')

on conflict (soru) do nothing;

-- ===================== ORTA (200) =====================

insert into public.questions (soru, secenekler, dogru_cevap, kategori) values

-- Türkiye: coğrafya ve idari yapı
('Türkiye''nin yüzölçümü bakımından en küçük ili hangisidir?', '["Düzce","Kilis","Bartın","Yalova"]'::jsonb, 3, 'genel_kultur'),
('Türkiye''nin en fazla komşusu olduğu yön hangisidir?', '["Doğu","Batı","Kuzey","Güney"]'::jsonb, 0, 'genel_kultur'),
('Marmara Denizi''ni Ege''ye bağlayan boğaz hangisidir?', '["Kerç Boğazı","Çanakkale Boğazı","İstanbul Boğazı","Cebelitarık"]'::jsonb, 1, 'genel_kultur'),
('Türkiye''nin en derin gölü hangisidir?', '["Manyas","Tuz Gölü","Van Gölü","Sapanca"]'::jsonb, 2, 'genel_kultur'),
('Türkiye''nin en uzun kıyısı hangi denize aittir?', '["Marmara","Karadeniz","Ege","Akdeniz"]'::jsonb, 3, 'genel_kultur'),
('Toroslar hangi bölgemizde uzanır?', '["Akdeniz","Karadeniz","Marmara","Doğu Anadolu"]'::jsonb, 0, 'genel_kultur'),
('Çukurova hangi bölgemizdedir?', '["İç Anadolu","Akdeniz","Ege","Marmara"]'::jsonb, 1, 'genel_kultur'),
('Türkiye''de en fazla yağış alan bölge hangisidir?', '["Marmara","İç Anadolu","Karadeniz","Güneydoğu Anadolu"]'::jsonb, 2, 'genel_kultur'),
('Türkiye''de karasal iklimin en belirgin görüldüğü bölge hangisidir?', '["Marmara","Ege","Akdeniz","İç Anadolu"]'::jsonb, 3, 'genel_kultur'),
('Ege kıyılarında dağların denize dik uzanmasının sonucu nedir?', '["Girintili çıkıntılı kıyı","Düz kıyı","Yüksek yayla","Geniş delta"]'::jsonb, 0, 'genel_kultur'),
('GAP projesi hangi iki nehir üzerinde kuruludur?', '["Meriç ve Ergene","Fırat ve Dicle","Kızılırmak ve Sakarya","Seyhan ve Ceyhan"]'::jsonb, 1, 'genel_kultur'),
('Türkiye''de aktif fay hattı deyince akla gelen kuşak hangisidir?', '["Ural Kuşağı","Alp Kuşağı","Kuzey Anadolu Fay Hattı","And Kuşağı"]'::jsonb, 2, 'genel_kultur'),
('Türkiye''nin en doğusundaki ili hangisidir?', '["Hakkâri","Ardahan","Van","Iğdır"]'::jsonb, 3, 'genel_kultur'),
('Efes Antik Kenti hangi antik bölgede yer alır?', '["İyonya","Frigya","Likya","Kapadokya"]'::jsonb, 0, 'genel_kultur'),
('Likya Yolu hangi bölgemizde yürünür?', '["Marmara","Akdeniz","İç Anadolu","Karadeniz"]'::jsonb, 1, 'genel_kultur'),
('Türkiye''de peribacalarının oluşumunda etkili olan süreç nedir?', '["Volkan patlaması sırasında donma","Buzullaşma","Aşınma","Deprem"]'::jsonb, 2, 'genel_kultur'),
('Kaz Dağları hangi iller arasındadır?', '["Bursa-Bilecik","Aydın-Denizli","İzmir-Manisa","Balıkesir-Çanakkale"]'::jsonb, 3, 'genel_kultur'),

-- Dünya coğrafyası orta
('Baykal Gölü hangi ülkededir?', '["Rusya","Çin","Moğolistan","Kazakistan"]'::jsonb, 0, 'genel_kultur'),
('Ural Dağları hangi iki kıtayı ayırır?', '["Asya ve Afrika","Avrupa ve Asya","Avrupa ve Afrika","Asya ve Amerika"]'::jsonb, 1, 'genel_kultur'),
('Cebelitarık Boğazı hangi iki kıtayı ayırır?', '["Asya ve Avrupa","Amerika ve Asya","Avrupa ve Afrika","Afrika ve Asya"]'::jsonb, 2, 'genel_kultur'),
('Süveyş Kanalı hangi iki denizi birleştirir?', '["Baltık ve Kuzey","Karadeniz ve Ege","Hazar ve Karadeniz","Akdeniz ve Kızıldeniz"]'::jsonb, 3, 'genel_kultur'),
('Panama Kanalı hangi iki okyanusu birleştirir?', '["Atlas ve Büyük Okyanus","Hint ve Atlas","Arktik ve Hint","Büyük ve Arktik"]'::jsonb, 0, 'genel_kultur'),
('Dünyanın en küçük bağımsız devleti hangisidir?', '["Monako","Vatikan","San Marino","Malta"]'::jsonb, 1, 'genel_kultur'),
('Amazon Yağmur Ormanları en çok hangi ülkenin sınırları içindedir?', '["Kolombiya","Peru","Brezilya","Bolivya"]'::jsonb, 2, 'genel_kultur'),
('Büyük Set Resifi hangi ülkenin kıyısındadır?', '["Meksika","Brezilya","Endonezya","Avustralya"]'::jsonb, 3, 'genel_kultur'),
('Hangi ülkenin kıtası ile adı aynıdır?', '["Avustralya","Brezilya","Hindistan","Mısır"]'::jsonb, 0, 'genel_kultur'),
('İzlanda hangi doğal olayla anılır?', '["Çöl fırtınaları","Volkan ve jeotermal kaynaklar","Muson yağmurları","Kum tepeleri"]'::jsonb, 1, 'genel_kultur'),
('Hangi şehir iki kıta üzerinde kurulmuştur?', '["Roma","Atina","İstanbul","Kahire"]'::jsonb, 2, 'genel_kultur'),
('Hazar Denizi aslında ne olarak sınıflandırılır?', '["Boğaz","Okyanus","Körfez","Göl"]'::jsonb, 3, 'genel_kultur'),
('Ekvator hangi ülkeden geçer?', '["Brezilya","Türkiye","İspanya","Japonya"]'::jsonb, 0, 'genel_kultur'),
('Grönland hangi ülkeye bağlıdır?', '["Norveç","Danimarka","İzlanda","Kanada"]'::jsonb, 1, 'genel_kultur'),
('Alpler hangi kıtadadır?', '["Amerika","Asya","Avrupa","Afrika"]'::jsonb, 2, 'genel_kultur'),
('Hangi ülke fiyortlarıyla tanınır?', '["İrlanda","Portekiz","Yunanistan","Norveç"]'::jsonb, 3, 'genel_kultur'),
('Sibirya hangi ülkenin bölgesidir?', '["Rusya","Çin","Kanada","Kazakistan"]'::jsonb, 0, 'genel_kultur'),

-- Tarih (genel kültür düzeyi)
('Malazgirt Meydan Muharebesi hangi yılda olmuştur?', '["1243","1071","1176","1453"]'::jsonb, 1, 'genel_kultur'),
('Fransız İhtilali hangi yıl gerçekleşmiştir?', '["1848","1815","1789","1871"]'::jsonb, 2, 'genel_kultur'),
('Amerika kıtasına ulaşan Kristof Kolomb hangi yıl yola çıkmıştır?', '["1521","1453","1600","1492"]'::jsonb, 3, 'genel_kultur'),
('Matbaayı Avrupa''da geliştiren kişi kimdir?', '["Gutenberg","Galileo","Newton","Kopernik"]'::jsonb, 0, 'genel_kultur'),
('Piramitleri yaptıran uygarlık hangisidir?', '["Roma","Mısır","Yunan","Pers"]'::jsonb, 1, 'genel_kultur'),
('Anadolu''da kurulan Hitit Devleti''nin başkenti neresidir?', '["Gordion","Sardes","Hattuşa","Truva"]'::jsonb, 2, 'genel_kultur'),

-- Bilim ve doğa orta
('Yanmayı destekleyen gaz hangisidir?', '["Helyum","Azot","Karbondioksit","Oksijen"]'::jsonb, 3, 'genel_kultur'),
('Yerçekimini açıklayan bilim insanı kimdir?', '["Newton","Einstein","Galileo","Darwin"]'::jsonb, 0, 'genel_kultur'),
('Periyodik tabloyu düzenleyen bilim insanı kimdir?', '["Dalton","Mendeleyev","Avogadro","Lavoisier"]'::jsonb, 1, 'genel_kultur'),
('Atomun merkezindeki yapıya ne denir?', '["Kabuk","Yörünge","Çekirdek","Bağ"]'::jsonb, 2, 'genel_kultur'),
('Elektronun yükü nedir?', '["Değişken","Pozitif","Nötr","Negatif"]'::jsonb, 3, 'genel_kultur'),
('Sesin yayılamadığı ortam hangisidir?', '["Boşluk","Hava","Su","Demir"]'::jsonb, 0, 'genel_kultur'),
('Işık hızı yaklaşık kaç km/sn''dir?', '["30.000","300.000","3.000","3.000.000"]'::jsonb, 1, 'genel_kultur'),
('Bir maddenin katıdan doğrudan gaza geçmesine ne denir?', '["Yoğuşma","Erime","Süblimleşme","Buharlaşma"]'::jsonb, 2, 'genel_kultur'),
('Bitkilerde fotosentez hangi renkli maddeyle yapılır?', '["Hemoglobin","Karoten","Melanin","Klorofil"]'::jsonb, 3, 'genel_kultur'),
('DNA''nın yapısı nasıl tanımlanır?', '["Çift sarmal","Tek zincir","Üçgen","Halka"]'::jsonb, 0, 'genel_kultur'),
('Hangi gaz solunumda kullanılır?', '["Azot","Oksijen","Helyum","Argon"]'::jsonb, 1, 'genel_kultur'),
('Balonları havada tutmak için kullanılan hafif gaz hangisidir?', '["Azot","Oksijen","Helyum","Klor"]'::jsonb, 2, 'genel_kultur'),
('Mıknatısın kutupları nelerdir?', '["Sıcak ve soğuk","Doğu ve batı","Artı ve sıfır","Kuzey ve güney"]'::jsonb, 3, 'genel_kultur'),
('Bir cismin uzaydaki yerinin değişmesine ne denir?', '["Hareket","Kütle","Ağırlık","Yoğunluk"]'::jsonb, 0, 'genel_kultur'),
('Kaldıraç hangi tür alettir?', '["Elektrikli alet","Basit makine","Ölçü aleti","Optik alet"]'::jsonb, 1, 'genel_kultur'),

-- Kurumlar, kısaltmalar, semboller
('TÜBİTAK hangi alanda çalışır?', '["Tarım desteği","Sağlık hizmeti","Bilimsel araştırma","Güvenlik"]'::jsonb, 2, 'genel_kultur'),
('TSE hangi konuda çalışır?', '["Ulaşım","Eğitim","Sağlık","Standartlar"]'::jsonb, 3, 'genel_kultur'),
('TDK''nin görevi nedir?', '["Türk dilini incelemek","Deprem ölçmek","Hava tahmini","Yol yapmak"]'::jsonb, 0, 'genel_kultur'),
('AFAD hangi alanda görev yapar?', '["Eğitim","Afet ve acil durum","Turizm","Maliye"]'::jsonb, 1, 'genel_kultur'),
('MEB hangi bakanlığın kısaltmasıdır?', '["Enerji","Maliye","Millî Eğitim","Ulaştırma"]'::jsonb, 2, 'genel_kultur'),
('TRT ne tür bir kurumdur?', '["Hastane","Banka","Üniversite","Yayın kurumu"]'::jsonb, 3, 'genel_kultur'),
('UNICEF hangi grupla ilgilenir?', '["Çocuklar","Sporcular","Askerler","Emekliler"]'::jsonb, 0, 'genel_kultur'),
('UNESCO''nun ilgi alanlarından biri hangisidir?', '["Askerlik","Eğitim ve kültür","Ticaret","Madencilik"]'::jsonb, 1, 'genel_kultur'),
('FIFA hangi sporun uluslararası kuruluşudur?', '["Voleybol","Basketbol","Futbol","Tenis"]'::jsonb, 2, 'genel_kultur'),
('Kırmızı Ay yıldızlı bayrak hangi ülkeye aittir?', '["Pakistan","Tunus","Cezayir","Türkiye"]'::jsonb, 3, 'genel_kultur'),
('Beyaz bayrak neyin simgesidir?', '["Teslimiyet","Zafer","Savaş","Tehlike"]'::jsonb, 0, 'genel_kultur'),
('Trafikte üçgen levhalar neyi belirtir?', '["Yasak","Tehlike uyarısı","Bilgi","Park yeri"]'::jsonb, 1, 'genel_kultur'),
('Bir ürünün kalitesini belgeleyen işaret hangisidir?', '["Etiket fiyatı","Fatura","Kalite belgesi","Barkod"]'::jsonb, 2, 'genel_kultur'),
('Geri dönüşüm simgesi kaç oktan oluşur?', '["5","2","4","3"]'::jsonb, 3, 'genel_kultur'),
('Uluslararası SOS işareti neyi ifade eder?', '["İmdat çağrısı","Selamlama","Zafer","Uyku"]'::jsonb, 0, 'genel_kultur'),

-- Ekonomi ve günlük hayat orta
('Bankaya yatırılan paraya verilen getiriye ne denir?', '["Vergi","Faiz","Prim","Ceza"]'::jsonb, 1, 'genel_kultur'),
('Fiyatların genel olarak artmasına ne denir?', '["Devalüasyon","Deflasyon","Enflasyon","Resesyon"]'::jsonb, 2, 'genel_kultur'),
('Bir ürünün üreticiden tüketiciye ulaşmasına ne denir?', '["İthalat","Üretim","Tüketim","Dağıtım"]'::jsonb, 3, 'genel_kultur'),
('Yurt dışından mal almaya ne denir?', '["İthalat","İhracat","Transit","Takas"]'::jsonb, 0, 'genel_kultur'),
('Yurt dışına mal satmaya ne denir?', '["İthalat","İhracat","Gümrük","Sigorta"]'::jsonb, 1, 'genel_kultur'),
('Bütçede gelirin giderden fazla olmasına ne denir?', '["Borç","Açık","Fazla","Zarar"]'::jsonb, 2, 'genel_kultur'),
('Devletin topladığı zorunlu ödemeye ne denir?', '["Kira","Bağış","Hediye","Vergi"]'::jsonb, 3, 'genel_kultur'),
('Bir işi yapan kişiye ödenen ücrete ne denir?', '["Maaş","Vergi","Faiz","Kâr payı"]'::jsonb, 0, 'genel_kultur'),
('Alışverişte ürünün üzerindeki çizgili koda ne denir?', '["Fatura","Barkod","Etiket","Fiş"]'::jsonb, 1, 'genel_kultur'),
('Bir malın satın alındığını gösteren belge hangisidir?', '["Pasaport","Bilet","Fiş","Ehliyet"]'::jsonb, 2, 'genel_kultur'),
('Sigorta ne işe yarar?', '["Kira toplamaya","Faiz kazanmaya","Vergi ödemeye","Riski karşılamaya"]'::jsonb, 3, 'genel_kultur'),
('Arz ve talep neyi belirler?', '["Fiyatı","Vergiyi","Maaşı","Faizi"]'::jsonb, 0, 'genel_kultur'),
('Bir şirketin ortaklık payına ne denir?', '["Fatura","Hisse","Bono","Çek"]'::jsonb, 1, 'genel_kultur'),
('Merkez bankasının temel görevlerinden biri nedir?', '["Okul açma","Yol yapımı","Para politikası","Sağlık hizmeti"]'::jsonb, 2, 'genel_kultur'),
('Bütçe nedir?', '["Alışveriş listesi","Bir tür vergi","Banka hesabı","Gelir gider planı"]'::jsonb, 3, 'genel_kultur'),

-- Sağlık ve ilk yardım orta
('İlk yardımda kanamayı durdurmak için ne yapılır?', '["Baskı uygulanır","Su dökülür","Ovulur","Isıtılır"]'::jsonb, 0, 'genel_kultur'),
('Yanık bölgesine ilk olarak ne yapılır?', '["Diş macunu sürülür","Soğuk su tutulur","Yağ sürülür","Sarılır"]'::jsonb, 1, 'genel_kultur'),
('Bilinci kapalı kişide önce ne kontrol edilir?', '["Kan şekeri","Ateş","Solunum","Tansiyon"]'::jsonb, 2, 'genel_kultur'),
('Bulaşıcı hastalıklardan korunmanın en basit yolu nedir?', '["Koşmak","Aç kalmak","Az uyumak","El yıkamak"]'::jsonb, 3, 'genel_kultur'),
('Aşı neyi sağlar?', '["Bağışıklık","Beslenme","Enerji","Uyku"]'::jsonb, 0, 'genel_kultur'),
('Kalp krizinde ilk olarak ne yapılmalıdır?', '["Su içirilir","112 aranır","Yürütülür","Beklenir"]'::jsonb, 1, 'genel_kultur'),
('Vücutta su kaybına ne denir?', '["Alerji","Enfeksiyon","Dehidrasyon","Anemi"]'::jsonb, 2, 'genel_kultur'),
('Kansızlığın tıptaki adı nedir?', '["Migren","Diyabet","Astım","Anemi"]'::jsonb, 3, 'genel_kultur'),
('Şeker hastalığında hangi hormon eksikliği vardır?', '["İnsülin","Adrenalin","Melatonin","Tiroksin"]'::jsonb, 0, 'genel_kultur'),
('Kan grubu O olan kişiye hangi kan grubundan kan verilebilir?', '["A","O","B","AB"]'::jsonb, 1, 'genel_kultur'),
('Kemik kırığında yapılması gereken nedir?', '["Çekmek","Ovalamak","Hareketsiz bırakmak","Isıtmak"]'::jsonb, 2, 'genel_kultur'),
('Boğulma riskinde uygulanan manevranın adı nedir?', '["Kegel","Valsalva","Trendelenburg","Heimlich"]'::jsonb, 3, 'genel_kultur'),
('Güneşten korunmak için ne kullanılır?', '["Güneş kremi","Sirke","Kolonya","Zeytinyağı"]'::jsonb, 0, 'genel_kultur'),
('Kalp masajı vücudun neresine uygulanır?', '["Karına","Göğüs kemiğinin ortasına","Sırta","Boyna"]'::jsonb, 1, 'genel_kultur'),
('Düzenli uykunun yetişkin için önerilen süresi nedir?', '["12-14 saat","2-3 saat","7-8 saat","4-5 saat"]'::jsonb, 2, 'genel_kultur'),

-- Sanat, sinema, müzik orta
('Davut Heykeli''nin sanatçısı kimdir?', '["Bernini","Donatello","Rodin","Michelangelo"]'::jsonb, 3, 'genel_kultur'),
('Beşinci Senfoni''nin bestecisi kimdir?', '["Beethoven","Mozart","Bach","Chopin"]'::jsonb, 0, 'genel_kultur'),
('Sihirli Flüt operasının bestecisi kimdir?', '["Verdi","Mozart","Wagner","Puccini"]'::jsonb, 1, 'genel_kultur'),
('Bir oyunun yazılı metnine ne denir?', '["Dekor","Afiş","Senaryo","Kostüm"]'::jsonb, 2, 'genel_kultur'),
('Sinemada sessiz filmden sesli filme geçiş neyle olmuştur?', '["3 boyut","Renkli film","Geniş ekran","Ses kaydı teknolojisi"]'::jsonb, 3, 'genel_kultur'),
('Yağlı boya hangi sanat dalında kullanılır?', '["Resim","Müzik","Dans","Tiyatro"]'::jsonb, 0, 'genel_kultur'),
('Fotoğrafta ışığı ayarlayan bölüm hangisidir?', '["Kayış","Diyafram","Vizör","Kılıf"]'::jsonb, 1, 'genel_kultur'),
('Hat sanatı neyle ilgilidir?', '["Halı dokuma","Çini","Güzel yazı","Ahşap oyma"]'::jsonb, 2, 'genel_kultur'),

-- Edebiyat orta
('Nutuk''un yazarı kimdir?', '["Halide Edip","İsmet İnönü","Ziya Gökalp","Mustafa Kemal Atatürk"]'::jsonb, 3, 'genel_kultur'),
('Divan edebiyatında beyit kaç dizeden oluşur?', '["2","3","4","1"]'::jsonb, 0, 'genel_kultur'),
('Dörtlüklerle yazılan halk edebiyatı nazım birimi hangisidir?', '["Beyit","Dörtlük","Bent","Mısra"]'::jsonb, 1, 'genel_kultur'),
('Yunus Emre hangi edebiyat geleneğindendir?', '["Servet-i Fünun","Fecr-i Ati","Tasavvuf halk edebiyatı","Garip"]'::jsonb, 2, 'genel_kultur'),
('Karagöz''ün karşısındaki bilgiç tipin adı nedir?', '["Beberuhi","Tuzsuz","Çelebi","Hacivat"]'::jsonb, 3, 'genel_kultur'),
('Şehnamenin yazarı kimdir?', '["Firdevsi","Sadi","Hafız","Mevlana"]'::jsonb, 0, 'genel_kultur'),
('Mesnevi''nin yazarı kimdir?', '["Yunus Emre","Mevlana","Hacı Bektaş","Aşık Paşa"]'::jsonb, 1, 'genel_kultur'),
('Dede Korkut Hikâyeleri hangi topluluğa aittir?', '["Kıpçaklar","Uygurlar","Oğuzlar","Peçenekler"]'::jsonb, 2, 'genel_kultur'),
('Bir olayın kısa anlatıldığı edebi türe ne denir?', '["Destan","Roman","Deneme","Öykü"]'::jsonb, 3, 'genel_kultur'),
('Yazarın kendi hayatını anlattığı türe ne denir?', '["Otobiyografi","Biyografi","Roman","Masal"]'::jsonb, 0, 'genel_kultur'),
('Bir sözü gerçek anlamının dışında kullanmaya ne denir?', '["Terim","Mecaz","Deyim","Eş anlam"]'::jsonb, 1, 'genel_kultur'),

-- Deyim ve atasözü
('"Damlaya damlaya göl olur" atasözü neyi anlatır?', '["Aceleyi","Cesareti","Birikimin önemini","Yalnızlığı"]'::jsonb, 2, 'genel_kultur'),
('"Ayağını yorganına göre uzat" ne anlatır?', '["Uzun yürümeyi","Çok uyumayı","Erken kalkmayı","Ölçülü harcamayı"]'::jsonb, 3, 'genel_kultur'),
('"Bir elin nesi var, iki elin sesi var" neyi anlatır?', '["Birlik olmayı","Sessizliği","Yalnızlığı","Alkışı"]'::jsonb, 0, 'genel_kultur'),
('"Sakla samanı gelir zamanı" ne demektir?', '["Saman satmak","Gereksiz görüneni saklamak","Tarla sürmek","Hızlı olmak"]'::jsonb, 1, 'genel_kultur'),
('"Göz var nizam var" ne anlatır?', '["Görme engelini","Gözlük takmayı","Ölçülü davranmayı","Uyumayı"]'::jsonb, 2, 'genel_kultur'),
('"Etekleri zil çalmak" deyimi ne anlatır?', '["Kızmak","Çok üzülmek","Korkmak","Çok sevinmek"]'::jsonb, 3, 'genel_kultur'),
('"Pabucu dama atılmak" ne anlatır?', '["Gözden düşmek","Ayakkabı almak","Ev taşımak","Çatı yapmak"]'::jsonb, 0, 'genel_kultur'),
('"Ağzı kulaklarına varmak" ne demektir?', '["Bağırmak","Çok sevinmek","Susmak","Şaşırmak"]'::jsonb, 1, 'genel_kultur'),
('"İpe un sermek" deyimi ne anlatır?', '["Çamaşır yıkamak","Ekmek yapmak","Bahane bulmak","Yardım etmek"]'::jsonb, 2, 'genel_kultur'),
('"Burnu havada olmak" ne anlatır?', '["Uzun boylu olmak","Üşütmek","Koşmak","Kibirli olmak"]'::jsonb, 3, 'genel_kultur'),
('"Ateş olmayan yerden duman çıkmaz" ne anlatır?', '["Her söylentinin bir temeli olduğunu","Yangını","Sobayı","Sisi"]'::jsonb, 0, 'genel_kultur'),
('"Acele işe şeytan karışır" ne anlatır?', '["Şeytan görünür","Aceleyle iş bozulur","İş kolaylaşır","Zaman kazanılır"]'::jsonb, 1, 'genel_kultur'),
('"Dilinin ucunda olmak" ne anlatır?', '["Yaralanmak","Konuşamamak","Hatırlamaya çalışmak","Susmak"]'::jsonb, 2, 'genel_kultur'),
('"Eli ayağı dolaşmak" ne demektir?', '["Dans etmek","Çok yürümek","Uyumak","Şaşırıp beceremez olmak"]'::jsonb, 3, 'genel_kultur'),
('"Kulak misafiri olmak" ne anlatır?', '["İstemeden duymak","Misafir ağırlamak","Kulak ağrısı","Şarkı dinlemek"]'::jsonb, 0, 'genel_kultur'),

-- Kültür, gelenek, yaşam
('Türk halk oyunlarından "horon" hangi bölgeye aittir?', '["Ege","Karadeniz","Akdeniz","İç Anadolu"]'::jsonb, 1, 'genel_kultur'),
('"Zeybek" hangi bölgemizin halk oyunudur?', '["Karadeniz","Doğu Anadolu","Ege","Marmara"]'::jsonb, 2, 'genel_kultur'),
('Halı ve kilim dokumada kullanılan alete ne denir?', '["Havan","Çıkrık","Fırın","Tezgâh"]'::jsonb, 3, 'genel_kultur'),
('Nazar boncuğunun geleneksel rengi nedir?', '["Mavi","Kırmızı","Yeşil","Sarı"]'::jsonb, 0, 'genel_kultur'),
('Türk kahvesi hangi kapta pişirilir?', '["Demlik","Cezve","Tencere","Güğüm"]'::jsonb, 1, 'genel_kultur'),
('Hamamda kullanılan geleneksel örtüye ne denir?', '["Şal","Yorgan","Peştamal","Kilim"]'::jsonb, 2, 'genel_kultur'),
('Geleneksel Türk gölge oyununda perdeye ne denir?', '["Pencere","Sahne","Kapı","Ayna"]'::jsonb, 3, 'genel_kultur'),
('Ramazan ayında oruç ne zaman açılır?', '["İftarda","Sahurda","Öğlen","Gece yarısı"]'::jsonb, 0, 'genel_kultur'),
('Kurban Bayramı kaç gün sürer?', '["3","4","2","5"]'::jsonb, 1, 'genel_kultur'),
('Hıdrellez hangi mevsimde kutlanır?', '["Kış","Sonbahar","İlkbahar","Yaz sonu"]'::jsonb, 2, 'genel_kultur'),
('Nevruz neyin başlangıcı sayılır?', '["Yazın","Kışın","Hasadın","Baharın"]'::jsonb, 3, 'genel_kultur'),
('Geleneksel Türk yağlı güreşi nerede yapılır?', '["Kırkpınar","Kapadokya","Efes","Pamukkale"]'::jsonb, 0, 'genel_kultur'),
('Mevlevi sema töreninde dönen kişiye ne denir?', '["Aşık","Semazen","Ozan","Derviş çırağı"]'::jsonb, 1, 'genel_kultur'),
('Türk mutfağında "mezelik" ne anlama gelir?', '["Tatlı çeşidi","Çorba türü","Ana yemek öncesi küçük tabaklar","Ekmek çeşidi"]'::jsonb, 2, 'genel_kultur'),
('Yemekten sonra ikram edilen geleneksel içecek hangisidir?', '["Şalgam","Ayran","Limonata","Türk kahvesi"]'::jsonb, 3, 'genel_kultur'),

-- Ulaşım ve keşif
('İlk buharlı lokomotifi geliştiren mühendis kimdir?', '["Stephenson","Watt","Ford","Diesel"]'::jsonb, 0, 'genel_kultur'),
('Dünyayı ilk dolaşan seferin kaptanı kimdir?', '["Kolomb","Macellan","Vasco da Gama","Cook"]'::jsonb, 1, 'genel_kultur'),
('Ümit Burnu''nu dolaşarak Hindistan''a ulaşan denizci kimdir?', '["Macellan","Kolomb","Vasco da Gama","Amerigo"]'::jsonb, 2, 'genel_kultur'),
('Gemilerde yön bulmayı kolaylaştıran alet hangisidir?', '["Teleskop","Terazi","Barometre","Pusula"]'::jsonb, 3, 'genel_kultur')

-- Oyun, eğlence, popüler kültür (zamansız)

on conflict (soru) do nothing;

-- ===================== ZOR (100) =====================

insert into public.questions (soru, secenekler, dogru_cevap, kategori) values

('Kızılırmak hangi denize dökülür?', '["Karadeniz","Akdeniz","Ege","Marmara"]'::jsonb, 0, 'genel_kultur'),
('Aras Nehri hangi denize ulaşan havzadadır?', '["Karadeniz","Hazar","Akdeniz","Ege"]'::jsonb, 1, 'genel_kultur'),
('Türkiye''de sönmüş volkan olarak bilinen Nemrut Krateri hangi ildedir?', '["Ağrı","Van","Bitlis","Muş"]'::jsonb, 2, 'genel_kultur'),
('Beyşehir Gölü hangi ilde bulunur?', '["Karaman","Isparta","Antalya","Konya"]'::jsonb, 3, 'genel_kultur'),
('Anadolu''da "Frigya" bölgesinin merkezi hangi antik kenttir?', '["Gordion","Sardes","Efes","Milet"]'::jsonb, 0, 'genel_kultur'),
('Truva antik kenti hangi ilimizdedir?', '["Edirne","Çanakkale","İzmir","Balıkesir"]'::jsonb, 1, 'genel_kultur'),
('Zeugma Mozaik Müzesi hangi ildedir?', '["Adıyaman","Şanlıurfa","Gaziantep","Kilis"]'::jsonb, 2, 'genel_kultur'),
('Aspendos Antik Tiyatrosu hangi ildedir?', '["Mersin","Aydın","Muğla","Antalya"]'::jsonb, 3, 'genel_kultur'),
('Safranbolu hangi özelliğiyle UNESCO listesindedir?', '["Geleneksel evleri","Plajları","Yaylaları","Mağaraları"]'::jsonb, 0, 'genel_kultur'),
('Divriği Ulu Camii hangi ildedir?', '["Tokat","Sivas","Malatya","Erzurum"]'::jsonb, 1, 'genel_kultur'),
('Kuş Cenneti Milli Parkı hangi ildedir?', '["Bursa","Manisa","Balıkesir","İzmir"]'::jsonb, 2, 'genel_kultur'),

('Bir sayının kendisiyle çarpımına ne denir?', '["Katı","Küpü","Kökü","Karesi"]'::jsonb, 3, 'genel_kultur'),
('Bir dörtgenin iç açıları toplamı kaç derecedir?', '["360","180","270","540"]'::jsonb, 0, 'genel_kultur'),
('Asal sayıların en küçüğü hangisidir?', '["3","2","1","0"]'::jsonb, 1, 'genel_kultur'),
('Bir çemberin çevresini hesaplarken kullanılan sabit hangisidir?', '["Sigma","Fi","Pi","Delta"]'::jsonb, 2, 'genel_kultur'),
('Kenar uzunlukları eşit olan üçgene ne denir?', '["Geniş açılı","İkizkenar","Dik","Eşkenar"]'::jsonb, 3, 'genel_kultur'),
('Bir açının 90 dereceden büyük olmasına ne denir?', '["Geniş açı","Dar açı","Dik açı","Tam açı"]'::jsonb, 0, 'genel_kultur'),
('Onluk sayı sisteminde kaç rakam kullanılır?', '["16","10","2","8"]'::jsonb, 1, 'genel_kultur'),
('İkilik sayı sisteminde hangi rakamlar kullanılır?', '["1 ve 10","1 ve 2","0 ve 1","0 ve 9"]'::jsonb, 2, 'genel_kultur'),
('Bir küpün kaç yüzü vardır?', '["12","4","8","6"]'::jsonb, 3, 'genel_kultur'),

('Nobel Ödülü''nün verilmediği alan hangisidir?', '["Matematik","Fizik","Kimya","Tıp"]'::jsonb, 0, 'genel_kultur'),
('Fields Madalyası hangi alanda verilir?', '["Barış","Matematik","Edebiyat","Müzik"]'::jsonb, 1, 'genel_kultur'),
('Altın Palmiye hangi film festivalinin ödülüdür?', '["Venedik","Berlin","Cannes","Sundance"]'::jsonb, 2, 'genel_kultur'),
('Altın Ayı ödülü hangi festivalde verilir?', '["Cannes","Toronto","Venedik","Berlin"]'::jsonb, 3, 'genel_kultur'),
('Pulitzer Ödülü ağırlıklı olarak hangi alandadır?', '["Gazetecilik","Mimarlık","Mühendislik","Tıp"]'::jsonb, 0, 'genel_kultur'),
('Grammy ödülleri hangi alanda verilir?', '["Sinema","Müzik","Tiyatro","Edebiyat"]'::jsonb, 1, 'genel_kultur'),
('Turing Ödülü hangi alanda verilir?', '["Fizik","Kimya","Bilgisayar bilimi","Ekonomi"]'::jsonb, 2, 'genel_kultur'),
('Nobel ödüllerinin verilmeye başlandığı yıl hangisidir?', '["1920","1895","1945","1901"]'::jsonb, 3, 'genel_kultur'),

('Bizans İmparatorluğu''nun başkenti neresiydi?', '["Konstantinopolis","Roma","Atina","Selanik"]'::jsonb, 0, 'genel_kultur'),
('Selçuklu Devleti''nin Anadolu''daki başkenti neresiydi?', '["Kayseri","Konya","Sivas","Erzurum"]'::jsonb, 1, 'genel_kultur'),
('Osmanlı''nın ilk başkenti neresidir?', '["Bursa","Edirne","Söğüt","İznik"]'::jsonb, 2, 'genel_kultur'),
('Osmanlı''da devşirme sistemiyle yetiştirilen askeri sınıf hangisidir?', '["Sipahiler","Akıncılar","Levendler","Yeniçeriler"]'::jsonb, 3, 'genel_kultur'),
('Kanuni Sultan Süleyman''ın Avrupa''daki lakabı nedir?', '["Muhteşem","Yavuz","Fatih","Yıldırım"]'::jsonb, 0, 'genel_kultur'),
('Osmanlı''da ilk anayasa hangi adla bilinir?', '["Tanzimat","Kanun-i Esasi","Islahat","Sened-i İttifak"]'::jsonb, 1, 'genel_kultur'),
('Çanakkale Savaşları hangi yıllarda yaşanmıştır?', '["1919-1922","1912-1913","1915-1916","1877-1878"]'::jsonb, 2, 'genel_kultur'),
('Sakarya Meydan Muharebesi hangi yıl kazanılmıştır?', '["1923","1922","1920","1921"]'::jsonb, 3, 'genel_kultur'),
('Saltanat hangi yıl kaldırılmıştır?', '["1922","1923","1924","1921"]'::jsonb, 0, 'genel_kultur'),
('Cumhuriyetin ilanından sonra kabul edilen yeni ölçü sistemi hangisidir?', '["Arşın sistemi","Metre sistemi","Okka sistemi","Endaze sistemi"]'::jsonb, 1, 'genel_kultur'),
('Soyadı Kanunu hangi yıl çıkarılmıştır?', '["1930","1928","1934","1926"]'::jsonb, 2, 'genel_kultur'),
('Türkiye''de yeni Türk alfabesi hangi alfabeye dayanır?', '["Yunan","Kiril","Arap","Latin"]'::jsonb, 3, 'genel_kultur'),
('Cumhuriyetin ilk cumhurbaşkanı kimdir?', '["Mustafa Kemal Atatürk","İsmet İnönü","Celal Bayar","Fevzi Çakmak"]'::jsonb, 0, 'genel_kultur'),

('Yunan mitolojisinde savaş tanrısı kimdir?', '["Hermes","Ares","Apollon","Hephaistos"]'::jsonb, 1, 'genel_kultur'),
('Yunan mitolojisinde bilgelik tanrıçası kimdir?', '["Demeter","Hera","Athena","Artemis"]'::jsonb, 2, 'genel_kultur'),
('Yunan mitolojisinde güneş ve sanat tanrısı kimdir?', '["Kronos","Ares","Hades","Apollon"]'::jsonb, 3, 'genel_kultur'),
('Mısır mitolojisinde güneş tanrısı kimdir?', '["Ra","Osiris","Horus","Seth"]'::jsonb, 0, 'genel_kultur'),
('İskandinav mitolojisinde gök gürültüsü tanrısı kimdir?', '["Loki","Thor","Odin","Freya"]'::jsonb, 1, 'genel_kultur'),
('Truva Atı hikâyesi hangi savaşla ilgilidir?', '["Yüzyıl Savaşları","Pers Savaşları","Truva Savaşı","Pön Savaşları"]'::jsonb, 2, 'genel_kultur'),
('Türk mitolojisinde gök tanrı inancının adı nedir?', '["Umay","Kayra","Erlik","Tengri"]'::jsonb, 3, 'genel_kultur'),
('Ergenekon Destanı hangi kültüre aittir?', '["Türk","Fars","Yunan","Kelt"]'::jsonb, 0, 'genel_kultur'),
('Anka kuşu hangi özelliğiyle bilinir?', '["Su altında yaşaması","Küllerinden yeniden doğması","Konuşması","Uçamaması"]'::jsonb, 1, 'genel_kultur'),

('Sistin Şapeli''nin tavanını kim resmetmiştir?', '["Botticelli","Rafael","Michelangelo","Caravaggio"]'::jsonb, 2, 'genel_kultur'),
('Empresyonizm akımı hangi sanat dalında doğmuştur?', '["Müzik","Edebiyat","Mimari","Resim"]'::jsonb, 3, 'genel_kultur'),
('Kübizmin öncülerinden biri kimdir?', '["Picasso","Monet","Rembrandt","Vermeer"]'::jsonb, 0, 'genel_kultur'),
('Gotik mimarinin belirgin özelliği nedir?', '["Yuvarlak kubbeler","Sivri kemerler","Düz çatılar","Ahşap sütunlar"]'::jsonb, 1, 'genel_kultur'),
('Mimar Sinan''ın "çıraklık eserim" dediği yapı hangisidir?', '["Süleymaniye","Selimiye","Şehzade Camii","Rüstem Paşa"]'::jsonb, 2, 'genel_kultur'),
('Selimiye Camii hangi ilimizdedir?', '["Konya","İstanbul","Bursa","Edirne"]'::jsonb, 3, 'genel_kultur'),
('Çini sanatıyla ünlü ilimiz hangisidir?', '["Kütahya","Rize","Sinop","Ordu"]'::jsonb, 0, 'genel_kultur'),
('Osmanlı minyatür sanatında ünlü isim kimdir?', '["Sinan","Levni","Itri","Baki"]'::jsonb, 1, 'genel_kultur'),

('Kanın pıhtılaşmasını sağlayan kan hücreleri hangileridir?', '["Plazma","Alyuvarlar","Trombositler","Akyuvarlar"]'::jsonb, 2, 'genel_kultur'),
('İnsanda kaç çift kromozom bulunur?', '["24","46","22","23"]'::jsonb, 3, 'genel_kultur'),
('İnsan kulağında sesi ileten en küçük kemikler hangileridir?', '["Çekiç, örs, üzengi","Kaburgalar","Omurlar","Bilek kemikleri"]'::jsonb, 0, 'genel_kultur'),
('Vücudun en sert dokusu hangisidir?', '["Kıkırdak","Diş minesi","Kemik","Tırnak"]'::jsonb, 1, 'genel_kultur'),
('Karaciğerin temel görevlerinden biri nedir?', '["Görüntü oluşturmak","Kan pompalamak","Zararlı maddeleri süzmek","Ses üretmek"]'::jsonb, 2, 'genel_kultur'),
('Hangi organ insülin salgılar?', '["Dalak","Karaciğer","Böbrek","Pankreas"]'::jsonb, 3, 'genel_kultur'),
('Böbreklerin temel görevi nedir?', '["Kanı süzmek","Kan üretmek","Besin depolamak","Hormon taşımak"]'::jsonb, 0, 'genel_kultur'),
('Beynin denge ve koordinasyondan sorumlu bölümü hangisidir?', '["Ön beyin","Beyincik","Omurilik soğanı","Hipofiz"]'::jsonb, 1, 'genel_kultur'),
('Vücutta besinlerin emiliminin çoğu nerede olur?', '["Yemek borusu","Mide","İnce bağırsak","Kalın bağırsak"]'::jsonb, 2, 'genel_kultur'),

('Bir bilgisayarda işletim sistemi ne işe yarar?', '["Kablo bağlar","Sadece oyun çalıştırır","Elektrik üretir","Donanım ve yazılımı yönetir"]'::jsonb, 3, 'genel_kultur'),
('Açık kaynak yazılım ne demektir?', '["Kaynak kodu paylaşılan yazılım","Ücretli yazılım","Bozuk yazılım","Eski yazılım"]'::jsonb, 0, 'genel_kultur'),
('İnternette güvenli bağlantıyı gösteren simge hangisidir?', '["Kalp","Kilit","Yıldız","Ok"]'::jsonb, 1, 'genel_kultur'),
('Bir bilgisayar ağında IP ne işe yarar?', '["Dosya siler","Ses üretir","Cihazı adresler","Ekran açar"]'::jsonb, 2, 'genel_kultur'),
('Yapay zekâda "makine öğrenmesi" ne yapar?', '["Ekran temizler","Donanım üretir","Kablo döşer","Veriden örüntü öğrenir"]'::jsonb, 3, 'genel_kultur'),
('Bulut bilişim ne anlama gelir?', '["Verilerin uzak sunucularda tutulması","Hava tahmini","Uçak seyahati","Bulut fotoğrafı"]'::jsonb, 0, 'genel_kultur'),
('Bir bilgisayarda "algoritma" nedir?', '["Bir kablo türü","Adım adım çözüm yolu","Bir donanım parçası","Bir ekran çeşidi"]'::jsonb, 1, 'genel_kultur'),
('İlk programlama fikirleriyle anılan kişi kimdir?', '["Hedy Lamarr","Marie Curie","Ada Lovelace","Rosalind Franklin"]'::jsonb, 2, 'genel_kultur'),
('Dünyanın ilk genel amaçlı elektronik bilgisayarlarından biri hangisidir?', '["Amiga","iMac","ZX81","ENIAC"]'::jsonb, 3, 'genel_kultur'),
('World Wide Web''i geliştiren kişi kimdir?', '["Tim Berners-Lee","Bill Gates","Steve Jobs","Linus Torvalds"]'::jsonb, 0, 'genel_kultur'),

('Dünyada en çok konuşulan dillerden Mandarin hangi ülkeye aittir?', '["Kore","Çin","Japonya","Vietnam"]'::jsonb, 1, 'genel_kultur'),
('Kiril alfabesi hangi dilde kullanılır?', '["Portekizce","İspanyolca","Rusça","İtalyanca"]'::jsonb, 2, 'genel_kultur'),
('Hangi dil Latin kökenli değildir?', '["İtalyanca","İspanyolca","Fransızca","Almanca"]'::jsonb, 3, 'genel_kultur'),
('Esperanto nedir?', '["Yapay bir dil","Bir müzik türü","Bir dans","Bir yemek"]'::jsonb, 0, 'genel_kultur'),
('Hiyeroglif hangi uygarlığın yazısıdır?', '["Yunan","Mısır","Roma","Pers"]'::jsonb, 1, 'genel_kultur'),
('Çivi yazısını kullanan uygarlık hangisidir?', '["Romalılar","Mısırlılar","Sümerler","Yunanlar"]'::jsonb, 2, 'genel_kultur'),
('Orhun Yazıtları hangi ülkededir?', '["Rusya","Kazakistan","Çin","Moğolistan"]'::jsonb, 3, 'genel_kultur'),
('Orhun Yazıtları hangi dönemden kalmadır?', '["Göktürk","Selçuklu","Osmanlı","Hun"]'::jsonb, 0, 'genel_kultur'),
('Divanü Lügati''t-Türk''ün yazarı kimdir?', '["Ahmet Yesevi","Kaşgarlı Mahmut","Yusuf Has Hacip","Edip Ahmet"]'::jsonb, 1, 'genel_kultur')

on conflict (soru) do nothing;


-- ===================== EK (tekrar eden sorular yerine yazılan yeni sorular) =====================

insert into public.questions (soru, secenekler, dogru_cevap, kategori) values

-- Meslekler ve araçları
('Ekmek yapan ve satan esnafa ne denir?', '["Manav","Kasap","Fırıncı","Terzi"]'::jsonb, 2, 'genel_kultur'),
('Kumaştan giysi diken kişiye ne denir?', '["Kuyumcu","Marangoz","Çilingir","Terzi"]'::jsonb, 3, 'genel_kultur'),
('Ahşap işleyen ustaya ne denir?', '["Marangoz","Demirci","Camcı","Boyacı"]'::jsonb, 0, 'genel_kultur'),
('Kilit ve anahtar işleriyle uğraşan kişiye ne denir?', '["Tesisatçı","Çilingir","Elektrikçi","Sıvacı"]'::jsonb, 1, 'genel_kultur'),
('Gemiyi yöneten kişiye ne denir?', '["Pilot","Şoför","Kaptan","Makinist"]'::jsonb, 2, 'genel_kultur'),
('Treni kullanan kişiye ne denir?', '["Kondüktör","Kaptan","Pilot","Makinist"]'::jsonb, 3, 'genel_kultur'),
('Hastanede ameliyat yapan hekime ne denir?', '["Cerrah","Eczacı","Hemşire","Diyetisyen"]'::jsonb, 0, 'genel_kultur'),
('Göz sağlığıyla ilgilenen hekime ne denir?', '["Diş hekimi","Göz doktoru","Veteriner","Kardiyolog"]'::jsonb, 1, 'genel_kultur'),
('Hayvanları tedavi eden hekime ne denir?', '["Cerrah","Eczacı","Veteriner","Psikolog"]'::jsonb, 2, 'genel_kultur'),
('Mahkemede savunma yapan kişiye ne denir?', '["Katip","Hakim","Savcı","Avukat"]'::jsonb, 3, 'genel_kultur'),
('Gökyüzünü ve yıldızları inceleyen bilim insanına ne denir?', '["Gökbilimci","Jeolog","Arkeolog","Biyolog"]'::jsonb, 0, 'genel_kultur'),
('Eski kalıntıları kazıyla araştıran bilim insanına ne denir?', '["Meteorolog","Arkeolog","Zoolog","Kimyager"]'::jsonb, 1, 'genel_kultur'),
('Hava durumunu inceleyen bilim dalı hangisidir?', '["Botanik","Jeoloji","Meteoroloji","Zooloji"]'::jsonb, 2, 'genel_kultur'),
('Bitkileri inceleyen bilim dalı hangisidir?', '["Anatomi","Zooloji","Ekoloji","Botanik"]'::jsonb, 3, 'genel_kultur'),
('Yer kabuğunu inceleyen bilim dalı hangisidir?', '["Jeoloji","Astronomi","Botanik","Sosyoloji"]'::jsonb, 0, 'genel_kultur'),

-- Coğrafya terimleri
('Üç tarafı suyla çevrili kara parçasına ne denir?', '["Ada","Yarımada","Kıstak","Körfez"]'::jsonb, 1, 'genel_kultur'),
('İki kara parçasını birleştiren dar kara şeridine ne denir?', '["Körfez","Boğaz","Kıstak","Burun"]'::jsonb, 2, 'genel_kultur'),
('Denizin karaya doğru girinti yaptığı yere ne denir?', '["Vadi","Burun","Delta","Körfez"]'::jsonb, 3, 'genel_kultur'),
('Akarsuyun denize döküldüğü yerde oluşan ovaya ne denir?', '["Delta","Plato","Yayla","Vadi"]'::jsonb, 0, 'genel_kultur'),
('Akarsuların aştığı derin çukur şekle ne denir?', '["Tepe","Vadi","Sırt","Zirve"]'::jsonb, 1, 'genel_kultur'),
('Yüksek ve düz alanlara ne denir?', '["Körfez","Delta","Plato","Kıstak"]'::jsonb, 2, 'genel_kultur'),
('Bir akarsuyun suyunu topladığı alana ne denir?', '["Kol","Menba","Ağız","Havza"]'::jsonb, 3, 'genel_kultur'),
('Haritada aynı yüksekliğe sahip noktaları birleştiren çizgiye ne denir?', '["İzohips","İzoterm","Meridyen","Paralel"]'::jsonb, 0, 'genel_kultur'),
('Haritada kuzey-güney yönünde uzanan çizgilere ne denir?', '["Paralel","Meridyen","İzohips","Ekvator"]'::jsonb, 1, 'genel_kultur'),
('Haritanın küçültme oranını gösteren değere ne denir?', '["Yön oku","Lejant","Ölçek","Koordinat"]'::jsonb, 2, 'genel_kultur'),
('Haritadaki işaretlerin anlamını açıklayan bölüme ne denir?', '["Çerçeve","Ölçek","Başlık","Lejant"]'::jsonb, 3, 'genel_kultur'),
('Dünyanın küçültülmüş küresel modeline ne denir?', '["Küre (glob)","Atlas","Pusula","Kroki"]'::jsonb, 0, 'genel_kultur'),
('Kuzey yarım kürede kışın en uzun gece hangi aya denk gelir?', '["Haziran","Aralık","Mart","Eylül"]'::jsonb, 1, 'genel_kultur'),
('Gece ile gündüzün eşit olduğu tarihlere ne denir?', '["Tutulma","Gündönümü","Ekinoks","Ay evresi"]'::jsonb, 2, 'genel_kultur'),
('Deniz seviyesinden yükseldikçe sıcaklık genel olarak ne olur?', '["İkiye katlanır","Artar","Değişmez","Azalır"]'::jsonb, 3, 'genel_kultur'),

-- Doğa olayları ve afetler
('Yer kabuğunun kırılmasıyla oluşan sarsıntıya ne denir?', '["Deprem","Sel","Çığ","Fırtına"]'::jsonb, 0, 'genel_kultur'),
('Depremin şiddetini ölçen alete ne denir?', '["Termometre","Sismograf","Barometre","Anemometre"]'::jsonb, 1, 'genel_kultur'),
('Denizaltı depremiyle oluşan dev dalgaya ne denir?', '["Gelgit","Girdap","Tsunami","Akıntı"]'::jsonb, 2, 'genel_kultur'),
('Dağ yamacından kayan kar kütlesine ne denir?', '["Kasırga","Heyelan","Sel","Çığ"]'::jsonb, 3, 'genel_kultur'),
('Toprak kütlesinin yamaçtan kaymasına ne denir?', '["Heyelan","Çığ","Erozyon","Deprem"]'::jsonb, 0, 'genel_kultur'),
('Aşırı yağışla suların taşmasına ne denir?', '["Kuraklık","Sel","Don","Sis"]'::jsonb, 1, 'genel_kultur'),
('Uzun süre yağış olmamasına ne denir?', '["Çığ","Sel","Kuraklık","Fırtına"]'::jsonb, 2, 'genel_kultur'),
('Havadaki su buharının yere yakın yoğuşmasına ne denir?', '["Çiy noktası","Kar","Dolu","Sis"]'::jsonb, 3, 'genel_kultur'),
('Buz taneleri halinde yağan yağışa ne denir?', '["Dolu","Çiy","Kırağı","Sis"]'::jsonb, 0, 'genel_kultur'),
('Sabaha karşı bitkiler üzerinde oluşan su damlalarına ne denir?', '["Dolu","Çiy","Kar","Sis"]'::jsonb, 1, 'genel_kultur'),

-- Bitkiler ve tarım
('Buğdayın öğütülmesiyle elde edilen ürün nedir?', '["Yağ","Şeker","Un","Tuz"]'::jsonb, 2, 'genel_kultur'),
('Pamuk hangi amaçla en çok kullanılır?', '["Boya","Yakıt","Gübre","Kumaş üretimi"]'::jsonb, 3, 'genel_kultur'),
('Ayçiçeğinden ne elde edilir?', '["Yağ","Un","Şeker","İpek"]'::jsonb, 0, 'genel_kultur'),
('Çeltik hangi ürünün tarladaki adıdır?', '["Buğday","Pirinç","Mısır","Arpa"]'::jsonb, 1, 'genel_kultur'),
('Bir bitkinin üreme organı hangisidir?', '["Gövde","Kök","Çiçek","Yaprak"]'::jsonb, 2, 'genel_kultur'),
('Tohumun toprakta filizlenmesine ne denir?', '["Hasat","Aşılama","Budama","Çimlenme"]'::jsonb, 3, 'genel_kultur'),
('Meyve ağaçlarının fazla dallarının kesilmesine ne denir?', '["Budama","Çapalama","Sulama","Gübreleme"]'::jsonb, 0, 'genel_kultur'),
('Ürünün toplanmasına ne denir?', '["Ekim","Hasat","Sürüm","Serpme"]'::jsonb, 1, 'genel_kultur'),
('Toprağa verimlilik kazandıran maddeye ne denir?', '["Kum","Kireç","Gübre","Asfalt"]'::jsonb, 2, 'genel_kultur'),
('Seracılık ne sağlar?', '["Toprak kaybı","Daha az verim","Su tasarrufu yok","Mevsim dışı üretim"]'::jsonb, 3, 'genel_kultur'),
('Zeytin ağacı hangi iklimde iyi yetişir?', '["Akdeniz iklimi","Kutup iklimi","Tundra","Çöl"]'::jsonb, 0, 'genel_kultur'),
('Arıcılıkta üretilen ürünlerden biri hangisidir?', '["Pamuk","Bal mumu","Yün","İpek"]'::jsonb, 1, 'genel_kultur'),
('Koyundan elde edilen lif hangisidir?', '["Keten","Pamuk","Yün","İpek"]'::jsonb, 2, 'genel_kultur'),
('Ketenden elde edilen ürün nedir?', '["Şeker","Bal","Peynir","Kumaş"]'::jsonb, 3, 'genel_kultur'),
('Bir bitkiyi başka bir bitkiye ekleme işlemine ne denir?', '["Aşılama","Budama","Çapalama","Havalandırma"]'::jsonb, 0, 'genel_kultur'),

-- Hayvanlar: yavrular ve topluluklar
('Kedi yavrusuna ne denir?', '["Kuzu","Yavru kedi","Buzağı","Tay"]'::jsonb, 1, 'genel_kultur'),
('At yavrusuna ne denir?', '["Buzağı","Kuzu","Tay","Oğlak"]'::jsonb, 2, 'genel_kultur'),
('İnek yavrusuna ne denir?', '["Civciv","Tay","Kuzu","Buzağı"]'::jsonb, 3, 'genel_kultur'),
('Koyun yavrusuna ne denir?', '["Kuzu","Oğlak","Buzağı","Tay"]'::jsonb, 0, 'genel_kultur'),
('Keçi yavrusuna ne denir?', '["Kuzu","Oğlak","Buzağı","Sıpa"]'::jsonb, 1, 'genel_kultur'),
('Tavuk yavrusuna ne denir?', '["Tay","Kuzu","Civciv","Yavru ördek"]'::jsonb, 2, 'genel_kultur'),
('Eşek yavrusuna ne denir?', '["Oğlak","Tay","Kuzu","Sıpa"]'::jsonb, 3, 'genel_kultur'),
('Koyun topluluğuna ne denir?', '["Sürü","Küme","Kovan","Sürek avı"]'::jsonb, 0, 'genel_kultur'),
('Balık topluluğuna ne denir?', '["Kovan","Sürü","Yuva","Küme"]'::jsonb, 1, 'genel_kultur'),
('Karıncaların yaşadığı yapıya ne denir?', '["Kümes","Kovan","Yuva","Ağıl"]'::jsonb, 2, 'genel_kultur'),
('Tavukların barındığı yapıya ne denir?', '["Yuva","Ahır","Kovan","Kümes"]'::jsonb, 3, 'genel_kultur'),
('Büyükbaş hayvanların barındığı yapıya ne denir?', '["Ahır","Kümes","Kovan","Ağıl"]'::jsonb, 0, 'genel_kultur'),

-- Ev, mutfak, günlük eşya
('Yiyecekleri soğutarak saklayan cihaz hangisidir?', '["Fırın","Buzdolabı","Ütü","Süpürge"]'::jsonb, 1, 'genel_kultur'),
('Kumaşın kırışıklığını gideren alet hangisidir?', '["Rende","Mikser","Ütü","Kepçe"]'::jsonb, 2, 'genel_kultur'),
('Sebzeleri ince ince doğramaya yarayan mutfak aracı hangisidir?', '["Süzgeç","Kepçe","Tencere","Rende"]'::jsonb, 3, 'genel_kultur'),
('Çorba servisinde kullanılan araç hangisidir?', '["Kepçe","Rende","Ütü","Tornavida"]'::jsonb, 0, 'genel_kultur'),
('Makarnanın suyunu süzmek için ne kullanılır?', '["Tava","Süzgeç","Kepçe","Rende"]'::jsonb, 1, 'genel_kultur'),
('Vidayı sıkmak için hangi alet kullanılır?', '["Testere","Çekiç","Tornavida","Mala"]'::jsonb, 2, 'genel_kultur'),
('Çivi çakmak için hangi alet kullanılır?', '["Metre","Tornavida","Pense","Çekiç"]'::jsonb, 3, 'genel_kultur'),
('Tahtayı kesmek için hangi alet kullanılır?', '["Testere","Çekiç","Mala","Fırça"]'::jsonb, 0, 'genel_kultur'),
('Duvar örerken harç sürmek için kullanılan alet hangisidir?', '["Testere","Mala","Pense","Metre"]'::jsonb, 1, 'genel_kultur'),
('Bir yüzeyin düz olup olmadığını ölçen alet hangisidir?', '["Gönye","Pergel","Su terazisi","Cetvel"]'::jsonb, 2, 'genel_kultur'),

-- Kitap, iletişim, okul
('Kitapların ödünç alınabildiği yere ne denir?', '["Ambar","Kırtasiye","Matbaa","Kütüphane"]'::jsonb, 3, 'genel_kultur'),
('Bir kitabın basıldığı yere ne denir?', '["Matbaa","Kütüphane","Kırtasiye","Depo"]'::jsonb, 0, 'genel_kultur'),
('Kitabın sonundaki kaynak listesine ne denir?', '["Önsöz","Kaynakça","Dizin","İçindekiler"]'::jsonb, 1, 'genel_kultur'),
('Kitabın başındaki konu listesine ne denir?', '["Dipnot","Kaynakça","İçindekiler","Kapak"]'::jsonb, 2, 'genel_kultur'),
('Mektupların taşındığı kurum hangisidir?', '["Emniyet","Belediye","Valilik","Posta"]'::jsonb, 3, 'genel_kultur'),
('Bir zarfın üzerine yapıştırılan ödeme belgesi nedir?', '["Pul","Bilet","Fiş","Etiket"]'::jsonb, 0, 'genel_kultur'),
('Okulda bir dersin süresine ne denir?', '["Teneffüs","Ders saati","Dönem","Yarıyıl"]'::jsonb, 1, 'genel_kultur'),
('Dersler arasındaki dinlenme süresine ne denir?', '["Sınav","Dönem","Teneffüs","Nöbet"]'::jsonb, 2, 'genel_kultur'),
('Üniversitede öğrencilerin katıldığı derse ne denir?', '["Yoklama","Nöbet","Tatil","Ders"]'::jsonb, 3, 'genel_kultur')

on conflict (soru) do nothing;

-- ===================== KARIŞTIRMA =====================
-- Doğru cevap hep aynı şıkta olmasın: SADECE bu partide eklenen soruların
-- şıkları karıştırılır. `created_at >= transaction_timestamp()` koşulu
-- ZORUNLUDUR; onsuz tüm havuzun şıkları karışır ve o an oynanan maçlarda
-- şık indeksleri kayar.
with karisik as (
  select q.id,
         jsonb_agg(s.value order by s.rnd) as yeni_secenekler,
         (array_position(array_agg(s.idx order by s.rnd), q.dogru_cevap::int) - 1)::smallint as yeni_dogru
  from public.questions q
  cross join lateral (
    select value, (ordinality - 1)::int as idx, random() as rnd
    from jsonb_array_elements(q.secenekler) with ordinality
  ) s
  where q.created_at >= transaction_timestamp()
  group by q.id, q.dogru_cevap
)
update public.questions q
   set secenekler = k.yeni_secenekler,
       dogru_cevap = k.yeni_dogru
  from karisik k
 where q.id = k.id;
