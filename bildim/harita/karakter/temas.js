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
}
