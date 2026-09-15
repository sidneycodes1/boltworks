export default function (THREE) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a545c, roughness: 0.8 });
  mat.name = 'metal';

  // Main hull body - reinforced base
  const hullBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.85, 1.9),
    mat
  );
  hullBody.position.y = 0.425;
  g.add(hullBody);

  // Thick frontal armour plates - properly angled at 30 degrees
  const armourShape = new THREE.Shape();
  armourShape.moveTo(0, 0);
  armourShape.lineTo(0.5, 0.3);
  armourShape.lineTo(0.5, 0);
  armourShape.lineTo(0, 0);

  const armourGeo = new THREE.ExtrudeGeometry(armourShape, {
    depth: 1.9,
    bevelEnabled: false
  });

  // Layer 1
  const armourLayer1 = new THREE.Mesh(armourGeo, mat);
  armourLayer1.rotation.x = -Math.PI / 2;
  armourLayer1.rotation.z = Math.PI / 6;
  armourLayer1.position.set(1.3, 0.4, -0.95);
  g.add(armourLayer1);

  // Layer 2
  const armourLayer2 = new THREE.Mesh(armourGeo, mat);
  armourLayer2.rotation.x = -Math.PI / 2;
  armourLayer2.rotation.z = Math.PI / 6;
  armourLayer2.position.set(1.75, 0.6, -0.95);
  g.add(armourLayer2);

  // Angled side skirts - 15 degrees
  const skirtShape = new THREE.Shape();
  skirtShape.moveTo(-1.3, 0);
  skirtShape.lineTo(1.3, 0);
  skirtShape.lineTo(1.3, 0.55);
  skirtShape.lineTo(-1.3, 0.55);
  skirtShape.lineTo(-1.3, 0);

  const skirtGeo = new THREE.ExtrudeGeometry(skirtShape, {
    depth: 0.12,
    bevelEnabled: false
  });

  const skirtL = new THREE.Mesh(skirtGeo, mat);
  skirtL.rotation.x = -Math.PI / 2;
  skirtL.rotation.z = Math.PI / 12;
  skirtL.position.set(0, 0.275, 0.95);
  g.add(skirtL);

  const skirtR = new THREE.Mesh(skirtGeo, mat);
  skirtR.rotation.x = -Math.PI / 2;
  skirtR.rotation.z = -Math.PI / 12;
  skirtR.position.set(0, 0.275, -1.07);
  g.add(skirtR);

  // Raised central fighting compartment - 0.3m above main deck
  const fightingComp = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.35, 1.3),
    mat
  );
  fightingComp.position.set(0.1, 0.9, 0);
  g.add(fightingComp);

  // Reinforced rear engine deck
  const engineDeck = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.8, 1.4),
    mat
  );
  engineDeck.position.set(-1.55, 0.4, 0);
  g.add(engineDeck);

  // Ventilation grilles - rectangular, properly sized
  const grilleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  const grilleShape = new THREE.Shape();
  grilleShape.moveTo(0, 0);
  grilleShape.lineTo(0.35, 0);
  grilleShape.lineTo(0.35, 0.55);
  grilleShape.lineTo(0, 0.55);
  grilleShape.lineTo(0, 0);

  const grilleGeo = new THREE.ExtrudeGeometry(grilleShape, {
    depth: 0.08,
    bevelEnabled: false
  });

  const grille1 = new THREE.Mesh(grilleGeo, grilleMat);
  grille1.rotation.x = -Math.PI / 2;
  grille1.position.set(-1.55, 0.65, 0.35);
  g.add(grille1);

  const grille2 = grille1.clone();
  grille2.position.z = -0.43;
  g.add(grille2);

  // Top deck
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-1.7, 0);
  deckShape.lineTo(1.8, 0);
  deckShape.lineTo(1.8, 0.1);
  deckShape.lineTo(-1.7, 0.1);
  deckShape.lineTo(-1.7, 0);

  const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
    depth: 1.9,
    bevelEnabled: false
  });
  const deck = new THREE.Mesh(deckGeo, mat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 1.15, -0.95);
  g.add(deck);

  // Heavy cast texture details
  const castMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.85 });
  for (let i = 0; i < 8; i++) {
    const x = -1.2 + i * 0.35;
    const castDetail = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 6, 6),
      castMat
    );
    castDetail.position.set(x, 1.2, 0.85);
    g.add(castDetail);

    const castDetail2 = castDetail.clone();
    castDetail2.position.z = -0.85;
    g.add(castDetail2);
  }

  // Bolt details on armour layers
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.9 });
  const boltGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8);
  
  for (let z = -0.8; z <= 0.8; z += 0.4) {
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(1.5, 0.5, z);
    bolt.rotation.z = Math.PI / 2;
    g.add(bolt);

    const bolt2 = bolt.clone();
    bolt2.position.x = 1.9;
    g.add(bolt2);
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