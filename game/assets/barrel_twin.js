export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3d444a, roughness: 0.8 });
  mat.name = 'metal';

  // Twin barrels - parallel
  const barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 16);
  
  const barrel1 = new THREE.Mesh(barrelGeo, mat);
  barrel1.rotation.x = Math.PI / 2;
  barrel1.position.set(1.25, 0.075, 0);
  g.add(barrel1);

  const barrel2 = new THREE.Mesh(barrelGeo, mat);
  barrel2.rotation.x = Math.PI / 2;
  barrel2.position.set(1.25, -0.075, 0);
  g.add(barrel2);

  // Add barrel bands for detail
  const bandGeo = new THREE.TorusGeometry(0.042, 0.008, 8, 16);
  for (let i = 0; i < 3; i++) {
    const band1 = new THREE.Mesh(bandGeo, mat);
    band1.rotation.x = Math.PI / 2;
    band1.position.set(0.5 + i * 0.8, 0.075, 0);
    g.add(band1);

    const band2 = new THREE.Mesh(bandGeo, mat);
    band2.rotation.x = Math.PI / 2;
    band2.position.set(0.5 + i * 0.8, -0.075, 0);
    g.add(band2);
  }

  // Shared mounting block
  const mount = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.2, 0.15),
    mat
  );
  mount.position.set(-0.2, 0, 0);
  g.add(mount);

  // Muzzle brakes - small
  const muzzleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  const muzzleGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.08, 8);
  
  const muzzle1 = new THREE.Mesh(muzzleGeo, muzzleMat);
  muzzle1.rotation.x = Math.PI / 2;
  muzzle1.position.set(2.54, 0.075, 0);
  g.add(muzzle1);

  const muzzle2 = new THREE.Mesh(muzzleGeo, muzzleMat);
  muzzle2.rotation.x = Math.PI / 2;
  muzzle2.position.set(2.54, -0.075, 0);
  g.add(muzzle2);

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