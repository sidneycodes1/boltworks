export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  mat.name = 'metal';

  // Main hull body - more detailed construction
  const hullBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.7, 1.6),
    mat
  );
  hullBody.position.y = 0.35;
  g.add(hullBody);

  // Front glacis - properly sloped at 45 degrees from front bottom
  const glacisShape = new THREE.Shape();
  glacisShape.moveTo(0, 0);
  glacisShape.lineTo(0.6, 0.6);
  glacisShape.lineTo(0.6, 0);
  glacisShape.lineTo(0, 0);

  const glacisGeo = new THREE.ExtrudeGeometry(glacisShape, {
    depth: 1.6,
    bevelEnabled: false
  });
  const glacis = new THREE.Mesh(glacisGeo, mat);
  glacis.rotation.x = -Math.PI / 2;
  glacis.position.set(1.1, 0, -0.8);
  g.add(glacis);

  // Rear engine compartment - vertical box
  const engine = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.65, 1.3),
    mat
  );
  engine.position.set(-1.35, 0.325, 0);
  g.add(engine);

  // Top deck with slight camber
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-1.4, 0);
  deckShape.lineTo(1.4, 0);
  deckShape.lineTo(1.4, 0.1);
  deckShape.lineTo(-1.4, 0.1);
  deckShape.lineTo(-1.4, 0);

  const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
    depth: 1.6,
    bevelEnabled: false
  });
  const deck = new THREE.Mesh(deckGeo, mat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.75, -0.8);
  g.add(deck);

  // Side sponsons for track mounting - properly positioned
  const sponsonShape = new THREE.Shape();
  sponsonShape.moveTo(-0.9, 0);
  sponsonShape.lineTo(0.9, 0);
  sponsonShape.lineTo(0.9, 0.25);
  sponsonShape.lineTo(-0.9, 0.25);
  sponsonShape.lineTo(-0.9, 0);

  const sponsonGeo = new THREE.ExtrudeGeometry(sponsonShape, {
    depth: 0.25,
    bevelEnabled: false
  });
  const sponsonMat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  sponsonMat.name = 'metal';

  const sponsonL = new THREE.Mesh(sponsonGeo, sponsonMat);
  sponsonL.rotation.x = -Math.PI / 2;
  sponsonL.position.set(0, 0.125, 0.8);
  g.add(sponsonL);

  const sponsonR = sponsonL.clone();
  sponsonR.position.z = -1.05;
  g.add(sponsonR);

  // Rivet details along panel seams - more detailed pattern
  const rivetMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.9 });
  const rivetGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.04, 8);
  
  // Rivets along top deck edges
  for (let x = -1.2; x <= 1.2; x += 0.3) {
    const rivet = new THREE.Mesh(rivetGeo, rivetMat);
    rivet.position.set(x, 0.75, 0.82);
    rivet.rotation.x = Math.PI / 2;
    g.add(rivet);
    
    const rivet2 = rivet.clone();
    rivet2.position.z = -0.82;
    g.add(rivet2);
  }

  // Rivets along glacis seam
  for (let z = -0.7; z <= 0.7; z += 0.35) {
    const rivet = new THREE.Mesh(rivetGeo, rivetMat);
    rivet.position.set(1.1, 0.35, z);
    rivet.rotation.z = Math.PI / 2;
    g.add(rivet);
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