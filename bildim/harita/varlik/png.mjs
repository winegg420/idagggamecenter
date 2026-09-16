// Saf Node PNG yazıcı (RGBA, 8 bit). Paket yok: zlib + CRC32 elle.
import zlib from "zlib";

const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function parca(tur, veri) {
  const b = Buffer.alloc(12 + veri.length);
  b.writeUInt32BE(veri.length, 0);
  b.write(tur, 4, "ascii");
  veri.copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + veri.length)), 8 + veri.length);
  return b;
}

/** @param {Uint8Array} rgba  en*boy*4 bayt, üst satırdan başlar */
export function pngYaz(en, boy, rgba) {
  const ham = Buffer.alloc((en * 4 + 1) * boy);
  for (let y = 0; y < boy; y++) {
    ham[y * (en * 4 + 1)] = 0; // filtre yok
    Buffer.from(rgba.buffer, rgba.byteOffset + y * en * 4, en * 4).copy(ham, y * (en * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(en, 0); ihdr.writeUInt32BE(boy, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca("IHDR", ihdr),
    parca("IDAT", zlib.deflateSync(ham, { level: 9 })),
    parca("IEND", Buffer.alloc(0)),
  ]);
}
