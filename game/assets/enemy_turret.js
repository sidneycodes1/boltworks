export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3d444a, roughness: 0.8 });
  mat.name = 'metal';

  // Simple rounded shape
  const turretBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    mat
  );
  turretBody.scale.set(1, 0.7, 1);
  turretBody.position.y = 0.35;
  g.add(turretBody);

  // Flat top
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.1, 12),
    mat
  );
  top.position.y = 0.7;
  g.add(top);

  // Barrel mounting point
  const mantlet = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.25, 0.2),
    mat
  );
  mantlet.position.set(0, 0.4, 0.5);
  g.add(mantlet);

  // Turret ring
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.08, 12),
    ringMat
  );
  ring.position.y = 0.04;
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