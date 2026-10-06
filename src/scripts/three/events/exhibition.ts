/**
 * Film Exhibition: a walk through the gallery.
 *
 * Scroll map (p):
 *   0.00-0.12  lights come up on the corridor, one bay at a time
 *   0.08-0.82  the camera walks down the hall, turning to look at the framed
 *              works and the exhibits on pedestals (the festival camera, a
 *              film reel, a costume, a clapper), which slowly turn
 *   0.82-1.00  it stops in front of the big empty frame at the end: the title
 *              hangs there
 */
import { CylinderGeometry, Group, SphereGeometry, TorusGeometry, ConeGeometry, PointLight } from 'three';
import { buildCameraModel } from '../cameraModel';
import { box, flat, grey, mesh, paper, rng } from './kit';
import { lerp, smooth } from '../post';
import type { EventBuilder } from '../eventScene';

const BAY = 7; // metres between pedestals
export const buildExhibition: EventBuilder = ({ scene, camera, lite, portrait }) => {
  const rand = rng(7);
  const bays = lite ? 5 : 7;
  const length = bays * BAY + 10;
  const hall = new Group();
  scene.add(hall);

  // Floor (checker tiles), walls, a ceiling beam rhythm.
  const floor = box(9, 0.1, length, grey(0.62));
  floor.position.set(0, -0.05, -length / 2 + 6);
  hall.add(floor);
  const tileMat = grey(0.42);
  for (let z = 0; z < length; z += 2) {
    for (let x = -4; x < 4; x += 2) {
      if (((x + z) / 2) % 2 !== 0) continue;
      const tile = box(1.98, 0.02, 1.98, tileMat);
      tile.position.set(x + 1, 0.01, -z + 5);
      hall.add(tile);
    }
  }
  const wallMat = grey(0.88);
  for (const side of [-1, 1]) {
    const wall = box(0.2, 5.5, length, wallMat);
    wall.position.set(side * 4.5, 2.75, -length / 2 + 6);
    hall.add(wall);
    // Skirting and picture rail.
    const rail = box(0.06, 0.08, length, grey(0.2));
    rail.position.set(side * 4.38, 3.9, -length / 2 + 6);
    hall.add(rail);
  }
  const beamMat = grey(0.3);
  for (let i = 0; i < bays + 2; i++) {
    const beam = box(9, 0.3, 0.3, beamMat);
    beam.position.set(0, 5.4, 4 - i * BAY);
    hall.add(beam);
  }

  // Framed works on both walls: dark frames, canvases in assorted tones.
  const frameMat = grey(0.08);
  for (let i = 0; i < bays * 2; i++) {
    const side = i % 2 ? 1 : -1;
    const w = 1.6 + rand() * 1.4;
    const h = 1.2 + rand() * 1.2;
    const g = new Group();
    g.add(box(w, h, 0.12, frameMat));
    const canvas = box(w - 0.3, h - 0.3, 0.13, grey(0.25 + rand() * 0.55));
    g.add(canvas);
    // A few canvases get a halftone "subject": a darker shape inside.
    if (rand() > 0.4) {
      const subject = mesh(new SphereGeometry(Math.min(w, h) * 0.22, 10, 8), grey(0.12));
      subject.scale.z = 0.1;
      subject.position.set((rand() - 0.5) * w * 0.3, (rand() - 0.5) * h * 0.2, 0.08);
      g.add(subject);
    }
    g.position.set(side * 4.38, 2.1 + rand() * 0.4, -Math.floor(i / 2) * BAY - 2 - rand() * 2);
    g.rotation.y = -side * Math.PI / 2;
    hall.add(g);
  }

  // Exhibits on pedestals down the middle.
  const exhibits: Group[] = [];
  const pedestalMat = grey(0.92);
  const makers = [
    () => {
      const cam = buildCameraModel();
      cam.scale.setScalar(0.55);
      return cam;
    },
    () => {
      const reel = new Group();
      const disc = mesh(new CylinderGeometry(0.75, 0.75, 0.08, 28), grey(0.25));
      disc.rotation.x = Math.PI / 2;
      reel.add(disc);
      for (let k = 0; k < 6; k++) {
        const hole = mesh(new CylinderGeometry(0.17, 0.17, 0.1, 14), paper());
        hole.rotation.x = Math.PI / 2;
        const a = (k / 6) * Math.PI * 2;
        hole.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0);
        reel.add(hole);
      }
      const rim = mesh(new TorusGeometry(0.75, 0.05, 6, 32), grey(0.1));
      reel.add(rim);
      reel.position.y = 0.4;
      return reel;
    },
    () => {
      // Costume on a dress form: torso cone, skirt cone, head ball, stand.
      const form = new Group();
      const skirt = mesh(new ConeGeometry(0.7, 1.3, 12, 1, true), grey(0.3));
      skirt.position.y = 0.2;
      const torso = mesh(new CylinderGeometry(0.28, 0.4, 0.9, 10), grey(0.5));
      torso.position.y = 1.15;
      const head = mesh(new SphereGeometry(0.2, 10, 8), grey(0.7));
      head.position.y = 1.85;
      form.add(skirt, torso, head);
      return form;
    },
    () => {
      const clap = new Group();
      clap.add(box(1.1, 0.8, 0.06, grey(0.15)));
      const stick = box(1.1, 0.15, 0.06, grey(0.9));
      stick.position.set(0, 0.5, 0);
      stick.rotation.z = 0.25;
      clap.add(stick);
      clap.position.y = 0.45;
      return clap;
    },
  ];
  for (let i = 0; i < bays; i++) {
    const g = new Group();
    const pedestal = box(1, 1.1, 1, pedestalMat);
    pedestal.position.y = 0.55;
    g.add(pedestal);
    const item = makers[i % makers.length]();
    item.position.y += 1.1;
    const spin = new Group();
    spin.add(item);
    spin.position.y = 0;
    g.add(spin);
    // Little placard.
    const card = box(0.5, 0.3, 0.02, flat(0.95));
    card.position.set(0, 0.75, 0.52);
    g.add(card);
    g.position.set(i % 2 ? 1.6 : -1.6, 0, -i * BAY - 5);
    hall.add(g);
    exhibits.push(spin);
  }

  // The end wall with the big frame for the title (its canvas is bare paper).
  const endZ = -bays * BAY - 3;
  const end = new Group();
  end.add(box(9, 5.5, 0.2, wallMat));
  const big = box(6.4, 3.4, 0.2, frameMat);
  big.position.set(0, 2.85 - 2.75, 0.12);
  const bigCanvas = box(5.9, 2.9, 0.22, paper());
  bigCanvas.position.copy(big.position);
  end.add(big, bigCanvas);
  end.position.set(0, 2.75, endZ);
  hall.add(end);

  // Bay lights: point lights that switch on one after another.
  const lights: PointLight[] = [];
  for (let i = 0; i < Math.min(bays, 4); i++) {
    const l = new PointLight(0xffffff, 0, 12, 1.6);
    l.position.set(0, 4.8, -i * BAY * 1.6 - 3);
    hall.add(l);
    lights.push(l);
  }

  return {
    dotSize: 4.6,
    update({ p, t, mx, my }) {
      const walk = smooth(0.06, 0.86, p);
      const z = lerp(8, endZ + (portrait() ? 9.5 : 7), walk);
      // Glance at the walls as we pass (alternating), straighten up at the end.
      const glance = Math.sin(walk * bays * Math.PI) * 0.38 * (1 - smooth(0.78, 0.88, p));
      camera.position.set(Math.sin(walk * 6) * 0.35 + mx * 0.3, 1.75 + Math.sin(walk * 40) * 0.025 + my * -0.15, z);
      camera.lookAt(camera.position.x + Math.sin(glance + mx * 0.25) * 6, 1.8 - my * 0.4, z - Math.cos(glance) * 6);
      exhibits.forEach((g, i) => (g.rotation.y = t * 0.35 + i));
      lights.forEach((l, i) => {
        const on = smooth(i * 0.03, i * 0.03 + 0.04, p);
        // Fluorescent stutter while switching on.
        const stutter = on > 0 && on < 1 ? (Math.sin(t * 60 + i) > 0 ? 1 : 0.2) : 1;
        l.intensity = on * stutter * 14;
      });
    },
  };
};
