// ============================================================
// KAFA TOPU — girdi yönetimi.
// Klavye (PC) ve dokunmatik (mobil) aynı anda aktiftir.
// Dokunmatik butonlar React tarafında DOM olarak durur ve
// buradaki tusAyarla() ile aynı girdi durumunu besler.
// ============================================================

import { bosGirdi } from "./oyun.js";

const TUS_ESLEME = {
  ArrowLeft: "sol", KeyA: "sol",
  ArrowRight: "sag", KeyD: "sag",
  ArrowUp: "zipla", KeyW: "zipla",
  Space: "vur", KeyX: "vur",
  KeyE: "guc", ShiftLeft: "guc",
};

export function girdiKur() {
  const klavye = bosGirdi();
  const dokunma = bosGirdi();

  const tusOlay = (e, basili) => {
    const ad = TUS_ESLEME[e.code];
    if (!ad) return;
    // Oyun tuşları sayfayı kaydırmasın
    if (["Space", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    klavye[ad] = basili;
  };
  const bas = (e) => tusOlay(e, true);
  const birak = (e) => tusOlay(e, false);
  window.addEventListener("keydown", bas);
  window.addEventListener("keyup", birak);

  return {
    // Anlık birleşik girdi (klavye VEYA dokunmatik basılıysa basılı)
    oku() {
      return {
        sol: klavye.sol || dokunma.sol,
        sag: klavye.sag || dokunma.sag,
        zipla: klavye.zipla || dokunma.zipla,
        vur: klavye.vur || dokunma.vur,
        guc: klavye.guc || dokunma.guc,
      };
    },
    // Dokunmatik butonlardan çağrılır
    tusAyarla(ad, basili) {
      if (ad in dokunma) dokunma[ad] = basili;
    },
    // Uygulama arka plana geçince çağrılır: kaçan pointerup/keyup yüzünden
    // tuş "basılı" kalmasın (mobilde karakterin kendi kendine koşması bug'ı).
    sifirla() {
      for (const k of Object.keys(klavye)) klavye[k] = false;
      for (const k of Object.keys(dokunma)) dokunma[k] = false;
    },
    yokEt() {
      window.removeEventListener("keydown", bas);
      window.removeEventListener("keyup", birak);
    },
  };
}

// Cihazda dokunmatik var mı? (buton katmanını göstermek için)
export function dokunmatikVarMi() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}
