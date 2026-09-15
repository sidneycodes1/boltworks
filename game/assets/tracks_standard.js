export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  mat.name = 'metal';

  // Track frame - rectangular loop
  const trackFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.35, 0.4),
    mat
  );
  trackFrame.position.y = 0.175;
  g.add(trackFrame);

  // Road wheels - 12 wheels with proper spacing (optimized)
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  const wheelGeo = new THREE.CylinderGeometry(0.175, 0.175, 0.38, 12);
  
  const wheelSpacing = 0.18;
  const startX = -1.0;
  
  for (let i = 0; i < 12; i++) {
    const x = startX + i * wheelSpacing;
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.175, 0);
    g.add(wheel);
  }

  // Drive sprockets - 2 at front
  const sprocketMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  const sprocketGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.42, 12);
  
  const sprocketFront = new THREE.Mesh(sprocketGeo, sprocketMat);
  sprocketFront.rotation.x = Math.PI / 2;
  sprocketFront.position.set(1.2, 0.175, 0);
  g.add(sprocketFront);

  const sprocketRear = sprocketFront.clone();
  sprocketRear.position.set(-1.2, 0.175, 0);
  g.add(sprocketRear);

  // Idler wheels - 2 at rear (smaller)
  const idlerGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.38, 12);
  
  const idlerFront = new THREE.Mesh(idlerGeo, wheelMat);
  idlerFront.rotation.x = Math.PI / 2;
  idlerFront.position.set(1.35, 0.175, 0);
  g.add(idlerFront);

  const idlerRear = idlerFront.clone();
  idlerRear.position.set(-1.35, 0.175, 0);
  g.add(idlerRear);

  // Track links - individual plates with connecting pins (optimized)
  const linkMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  const linkGeo = new THREE.BoxGeometry(0.08, 0.12, 0.44);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  const pinGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.46, 6);
  
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const radius = 0.26;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius + 0.175;
    
    const link = new THREE.Mesh(linkGeo, linkMat);
    link.position.set(x, y, 0);
    link.rotation.z = angle;
    g.add(link);

    // Connecting pin
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(x, y, 0);
    g.add(pin);
  }

  // Rubber rim detail on wheels - optimized
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.95 });
  const rubberGeo = new THREE.TorusGeometry(0.15, 0.025, 6, 12);
  
  for (let i = 0; i < 12; i++) {
    const x = startX + i * wheelSpacing;
    const rubber = new THREE.Mesh(rubberGeo, rubberMat);
    rubber.rotation.x = Math.PI / 2;
    rubber.position.set(x, 0.175, 0.23);
    g.add(rubber);

    const rubber2 = rubber.clone();
    rubber2.position.z = -0.23;
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