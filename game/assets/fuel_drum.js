export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  mat.name = 'metal';

  // Main drum body - slightly tapered
  const drumBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.26, 0.9, 16),
    mat
  );
  drumBody.position.y = 0.45;
  g.add(drumBody);

  // Metal bands at top, middle, bottom
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  const bandGeo = new THREE.TorusGeometry(0.27, 0.02, 8, 16);
  
  const bandTop = new THREE.Mesh(bandGeo, bandMat);
  bandTop.rotation.x = Math.PI / 2;
  bandTop.position.y = 0.85;
  g.add(bandTop);

  const bandMid = new THREE.Mesh(bandGeo, bandMat);
  bandMid.rotation.x = Math.PI / 2;
  bandMid.position.y = 0.45;
  g.add(bandMid);

  const bandBot = new THREE.Mesh(bandGeo, bandMat);
  bandBot.rotation.x = Math.PI / 2;
  bandBot.position.y = 0.05;
  g.add(bandBot);

  // Filler cap on top
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8),
    capMat
  );
  cap.position.set(0, 0.92, 0);
  g.add(cap);

  // Dents and rust
  const dentMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const dent = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 6, 6),
      dentMat
    );
    dent.position.set(
      Math.cos(i * Math.PI / 2) * 0.2,
      0.3 + Math.random() * 0.3,
      Math.sin(i * Math.PI / 2) * 0.2
    );
    dent.scale.set(1, 0.3, 1);
    g.add(dent);
  }

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