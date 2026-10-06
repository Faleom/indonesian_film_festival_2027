/**
 * Main Screening: premiere night in the cinema.
 *
 * Scroll map (p):
 *   0.00-0.25  from the back row: the hall, curtains closed and swaying,
 *              searchlights sweeping, marquee bulbs chasing round the arch
 *   0.20-0.55  the curtains draw open on the white screen
 *   0.35-0.92  the camera flies low over the rows of seats to the stage
 *   0.88-1.00  the screen fills the view: the title is on it
 */
import { ConeGeometry, CylinderGeometry, Group, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, SphereGeometry } from 'three';
import { box, glow, grey, mesh, paper } from './kit';
import { lerp, smooth } from '../post';
import type { EventBuilder } from '../eventScene';

/** Curtain: a plane with deep sine folds; folds bunch up as it opens. */
function curtain(width: number, height: number) {
  const geo = new PlaneGeometry(width, height, 48, 1);
  const base = Float32Array.from(geo.attributes.position.array);
  const m = mesh(geo, grey(0.32));
  (m.material as { side: number }).side = 2;
  const setOpen = (open: number, t: number) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x0 = base[i * 3];
      const u = (x0 + width / 2) / width; // 0 at the outer edge, 1 at the middle
      const x = x0 * (1 - open * 0.82) - open * width * 0.41;
      const fold = Math.sin(u * 22) * (0.18 + open * 0.35) + Math.sin(t * 1.3 + u * 6) * 0.04 * (1 - open);
      pos.setXYZ(i, x, base[i * 3 + 1], fold);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  // Fully open, the folds stop swaying: skip rebuilding the geometry.
  let last = -1;
  const update = (open: number, t: number) => {
    if (open >= 1 && last >= 1) return;
    last = open;
    setOpen(open, t);
  };
  return { mesh: m, setOpen: update };
}

export const buildMain: EventBuilder = ({ scene, camera, lite, portrait }) => {
  const hall = new Group();
  scene.add(hall);

  // Floor, walls, ceiling: dark room so the screen and bulbs read as light.
  const floor = box(30, 0.2, 46, grey(0.25));
  floor.position.set(0, -0.1, 4);
  const back = box(30, 14, 0.4, grey(0.18));
  back.position.set(0, 7, -14.5);
  hall.add(floor, back);
  for (const side of [-1, 1]) {
    const wall = box(0.4, 14, 46, grey(0.3));
    wall.position.set(side * 15, 7, 4);
    hall.add(wall);
  }

  // Stage, screen, proscenium arch.
  const stage = box(22, 1.4, 5, grey(0.4));
  stage.position.set(0, 0.7, -11.5);
  const screen = box(16, 9, 0.1, paper());
  screen.position.set(0, 6.4, -13.9);
  hall.add(stage, screen);
  const archMat = grey(0.12);
  const archTop = box(22, 2, 0.8, archMat);
  archTop.position.set(0, 12, -12.6);
  hall.add(archTop);
  for (const side of [-1, 1]) {
    const col = box(2, 12, 0.8, archMat);
    col.position.set(side * 10, 6, -12.6);
    hall.add(col);
  }
  // Valance with scalloped hem.
  const valance = box(18, 1.4, 0.3, grey(0.22));
  valance.position.set(0, 10.6, -12.9);
  hall.add(valance);
  for (let i = 0; i < 12; i++) {
    const scallop = mesh(new CylinderGeometry(0.75, 0.75, 0.3, 14, 1, false, 0, Math.PI), grey(0.22));
    scallop.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    scallop.position.set(-8.25 + i * 1.5, 9.9, -12.9);
    hall.add(scallop);
  }

  const left = curtain(9.2, 10);
  const right = curtain(9.2, 10);
  left.mesh.position.set(-4.6, 6, -13);
  right.mesh.position.set(4.6, 6, -13);
  right.mesh.scale.x = -1; // mirrored: opens to the right
  hall.add(left.mesh, right.mesh);

  // Marquee bulbs round the arch: two interleaved sets that swap (chase).
  const bulbGeo = new SphereGeometry(0.2, 8, 6);
  const spots: [number, number][] = [];
  for (let i = 0; i <= 20; i++) spots.push([-10.6 + i * 1.06, 13.15]);
  for (let i = 1; i <= 11; i++) spots.push([-10.6, 13.15 - i * 1.1], [10.6, 13.15 - i * 1.1]);
  const litA = new InstancedMesh(bulbGeo, paper(), spots.length);
  const litB = new InstancedMesh(bulbGeo, paper(), spots.length);
  const dimMat = grey(0.15);
  const dim = new InstancedMesh(bulbGeo, dimMat, spots.length);
  const d = new Object3D();
  let a = 0;
  let b = 0;
  spots.forEach(([x, y], i) => {
    d.position.set(x, y, -12.15);
    d.updateMatrix();
    dim.setMatrixAt(i, d.matrix);
    if (i % 2) litA.setMatrixAt(a++, d.matrix);
    else litB.setMatrixAt(b++, d.matrix);
  });
  litA.count = a;
  litB.count = b;
  hall.add(dim, litA, litB);

  // Seats: curved rows, each seat = back + cushion.
  const rows = lite ? 8 : 12;
  const perRow = lite ? 12 : 18;
  const seatBack = new InstancedMesh(box(0.9, 1.1, 0.15, grey(0.1)).geometry, grey(0.1), rows * perRow);
  const seatBase = new InstancedMesh(box(0.9, 0.2, 0.8, grey(0.2)).geometry, grey(0.2), rows * perRow);
  let n = 0;
  for (let r = 0; r < rows; r++) {
    const z = -5 + r * 2;
    const y = r * 0.35; // raked floor
    for (let s = 0; s < perRow; s++) {
      const x = (s - (perRow - 1) / 2) * 1.15;
      if (Math.abs(x) < 0.8) continue; // centre aisle
      const curve = (x * x) * 0.012;
      d.position.set(x, y + 0.9, z + curve + 0.4);
      d.rotation.set(0, -x * 0.02, 0);
      d.updateMatrix();
      seatBack.setMatrixAt(n, d.matrix);
      d.position.set(x, y + 0.45, z + curve);
      d.updateMatrix();
      seatBase.setMatrixAt(n, d.matrix);
      n++;
    }
  }
  seatBack.count = seatBase.count = n;
  hall.add(seatBack, seatBase);

  // Searchlights from the back corners (see-through cones of light).
  const beams = [-1, 1].map((side) => {
    const pivot = new Group();
    pivot.position.set(side * 12, 12, 22);
    const cone = mesh(new ConeGeometry(4, 34, 16, 1, true), glow(0.18));
    cone.position.y = -17;
    pivot.add(cone);
    hall.add(pivot);
    return pivot;
  });
  const beamMats = beams.map((p) => (p.children[0] as unknown as { material: MeshBasicMaterial }).material);

  return {
    dotSize: 4.6,
    update({ p, t, mx, my }) {
      // Curtains: sway, then draw open.
      const open = smooth(0.2, 0.55, p);
      left.setOpen(open, t);
      right.setOpen(open, t);

      // Bulb chase: swap the two sets ~3 times a second.
      const phase = Math.floor(t * 3) % 2 === 0;
      litA.visible = phase;
      litB.visible = !phase;

      // Searchlights sweep toward the stage; fade as we get close.
      beams.forEach((pivot, i) => {
        const side = i ? 1 : -1;
        pivot.rotation.set(1.15 + Math.sin(t * 0.7 + i) * 0.12, side * (0.35 + Math.sin(t * 0.5 + i * 2) * 0.25), 0);
      });
      const beamFade = 1 - smooth(0.6, 0.9, p);
      beamMats.forEach((m) => (m.opacity = 0.2 * beamFade));
      beams.forEach((b) => (b.visible = beamFade > 0));

      // Camera: back of the hall -> low over the seats -> facing the screen.
      const fly = smooth(0.3, 0.92, p);
      const land = smooth(0.85, 1, p);
      const endZ = portrait() ? 8 : 3.2;
      const z = lerp(24, endZ, fly);
      const y = lerp(9, 4, smooth(0.3, 0.7, p)) + lerp(0, 2.4, land) + Math.sin(fly * Math.PI) * -1.2;
      camera.position.set(mx * 1.2 * (1 - land), y - my * 0.4, z);
      camera.lookAt(mx * 0.6 * (1 - land), lerp(4, 6.4, smooth(0.4, 1, p)), -14);
      camera.fov = lerp(52, portrait() ? 58 : 46, land);
      camera.updateProjectionMatrix();
    },
  };
};
