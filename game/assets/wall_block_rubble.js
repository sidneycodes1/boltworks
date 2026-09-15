export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2d3136, roughness: 0.9 });
  mat.name = 'stone';

  // Main damaged block
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.95, 0.9),
    mat
  );
  block.position.y = 0.475;
  g.add(block);

  // Broken/crumbling edges
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  for (let i = 0; i < 8; i++) {
    const rubble = new THREE.Mesh(
      new THREE.BoxGeometry(0.1 + Math.random() * 0.1, 0.08 + Math.random() * 0.08, 0.1 + Math.random() * 0.1),
      rubbleMat
    );
    const angle = (i / 8) * Math.PI * 2;
    rubble.position.set(Math.cos(angle) * 0.45, 0.1 + Math.random() * 0.3, Math.sin(angle) * 0.45);
    rubble.rotation.set(Math.random() * 0.3, Math.random() * 0.3, Math.random() * 0.3);
    g.add(rubble);
  }

  // Multiple cracks
  const crackMat = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.95 });
  const crackGeo = new THREE.BoxGeometry(0.02, 0.8, 0.02);
  
  const crack1 = new THREE.Mesh(crackGeo, crackMat);
  crack1.position.set(0.2, 0.5, 0.5);
  crack1.rotation.x = Math.PI / 6;
  g.add(crack1);

  const crack2 = new THREE.Mesh(crackGeo, crackMat);
  crack2.position.set(-0.2, 0.5, 0.5);
  crack2.rotation.x = -Math.PI / 6;
  g.add(crack2);

  // Spalled areas - exposed aggregate
  const spallMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const spall = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      spallMat
    );
    spall.position.set(-0.3 + i * 0.3, 0.6 + Math.random() * 0.2, 0.48);
    spall.scale.set(1, 0.5, 0.5);
    g.add(spall);
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