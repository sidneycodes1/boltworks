export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffb45a, emissive: 0xffb45a, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.1 });
  mat.name = 'metal';
  const geo = new THREE.OctahedronGeometry(0.35, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 8;
  mesh.position.y = 0.45;
  g.add(mesh);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8), new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.8 }));
  base.position.y = 0.02;
  g.add(base);
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
