export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2d3136, roughness: 0.9 });
  mat.name = 'stone';

  // Main block
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.0, 1.0),
    mat
  );
  block.position.y = 0.5;
  g.add(block);

  // Diagonal crack
  const crackMat = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.95 });
  const crackGeo = new THREE.BoxGeometry(0.03, 1.5, 0.03);
  const crack = new THREE.Mesh(crackGeo, crackMat);
  crack.position.set(0, 0.5, 0.5);
  crack.rotation.x = Math.PI / 4;
  crack.rotation.z = Math.PI / 4;
  g.add(crack);

  // Chamfered edges
  const chamferMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  const chamferGeo = new THREE.BoxGeometry(0.05, 1.0, 1.0);
  
  for (let i = 0; i < 4; i++) {
    const chamfer = new THREE.Mesh(chamferGeo, chamferMat);
    const angle = (i / 4) * Math.PI * 2;
    chamfer.position.set(Math.cos(angle) * 0.48, 0.5, Math.sin(angle) * 0.48);
    chamfer.rotation.y = angle;
    g.add(chamfer);
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