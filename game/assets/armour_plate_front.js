export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5c6874, roughness: 0.8 });
  mat.name = 'metal';

  // Main plate - trapezoidal to match 30-degree angle
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-0.6, 0);
  plateShape.lineTo(0.75, 0.45);
  plateShape.lineTo(0.75, 0);
  plateShape.lineTo(-0.6, 0);

  const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: 0.08,
    bevelEnabled: false
  });
  const plate = new THREE.Mesh(plateGeo, mat);
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0, 0, -0.04);
  g.add(plate);

  // Bolt holes along edges
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  const boltGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6);
  
  // Grid pattern
  for (let x = -0.5; x <= 0.6; x += 0.3) {
    for (let y = 0.1; y <= 0.4; y += 0.15) {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(x, y, 0.04);
      bolt.rotation.x = Math.PI / 2;
      g.add(bolt);
    }
  }

  // Battle damage scarring
  const damageMat = new THREE.MeshStandardMaterial({ color: 0x8b3a3a, roughness: 0.9 });
  const scar1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 6, 6),
    damageMat
  );
  scar1.position.set(0.2, 0.25, 0.05);
  scar1.scale.set(1, 0.3, 0.5);
  g.add(scar1);

  const scar2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.03, 0.06),
    damageMat
  );
  scar2.position.set(-0.3, 0.35, 0.05);
  scar2.rotation.z = 0.3;
  g.add(scar2);

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