// Node'da GLTFExporter için: FileReader yok, Blob var.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((ab) => { this.result = ab; this.onloadend?.({ target: this }); this.onload?.({ target: this }); }); }
    readAsDataURL(blob) { blob.arrayBuffer().then((ab) => { this.result = "data:" + (blob.type || "application/octet-stream") + ";base64," + Buffer.from(ab).toString("base64"); this.onloadend?.({ target: this }); this.onload?.({ target: this }); }); }
  };
}
if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
