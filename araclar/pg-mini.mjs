// Küçük PostgreSQL istemcisi — yalnız Node'un kendi modülleriyle (net, tls, crypto).
//
// Neden var: bu depoda YENİ NPM PAKETİ KURULMAZ (kök CLAUDE.md). Sunucu mantığının
// otomatik testleri veritabanına bağlanmak zorunda; `pg` paketi kurulamayacağı,
// bu makinede `psql` da bulunmadığı için (Paket 26'da ölçüldü) protokolün
// ihtiyaç duyulan kadarı buraya yazıldı.
//
// Kapsam bilinçli olarak dar: TLS + SCRAM-SHA-256 kimlik doğrulama ve "basit
// sorgu" protokolü. Değerler METİN olarak döner (tür çözümlemesi yok) —
// testlerde karşılaştırma yapmaya yeter. Parametreli sorgu (extended protocol)
// YOKTUR; testler değerleri SQL'in içine gömmek yerine `alintila()` ile kaçırır.
//
// Uygulamada kullanılmaz, yalnız `_test/` altındaki testler ve bakım betikleri içindir.

import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

/** Metni SQL tek tırnaklı sabitine çevirir (tek tırnaklar ikilenir). */
export function alintila(deger) {
  if (deger === null || deger === undefined) return 'null';
  if (typeof deger === 'number') return String(deger);
  if (typeof deger === 'boolean') return deger ? 'true' : 'false';
  return "'" + String(deger).replace(/'/g, "''") + "'";
}

function mesaj(tur, govde) {
  const b = Buffer.alloc(5 + govde.length);
  b.write(tur, 0, 'ascii');
  b.writeInt32BE(4 + govde.length, 1);
  govde.copy(b, 5);
  return b;
}

function cStr(s) {
  return Buffer.from(s + '\0', 'utf8');
}

class PgHata extends Error {}

export class PgIstemci {
  constructor(baglantiDizgisi) {
    const u = new URL(baglantiDizgisi);
    this.sunucu = u.hostname;
    this.port = Number(u.port || 5432);
    this.kullanici = decodeURIComponent(u.username);
    this.sifre = decodeURIComponent(u.password);
    this.veritabani = decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres';
    this.tampon = Buffer.alloc(0);
    this.bekleyen = [];
  }

  async baglan() {
    const ham = await new Promise((coz, at) => {
      const s = net.connect(this.port, this.sunucu);
      s.once('error', at);
      s.once('connect', () => coz(s));
    });

    // SSLRequest
    const istek = Buffer.alloc(8);
    istek.writeInt32BE(8, 0);
    istek.writeInt32BE(80877103, 4);
    ham.write(istek);
    const yanit = await new Promise((coz) => ham.once('data', coz));
    if (yanit.toString() !== 'S') throw new PgHata('Sunucu TLS kabul etmedi');

    this.soket = await new Promise((coz, at) => {
      const t = tls.connect({ socket: ham, servername: this.sunucu, rejectUnauthorized: false });
      t.once('error', at);
      t.once('secureConnect', () => coz(t));
    });
    this.soket.on('data', (d) => this.#veri(d));
    this.soket.on('error', () => {});

    // StartupMessage
    const par = Buffer.concat([
      cStr('user'), cStr(this.kullanici),
      cStr('database'), cStr(this.veritabani),
      Buffer.from([0]),
    ]);
    const bas = Buffer.alloc(8 + par.length);
    bas.writeInt32BE(8 + par.length, 0);
    bas.writeInt32BE(196608, 4);
    par.copy(bas, 8);
    this.soket.write(bas);

    await this.#kimlik();
    return this;
  }

  #veri(d) {
    this.tampon = Buffer.concat([this.tampon, d]);
    for (;;) {
      if (this.tampon.length < 5) return;
      const boy = this.tampon.readInt32BE(1);
      if (this.tampon.length < boy + 1) return;
      const tur = String.fromCharCode(this.tampon[0]);
      const govde = this.tampon.subarray(5, boy + 1);
      this.tampon = this.tampon.subarray(boy + 1);
      const f = this.bekleyen[0];
      if (f) f(tur, govde);
    }
  }

  /** Belirli bir mesaj gelene kadar bekler; ErrorResponse'u hataya çevirir. */
  #bekle(kosul) {
    return new Promise((coz, at) => {
      const kuyruk = [];
      let hata = null;
      const isle = (tur, govde) => {
        if (tur === 'E') {
          // Hatayı hemen atma: sunucu ardından ReadyForQuery gönderir ve o
          // yutulmazsa bir sonraki sorgunun yanıtına karışır.
          hata = new PgHata(this.#hataMetni(govde));
          return;
        }
        kuyruk.push([tur, govde]);
        if (hata ? tur === 'Z' : kosul(tur, govde)) {
          this.bekleyen.shift();
          if (hata) at(hata); else coz(kuyruk);
        }
      };
      this.bekleyen.push(isle);
    });
  }

  #hataMetni(govde) {
    const parcalar = govde.toString('utf8').split('\0');
    const m = parcalar.find((p) => p.startsWith('M'));
    return m ? m.slice(1) : 'bilinmeyen veritabanı hatası';
  }

  async #kimlik() {
    const nonce = crypto.randomBytes(18).toString('base64');
    const ilkCiplak = `n=,r=${nonce}`;

    const [[, ilk]] = await this.#bekle((tur) => tur === 'R');
    const alt = ilk.readInt32BE(0);
    if (alt !== 10) throw new PgHata(`Beklenmeyen kimlik yöntemi: ${alt} (SCRAM bekleniyordu)`);

    const govde = Buffer.concat([
      cStr('SCRAM-SHA-256'),
      (() => { const b = Buffer.alloc(4); b.writeInt32BE(Buffer.byteLength('n,,' + ilkCiplak)); return b; })(),
      Buffer.from('n,,' + ilkCiplak, 'utf8'),
    ]);
    this.soket.write(mesaj('p', govde));

    const [[, devam]] = await this.#bekle((tur) => tur === 'R');
    if (devam.readInt32BE(0) !== 11) throw new PgHata('SCRAMContinue bekleniyordu');
    const sunucuIlk = devam.subarray(4).toString('utf8');
    const alanlar = Object.fromEntries(sunucuIlk.split(',').map((p) => [p[0], p.slice(2)]));
    const tuz = Buffer.from(alanlar.s, 'base64');
    const dongu = Number(alanlar.i);
    if (!alanlar.r.startsWith(nonce)) throw new PgHata('Sunucu nonce uyuşmadı');

    const tuzlu = crypto.pbkdf2Sync(this.sifre, tuz, dongu, 32, 'sha256');
    const hmac = (anahtar, veri) => crypto.createHmac('sha256', anahtar).update(veri).digest();
    const istemciAnahtar = hmac(tuzlu, 'Client Key');
    const saklananAnahtar = crypto.createHash('sha256').update(istemciAnahtar).digest();
    const sonProofsuz = `c=${Buffer.from('n,,').toString('base64')},r=${alanlar.r}`;
    const kimlikMetni = `${ilkCiplak},${sunucuIlk},${sonProofsuz}`;
    const imza = hmac(saklananAnahtar, kimlikMetni);
    const kanit = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) kanit[i] = istemciAnahtar[i] ^ imza[i];

    this.soket.write(mesaj('p', Buffer.from(`${sonProofsuz},p=${kanit.toString('base64')}`, 'utf8')));
    await this.#bekle((tur, g) => tur === 'R' && g.readInt32BE(0) === 12);
    await this.#bekle((tur) => tur === 'Z');
  }

  /**
   * Basit sorgu. Birden çok ifade ';' ile ayrılabilir.
   * Döner: son SELECT'in satırları — her satır { kolonAdi: 'metin' }.
   */
  async sorgu(sql) {
    this.soket.write(mesaj('Q', cStr(sql)));
    const mesajlar = await this.#bekle((tur) => tur === 'Z');
    let kolonlar = [];
    const satirlar = [];
    for (const [tur, govde] of mesajlar) {
      if (tur === 'T') {
        kolonlar = [];
        const adet = govde.readInt16BE(0);
        let p = 2;
        for (let i = 0; i < adet; i++) {
          const son = govde.indexOf(0, p);
          kolonlar.push(govde.subarray(p, son).toString('utf8'));
          p = son + 1 + 18;
        }
        satirlar.length = 0;
      } else if (tur === 'D') {
        const adet = govde.readInt16BE(0);
        let p = 2;
        const s = {};
        for (let i = 0; i < adet; i++) {
          const boy = govde.readInt32BE(p);
          p += 4;
          s[kolonlar[i]] = boy === -1 ? null : govde.subarray(p, p + boy).toString('utf8');
          if (boy !== -1) p += boy;
        }
        satirlar.push(s);
      }
    }
    return satirlar;
  }

  /**
   * Çok ifadeli toplu sorgu: HER SELECT'in sonucu ayrı dizi olarak döner.
   * (`sorgu()` yalnız sonuncuyu verir.)
   */
  async sorguCoklu(sql) {
    this.soket.write(mesaj('Q', cStr(sql)));
    const mesajlar = await this.#bekle((tur) => tur === 'Z');
    const kumeler = [];
    let kolonlar = [];
    let satirlar = null;
    for (const [tur, govde] of mesajlar) {
      if (tur === 'T') {
        if (satirlar) kumeler.push(satirlar);
        kolonlar = [];
        const adet = govde.readInt16BE(0);
        let p = 2;
        for (let i = 0; i < adet; i++) {
          const son = govde.indexOf(0, p);
          kolonlar.push(govde.subarray(p, son).toString('utf8'));
          p = son + 1 + 18;
        }
        satirlar = [];
      } else if (tur === 'D' && satirlar) {
        const adet = govde.readInt16BE(0);
        let p = 2;
        const s = {};
        for (let i = 0; i < adet; i++) {
          const boy = govde.readInt32BE(p);
          p += 4;
          s[kolonlar[i]] = boy === -1 ? null : govde.subarray(p, p + boy).toString('utf8');
          if (boy !== -1) p += boy;
        }
        satirlar.push(s);
      }
    }
    if (satirlar) kumeler.push(satirlar);
    return kumeler;
  }

  /** Tek satır, tek kolon. */
  async tek(sql) {
    const r = await this.sorgu(sql);
    if (!r.length) return null;
    return Object.values(r[0])[0];
  }

  async kapat() {
    try { this.soket.write(mesaj('X', Buffer.alloc(0))); } catch { /* kapanmış olabilir */ }
    try { this.soket.end(); } catch { /* yoksay */ }
  }
}

/**
 * Bağlantı dizgisini bulur:
 *  1. SUPABASE_DB_URL ortam değişkeni (CI burayı kullanır)
 *  2. .env.local içindeki SUPABASE_DB_PASSWORD + bilinen havuz adresi
 * Bulamazsa null döner — testler o zaman atlanır, kırılmaz.
 */
export async function baglantiDizgisi() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  try {
    const fs = await import('node:fs');
    const url = new URL('../.env.local', import.meta.url);
    const metin = fs.readFileSync(url, 'utf8');
    const sifre = metin.match(/SUPABASE_DB_PASSWORD=(.*)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
    if (!sifre) return null;
    return `postgresql://postgres.zfpnxzybcpkxsotwdsey:${encodeURIComponent(sifre)}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`;
  } catch {
    return null;
  }
}
