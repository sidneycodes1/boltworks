export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2d3136, roughness: 0.9 });
  mat.name = 'stone';

  // Main barrier - rectangular cross-section
  const barrier = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.8, 0.4),
    mat
  );
  barrier.position.y = 0.4;
  g.add(barrier);

  // Add reinforcement ribs
  const ribGeo = new THREE.BoxGeometry(0.08, 0.75, 0.42);
  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(ribGeo, mat);
    rib.position.set(-0.7 + i * 0.35, 0.375, 0);
    g.add(rib);
  }

  // Add surface texture details
  const texMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  for (let i = 0; i < 10; i++) {
    const tex = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.02, 0.42),
      texMat
    );
    tex.position.set(-0.85 + i * 0.19, 0.4 + Math.random() * 0.3, 0);
    g.add(tex);
  }

  // Construction joints
  const jointMat = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.95 });
  const jointGeo = new THREE.BoxGeometry(0.02, 0.8, 0.42);
  
  const joint1 = new THREE.Mesh(jointGeo, jointMat);
  joint1.position.set(0, 0.4, 0);
  g.add(joint1);

  // Weathering
  const weatherMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.02, 0.42),
      weatherMat
    );
    mark.position.set(-0.7 + i * 0.47, 0.4 + Math.random() * 0.2, 0);
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