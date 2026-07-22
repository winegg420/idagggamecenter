import { describe, it, expect } from 'vitest';
import { containsProfanity, maskProfanity, validateUsername } from '../../lib/profanity';

describe('containsProfanity', () => {
  it('temiz metinleri geçirir', () => {
    expect(containsProfanity('merhaba dostum')).toBe(false);
    expect(containsProfanity('bugün harika yarıştın')).toBe(false);
    expect(containsProfanity('HızlıKaplumbağa')).toBe(false);
    // "am" içeren masum kelimeler tam kelime kuralıyla korunur
    expect(containsProfanity('ambulans hamburger tamam')).toBe(false);
    expect(containsProfanity('siktir lan')).toBe(true); // uzun kök alt dize olarak yakalanır
  });

  it('Türkçe küfürleri yakalar', () => {
    expect(containsProfanity('orospu')).toBe(true);
    expect(containsProfanity('tam bir gerizekali')).toBe(true);
    expect(containsProfanity('amk')).toBe(true);
  });

  it('karakter değiştirmeyi yakalar (a→@, i→1)', () => {
    expect(containsProfanity('or0spu')).toBe(true);
    expect(containsProfanity('s1kt1r')).toBe(true);
  });

  it('boşlukla gizlemeyi yakalar', () => {
    expect(containsProfanity('o r o s p u')).toBe(true);
  });

  it('İngilizce küfürleri yakalar', () => {
    expect(containsProfanity('fuck you')).toBe(true);
    expect(containsProfanity('sh1t')).toBe(true);
  });
});

describe('maskProfanity', () => {
  it('küfürlü kelimeyi yıldızlar, temizleri korur', () => {
    const masked = maskProfanity('seni salak seni');
    expect(masked).toContain('seni');
    expect(masked).not.toContain('salak');
    expect(masked).toContain('*');
  });

  it('temiz metni değiştirmez', () => {
    expect(maskProfanity('iyi yarıştı herkes')).toBe('iyi yarıştı herkes');
  });
});

describe('validateUsername', () => {
  it('geçerli adları kabul eder', () => {
    expect(validateUsername('HızlıTilki')).toBeNull();
    expect(validateUsername('oyuncu_42')).toBeNull();
  });

  it('kısa/uzun adları reddeder', () => {
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('a'.repeat(17))).not.toBeNull();
  });

  it('küfürlü adları reddeder', () => {
    expect(validateUsername('orospuCocugu')).not.toBeNull();
    expect(validateUsername('s1kt1r_git')).not.toBeNull();
  });

  it('geçersiz karakterleri reddeder', () => {
    expect(validateUsername('ad soyad')).not.toBeNull();
    expect(validateUsername('ad<script>')).not.toBeNull();
  });
});
