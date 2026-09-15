export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  mat.name = 'metal';

  // Pointed front nose
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 0.6, 4),
    mat
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(1.2, 0.3, 0);
  nose.rotation.z = Math.PI / 2;
  g.add(nose);

  // Main body - boxy but sloped sides
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 1.2),
    mat
  );
  body.position.y = 0.35;
  g.add(body);

  // Add reinforcement ribs
  const ribGeo = new THREE.BoxGeometry(0.06, 0.65, 1.22);
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(ribGeo, mat);
    rib.position.set(-0.7 + i * 0.28, 0.325, 0);
    g.add(rib);
  }

  // Add surface details
  const detailMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  for (let i = 0; i < 8; i++) {
    const detail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.03, 1.22),
      detailMat
    );
    detail.position.set(-0.6 + i * 0.17, 0.5 + Math.random() * 0.15, 0);
    g.add(detail);
  }

  // Sloped sides
  const sideL = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.6, 0.15),
    mat
  );
  sideL.position.set(0, 0.3, 0.675);
  sideL.rotation.x = Math.PI / 8;
  g.add(sideL);

  const sideR = sideL.clone();
  sideR.position.z = -0.675;
  sideR.rotation.x = -Math.PI / 8;
  g.add(sideR);

  // Flat top
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.08, 1.1),
    mat
  );
  top.position.y = 0.72;
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