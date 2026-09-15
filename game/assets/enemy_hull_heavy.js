export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  mat.name = 'metal';

  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.85, 1.6),
    mat
  );
  body.position.y = 0.425;
  g.add(body);

  // Add reinforcement ribs
  const ribGeo = new THREE.BoxGeometry(0.06, 0.8, 1.62);
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(ribGeo, mat);
    rib.position.set(-1.0 + i * 0.4, 0.4, 0);
    g.add(rib);
  }

  // Thick frontal armour
  const frontArmour = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.8, 1.6),
    mat
  );
  frontArmour.position.set(1.675, 0.4, 0);
  frontArmour.rotation.x = Math.PI / 6;
  g.add(frontArmour);

  // Angled sides at 20 degrees
  const sideL = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.75, 0.18),
    mat
  );
  sideL.position.set(0, 0.375, 0.89);
  sideL.rotation.x = Math.PI / 9;
  g.add(sideL);

  const sideR = sideL.clone();
  sideR.position.z = -0.89;
  sideR.rotation.x = -Math.PI / 9;
  g.add(sideR);

  // Reinforced rear
  const rear = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.8, 1.4),
    mat
  );
  rear.position.set(-1.65, 0.4, 0);
  g.add(rear);

  // Additional reinforcement plates
  const reinMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  const rein = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.6, 1.5),
    reinMat
  );
  rein.position.set(1.5, 0.5, 0);
  g.add(rein);

  // Flat top
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.1, 1.4),
    mat
  );
  top.position.y = 0.9;
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