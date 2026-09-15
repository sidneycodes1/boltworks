export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  mat.name = 'metal';

  // Track frame - wider
  const trackFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.4, 0.6),
    mat
  );
  trackFrame.position.y = 0.2;
  g.add(trackFrame);

  // Road wheels - 14 wheels, larger
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.58, 12);
  
  for (let i = 0; i < 14; i++) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(-1.1 + i * 0.17, 0.2, 0);
    g.add(wheel);
  }

  // Drive sprockets - larger
  const sprocketMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  const sprocketGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.62, 12);
  
  const sprocket1 = new THREE.Mesh(sprocketGeo, sprocketMat);
  sprocket1.rotation.x = Math.PI / 2;
  sprocket1.position.set(1.3, 0.2, 0);
  g.add(sprocket1);

  const sprocket2 = sprocket1.clone();
  sprocket2.position.set(-1.3, 0.2, 0);
  g.add(sprocket2);

  // Idler wheels
  const idlerGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.58, 12);
  
  const idler1 = new THREE.Mesh(idlerGeo, wheelMat);
  idler1.rotation.x = Math.PI / 2;
  idler1.position.set(1.45, 0.2, 0);
  g.add(idler1);

  const idler2 = idler1.clone();
  idler2.position.set(-1.45, 0.2, 0);
  g.add(idler2);

  // Track links - wider plates, reinforced
  const linkMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  const linkGeo = new THREE.BoxGeometry(0.1, 0.14, 0.64);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  const pinGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.66, 6);
  
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    const radius = 0.3;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius + 0.2;
    
    const link = new THREE.Mesh(linkGeo, linkMat);
    link.position.set(x, y, 0);
    link.rotation.z = angle;
    g.add(link);

    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(x, y, 0);
    g.add(pin);
  }

  // Heavy rim detail
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.95 });
  const rubberGeo = new THREE.TorusGeometry(0.18, 0.03, 6, 12);
  
  for (let i = 0; i < 14; i++) {
    const rubber = new THREE.Mesh(rubberGeo, rubberMat);
    rubber.rotation.x = Math.PI / 2;
    rubber.position.set(-1.1 + i * 0.17, 0.2, 0.31);
    g.add(rubber);

    const rubber2 = rubber.clone();
    rubber2.position.z = -0.31;
    g.add(rubber2);
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