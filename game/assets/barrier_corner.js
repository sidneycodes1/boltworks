export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2d3136, roughness: 0.9 });
  mat.name = 'stone';

  // L-shaped corner barrier
  const leg1 = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.8, 0.4),
    mat
  );
  leg1.position.set(0.55, 0.4, 0);
  g.add(leg1);

  const leg2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.8, 1.5),
    mat
  );
  leg2.position.set(0, 0.4, 0.55);
  g.add(leg2);

  // Corner reinforcement
  const corner = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.8, 0.4),
    mat
  );
  corner.position.set(0, 0.4, 0);
  g.add(corner);

  // Add reinforcement ribs to both legs
  const ribGeo = new THREE.BoxGeometry(0.08, 0.75, 0.42);
  for (let i = 0; i < 5; i++) {
    const rib1 = new THREE.Mesh(ribGeo, mat);
    rib1.position.set(0.15 + i * 0.275, 0.375, 0);
    g.add(rib1);
  }

  const ribGeo2 = new THREE.BoxGeometry(0.42, 0.75, 0.08);
  for (let i = 0; i < 5; i++) {
    const rib2 = new THREE.Mesh(ribGeo2, mat);
    rib2.position.set(0, 0.375, 0.15 + i * 0.275);
    g.add(rib2);
  }

  // Add surface texture details
  const texMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  for (let i = 0; i < 8; i++) {
    const tex = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.02, 0.42),
      texMat
    );
    tex.position.set(0.2 + (i % 4) * 0.3, 0.4 + Math.floor(i / 4) * 0.3, 0);
    g.add(tex);
  }

  // Construction joints
  const jointMat = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.95 });
  const jointGeo = new THREE.BoxGeometry(0.02, 0.8, 0.42);
  
  const joint1 = new THREE.Mesh(jointGeo, jointMat);
  joint1.position.set(0.55, 0.4, 0);
  g.add(joint1);

  const joint2 = new THREE.Mesh(jointGeo, jointMat);
  joint2.rotation.y = Math.PI / 2;
  joint2.position.set(0, 0.4, 0.55);
  g.add(joint2);

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