export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3d444a, roughness: 0.8 });
  mat.name = 'metal';

  // Main barrel - longer, thinner
  const section1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.2, 12),
    mat
  );
  section1.rotation.x = Math.PI / 2;
  section1.position.set(0.6, 0, 0);
  g.add(section1);

  const section2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1.0, 12),
    mat
  );
  section2.rotation.x = Math.PI / 2;
  section2.position.set(1.7, 0, 0);
  g.add(section2);

  const section3 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.0, 12),
    mat
  );
  section3.rotation.x = Math.PI / 2;
  section3.position.set(2.7, 0, 0);
  g.add(section3);

  // Breech end
  const breech = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.25, 12),
    mat
  );
  breech.rotation.x = Math.PI / 2;
  breech.position.set(-0.125, 0, 0);
  g.add(breech);

  // Muzzle brake
  const muzzleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.05, 0.12, 12),
    muzzleMat
  );
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(3.25, 0, 0);
  g.add(muzzle);

  // Muzzle slots
  const slotGeo = new THREE.BoxGeometry(0.02, 0.1, 0.02);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const slot = new THREE.Mesh(slotGeo, muzzleMat);
    slot.position.set(3.25, Math.cos(angle) * 0.06, Math.sin(angle) * 0.06);
    g.add(slot);
  }

  // Thermal sleeve - textured section
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.85 });
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.8, 12),
    sleeveMat
  );
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.set(1.7, 0, 0);
  g.add(sleeve);

  // Normalize position
  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position;
    if (!p) return;
    const put = (mat) => {
      for (let i = 0; i < p.count; i++) {
        box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat));
      }
    };
    if (n.isInstancedMesh) {
      for (let c = 0; c < n.count; c++) {
        const im = new THREE.Matrix4();
        n.getMatrixAt(c, im);
        put(m.multiplyMatrices(n.matrixWorld, im));
      }
      return;
    }
    put(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => {
    o.position.x -= c.x;
    o.position.y -= box.min.y;
    o.position.z -= c.z;
  });

  return g;
}