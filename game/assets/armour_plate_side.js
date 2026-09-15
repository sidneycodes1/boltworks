export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5c6874, roughness: 0.8 });
  mat.name = 'metal';

  // Main plate
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.8, 0.05),
    mat
  );
  plate.position.y = 0.4;
  g.add(plate);

  // Bolt holes along edges
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  const boltGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 6);
  
  // Grid pattern of bolt holes
  for (let x = -0.5; x <= 0.5; x += 0.25) {
    for (let y = 0.15; y <= 0.65; y += 0.25) {
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(x, y, 0.03);
      bolt.rotation.x = Math.PI / 2;
      g.add(bolt);
    }
  }

  // Worn texture detail
  const wornMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.85 });
  for (let i = 0; i < 5; i++) {
    const scratch = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.02, 0.06),
      wornMat
    );
    scratch.position.set(-0.4 + i * 0.2, 0.3 + Math.random() * 0.4, 0.03);
    scratch.rotation.z = Math.random() * 0.2;
    g.add(scratch);
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