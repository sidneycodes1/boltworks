export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3d444a, roughness: 0.8 });
  mat.name = 'metal';

  // Main turret body - angular with flat surfaces
  const turretBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 1.4),
    mat
  );
  turretBody.position.y = 0.35;
  g.add(turretBody);

  // Front face - angled at 60 degrees
  const front = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.6, 1.2),
    mat
  );
  front.position.set(1.1, 0.3, 0);
  front.rotation.z = Math.PI / 6;
  g.add(front);

  // Side faces - angled at 45 degrees
  const sideL = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.6, 0.3),
    mat
  );
  sideL.position.set(0, 0.3, 0.85);
  sideL.rotation.x = Math.PI / 6;
  g.add(sideL);

  const sideR = sideL.clone();
  sideR.position.z = -0.85;
  sideR.rotation.x = -Math.PI / 6;
  g.add(sideR);

  // Flat top with raised edges
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.1, 1.2),
    mat
  );
  top.position.y = 0.75;
  g.add(top);

  const topEdgeL = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.08, 0.15),
    mat
  );
  topEdgeL.position.set(0, 0.82, 0.6);
  g.add(topEdgeL);

  const topEdgeR = topEdgeL.clone();
  topEdgeR.position.z = -0.6;
  g.add(topEdgeR);

  // Hatch - left rear
  const hatch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8),
    mat
  );
  hatch.position.set(-0.5, 0.82, -0.3);
  g.add(hatch);

  // Mantlet - rectangular block
  const mantlet = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.35, 0.5),
    mat
  );
  mantlet.position.set(0.9, 0.45, 0);
  g.add(mantlet);

  // Turret ring
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 0.1, 12),
    ringMat
  );
  ring.position.y = 0.05;
  g.add(ring);

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