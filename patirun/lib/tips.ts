// Yükleme ekranı ipuçları — tamamı özgün, mizahi.
export const LOADING_TIPS = [
  'İpucu: Kalkan, yıldırımı engeller. Gurur kırıklığını engellemez.',
  'İpucu: Slipstream gerçektir. Öndekinin rüzgarını çal, sonra teşekkür etme.',
  'İpucu: Engele çarpan tembel hayvan bile senden hızlı kalkıyor olabilir.',
  'İpucu: Altın skill o kadar nadir ki, gören oyuncular anı köşesi açıyor.',
  'İpucu: Zıplamak ücretsizdir. Düşmek de öyle.',
  'İpucu: Sonuncuysan üzülme — kutulardan daha iyi skill çıkıyor. Bu bir acıma değil, fizik.',
  'İpucu: Joystick\'i ne kadar sert bastırırsan karakter o kadar hızlı koşmaz. Denedik.',
  'İpucu: Pistte bazen parlayan yeşil bir şerit görürsen sağa yanaş. Sormadan yap.',
  'İpucu: Şef Ayı yarıştan sonra herkese mantı sözü verdi. Hâlâ bekliyoruz.',
  'İpucu: Rakibine kapan kurmak ayıp değil. Kurarken gülmek biraz ayıp.',
  'İpucu: Su dibindeki kutular meraklısını bekler. EĞİL\'e bas bas dal, ZIPLA\'ya bas bas yunus gibi fırla.',
  'İpucu: Yamaç seni durdurursa zıplamaya devam — yukarıda yepyeni bir yol var.',
  'İpucu: Checkpoint\'te sıranı görürsün. Beğenmezsen değiştirebilirsin, buna "yarış" denir.',
  'İpucu: Peruklu Aslan\'ın peruğu takma. Kimseye söyleme.',
  'İpucu: AFK kalırsan karakterin donar. 30 saniyede diskalifiye. Çay molasını podyumda ver.',
  'İpucu: Emlakçı Timsah\'a göre bu pist "yatırımlık". Dinlemeyin.',
];

export function randomTip(): string {
  return LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
}
