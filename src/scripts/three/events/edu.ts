/**
 * Educational Screening: the class reader.
 *
 * A giant open book on the paper. Pages are hinged at the spine and curl as
 * they turn (three linked strips per page). Paper planes loop over it and a
 * pencil rolls across the spread.
 *
 * Scroll map (p):
 *   0.00-0.15  the book drops open from above
 *   0.12-0.72  the pages turn one after another, the camera orbits
 *   0.72-1.00  the camera dives onto the right-hand page: the title is printed there
 */
import { ConeGeometry, CylinderGeometry, Group, Mesh, BufferGeometry, Float32BufferAttribute } from 'three';
import { box, grey, mesh, rng } from './kit';
import { lerp, smooth } from '../post';
import type { EventBuilder } from '../eventScene';

const W = 4; // page width
const H = 5.2; // page height (along z)
const STRIPS = 3;

export const buildEdu: EventBuilder = ({ scene, camera, lite, portrait }) => {
  const rand = rng(11);
  const book = new Group();
  scene.add(book);

  // Covers and page blocks.
  const coverMat = grey(0.22);
  for (const side of [-1, 1]) {
    const cover = box(W + 0.3, 0.12, H + 0.3, coverMat);
    cover.position.set(side * (W / 2 + 0.05), -0.12, 0);
    const block = box(W, 0.35, H, grey(0.9));
    block.position.set(side * W / 2, 0.06, 0);
    book.add(cover, block);
  }
  // Text lines on the resting pages (left page only: the right page stays clear for the title).
  const lineMat = grey(0.35);
  const textLines = (parent: Group, x0: number, w: number, y: number) => {
    for (let r = 0; r < 13; r++) {
      if (r === 4 || r === 9) continue;
      const len = w * (r % 4 === 3 ? 0.55 : 0.85 + rand() * 0.1);
      const line = box(len, 0.01, 0.07, lineMat);
      line.position.set(x0 + len / 2, y, -H / 2 + 0.6 + r * 0.33);
      parent.add(line);
    }
  };
  textLines(book, -W + 0.35, W - 0.7, 0.24);

  // Turning pages: each = 3 linked strips that curl progressively.
  const pageCount = lite ? 5 : 8;
  const pages: Group[][] = [];
  const pageMat = grey(0.96);
  for (let i = 0; i < pageCount; i++) {
    const strips: Group[] = [];
    let parent: Group = book;
    for (let s = 0; s < STRIPS; s++) {
      const hinge = new Group();
      hinge.position.set(s === 0 ? 0 : W / STRIPS, s === 0 ? 0.25 + i * 0.004 : 0, 0);
      const leaf = box(W / STRIPS, 0.012, H, pageMat);
      leaf.position.x = W / STRIPS / 2;
      hinge.add(leaf);
      // Lines printed on the leaf (both faces read the same through the halftone).
      for (let r = 0; r < 12; r++) {
        if (r % 5 === 4) continue;
        const line = box(W / STRIPS - 0.15, 0.016, 0.06, lineMat);
        line.position.set(W / STRIPS / 2, 0, -H / 2 + 0.6 + r * 0.36);
        hinge.add(line);
      }
      parent.add(hinge);
      strips.push(hinge);
      parent = hinge;
    }
    pages.push(strips);
  }

  // Pencil: hexagonal barrel, cone tip, eraser.
  const pencil = new Group();
  const barrel = mesh(new CylinderGeometry(0.16, 0.16, 3, 6), grey(0.5));
  barrel.rotation.z = Math.PI / 2;
  const tip = mesh(new ConeGeometry(0.16, 0.45, 6), grey(0.85));
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 1.72;
  const lead = mesh(new ConeGeometry(0.05, 0.14, 6), grey(0.05));
  lead.rotation.z = -Math.PI / 2;
  lead.position.x = 1.98;
  const eraser = mesh(new CylinderGeometry(0.16, 0.16, 0.35, 10), grey(0.25));
  eraser.rotation.z = Math.PI / 2;
  eraser.position.x = -1.68;
  pencil.add(barrel, tip, lead, eraser);
  scene.add(pencil);

  // Paper planes: a folded dart shape.
  const dart = new BufferGeometry();
  dart.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0, -0.9, -0.55, 0.05, 0.5, 0, -0.12, 0.5, 0, 0, -0.9, 0, -0.12, 0.5, 0.55, 0.05, 0.5], 3),
  );
  dart.computeVertexNormals();
  const planeMat = grey(0.8);
  planeMat.side = 2;
  const planes: Mesh[] = [];
  for (let i = 0; i < (lite ? 2 : 4); i++) {
    const m = new Mesh(dart, planeMat);
    m.scale.setScalar(0.9);
    scene.add(m);
    planes.push(m);
  }

  // Desk shadow under the book (a soft dark slab).
  const shadow = box(W * 2 + 1.5, 0.02, H + 1.2, grey(0.6));
  shadow.position.set(0.25, -0.2, 0.25);
  scene.add(shadow);

  return {
    dotSize: 4.8,
    update({ p, t, mx, my }) {
      // Closed-ish book tilted toward us, then it settles flat on the desk.
      const drop = smooth(0, 0.12, p);
      book.position.y = lerp(2.2, 0, drop);
      book.rotation.set(lerp(0.5, 0, drop), lerp(0.4, 0, drop), lerp(-0.15, 0, drop));
      shadow.scale.setScalar(lerp(0.6, 1, drop));

      // Pages turn in sequence; each strip curls a bit more than the last.
      pages.forEach((strips, i) => {
        const start = 0.14 + i * (0.56 / pageCount);
        const k = smooth(start, start + 0.16, p);
        const a = -k * Math.PI;
        const lift = Math.sin(k * Math.PI);
        strips[0].rotation.z = -a;
        strips[1].rotation.z = lift * 0.35 + Math.sin(t * 2 + i) * 0.01 * lift;
        strips[2].rotation.z = lift * 0.45;
      });

      // Pencil rolls across the left page and back.
      const roll = Math.sin(t * 0.6) * 1.3;
      pencil.position.set(-W / 2 + roll * 0.4, 0.45 + book.position.y, 1.6);
      pencil.rotation.set(roll * 2.2, 0.3, 0);
      pencil.visible = drop > 0.9;

      // Planes loop around the book.
      planes.forEach((m, i) => {
        const a = t * 0.5 + (i / planes.length) * Math.PI * 2;
        const r = 6 + i;
        m.position.set(Math.cos(a) * r, 2.6 + Math.sin(a * 2) * 0.7 + i * 0.4, Math.sin(a) * r * 0.7);
        m.rotation.set(Math.sin(a * 2) * 0.2, -a, Math.cos(a) * 0.4);
      });

      // Camera: orbit while the pages turn, then dive onto the right page.
      const orbit = smooth(0.1, 0.72, p);
      const dive = smooth(0.72, 1, p);
      const ang = lerp(-0.7, 0.5, orbit) + mx * 0.15;
      const dist = portrait() ? 15 : 11;
      const cx = Math.sin(ang) * dist;
      const cz = Math.cos(ang) * dist;
      const target = { x: lerp(0, W / 2, dive), y: 0.3, z: 0 };
      const tight = portrait() ? 8.5 : 5.6;
      camera.position.set(lerp(cx, target.x, dive), lerp(7.5 - my * 0.8, tight, dive), lerp(cz, 0.01, dive));
      camera.lookAt(target.x, target.y, target.z);
    },
  };
};
