# BOLTWORKS — the locked style

> Industrial military vehicles built from riveted steel plates, welded joints, and rough cast components, with a worn tactical finish showing field use and weathering.

| role | hex | where it belongs |
|---|---|---|
| hull base | `0x4a545c` | main tank bodies, hull structures |
| tracks | `0x2a2e32` | tank tracks, wheels, undercarriage |
| turret | `0x3d444a` | turret shells, rotating parts |
| armour | `0x5c6874` | bolt-on armour plates, reinforcing |
| accent | `0xffb45a` | warning markings, control highlights |
| damage | `0x8b3a3a` | battle damage, scorched areas |
| ground | `0x3a3e42` | arena floor slabs, terrain |
| wall | `0x2d3136` | barrier blocks, arena walls |
| supply | `0x6b7a8a` | crates, fuel drums, supply objects |
| highlight | `0x8fb4d8` | muzzle flashes, energy effects |

## Fixed decisions
- Metres. Player tank is 3.2m long, 1.8m wide, 1.6m tall. Wall block is 1.0m cube. Barrier is 2.0m x 0.8m. Enemy tanks within 0.8x-1.4x player size.
- Base at y = 0, centred on x and z, front faces +Z.
- Flat colours with sensible roughness; surfaces are applied at load time.
- Material names from the contract's list, not a shortened one: plaster | stone | timber | tile | metal | fabric | foliage | ground.
- No glyphs anywhere. No printed text on any 3D object.