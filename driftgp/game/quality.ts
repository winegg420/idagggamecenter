// Adaptif kalite: mobil cihazlarda performans için DPR/gölge/obje yoğunluğunu düşürür.
// Masaüstünde tam kalite. Tek yerden yönetilir; sahne ve çevre bunu okur.

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);

// düşük çekirdek sayısı = daha zayıf cihaz (ek güvenlik)
const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 8;
const lowEnd = isMobile && cores <= 4;

/**
 * YAZILIM RENDER TESPİTİ (kritik): Chrome'da donanım hızlandırma kapalıysa WebGL,
 * "Microsoft Basic Render Driver" / SwiftShader üzerinde CPU ile çizer → kare başına
 * SANİYELER ("inanılmaz kasma"nın kök nedeni; gerçek GPU/sürücü sağlam olsa bile).
 * Bu modda ultra-düşük kalite zorlanır + kullanıcıya kalıcı uyarı gösterilir
 * (asıl çözüm: Chrome → Ayarlar → Sistem → grafik hızlandırmayı aç).
 */
function detectSoftwareGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(
      ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    return /basic render|swiftshader|llvmpipe|software|mesa offscreen/i.test(r);
  } catch {
    return false;
  }
}
export const softwareGL = detectSoftwareGL();

export const QUALITY = {
  isMobile,
  lowEnd,
  /** WebGL yazılımda çalışıyor (donanım hızlandırma kapalı) — her şey minimuma iner */
  softwareGL,
  /** Canvas maksimum DPR (başlangıç) — gerçek çözünürlüğü AdaptiveQuality FPS'e göre ayarlar.
   *  Mobilde muhafazakâr başlanır (yüksek dpr bazı telefonlarda kasmanın ana kaynağı);
   *  güçlü cihazlarda AdaptiveQuality zaten tavana çıkarır. */
  dpr: softwareGL ? 0.6 : lowEnd ? 1.2 : isMobile ? 1.5 : 2.0,
  /** antialias — yalnızca çok zayıf cihazlarda kapalı (modern mobil GPU rahat kaldırır) */
  antialias: !lowEnd && !softwareGL,
  /** gölgeler tamamen kapalı mı — zayıf telefonda dinamik gölge en pahalı geçiş; araçların
   *  altındaki temas gölgesi (fake AO) kaldığı için görsel olarak kabul edilebilir */
  noShadows: softwareGL || lowEnd,
  /** gölge haritası çözünürlüğü */
  shadowMap: isMobile ? 1024 : 2048,
  /** pahalı malzemeler (clearcoat boya, Sky/Stars shader'ı, IBL env) kapatılsın mı —
   *  zayıf telefonlarda piksel başına maliyetin en büyük kalemleri */
  cheapMaterials: softwareGL || lowEnd,
  /** çevre objesi seyreltme çarpanı — scatter step'i bununla çarpılır (yüksek = az obje) */
  stepMul: softwareGL ? 3 : lowEnd ? 1.5 : isMobile ? 1.15 : 1,
  /** seyirci sırası sayısı çarpanı */
  crowdMul: softwareGL ? 3 : lowEnd ? 1.6 : isMobile ? 1.2 : 1,
};
