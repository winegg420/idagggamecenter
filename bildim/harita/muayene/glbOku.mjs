// ============================================================
// MUAYENE — Node'da GLB okuyucu (tarayıcısız). Dış atlas dokusu Node'da yüklenemez; görüntü/doku
// başvuruları JSON'dan çıkarılıp GLB yeniden paketlenir, sonra GLTFLoader.parse ile sahne kurulur.
// Yalnız geometri, düğüm hiyerarşisi, extras (userData) ve animasyonlar gerekir.
// ============================================================
import "../varlik/polyfill.mjs";
import fs from "fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export async function glbOku(dosya) {
  const b = fs.readFileSync(dosya);
  const jsonUzun = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jsonUzun).toString());
  delete j.images; delete j.textures; delete j.samplers;
  for (const m of j.materials ?? []) { if (m.pbrMetallicRoughness) delete m.pbrMetallicRoughness.baseColorTexture; }
  let js = JSON.stringify(j); while (js.length % 4) js += " ";
  const jb = Buffer.from(js), bin = b.subarray(20 + jsonUzun);
  const out = Buffer.alloc(20 + jb.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jb.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jb.copy(out, 20); bin.copy(out, 20 + jb.length);
  const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  const gltf = await new Promise((coz, red) => new GLTFLoader().parse(ab, "", coz, red));
  gltf.scene.updateMatrixWorld(true);
  return gltf;
}
