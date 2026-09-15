export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5c6874, roughness: 0.8 });
  mat.name = 'metal';

  // Low cylinder base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.1, 12),
    mat
  );
  base.position.y = 0.05;
  g.add(base);

  // Glowing ring
  const glowMat = new THREE.MeshStandardMaterial({ 
    color: 0xffb45a, 
    roughness: 0.5,
    emissive: 0xffb45a,
    emissiveIntensity: 0.5
  });
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.03, 8, 16),
    glowMat
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  g.add(ring);

  // Center marker
  const center = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8),
    glowMat
  );
  center.position.y = 0.1;
  g.add(center);

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