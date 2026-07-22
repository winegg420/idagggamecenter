// Krediler ekranı — kullanılan CC0 3D varlıkları için teşekkür (atıf zorunlu değil).
// Oynanışı engellemez; ana menüden küçük bir linkle erişilir.

import { useGameStore } from '../../store/gameStore';

interface Credit {
  role: string;
  author: string;
  url: string;
  license: string;
  note?: string;
}

const CREDITS: Credit[] = [
  {
    role: 'Araç modelleri, pist ve sesler',
    author: 'idaGP ekibi',
    url: 'https://github.com',
    license: 'Özgün',
    note: 'Tüm araç gövdeleri, çevre objeleri ve ses efektleri prosedürel olarak özgün üretilmiştir',
  },
  {
    role: 'Geçmiş sürüm 3D varlıkları (teşekkür)',
    author: 'Kenney · Quaternius',
    url: 'https://kenney.nl',
    license: 'CC0',
    note: 'Erken geliştirme sürümlerinde kullanılan ücretsiz varlıklar için teşekkürler',
  },
];

export function CreditsScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  return (
    <div className="screen list-screen">
      <div className="screen-header">
        <button className="icon-btn" onClick={() => setScreen('menu')}>
          ←
        </button>
        <h2>KREDİLER</h2>
        <div />
      </div>

      <p className="credits-intro">
        idaGP, aşağıdaki sanatçıların ücretsiz ve ticari kullanıma açık (CC0) 3D varlıklarını kullanır.
        CC0 atıf gerektirmese de teşekkür borçluyuz!
      </p>

      <div className="credits-list">
        {CREDITS.map((c, i) => (
          <div key={i} className="credit-card">
            <div className="credit-role">{c.role}</div>
            <div className="credit-author">
              {c.author} <span className="credit-license">· {c.license}</span>
            </div>
            {c.note && <div className="credit-note">{c.note}</div>}
            <a className="credit-link" href={c.url} target="_blank" rel="noopener noreferrer">
              {c.url.replace('https://', '')}
            </a>
          </div>
        ))}
      </div>

      <p className="credits-footer">
        Tüm araç isimleri kurgudur; gerçek otomotiv markası, logosu veya lisanslı tasarımı içermez.
      </p>
    </div>
  );
}
