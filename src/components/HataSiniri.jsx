import { Component } from "react";
import { hataBildir } from "../lib/hataIzleme.js";
import { tt } from "../../bildim/lib/dil.js";

/**
 * Uygulama genelinde hata sınırı.
 *
 * Neden: React'te render sırasında atılan bir hata, sınır yoksa TÜM ağacı
 * söker — kullanıcı beyaz ekranla kalır ve ne olduğunu anlamaz. Yayın öncesi
 * denetimde projede hiç hata sınırı olmadığı görüldü.
 *
 * Burada hata yutulmuyor: konsola basılıyor (Vercel/tarayıcı günlüğünde
 * görünsün diye) ve kullanıcıya Türkçe, eyleme dönük bir ekran gösteriliyor.
 */
export default class HataSiniri extends Component {
  constructor(props) {
    super(props);
    this.state = { hata: null };
  }

  static getDerivedStateFromError(hata) {
    return { hata };
  }

  componentDidCatch(hata, bilgi) {
    // eslint-disable-next-line no-console
    console.error("[Uygulama hatası]", hata, bilgi?.componentStack);
    // Sentry kuruluysa raporla. Kurulu değilse (VITE_SENTRY_DSN boşsa) bu
    // çağrı sessizce hiçbir şey yapmaz — ekran ve davranış aynı kalır.
    hataBildir(hata, bilgi);
  }

  render() {
    if (!this.state.hata) return this.props.children;

    return (
      <div className="hata-siniri">
        <div className="hata-siniri-kart">
          <h1>{tt("Bir şeyler ters gitti")}</h1>
          <p>
            {tt("Beklenmedik bir hata oluştu. Sayfayı yenilemek çoğu zaman yeterli oluyor; sorun sürerse ana sayfaya dönebilirsin.")}
          </p>
          <div className="hata-siniri-butonlar">
            <button className="btn" onClick={() => window.location.reload()}>
              {tt("Sayfayı yenile")}
            </button>
            <button
              className="btn ikincil"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              {tt("Ana sayfa")}
            </button>
          </div>
          <details>
            <summary>{tt("Teknik ayrıntı")}</summary>
            <code>{String(this.state.hata?.message ?? this.state.hata)}</code>
          </details>
        </div>
      </div>
    );
  }
}
