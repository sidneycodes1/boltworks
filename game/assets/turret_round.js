export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3d444a, roughness: 0.8 });
  mat.name = 'metal';

  // Main turret body - rounded front
  const turretBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    mat
  );
  turretBody.scale.set(1, 0.8, 1);
  turretBody.position.y = 0.4;
  g.add(turretBody);

  // Flat top
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 0.15, 16),
    mat
  );
  top.position.y = 0.85;
  g.add(top);

  // Tapered rear
  const rear = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 0.4, 12),
    mat
  );
  rear.position.set(0, 0.6, -0.5);
  rear.rotation.x = Math.PI / 2;
  g.add(rear);

  // Turret ring
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 0.1, 16),
    ringMat
  );
  ring.position.y = 0.05;
  g.add(ring);

  // Commander's cupola - right rear
  const cupola = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.3, 8),
    mat
  );
  cupola.position.set(0.4, 0.95, -0.3);
  g.add(cupola);

  // Cupola hatch
  const hatch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8),
    mat
  );
  hatch.position.set(0.4, 1.1, -0.3);
  g.add(hatch);

  // Mantlet - rounded protrusion for barrel mounting
  const mantlet = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 8),
    mat
  );
  mantlet.position.set(0, 0.5, 0.7);
  mantlet.scale.set(1.2, 0.8, 0.6);
  g.add(mantlet);

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