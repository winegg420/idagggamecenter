// Dikey tutulan telefonda yarışı kapatan uyarı katmanı.
// Görünürlük tamamen CSS media query ile (orientation: portrait) yönetilir.
export function RotateOverlay() {
  return (
    <div className="rotate-overlay">
      <div className="rotate-phone">📱</div>
      <p>Telefonu yan çevir!</p>
      <small>Yarış yatay ekranda oynanır 🏁</small>
    </div>
  );
}

/**
 * Yarışa girerken (kullanıcı dokunuşu bağlamında çağrılmalı) tam ekran +
 * yatay kilit dene. Desteklenmeyen tarayıcıda sessizce vazgeçer.
 */
export async function tryLandscapeFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    await orientation.lock?.('landscape');
  } catch {
    // iOS Safari vb. desteklemez — CSS uyarı katmanı devrede kalır
  }
}

/**
 * Yarış bitince ZORUNLU: yatay kilidi aç + tam ekrandan çık.
 * (Açılmazsa sonuç/menü ekranları yatay kilitli kalır ve kullanıcı çıkamaz.)
 */
export function releaseLandscapeFullscreen(): void {
  try {
    screen.orientation.unlock?.();
  } catch {
    // kilit yoksa sorun değil
  }
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
  } catch {
    // tam ekran değilse sorun değil
  }
}
