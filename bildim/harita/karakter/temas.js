// ============================================================
// TEMAS GÖLGESİ (Aşama 1B → ortak modül, Aşama 2B §1): yumuşak yuvarlak zemin gölgesi, TEK InstancedMesh.
// hedefler: [{ nesne: Object3D | {visible, parent, getWorldPosition}, r }]. Gizli nesne / gizli ebeveyn gölge bırakmaz.
// ============================================================
import * as THREE from "three";

export class TemasGolgeleri {
  constructor(sahne, doku, kapasite = 200) {
    this.kapasite = kapasite;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: doku, transparent: true, depthWrite: false, opacity: 0.55 }), kapasite);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; this.mesh.name = "TemasGolgeleri";
    sahne.add(this.mesh);
    this.hedefler = [];
    this._M = new THREE.Matrix4(); this._P = new THREE.Vector3(); this._Q = new THREE.Quaternion(); this._S = new THREE.Vector3();
  }
  ekle(nesne, r, ek = {}) { this.hedefler.push({ nesne, r, ...ek }); }
  sil(nesne) { const i = this.hedefler.findIndex((h) => h.nesne === nesne); if (i >= 0) this.hedefler.splice(i, 1); }
  guncelle() {
    let i = 0;
    for (const h of this.hedefler) {
      if (!h.nesne.visible || !h.nesne.parent || h.nesne.parent.visible === false || i >= this.kapasite) continue;
      h.nesne.getWorldPosition(this._P); this._P.y = 0.02;
      this._M.compose(this._P, this._Q, this._S.set(h.r, 1, h.r)); this.mesh.setMatrixAt(i++, this._M);
    }
    this.mesh.count = i; this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * AŞAMA 2D-B — STATİK GÖLGELERİ ZEMİNE PİŞİR.
   * `{ cevre: true }` ile eklenen hedefler (ağaç, bank) hiç hareket etmez. Her karede saydam, derinlik yazmayan,
   * örtüşen düzlem olarak çizilmek yerine bir kez dünya-XZ maske dokusuna çizilir ve zemin malzemesinin
   * fragment shader'ında karıştırılır: ek çizim çağrısı yok, saydam katman yok, harmanlama yok.
   * Karışım, saydam düzlemin çerçeve arabelleğindeki harmanlamasıyla aynıdır (renk ton eşleme + sRGB'den geçer,
   * sisten ÖNCE karışır; maske alfası = doku alfası × 0.55, üst üste binme source-over).
   * Doku yüklenmeden çağrılırsa yüklenince tamamlanır; o zamana kadar gölgeler dinamik çizilmeye devam eder.
   * @param {THREE.Mesh} zemin zemin mesh'i (malzemesi klonlanır; paylaşılan prop malzemesine dokunulmaz)
   * @returns {Promise<number>} pişirilen gölge sayısı
   */
  async statikPisir(zemin, { metreBasinaPiksel = 6, enCok = 2048 } = {}) {
    const statik = this.hedefler.filter((h) => h.cevre);
    if (!zemin || !statik.length) return 0;
    const img = this.mesh.material.map?.image?.width ? this.mesh.material.map.image
      : await new Promise((coz, red) => { const i = new Image(); i.onload = () => coz(i); i.onerror = red; i.src = this.mesh.material.map.source?.data?.src ?? this.mesh.material.map.image?.src; });
    const P = new THREE.Vector3();
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const h of statik) { h.nesne.getWorldPosition(P); x0 = Math.min(x0, P.x - h.r); z0 = Math.min(z0, P.z - h.r); x1 = Math.max(x1, P.x + h.r); z1 = Math.max(z1, P.z + h.r); }
    x0 -= 2; z0 -= 2; x1 += 2; z1 += 2;   // kenar pikselleri boş kalsın (ClampToEdge taşmasın)
    const ppm = Math.min(metreBasinaPiksel, enCok / (x1 - x0), enCok / (z1 - z0));
    const W = Math.ceil((x1 - x0) * ppm), H = Math.ceil((z1 - z0) * ppm);
    const tuval = document.createElement("canvas"); tuval.width = W; tuval.height = H;
    const c = tuval.getContext("2d");
    c.globalAlpha = this.mesh.material.opacity;
    for (const h of statik) {
      h.nesne.getWorldPosition(P);
      const d = h.r * ppm;   // düzlem 1×1 m, r ile ölçeklenir → kenar uzunluğu r
      c.drawImage(img, (P.x - x0) * ppm - d / 2, (P.z - z0) * ppm - d / 2, d, d);
    }
    const maske = new THREE.CanvasTexture(tuval);
    maske.colorSpace = THREE.NoColorSpace;   // ham sRGB baytları; çözme shader'da, düzlemin yoluyla aynı
    maske.flipY = false; maske.wrapS = maske.wrapT = THREE.ClampToEdgeWrapping; maske.anisotropy = 4;

    const kaynak = zemin.material, m = kaynak.clone();
    const ustKey = kaynak.customProgramCacheKey?.bind(kaynak), ustDerle = kaynak.onBeforeCompile;
    m.customProgramCacheKey = () => (ustKey ? ustKey() : "") + "|temas-maske-v1";
    m.onBeforeCompile = (s, r) => {
      ustDerle?.call(kaynak, s, r);
      s.uniforms.temasMaske = { value: maske };
      s.uniforms.temasKutu = { value: new THREE.Vector4(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0)) };
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vTemasXZ;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTemasXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vTemasXZ;\nuniform sampler2D temasMaske;\nuniform vec4 temasKutu;")
        .replace("#include <fog_fragment>", `{
  vec4 tm = texture2D(temasMaske, (vTemasXZ - temasKutu.xy) * temasKutu.zw);
  vec3 tc = sRGBTransferEOTF(vec4(tm.rgb, 1.0)).rgb;
  #ifdef TONE_MAPPING
  tc = toneMapping(tc);
  #endif
  tc = sRGBTransferOETF(vec4(tc, 1.0)).rgb;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, tc, tm.a);
}
#include <fog_fragment>`);
    };
    zemin.material = m;
    for (const h of statik) this.sil(h.nesne);
    this.maske = maske;   // yokEt: dunya.js serbest bırakır
    this.pisirilen = { sayi: statik.length, doku: [W, H], ppm: +ppm.toFixed(2) };
    return statik.length;
  }
}
