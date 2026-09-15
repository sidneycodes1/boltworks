export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b7a8a, roughness: 0.85 });
  mat.name = 'timber';

  // Main crate body
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.8),
    mat
  );
  crate.position.y = 0.4;
  g.add(crate);

  // Wooden slats
  const slatMat = new THREE.MeshStandardMaterial({ color: 0x5c6874, roughness: 0.9 });
  const slatGeo = new THREE.BoxGeometry(0.82, 0.08, 0.82);
  
  for (let y = 0.1; y <= 0.7; y += 0.2) {
    const slat = new THREE.Mesh(slatGeo, slatMat);
    slat.position.y = y;
    g.add(slat);
  }

  // Metal corner reinforcements
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  const cornerGeo = new THREE.BoxGeometry(0.1, 0.82, 0.1);
  
  for (let x = -0.35; x <= 0.35; x += 0.7) {
    for (let z = -0.35; z <= 0.35; z += 0.7) {
      const corner = new THREE.Mesh(cornerGeo, cornerMat);
      corner.position.set(x, 0.4, z);
      g.add(corner);
    }
  }

  // Wear and handling marks
  const wornMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.02, 0.82),
      wornMat
    );
    mark.position.set(-0.25 + i * 0.17, 0.3 + Math.random() * 0.2, 0);
    g.add(mark);
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