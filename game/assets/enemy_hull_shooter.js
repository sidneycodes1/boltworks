export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  mat.name = 'metal';

  // Boxy shape
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.75, 1.4),
    mat
  );
  body.position.y = 0.375;
  g.add(body);

  // Add reinforcement ribs
  const ribGeo = new THREE.BoxGeometry(0.06, 0.7, 1.42);
  for (let i = 0; i < 7; i++) {
    const rib = new THREE.Mesh(ribGeo, mat);
    rib.position.set(-0.9 + i * 0.3, 0.35, 0);
    g.add(rib);
  }

  // Add surface details
  const detailMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  for (let i = 0; i < 10; i++) {
    const detail = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.03, 1.42),
      detailMat
    );
    detail.position.set(-0.95 + i * 0.21, 0.5 + Math.random() * 0.2, 0);
    g.add(detail);
  }

  // Raised front deck
  const frontDeck = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.2, 1.2),
    mat
  );
  frontDeck.position.set(1.0, 0.65, 0);
  g.add(frontDeck);

  // Vertical sides
  const sideL = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.75, 0.12),
    mat
  );
  sideL.position.set(0, 0.375, 0.76);
  g.add(sideL);

  const sideR = sideL.clone();
  sideR.position.z = -0.76;
  g.add(sideR);

  // Flat top
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.08, 1.2),
    mat
  );
  top.position.y = 0.79;
  g.add(top);

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