/**
 * Short Film Competition: "Take 21".
 *
 * Scroll map (p):
 *   0.00-0.28  a giant clapperboard swings in, the clapstick creaks open
 *   0.28-0.34  SNAP: stick slams shut, the print flashes and shakes
 *   0.34-0.85  the board drops away and a spiral of film frames uncoils;
 *              the camera flies down the middle of it
 *   0.85-1.00  the frames burst outward, leaving the screen to the title
 */
import { Group, InstancedMesh, Matrix4, Object3D } from 'three';
import { box, grey, paper } from './kit';
import { lerp, smooth } from '../post';
import type { EventBuilder } from '../eventScene';

export const buildSfc: EventBuilder = ({ scene, camera, lite, portrait }) => {
  // ---- Clapperboard ----
  const board = new Group();
  const slate = box(4.2, 3, 0.18, grey(0.2));
  board.add(slate);
  // Chalk rows: PROD / SCENE / TAKE boxes.
  const chalk = grey(0.92);
  const rows: [number, number, number][] = [
    [-1.5, 0.75, 0.9], [0.2, 0.75, 2.2],
    [-1.5, 0.05, 0.9], [-0.2, 0.05, 1.1], [1.2, 0.05, 1.0],
    [-1.5, -0.65, 0.9], [0.4, -0.65, 2.6],
    [-1.4, -1.2, 1.1], [0.9, -1.2, 1.9],
  ];
  rows.forEach(([x, y, w]) => {
    const line = box(w, 0.07, 0.02, chalk);
    line.position.set(x + w / 2 - 0.45, y - 0.18, 0.1);
    board.add(line);
  });
  // Striped bar on top of the slate, and the hinged clapstick above it.
  const stripes = (parent: Group) => {
    const bar = box(4.2, 0.5, 0.2, grey(0.12));
    parent.add(bar);
    for (let i = 0; i < 6; i++) {
      const s = box(0.38, 0.62, 0.21, paper());
      s.position.set(-1.75 + i * 0.7, 0, 0.005);
      s.rotation.z = -0.6;
      s.scale.y = 0.85;
      parent.add(s);
    }
    return bar;
  };
  const lowBar = new Group();
  stripes(lowBar);
  lowBar.position.y = 1.75;
  board.add(lowBar);
  const hinge = new Group();
  hinge.position.set(-2.1, 2.02, 0);
  const stick = new Group();
  stripes(stick);
  stick.position.set(2.1, 0.27, 0);
  hinge.add(stick);
  board.add(hinge);
  scene.add(board);

  // ---- Film spiral ----
  const count = lite ? 34 : 60;
  const frameMat = grey(0.1);
  const windowMat = grey(0.86);
  const frames = new InstancedMesh(box(1.7, 1.2, 0.05, frameMat).geometry, frameMat, count);
  const windows = new InstancedMesh(box(1.38, 0.86, 0.06, windowMat).geometry, windowMat, count);
  const holesMat = paper();
  const holesPer = 6;
  const holes = new InstancedMesh(box(0.12, 0.09, 0.07, holesMat).geometry, holesMat, count * holesPer * 2);
  scene.add(frames, windows, holes);

  const dummy = new Object3D();
  const hole = new Object3D();
  const m = new Matrix4();
  const placeFrames = (t: number, uncoil: number, burst: number) => {
    for (let i = 0; i < count; i++) {
      const a = i * 0.42 + t * 0.25;
      const r = 2.6 + burst * (4 + (i % 5));
      const z = 2 - i * 1.15 * uncoil - (1 - uncoil) * 30;
      dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, z);
      dummy.rotation.set(0, 0, a + Math.PI / 2);
      dummy.updateMatrix();
      frames.setMatrixAt(i, dummy.matrix);
      windows.setMatrixAt(i, dummy.matrix);
      for (let k = 0; k < holesPer * 2; k++) {
        const side = k < holesPer ? 1 : -1;
        hole.position.set(-0.7 + (k % holesPer) * 0.28, side * 0.52, 0);
        hole.updateMatrix();
        m.multiplyMatrices(dummy.matrix, hole.matrix);
        holes.setMatrixAt(i * holesPer * 2 + k, m);
      }
    }
    frames.instanceMatrix.needsUpdate = windows.instanceMatrix.needsUpdate = holes.instanceMatrix.needsUpdate = true;
  };

  return {
    dotSize: 5,
    update({ p, t, mx, my, print }) {
      const near = portrait() ? 10.5 : 7.5;
      // Board swings in, then drops away.
      const swing = smooth(0, 0.22, p);
      const drop = smooth(0.36, 0.55, p);
      // Starts big on the right (the intro title sits on the left), swings to centre.
      const side = portrait() ? 0 : 2.2;
      board.position.set(lerp(side, 0, swing) + mx * 0.3, lerp(0.4, -0.2, swing) - drop * 9, lerp(-3, 0, swing));
      board.rotation.set(lerp(0.25, -0.06, swing) + my * 0.08 + drop * 1.2, lerp(-0.55, 0.12, swing) + mx * 0.15, lerp(-0.18, 0.04, swing) + drop * 0.5);
      // Clapstick: creaks open while swinging in, slams shut at the snap.
      const open = smooth(0.08, 0.26, p) * (1 - smooth(0.28, 0.315, p));
      hinge.rotation.z = open * 0.62 + Math.sin(t * 3) * 0.01 * open;

      // The snap: flash, coarse dots, camera shake that dies off.
      const snap = smooth(0.305, 0.315, p) * (1 - smooth(0.315, 0.37, p));
      print.dotScale = 1 + snap * 1.6;
      print.tone = 1 - snap * 0.85;
      const shake = snap * 0.35;

      // Spiral: uncoils toward us, the camera dives down it, then it bursts.
      const uncoil = smooth(0.32, 0.6, p);
      const dive = smooth(0.4, 0.92, p);
      const burst = smooth(0.82, 1, p);
      // The spiral only exists once it starts uncoiling; the board is gone once it has dropped.
      const spiralOn = uncoil > 0.001;
      frames.visible = windows.visible = holes.visible = spiralOn;
      if (spiralOn) placeFrames(t, uncoil, burst);
      board.visible = drop < 0.999;
      camera.position.set(
        mx * 0.6 + Math.sin(t * 40) * shake,
        my * -0.4 + Math.cos(t * 37) * shake,
        lerp(near, -42, dive),
      );
      camera.lookAt(mx * 0.4, 0, camera.position.z - 10);
      camera.rotation.z += dive * 0.6 + Math.sin(t * 0.4) * 0.03;
    },
  };
};
