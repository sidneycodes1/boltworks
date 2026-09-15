export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.9 });
  mat.name = 'ground';

  // Main slab
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(4.0, 0.2, 4.0),
    mat
  );
  slab.position.y = 0.1;
  g.add(slab);

  // Chamfered edges
  const chamferMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.85 });
  const chamferGeo = new THREE.BoxGeometry(4.0, 0.05, 0.05);
  
  const chamfer1 = new THREE.Mesh(chamferGeo, chamferMat);
  chamfer1.position.set(0, 0.025, 2.0);
  g.add(chamfer1);

  const chamfer2 = chamfer1.clone();
  chamfer2.position.z = -2.0;
  g.add(chamfer2);

  const chamfer3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 4.0), chamferMat);
  chamfer3.position.set(2.0, 0.025, 0);
  g.add(chamfer3);

  const chamfer4 = chamfer3.clone();
  chamfer4.position.x = -2.0;
  g.add(chamfer4);

  // Expansion joints in grid pattern
  const jointMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.95 });
  const jointGeo = new THREE.BoxGeometry(0.02, 0.22, 4.0);
  
  const joint1 = new THREE.Mesh(jointGeo, jointMat);
  joint1.position.set(0, 0.1, 0);
  g.add(joint1);

  const joint2 = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, 0.02), jointMat);
  joint2.position.set(0, 0.1, 0);
  g.add(joint2);

  // Add surface texture details
  const texMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.85 });
  for (let i = 0; i < 16; i++) {
    const tex = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.01, 0.1),
      texMat
    );
    tex.position.set(
      -1.5 + (i % 4) * 1.0,
      0.21,
      -1.5 + Math.floor(i / 4) * 1.0
    );
    g.add(tex);
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