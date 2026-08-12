// ============================================================
// GÖLGE BOKS — profesyonel dövüşçü stil kütüphanesi
//
// AMAÇ: oyuncunun birikmiş stil verisini gerçek dövüşçülerin KAMUYA AÇIK,
// yaygın olarak bilinen dövüş tarzı özellikleriyle karşılaştırıp "stilin en çok
// X'e benziyor" sonucu üretmek.
//
// DÜRÜSTLÜK KURALI (kritik): burada yalnız STİL/KARAKTERİSTİK bilgisi vardır.
// Sahte alıntı, kurgu diyalog, uydurma biyografik iddia, rekor/istatistik
// yoktur ve ÜRETİLMEZ. Notlar, o dövüşçünün tarzına dair genel kabul görmüş
// tanımlardır; kişisel iddia içermez.
//
// VERİ BİÇİMİ (token/bundle ekonomisi için dizi):
//   [ad, spor, durus, gard, baski, cesitlilik, tempo, guc, kontra, hareket, kombinasyon, not]
//     spor  : "B" boks · "M" MMA/UFC · "K" kickboks/muaythai
//     durus : "O" ortodoks · "G" güney pençe (solak) · "D" değişken
//     ölçüler 0-100:
//       gard        yüksek/sıkı gard eğilimi (0 = eller aşağıda)
//       baski       öne baskı/agresiflik (0 = geri çekilip bekleyen)
//       cesitlilik  yumruk/vuruş çeşitliliği (0 = tek silah)
//       tempo       iş hacmi, dakikadaki vuruş yoğunluğu
//       guc         tek vuruşluk bitirici güç eğilimi
//       kontra      kontra-atak eğilimi (0 = hiç, 100 = kontra uzmanı)
//       hareket     kafa/ayak hareketi, açı değiştirme
//       kombinasyon seri/kombinasyon uzunluğu eğilimi
// ============================================================

const HAM = [
  // ---------------- BOKS ----------------
  ["Floyd Mayweather Jr.", "B", "O", 92, 30, 62, 45, 40, 96, 78, 55, "Omuz-rulo savunması ve zamanlamaya dayalı kontra boksun en bilinen örneği."],
  ["Manny Pacquiao", "B", "G", 45, 92, 78, 94, 82, 30, 88, 88, "Açılı giriş-çıkışlarla yüksek tempolu, çok yönlü solak baskı boksu."],
  ["Canelo Álvarez", "B", "O", 88, 70, 88, 62, 88, 82, 70, 82, "Yüksek gardla kayıp kontra atan, gövde vuruşu ağırlıklı kombinasyon boksu."],
  ["Gennadiy Golovkin", "B", "O", 78, 90, 72, 68, 94, 40, 45, 74, "Sabit ilerleyen ayak baskısı ve ağır jab ile alan daraltan güç boksu."],
  ["Tyson Fury", "B", "D", 55, 62, 80, 66, 66, 74, 84, 62, "Ağır sıklette olağandışı ayak/üst gövde hareketi ve duruş değiştirme."],
  ["Anthony Joshua", "B", "O", 78, 62, 66, 58, 90, 46, 44, 72, "Uzun jab ve düz sağ üzerine kurulu klasik ağır sıklet boksu."],
  ["Deontay Wilder", "B", "O", 40, 66, 30, 38, 99, 52, 40, 28, "Tek vuruşluk sağ el gücüne dayanan, ekonomik ve patlayıcı tarz."],
  ["Oleksandr Usyk", "B", "G", 70, 68, 86, 82, 52, 76, 92, 84, "Sürekli açı değiştiren, ayak hareketi ve ritim üstünlüğüyle çalışan solak."],
  ["Wladimir Klitschko", "B", "O", 88, 45, 48, 48, 88, 66, 40, 52, "Mesafeyi jab ve klinçle yöneten, disiplinli ağır sıklet boksu."],
  ["Vitali Klitschko", "B", "O", 74, 72, 44, 56, 88, 40, 30, 48, "Boy-erişim avantajını dik duruşla kullanan baskılı ağır sıklet."],
  ["Lennox Lewis", "B", "O", 76, 58, 62, 50, 92, 62, 46, 60, "Uzaktan jab kuran, tek sağ uppercut'la bitiren teknik ağır sıklet."],
  ["Evander Holyfield", "B", "O", 72, 84, 74, 76, 78, 52, 58, 80, "Kalp ve iş hacmiyle içeri giren, klinç içi kombinasyon üreten tarz."],
  ["Mike Tyson", "B", "O", 88, 96, 74, 78, 98, 48, 88, 84, "Peek-a-boo gardı, sürekli kafa hareketi ve içeri girip kanca üreten baskı."],
  ["Roy Jones Jr.", "B", "O", 25, 70, 88, 72, 86, 82, 94, 74, "Eller aşağıda, olağandışı refleks ve açılarla vuran atletik tarz."],
  ["Bernard Hopkins", "B", "O", 90, 40, 70, 40, 60, 92, 68, 52, "Mesafe ve ritmi bozan, uzun kariyerli savunma-zamanlama ustası."],
  ["Oscar De La Hoya", "B", "O", 70, 74, 82, 78, 78, 48, 62, 84, "Güçlü sol jab ve sol kanca ile kombinasyon üreten çok yönlü boksör."],
  ["Félix Trinidad", "B", "O", 66, 86, 70, 70, 92, 44, 44, 76, "Sol kanca ağırlıklı, ilerleyerek bitirmeye çalışan güç boksu."],
  ["Shane Mosley", "B", "O", 62, 78, 78, 84, 80, 50, 66, 86, "El hızı ve seri kombinasyonlarla baskı kuran hızlı boksör."],
  ["Erik Morales", "B", "O", 60, 82, 80, 82, 76, 46, 40, 84, "Dik duruşlu, uzun kombinasyonlarla savaşan klasik Meksika boksu."],
  ["Marco Antonio Barrera", "B", "O", 72, 74, 82, 76, 74, 62, 56, 82, "Sertlikten teknik boksa evrilen, gövde vuruşu güçlü tarz."],
  ["Juan Manuel Márquez", "B", "O", 82, 52, 84, 66, 80, 96, 62, 78, "Kontra zamanlamasının ders kitabı örneği; sayaç sağ el uzmanı."],
  ["Ricky Hatton", "B", "O", 58, 94, 62, 86, 74, 30, 52, 74, "Sürekli baskı, gövde vuruşu ve içeri girme üzerine kurulu tarz."],
  ["Miguel Cotto", "B", "O", 76, 78, 80, 74, 82, 56, 60, 86, "Sol kanca ve gövde işiyle ilerleyen disiplinli baskı boksu."],
  ["Kostya Tszyu", "B", "O", 74, 76, 72, 66, 90, 60, 46, 72, "Kısa, sert sağ el ve zamanlamayla bitirici Doğu Avrupa okulu."],
  ["Arturo Gatti", "B", "O", 45, 88, 66, 84, 78, 34, 40, 76, "Karşılıklı bombardımanı seçen, dayanıklılığıyla bilinen savaşçı tarz."],
  ["Micky Ward", "B", "O", 55, 86, 58, 76, 74, 38, 34, 66, "Gövdeye sol kroşesiyle tanınan, temposu bozulmayan içeri boksu."],
  ["Diego Corrales", "B", "O", 50, 84, 66, 76, 86, 40, 38, 72, "Uzun boy avantajını kullanmak yerine karşılıklı vuruşmayı seçen tarz."],
  ["José Luis Castillo", "B", "O", 70, 86, 70, 76, 78, 44, 40, 78, "Gövdeye sürekli baskı yapan Meksika tarzı içeri boksu."],
  ["Israel Vázquez", "B", "O", 68, 88, 70, 82, 82, 40, 42, 80, "Yıpratıcı tempo ve gövde işiyle ilerleyen agresif boksör."],
  ["Rafael Márquez", "B", "O", 74, 74, 76, 72, 82, 60, 50, 78, "Teknik temeli güçlü, sert vuran kontra-baskı karışımı."],
  ["Nonito Donaire", "B", "O", 62, 66, 76, 62, 92, 74, 60, 70, "Sol kancasıyla tanınan, kontra zamanlamalı patlayıcı tarz."],
  ["Guillermo Rigondeaux", "B", "G", 88, 22, 60, 34, 74, 96, 78, 48, "Aşırı savunmacı, tek atışlık kontra üzerine kurulu solak amatör okulu."],
  ["Vasiliy Lomachenko", "B", "G", 74, 66, 92, 82, 58, 82, 96, 92, "Sürekli açı değiştirip rakibin kör noktasına geçen ayak işi ustası."],
  ["Terence Crawford", "B", "D", 76, 74, 90, 74, 86, 84, 78, 86, "Duruş değiştirerek ritim bozan, maç içinde uyum sağlayan tarz."],
  ["Errol Spence Jr.", "B", "G", 78, 84, 78, 80, 80, 52, 50, 84, "Gövde vuruşu ağırlıklı, sabit baskı kuran solak boksör."],
  ["Keith Thurman", "B", "O", 70, 70, 74, 66, 82, 62, 62, 74, "Hız ve güç dengesi kuran, kontra da atabilen çok yönlü tarz."],
  ["Danny García", "B", "O", 72, 58, 70, 58, 84, 78, 52, 70, "Sol kanca kontrasıyla bilinen sabırlı sayaç boksu."],
  ["Shawn Porter", "B", "O", 66, 92, 68, 88, 62, 36, 58, 76, "Klinçe kadar giren, yüksek iş hacimli fiziksel baskı."],
  ["Adrien Broner", "B", "O", 86, 46, 62, 48, 70, 84, 56, 60, "Omuz-rulo savunmasına dayanan düşük hacimli kontra tarzı."],
  ["Andre Ward", "B", "O", 84, 60, 82, 62, 62, 86, 70, 74, "İç mesafede ustaca çalışan, akıllı ve uyum sağlayan teknik boksör."],
  ["Sergey Kovalev", "B", "O", 74, 82, 66, 66, 92, 46, 42, 70, "Ağır jab ve düz sağ ile alan daraltan güç boksu."],
  ["Artur Beterbiev", "B", "O", 80, 94, 66, 66, 98, 36, 34, 72, "Durmadan ilerleyen, her vuruşu ağır basınç boksu."],
  ["Dmitry Bivol", "B", "O", 86, 56, 78, 74, 66, 82, 66, 78, "Ölçülü jab ve disiplinli savunmayla puan toplayan teknik tarz."],
  ["Carl Froch", "B", "O", 52, 80, 64, 66, 82, 44, 36, 64, "Alışılmadık açılardan vuran, dayanıklılığa yaslanan tarz."],
  ["Joe Calzaghe", "B", "G", 58, 88, 72, 96, 52, 40, 62, 88, "Olağanüstü el hızı ve iş hacmiyle rakibi boğan solak."],
  ["Timothy Bradley", "B", "O", 68, 84, 66, 82, 58, 48, 58, 74, "Fiziksel baskı ve yüksek hacimle çalışan atletik boksör."],
  ["Ruslan Provodnikov", "B", "O", 56, 92, 58, 76, 86, 32, 34, 68, "Baskıyı hiç kesmeyen, gövdeyi hedef alan savaşçı tarz."],
  ["Lucas Matthysse", "B", "O", 64, 84, 62, 66, 92, 42, 38, 68, "Kısa mesafede tek vuruşla bitirebilen sert vurucu."],
  ["Amir Khan", "B", "O", 52, 76, 74, 86, 76, 40, 62, 82, "Aşırı el hızıyla seri üreten, mesafe yönetimi riskli tarz."],
  ["Kell Brook", "B", "O", 72, 66, 78, 68, 78, 66, 58, 78, "Teknik olarak düzgün, uppercut ve kancayla iş bitiren boksör."],
  ["Naoya Inoue", "B", "O", 80, 84, 88, 74, 96, 74, 66, 86, "Gövde vuruşuyla bitiren, teknik ve gücü birleştiren modern tarz."],
  ["Juan Francisco Estrada", "B", "O", 76, 72, 84, 78, 74, 72, 62, 84, "Zamanlama ve kombinasyon zenginliğiyle çalışan küçük sıklet ustası."],
  ["Román González", "B", "O", 70, 90, 88, 92, 76, 44, 56, 92, "Sürekli kombinasyon üreten, gövde-kafa geçişi mükemmel baskı boksu."],
  ["Jorge Linares", "B", "O", 66, 62, 80, 70, 74, 68, 66, 80, "Teknik ve zarif kombinasyon boksu; savunması risk alabilen tarz."],
  ["Devin Haney", "B", "O", 82, 48, 74, 64, 56, 84, 70, 70, "Uzun jab ve mesafe kontrolüyle puan toplayan disiplinli tarz."],
  ["Gervonta Davis", "B", "G", 78, 70, 76, 56, 96, 82, 66, 72, "Sabırla bekleyip tek sol el patlamasıyla bitiren solak."],
  ["Ryan García", "B", "O", 58, 68, 66, 66, 90, 60, 58, 70, "Sol kancasıyla tanınan, hız odaklı atletik tarz."],
  ["Shakur Stevenson", "B", "G", 88, 40, 76, 58, 48, 92, 82, 68, "Vurulmama üzerine kurulu, savunma odaklı solak teknik boksu."],
  ["Teófimo López", "B", "O", 62, 70, 72, 60, 88, 74, 60, 70, "Patlayıcı tek atışlar ve kontra zamanlaması karışımı."],
  ["Josh Taylor", "B", "G", 66, 78, 76, 74, 78, 58, 58, 78, "Sert ve fiziksel, iç mesafede de çalışabilen solak."],
  ["Jermell Charlo", "B", "O", 74, 66, 72, 62, 88, 70, 54, 72, "Sabırlı kurulum sonrası tek sert vuruşla bitiren tarz."],
  ["Sergio Martínez", "B", "G", 30, 74, 76, 70, 82, 76, 92, 72, "Eller aşağıda, olağandışı mesafe ve hızla vuran solak."],
  ["Winky Wright", "B", "O", 96, 50, 58, 68, 46, 78, 48, 62, "Yüksek çift gardıyla tanınan, jab üzerine kurulu savunma boksu."],
  ["Julio César Chávez", "B", "O", 76, 92, 78, 78, 84, 50, 44, 84, "Gövde vuruşlarıyla yıpratan, yürüyerek baskı kuran efsanevi tarz."],
  ["Marcos Maidana", "B", "O", 50, 90, 56, 74, 90, 30, 32, 66, "Ham güç ve kesintisiz baskıya dayanan sert vurucu."],
  ["Zab Judah", "B", "G", 48, 72, 72, 74, 84, 58, 74, 74, "Aşırı hızlı solak; erken raundlarda patlayıcı tarz."],
  ["David Haye", "B", "O", 52, 68, 62, 58, 90, 62, 66, 60, "Hız ve patlayıcılığı ağır siklete taşıyan atletik tarz."],
  ["Dillian Whyte", "B", "O", 64, 80, 62, 64, 86, 42, 40, 66, "Fiziksel baskı ve sol kancayla çalışan ağır sıklet."],
  ["Andy Ruiz Jr.", "B", "O", 70, 72, 78, 78, 84, 58, 56, 84, "Ağır sıklette olağandışı el hızı ve seri kombinasyon üretimi."],
  ["Joseph Parker", "B", "O", 70, 62, 70, 66, 74, 60, 62, 72, "Hareketli ayak işi ve tempo dengesiyle çalışan ağır sıklet."],
  ["Daniel Dubois", "B", "O", 66, 78, 58, 58, 92, 44, 40, 62, "Ağır jab ve sağ el gücüne yaslanan tarz."],
  ["Zhilei Zhang", "B", "G", 60, 60, 54, 42, 96, 66, 34, 52, "Tek sol el gücüyle bitirici, ekonomik solak ağır sıklet."],
  ["Naseem Hamed", "B", "G", 20, 76, 78, 58, 94, 70, 96, 62, "Eller aşağıda, tahmin edilemez açılardan vuran gösterişli solak."],
  ["Carl Frampton", "B", "O", 72, 70, 76, 74, 70, 62, 56, 80, "Zamanlaması iyi, kombinasyon üreten teknik boksör."],
  ["Leo Santa Cruz", "B", "O", 60, 88, 74, 94, 54, 34, 44, 88, "Çok yüksek iş hacmiyle rakibi boğan tempo boksu."],
  ["Mikey García", "B", "O", 80, 62, 82, 64, 82, 78, 52, 78, "Ders kitabı tekniği; sabırlı kurulum ve sert bitiriş."],
  ["Chad Dawson", "B", "G", 70, 54, 72, 66, 66, 72, 70, 72, "Hızlı eller ve mesafe yönetimiyle çalışan solak."],
  ["Antonio Tarver", "B", "G", 66, 58, 66, 56, 84, 78, 56, 62, "Tek sol el kontrasıyla tanınan uzun menzilli solak."],
  ["Jean Pascal", "B", "O", 54, 74, 66, 62, 78, 52, 66, 64, "Atletik patlamalar ve alışılmadık ritim değişimleri."],
  ["Adonis Stevenson", "B", "G", 58, 70, 54, 52, 94, 66, 44, 56, "Tek sol el gücüne dayalı solak bitirici."],
  ["George Groves", "B", "O", 72, 64, 72, 64, 80, 66, 52, 72, "Uzun jab ve sert sağ el; teknik disiplinli tarz."],
  ["James DeGale", "B", "G", 62, 62, 74, 68, 70, 70, 70, 74, "Alışılmadık açılarla vuran hareketli solak."],
  ["Chris Eubank Jr.", "B", "O", 56, 84, 66, 84, 74, 40, 52, 74, "Yüksek tempo ve fiziksel dayanıklılıkla baskı kuran tarz."],
  ["Billy Joe Saunders", "B", "G", 72, 46, 74, 62, 52, 84, 78, 70, "Mesafe ve ayak işiyle vurdurmayan solak teknik boksör."],
  ["Caleb Plant", "B", "O", 80, 52, 76, 66, 58, 78, 72, 74, "Uzun jab ve ayak hareketiyle puan toplayan teknik tarz."],
  ["David Benavidez", "B", "O", 70, 92, 78, 88, 84, 38, 40, 86, "Kesintisiz baskı ve yüksek hacimli kombinasyon üretimi."],
  ["Jaime Munguía", "B", "O", 60, 88, 72, 82, 84, 34, 36, 80, "Sürekli ilerleyen, gövde-kafa kombinasyonlu Meksika baskısı."],
  ["Sebastian Fundora", "B", "D", 50, 78, 68, 76, 74, 40, 38, 74, "Olağandışı boy avantajıyla içeri girip kısa mesafede çalışan tarz."],
  ["Tim Tszyu", "B", "O", 72, 82, 74, 78, 78, 46, 44, 80, "Gövde vuruşu ağırlıklı, sabit ilerleyen baskı boksu."],
  ["Vergil Ortiz Jr.", "B", "O", 66, 92, 74, 84, 90, 36, 40, 84, "Durmayan baskı ve gövdeye ağır vuruşlarla bitirme eğilimi."],
  ["Jaron Ennis", "B", "D", 68, 74, 86, 74, 88, 70, 70, 84, "Duruş değiştirebilen, hem güçlü hem teknik çok yönlü tarz."],
  ["Emanuel Navarrete", "B", "O", 44, 86, 76, 84, 84, 36, 46, 78, "Alışılmadık geniş açılı vuruşlar ve yüksek hacim."],
  ["Stephen Fulton", "B", "O", 76, 56, 78, 70, 56, 78, 68, 76, "Ritim bozan jab ve akıllı mesafe yönetimi."],
  ["Kazuto Ioka", "B", "O", 74, 68, 80, 74, 66, 74, 62, 80, "Gövde vuruşu ve zamanlama üzerine kurulu teknik küçük sıklet."],
  ["Katie Taylor", "B", "O", 62, 82, 78, 88, 60, 56, 74, 84, "Yüksek tempolu, ayak hareketi güçlü amatör kökenli tarz."],
  ["Claressa Shields", "B", "O", 74, 80, 80, 82, 70, 60, 60, 84, "Teknik temeli güçlü, baskı kurup kombinasyon üreten tarz."],
  ["Amanda Serrano", "B", "O", 62, 90, 82, 90, 84, 38, 44, 88, "Çok sıklette dövüşmüş, yüksek hacimli agresif tarz."],
  ["Cecilia Brækhus", "B", "O", 76, 62, 76, 70, 62, 72, 62, 76, "Disiplinli jab ve savunma dengesiyle çalışan teknik boksör."],
  ["Savannah Marshall", "B", "O", 66, 74, 66, 62, 88, 54, 44, 68, "Uzun menzilden sert vuran güç odaklı tarz."],
  ["Alycia Baumgardner", "B", "O", 64, 74, 70, 70, 82, 60, 56, 74, "Hızlı eller ve sert sağ el ile bitirme eğilimi."],
  ["Seniesa Estrada", "B", "O", 68, 84, 76, 86, 66, 48, 58, 84, "Yüksek hacimli, sürekli ilerleyen küçük sıklet baskısı."],
  ["Regis Prograis", "B", "G", 64, 80, 76, 78, 82, 52, 56, 82, "Baskılı solak; gövde ve kanca kombinasyonlarıyla çalışan tarz."],
  ["Demetrius Andrade", "B", "G", 74, 52, 76, 68, 58, 80, 76, 74, "Hareketli, vurdurmayan solak teknik boksör."],
  ["Daniel Jacobs", "B", "D", 70, 62, 78, 64, 78, 68, 66, 76, "Atletik, duruş değiştirebilen çok yönlü orta sıklet."],
  ["Kelly Pavlik", "B", "O", 62, 80, 66, 66, 88, 44, 38, 70, "Uzun boy ve sert sağ el ile ilerleyen tarz."],
  ["Paulie Malignaggi", "B", "O", 74, 50, 68, 78, 26, 66, 74, 70, "Hız ve jab üzerine kurulu, güç yerine teknikle çalışan tarz."],
  ["Chris Byrd", "B", "G", 78, 40, 62, 58, 34, 88, 82, 58, "Vurdurmama ve kontra üzerine kurulu savunmacı solak."],
  ["Brandon Ríos", "B", "O", 48, 92, 58, 80, 78, 30, 30, 70, "Karşılıklı vuruşmayı seçen yüksek dayanıklılıklı baskı."],
  ["Abner Mares", "B", "O", 60, 84, 74, 82, 66, 44, 48, 80, "İç mesafede çalışan, yüksek hacimli agresif tarz."],
  ["Robert Guerrero", "B", "G", 62, 78, 70, 76, 62, 48, 46, 76, "Fiziksel baskı kuran, iç mesafeyi seven solak."],
  ["Yuriorkis Gamboa", "B", "O", 44, 76, 72, 68, 84, 62, 84, 70, "Patlayıcı giriş-çıkışlar ve olağandışı atletizm."],
  ["Badou Jack", "B", "O", 76, 70, 72, 72, 66, 62, 50, 74, "Sabırlı baskı ve düzgün temel teknikle çalışan tarz."],
  ["Gilberto Ramírez", "B", "G", 70, 76, 74, 78, 74, 50, 46, 80, "Yüksek hacimli solak baskı boksu."],
  ["Murodjon Akhmadaliev", "B", "G", 72, 82, 74, 76, 80, 52, 48, 80, "Amatör kökenli, gövdeye baskı kuran sert solak."],
  ["Brandon Figueroa", "B", "O", 54, 94, 70, 92, 60, 30, 36, 84, "Aşırı yüksek hacimli, klinçe kadar giren baskı."],
  ["Rey Vargas", "B", "O", 66, 58, 74, 66, 58, 72, 70, 72, "Uzun erişim ve jab ile mesafe koruyan teknik tarz."],
  ["Luis Nery", "B", "G", 52, 84, 66, 76, 88, 42, 46, 74, "Agresif solak; sert sol el ile bitirme eğilimi."],
  ["Andre Berto", "B", "O", 62, 74, 70, 70, 80, 52, 60, 74, "Atletik, hızlı ve sert vuran; savunması risk alan tarz."],
  ["Sergiy Derevyanchenko", "B", "O", 72, 86, 70, 82, 66, 42, 40, 78, "Durmadan ilerleyen, gövde ağırlıklı yıpratma boksu."],
  ["Callum Smith", "B", "O", 72, 66, 70, 60, 84, 58, 46, 70, "Uzun menzil ve ağır sağ el üzerine kurulu tarz."],
  ["Ricardo Mayorga", "B", "O", 26, 88, 52, 70, 84, 28, 40, 56, "Eller aşağıda, tahmin edilemez ve agresif tarz."],
  ["Antonio Margarito", "B", "O", 58, 94, 62, 82, 78, 28, 26, 72, "Yürüyerek gelen, vuruş alarak ilerleyen baskı boksu."],

  // ---------------- MMA / UFC ----------------
  ["Conor McGregor", "M", "G", 40, 74, 70, 58, 94, 84, 74, 58, "Uzun mesafeden tek sol el zamanlamasına dayanan solak vuruşçu."],
  ["Khabib Nurmagomedov", "M", "O", 60, 92, 46, 70, 50, 40, 56, 50, "Güreş baskısı ve kesintisiz yüklenme üzerine kurulu tarz."],
  ["Georges St-Pierre", "M", "O", 78, 72, 88, 74, 58, 66, 76, 76, "Jab ve mesafe kontrolüyle çalışan, çok yönlü ve disiplinli tarz."],
  ["Anderson Silva", "M", "D", 34, 62, 92, 60, 90, 94, 90, 72, "Eller aşağıda, olağandışı zamanlama ve kontra hassasiyeti."],
  ["Jon Jones", "M", "D", 60, 76, 94, 68, 80, 72, 78, 70, "Olağandışı erişim ve alışılmadık silah çeşitliliği."],
  ["Daniel Cormier", "M", "O", 72, 84, 68, 74, 74, 46, 48, 70, "Güreş temelli, iç mesafede baskı kuran tarz."],
  ["Stipe Miocic", "M", "O", 70, 72, 74, 72, 82, 56, 54, 74, "Boks temelli kombinasyonlar ve tempo yönetimi."],
  ["Francis Ngannou", "M", "O", 56, 74, 44, 42, 99, 50, 40, 40, "Tek vuruşluk olağanüstü güç eğilimi."],
  ["Cain Velasquez", "M", "O", 62, 94, 66, 92, 66, 34, 52, 74, "Aşırı yüksek tempolu güreş-boks baskısı."],
  ["Junior dos Santos", "M", "O", 62, 74, 70, 62, 90, 58, 60, 72, "Boks temelli, uppercut ve overhand ile bitiren tarz."],
  ["Alistair Overeem", "M", "O", 64, 68, 78, 56, 88, 60, 44, 66, "Kickboks kökenli, diz ve klinç işiyle bitiren tarz."],
  ["Chuck Liddell", "M", "O", 34, 78, 58, 58, 90, 72, 56, 50, "Sprawl-and-brawl; geniş açılı overhand sağ ile bitirme."],
  ["Lyoto Machida", "M", "G", 62, 40, 78, 44, 84, 96, 88, 56, "Karate temelli mesafe ve kontra zamanlaması."],
  ["Mauricio Rua", "M", "O", 52, 86, 74, 78, 82, 40, 44, 76, "Muaythai kökenli, agresif ve yüksek hacimli tarz."],
  ["Wanderlei Silva", "M", "O", 40, 96, 62, 84, 90, 26, 40, 70, "Durmadan ilerleyen, klinçte diz ve kanca yağdıran tarz."],
  ["Vitor Belfort", "M", "O", 48, 82, 62, 76, 92, 46, 56, 74, "Patlayıcı el hızıyla erken bitirmeye yönelen tarz."],
  ["Michael Bisping", "M", "O", 68, 82, 74, 88, 52, 44, 58, 80, "Yüksek hacimli boks ve durmayan tempo."],
  ["Luke Rockhold", "M", "G", 60, 74, 74, 70, 78, 50, 52, 70, "Solak duruş ve tekme çeşitliliğiyle çalışan tarz."],
  ["Yoel Romero", "M", "O", 66, 44, 66, 36, 96, 88, 74, 52, "Uzun bekleme ve patlayıcı tek atış üzerine kurulu tarz."],
  ["Robert Whittaker", "M", "O", 70, 78, 80, 78, 78, 66, 72, 80, "Hızlı giriş-çıkış ve kombinasyon üretimi."],
  ["Israel Adesanya", "M", "D", 56, 48, 88, 56, 84, 90, 86, 66, "Kickboks kökenli mesafe ustalığı ve kontra zamanlaması."],
  ["Alex Pereira", "M", "O", 62, 74, 72, 52, 98, 74, 56, 58, "Sol kancasıyla tanınan, tek vuruşta bitirebilen kickboks kökeni."],
  ["Sean Strickland", "M", "O", 84, 76, 64, 84, 46, 60, 40, 70, "Philly-shell benzeri yüksek gard ve durmayan jab temposu."],
  ["Dricus du Plessis", "M", "D", 48, 88, 74, 82, 78, 36, 50, 74, "Alışılmadık ritimli, durmadan baskı kuran tarz."],
  ["Paulo Costa", "M", "O", 58, 90, 62, 80, 84, 32, 38, 72, "Sürekli ilerleyen, gövde vuruşu ağırlıklı baskı."],
  ["Jorge Masvidal", "M", "O", 64, 66, 78, 62, 84, 74, 66, 70, "Sokak dövüşü kökenli, zamanlaması iyi çok yönlü vuruşçu."],
  ["Nate Diaz", "M", "O", 54, 78, 72, 88, 52, 50, 54, 82, "Yüksek hacimli boks ve dayanıklılık üzerine kurulu tarz."],
  ["Nick Diaz", "M", "O", 50, 86, 70, 94, 46, 44, 44, 86, "Aşırı yüksek hacimli, yaklaşarak yıpratan boks tarzı."],
  ["Kamaru Usman", "M", "O", 74, 86, 70, 78, 70, 44, 48, 74, "Güreş baskısı üstüne kurulu, jab ile ilerleyen tarz."],
  ["Colby Covington", "M", "O", 66, 94, 60, 92, 40, 34, 50, 72, "Aşırı yüksek tempolu baskı ve güreş yüklemesi."],
  ["Leon Edwards", "M", "G", 72, 56, 80, 62, 74, 82, 70, 70, "Solak duruş, uzun mesafeden zamanlamalı vuruş."],
  ["Belal Muhammad", "M", "O", 70, 88, 66, 86, 40, 42, 56, 74, "Kesintisiz tempo ve baskıyla ritim bozan tarz."],
  ["Gilbert Burns", "M", "O", 64, 76, 72, 70, 82, 52, 54, 76, "Boks kombinasyonları ve patlayıcı giriş."],
  ["Stephen Thompson", "M", "D", 54, 40, 84, 52, 76, 92, 94, 60, "Karate kökenli, uzun mesafe ve olağandışı açılar."],
  ["Robbie Lawler", "M", "G", 56, 82, 66, 68, 92, 56, 46, 70, "Solak güç vuruşçusu; karşılıklı vuruşmayı seçen tarz."],
  ["Carlos Condit", "M", "O", 52, 88, 82, 86, 70, 40, 54, 80, "Yüksek hacimli, çeşitliliği bol agresif tarz."],
  ["Rory MacDonald", "M", "O", 74, 70, 78, 70, 66, 66, 58, 74, "Soğukkanlı, mesafe yöneten teknik tarz."],
  ["Tyron Woodley", "M", "O", 70, 40, 56, 34, 94, 90, 56, 46, "Bekleyip tek patlayıcı sağ el ile bitiren tarz."],
  ["Dustin Poirier", "M", "O", 64, 84, 78, 82, 86, 46, 50, 84, "Boks kombinasyonları ve gövde vuruşuyla baskı."],
  ["Justin Gaethje", "M", "O", 42, 94, 66, 84, 94, 34, 34, 72, "Karşılıklı vuruşmayı seçen, bacak tekmesi ağırlıklı baskı."],
  ["Charles Oliveira", "M", "O", 56, 82, 80, 78, 80, 46, 52, 80, "Uzun kombinasyonlar ve diz-dirsek çeşitliliği."],
  ["Islam Makhachev", "M", "G", 68, 80, 70, 70, 62, 56, 56, 66, "Güreş baskısı ve sabırlı kurulum."],
  ["Michael Chandler", "M", "O", 56, 88, 64, 76, 90, 42, 56, 72, "Patlayıcı, atletik ve agresif tarz."],
  ["Tony Ferguson", "M", "O", 40, 90, 82, 90, 66, 42, 62, 84, "Alışılmadık açılar ve durmayan tempo."],
  ["Rafael dos Anjos", "M", "G", 66, 84, 74, 82, 70, 44, 48, 78, "Baskılı solak; bacak tekmesi ve boks karışımı."],
  ["Anthony Pettis", "M", "O", 50, 62, 84, 58, 84, 68, 82, 66, "Gösterişli tekme çeşitliliği ve atletizm."],
  ["Frankie Edgar", "M", "O", 62, 84, 70, 86, 46, 52, 88, 78, "Sürekli hareket eden, giriş-çıkış temposu yüksek tarz."],
  ["Max Holloway", "M", "O", 62, 90, 84, 96, 62, 48, 58, 92, "Olağanüstü iş hacmi ve uzun kombinasyon zincirleri."],
  ["Alexander Volkanovski", "M", "O", 72, 84, 82, 84, 70, 56, 66, 84, "Kısa boy dezavantajını açı ve tempoyla kapatan tarz."],
  ["Brian Ortega", "M", "O", 58, 74, 74, 70, 76, 58, 48, 76, "Uppercut ağırlıklı, dayanıklılığa yaslanan tarz."],
  ["Yair Rodríguez", "M", "D", 46, 70, 88, 68, 78, 62, 84, 70, "Alışılmadık, tahmin edilemez vuruş çeşitliliği."],
  ["José Aldo", "M", "O", 70, 62, 82, 62, 84, 78, 70, 74, "Bacak tekmesi ve kontra boks zamanlaması."],
  ["Petr Yan", "M", "O", 74, 78, 84, 82, 72, 62, 62, 84, "Boks temelli, gövdeye yüklenen teknik baskı."],
  ["Aljamain Sterling", "M", "O", 60, 74, 76, 74, 52, 54, 72, 72, "Uzun erişim ve güreş baskısını birleştiren tarz."],
  ["Sean O'Malley", "M", "D", 46, 58, 82, 62, 84, 78, 84, 68, "Uzun erişimli, mesafeden zamanlamalı vuruşlar."],
  ["Merab Dvalishvili", "M", "O", 62, 96, 62, 96, 40, 30, 66, 74, "Aşırı yüksek tempolu, durmayan güreş baskısı."],
  ["Dominick Cruz", "M", "D", 56, 62, 78, 74, 44, 70, 96, 70, "Olağandışı ayak hareketi ve duruş değiştirme."],
  ["Henry Cejudo", "M", "O", 70, 82, 76, 78, 64, 56, 74, 78, "Olimpik güreş temelli, açı üreten baskı."],
  ["Demetrious Johnson", "M", "O", 66, 74, 88, 82, 52, 62, 88, 82, "Hız, çeşitlilik ve akıcı geçişlerle çalışan tarz."],
  ["Brandon Moreno", "M", "O", 64, 80, 78, 80, 66, 54, 62, 80, "Baskılı ama soğukkanlı, kombinasyon üreten tarz."],
  ["Alexandre Pantoja", "M", "O", 62, 84, 72, 82, 62, 46, 58, 76, "Yüksek tempolu baskı ve sürekli pozisyon arayışı."],
  ["Ciryl Gane", "M", "O", 58, 46, 82, 62, 70, 78, 88, 68, "Ağır sıklette olağandışı ayak hareketi ve mesafe oyunu."],
  ["Tom Aspinall", "M", "O", 66, 78, 74, 72, 90, 54, 62, 72, "Ağır sıklette yüksek el hızı ve patlayıcı bitiriş."],
  ["Derrick Lewis", "M", "O", 50, 56, 44, 34, 98, 62, 30, 36, "Düşük hacim, tek vuruşluk olağanüstü güç."],
  ["Jiří Procházka", "M", "D", 26, 92, 78, 82, 90, 40, 66, 70, "Eller aşağıda, tahmin edilemez ve kaotik baskı."],
  ["Jan Błachowicz", "M", "O", 68, 66, 70, 62, 86, 62, 46, 68, "Sabırlı kurulum ve ağır sol el."],
  ["Glover Teixeira", "M", "O", 62, 80, 66, 70, 80, 44, 42, 72, "Boks baskısı ve klinç işini birleştiren tarz."],
  ["Magomed Ankalaev", "M", "O", 74, 66, 72, 66, 78, 66, 52, 70, "Disiplinli savunma ve ölçülü baskı."],
  ["Alexander Gustafsson", "M", "O", 66, 62, 76, 70, 70, 62, 74, 74, "Uzun jab ve mesafe yönetimi."],
  ["Amanda Nunes", "M", "O", 66, 84, 78, 74, 92, 54, 52, 78, "Patlayıcı el gücü ve erken baskı."],
  ["Valentina Shevchenko", "M", "O", 74, 58, 86, 66, 74, 88, 74, 76, "Muaythai kökenli kontra zamanlaması ve mesafe kontrolü."],
  ["Rose Namajunas", "M", "O", 68, 66, 78, 70, 72, 72, 76, 74, "Zamanlama ve ayak işiyle çalışan teknik tarz."],
  ["Joanna Jędrzejczyk", "M", "O", 70, 88, 80, 92, 52, 46, 62, 86, "Muaythai kökenli, çok yüksek hacimli baskı."],
  ["Zhang Weili", "M", "O", 68, 84, 80, 84, 76, 50, 62, 82, "Fiziksel patlayıcılık ve yüksek tempolu kombinasyonlar."],
  ["Holly Holm", "M", "G", 72, 44, 76, 58, 66, 88, 88, 62, "Boks kökenli, mesafeden kontra atan hareketli solak."],
  ["Cris Cyborg", "M", "O", 58, 92, 70, 84, 92, 32, 40, 80, "Durmadan ilerleyen, ağır elli baskı."],
  ["Alexa Grasso", "M", "O", 68, 70, 74, 76, 58, 66, 62, 78, "Boks temelli, temiz kombinasyon üreten tarz."],
  ["Ilia Topuria", "M", "O", 70, 86, 78, 78, 90, 56, 52, 82, "Boks temelli patlayıcı baskı ve sert eller."],
  ["Khamzat Chimaev", "M", "O", 60, 94, 62, 84, 74, 32, 46, 68, "Aralıksız güreş baskısı ve fiziksel yüklenme."],
  ["Shavkat Rakhmonov", "M", "O", 66, 82, 76, 74, 82, 50, 54, 78, "Her alanda bitirme arayan çok yönlü baskı."],
  ["Arman Tsarukyan", "M", "O", 68, 84, 74, 82, 70, 48, 58, 78, "Güreş ve boksu birleştiren yüksek tempolu tarz."],
  ["Chan Sung Jung", "M", "O", 50, 88, 74, 84, 78, 38, 44, 78, "Karşılıklı vuruşmayı seçen, dayanıklı ve agresif tarz."],
  ["Renan Barão", "M", "O", 66, 74, 76, 72, 74, 62, 56, 74, "Bacak tekmesi ve kontra zamanlaması."],
  ["Marlon Vera", "M", "O", 60, 76, 76, 72, 78, 58, 46, 76, "Geç raundlarda yüklenen, dirsek/diz çeşitliliği olan tarz."],
  ["Paddy Pimblett", "M", "O", 48, 78, 66, 74, 62, 44, 50, 70, "Ritim değiştiren, baskı kurup pozisyon arayan tarz."],
  ["Kevin Holland", "M", "D", 44, 70, 80, 74, 78, 62, 66, 72, "Uzun erişimli, alışılmadık ritimli vuruşçu."],
  ["Jared Cannonier", "M", "O", 68, 70, 70, 62, 90, 58, 52, 68, "Ağır bacak tekmesi ve patlayıcı el gücü."],
  ["Kelvin Gastelum", "M", "G", 60, 84, 68, 80, 78, 40, 46, 78, "Kısa boylu solak; içeri girip kombinasyon üreten tarz."],
  ["Darren Till", "M", "G", 68, 58, 74, 60, 78, 76, 62, 68, "Uzun erişimli solak; mesafeden zamanlamalı vuruş."],
  ["Marvin Vettori", "M", "G", 62, 86, 66, 86, 56, 38, 42, 76, "Durmadan ilerleyen yüksek hacimli solak baskı."],
  ["Chris Weidman", "M", "O", 66, 76, 72, 72, 70, 52, 50, 72, "Güreş temelli, boksla destekli baskı."],
  ["Rashad Evans", "M", "O", 62, 66, 70, 62, 82, 70, 66, 68, "Güreş temelli, patlayıcı overhand ile bitiren tarz."],
  ["Forrest Griffin", "M", "O", 54, 82, 68, 82, 56, 40, 46, 74, "Tempo ve dayanıklılıkla çalışan tarz."],
  ["Tito Ortiz", "M", "O", 58, 84, 56, 74, 62, 34, 42, 62, "Güreş baskısı ve üstten yüklenme."],
  ["Randy Couture", "M", "O", 66, 82, 62, 76, 54, 44, 46, 68, "Klinç güreşi ve dirty boxing üzerine kurulu tarz."],
  ["Fabrício Werdum", "M", "O", 60, 68, 70, 66, 66, 58, 46, 68, "Muaythai ve jiu-jitsu geçişlerini birleştiren tarz."],
  ["Andrei Arlovski", "M", "O", 62, 62, 66, 60, 84, 66, 58, 66, "Hızlı eller ve kontra eğilimi olan ağır sıklet."],
  ["Curtis Blaydes", "M", "O", 64, 84, 58, 78, 74, 38, 44, 64, "Güreş baskısı ağırlıklı ağır sıklet."],
  ["Sergei Pavlovich", "M", "O", 58, 88, 52, 74, 94, 34, 34, 62, "Kesintisiz el baskısı ve ağır vuruş."],
  ["Volkan Oezdemir", "M", "O", 66, 70, 60, 58, 90, 60, 46, 64, "Tek sert sağ el ile bitirme eğilimi."],
  ["Anthony Smith", "M", "O", 58, 74, 70, 68, 82, 48, 46, 70, "Uzun erişim ve bitirme arayışı."],

  // ---------------- KICKBOKS / MUAYTHAI ----------------
  ["Ramon Dekkers", "K", "O", 48, 94, 74, 86, 90, 30, 40, 80, "Muaythai'de Hollanda boksunu birleştiren efsanevi baskı tarzı."],
  ["Buakaw Banchamek", "K", "O", 62, 84, 80, 82, 82, 46, 52, 78, "Tekme ve diz ağırlıklı, sürekli baskı kuran muaythai tarzı."],
  ["Saenchai", "K", "D", 54, 66, 94, 74, 62, 78, 92, 76, "Olağandışı teknik çeşitliliği ve oyunbaz mesafe yönetimi."],
  ["Rico Verhoeven", "K", "O", 74, 72, 78, 74, 82, 60, 50, 78, "Uzun boy ve tempo yönetimiyle çalışan ağır sıklet kickboks."],
  ["Semmy Schilt", "K", "O", 70, 60, 66, 52, 92, 66, 36, 58, "Erişim ve ön diz ile mesafe kesen tarz."],
  ["Peter Aerts", "K", "O", 62, 82, 72, 72, 92, 42, 42, 74, "Yüksek tekme ve baskıyla bitiren klasik Hollanda okulu."],
  ["Ernesto Hoost", "K", "O", 76, 70, 82, 74, 82, 66, 50, 82, "Alçak tekme ve boks kombinasyonlarını birleştiren teknik tarz."],
  ["Badr Hari", "K", "O", 52, 84, 74, 66, 94, 58, 58, 72, "Patlayıcı el gücü ve agresif giriş."],
  ["Giorgio Petrosyan", "K", "D", 82, 46, 84, 66, 48, 94, 78, 74, "Vurulmadan kontra atan, teknik hassasiyetiyle bilinen tarz."],
  ["Andy Souwer", "K", "O", 66, 80, 78, 84, 66, 56, 62, 82, "Yüksek tempolu, çeşitliliği bol kickboks."],
  ["Masato", "K", "O", 60, 84, 74, 84, 74, 48, 54, 82, "Boks ağırlıklı, sürekli baskı kuran Japon kickboks tarzı."],
  ["Tenshin Nasukawa", "K", "O", 58, 74, 88, 78, 78, 78, 86, 82, "Hız ve zamanlamayı birleştiren teknik-atletik tarz."],
  ["Takeru Segawa", "K", "O", 60, 90, 80, 90, 74, 42, 58, 86, "Aşırı yüksek tempo ve kesintisiz kombinasyon."],
  ["Superbon Singha Mawynn", "K", "O", 66, 62, 84, 66, 84, 74, 66, 74, "Uzun mesafeden yüksek tekme zamanlaması."],
  ["Sitthichai Sitsongpeenong", "K", "O", 70, 76, 80, 80, 74, 62, 54, 80, "Dengeli, teknik ve dayanıklı muaythai tarzı."],
  ["Yodsanklai Fairtex", "K", "O", 64, 80, 76, 72, 92, 52, 46, 76, "Ağır sol el ve tekmeyle bitiren güç odaklı tarz."],
  ["Nieky Holzken", "K", "O", 68, 82, 74, 80, 82, 50, 46, 82, "Boks temelli, gövde ve kanca ağırlıklı Hollanda tarzı."],
  ["Gökhan Saki", "K", "O", 50, 88, 68, 76, 92, 44, 52, 74, "Patlayıcı el hızı ve agresif baskı."],
  ["Melvin Manhoef", "K", "O", 40, 94, 58, 74, 96, 30, 42, 66, "Aşırı agresif, tek vuruşluk güç odaklı tarz."],
  ["Artem Vakhitov", "K", "O", 72, 68, 76, 72, 74, 66, 52, 76, "Disiplinli, teknik ve ölçülü kickboks."],
  ["Alistair Overeem (K-1)", "K", "O", 62, 74, 74, 62, 90, 54, 44, 70, "Klinç dizi ve ağır el gücünü birleştiren tarz."],
  ["Mirko Cro Cop", "K", "G", 60, 62, 60, 54, 96, 70, 50, 56, "Sol yüksek tekme zamanlamasıyla tanınan solak."],
  ["Jérôme Le Banner", "K", "O", 54, 82, 66, 68, 96, 44, 40, 70, "Ağır sol el ve baskılı ilerleme."],
  ["Remy Bonjasky", "K", "O", 66, 66, 78, 66, 80, 62, 74, 72, "Uçan diz ve tekme çeşitliliğiyle bilinen atletik tarz."],
  ["Tyrone Spong", "K", "O", 62, 74, 76, 72, 84, 56, 56, 76, "Hız ve güç dengesi kuran modern kickboks."],
];

const SPOR_AD = { B: "Boks", M: "MMA / UFC", K: "Kickboks / Muaythai" };
const DURUS_AD = { O: "ortodoks", G: "güney pençe (solak)", D: "değişken duruş" };

/** Ham diziyi okunur objelere çevirir (bir kez, modül yüklenirken). */
export const DOVUSCULER = HAM.filter((d) => d.length >= 12 && typeof d[11] === "string").map((d) => ({
  ad: d[0],
  spor: d[1],
  sporAd: SPOR_AD[d[1]],
  durus: d[2],
  durusAd: DURUS_AD[d[2]],
  o: {
    gard: d[3],
    baski: d[4],
    cesitlilik: d[5],
    tempo: d[6],
    guc: d[7],
    kontra: d[8],
    hareket: d[9],
    kombinasyon: d[10],
  },
  not: d[11],
}));

// Eşleştirme ağırlıkları: gard ve baskı bir stilin en ayırt edici iki boyutudur;
// kamerada en güvenilir ölçülen büyüklükler de bunlardır.
const AGIRLIK = {
  gard: 1.35,
  baski: 1.25,
  cesitlilik: 1.15,
  tempo: 1.1,
  guc: 0.9,
  kontra: 0.85,
  hareket: 0.8,
  kombinasyon: 1.0,
};

/**
 * Oyuncu stil vektörüne en yakın dövüşçüleri döndürür.
 * @param {object} profil 0-100 arası 8 boyut (antrenorAnalizi.stilVektoru çıktısı)
 * @param {object} [secenek] { durus:'ortodoks'|'guney_pence', spor:'B'|'M'|'K'|null, adet:3 }
 */
export function enYakinDovuscular(profil, secenek = {}) {
  const adet = secenek.adet || 3;
  const istenenDurus = secenek.durus === "guney_pence" ? "G" : "O";
  const liste = [];
  for (const d of DOVUSCULER) {
    if (secenek.spor && d.spor !== secenek.spor) continue;
    let toplam = 0;
    let agirlikToplam = 0;
    for (const k in AGIRLIK) {
      const fark = (profil[k] == null ? 50 : profil[k]) - d.o[k];
      toplam += AGIRLIK[k] * fark * fark;
      agirlikToplam += AGIRLIK[k];
    }
    // Kök ortalama kare fark → 0-100 arası "uzaklık"
    let uzaklik = Math.sqrt(toplam / agirlikToplam);
    // Duruş uyumu belirgin bir benzerlik sinyalidir (solak boksörün ritmi farklıdır).
    if (d.durus === istenenDurus) uzaklik *= 0.86;
    else if (d.durus === "D") uzaklik *= 0.95;
    const benzerlik = Math.max(0, Math.min(100, Math.round(100 - uzaklik * 1.35)));
    liste.push({ ...d, uzaklik, benzerlik });
  }
  liste.sort((a, b) => a.uzaklik - b.uzaklik);
  return liste.slice(0, adet);
}

/** Kütüphane büyüklüğü (arayüzde "N dövüşçü ile karşılaştırıldı" bilgisi için). */
export const DOVUSCU_SAYISI = DOVUSCULER.length;
