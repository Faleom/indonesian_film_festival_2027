/**
 * Under the Stars: an open-air screening at night.
 *
 * The sky is a dome of ink with the stars left as bare paper, so the night
 * really prints dark; the screen is pure white (no ink) and reads as light.
 *
 * Scroll map (p):
 *   0.00-0.30  looking straight up into the stars; a shooting star; the sky turns
 *   0.25-0.55  the camera tilts down over the crowd to the screen and the
 *              string lights; the projector beam flickers on
 *   0.50-0.80  it rises and pulls back over the field
 *   0.80-1.00  it glides in to the glowing screen: the title is on it
 */
import {
  BackSide,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import { box, glow, grey, mesh, paper, rng } from './kit';
import { lerp, smooth } from '../post';
import type { EventBuilder } from '../eventScene';

export const buildUts: EventBuilder = ({ scene, camera, lite, portrait }) => {
  const rand = rng(3);

  // ---- Sky dome: ink, darker toward the top ----
  const skyGeo = new SphereGeometry(90, 32, 16);
  const pos = skyGeo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const h = Math.max(0, pos.getY(i) / 90);
    const g = lerp(0.62, 0.16, Math.pow(h, 0.6));
    colours.set([g, g, g], i * 3);
  }
  skyGeo.setAttribute('color', new BufferAttribute(colours, 3));
  const sky = mesh(skyGeo, new MeshBasicMaterial({ vertexColors: true, side: BackSide }));
  scene.add(sky);

  // ---- Stars: paper-white specks on the dome ----
  const starCount = lite ? 260 : 520;
  const stars = new InstancedMesh(new IcosahedronGeometry(0.28, 0), paper(), starCount);
  const d = new Object3D();
  for (let i = 0; i < starCount; i++) {
    const u = rand() * 0.92 + 0.08; // above the horizon
    const th = rand() * Math.PI * 2;
    const r = 80;
    const s = Math.sqrt(1 - u * u);
    d.position.set(Math.cos(th) * s * r, u * r, Math.sin(th) * s * r);
    d.scale.setScalar(rand() < 0.08 ? 2.4 : 0.6 + rand());
    d.updateMatrix();
    stars.setMatrixAt(i, d.matrix);
  }
  scene.add(stars);
  const moon = mesh(new SphereGeometry(5, 24, 16), paper());
  moon.position.set(-30, 52, -40);
  const bite = mesh(new SphereGeometry(4.6, 24, 16), new MeshBasicMaterial({ color: new Color(0.2, 0.2, 0.2) }));
  bite.position.set(-27.4, 53.4, -38);
  scene.add(moon, bite);
  const shooter = box(6, 0.12, 0.12, paper());
  scene.add(shooter);

  // ---- Ground, screen, crowd, lights ----
  const ground = mesh(new CylinderGeometry(70, 70, 0.2, 40), grey(0.3));
  ground.position.y = -0.1;
  scene.add(ground);

  const screen = new Group();
  const panel = box(12, 6.75, 0.12, paper());
  panel.position.y = 5.4;
  const border = box(12.6, 7.3, 0.08, grey(0.05));
  border.position.set(0, 5.4, -0.08);
  screen.add(border, panel);
  for (const side of [-1, 1]) {
    const pole = box(0.25, 9.5, 0.25, grey(0.1));
    pole.position.set(side * 6.6, 4.75, -0.2);
    screen.add(pole);
  }
  screen.position.z = -16;
  scene.add(screen);

  // Crowd: rows of heads and shoulders facing the screen, on mats.
  const people = lite ? 46 : 110;
  const bodyGeo = new CylinderGeometry(0.32, 0.42, 0.9, 8);
  const headGeo = new SphereGeometry(0.22, 8, 6);
  const bodies = new InstancedMesh(bodyGeo, grey(0.08), people);
  const heads = new InstancedMesh(headGeo, grey(0.08), people);
  for (let i = 0; i < people; i++) {
    const row = Math.floor(i / 11);
    const x = ((i % 11) - 5) * 1.25 + (rand() - 0.5) * 0.5;
    const z = -9 + row * 1.6 + (rand() - 0.5) * 0.4;
    const sc = 0.85 + rand() * 0.3;
    d.position.set(x, 0.45 * sc, z);
    d.scale.setScalar(sc);
    d.rotation.set(0, (rand() - 0.5) * 0.4, 0);
    d.updateMatrix();
    bodies.setMatrixAt(i, d.matrix);
    d.position.y = 1.05 * sc;
    d.updateMatrix();
    heads.setMatrixAt(i, d.matrix);
  }
  scene.add(bodies, heads);

  // String lights: catenaries from the screen poles out over the crowd.
  const bulbs = new InstancedMesh(new SphereGeometry(0.12, 6, 4), paper(), lite ? 60 : 120);
  const strands = [
    new CatmullRomCurve3([new Vector3(-6.6, 9, -16), new Vector3(-7, 5.5, -6), new Vector3(-9, 6.5, 6)]),
    new CatmullRomCurve3([new Vector3(6.6, 9, -16), new Vector3(7, 5.5, -6), new Vector3(9, 6.5, 6)]),
    new CatmullRomCurve3([new Vector3(-9, 6.5, 6), new Vector3(0, 4.8, 4), new Vector3(9, 6.5, 6)]),
  ];
  const per = Math.floor(bulbs.count / strands.length);
  strands.forEach((c, s) => {
    for (let k = 0; k < per; k++) {
      d.position.copy(c.getPoint(k / (per - 1)));
      d.scale.setScalar(1);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      bulbs.setMatrixAt(s * per + k, d.matrix);
    }
  });
  scene.add(bulbs);

  // Projector at the back and its beam (a see-through cone of light).
  const projector = new Group();
  projector.add(box(1, 0.7, 1.4, grey(0.15)));
  const lens = mesh(new CylinderGeometry(0.22, 0.22, 0.3, 12), grey(0.05));
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.8;
  projector.add(lens);
  projector.position.set(0, 2.2, 10);
  scene.add(projector);
  const beamLength = 26;
  const beam = mesh(new ConeGeometry(6.5, beamLength, 4, 1, true), glow(0.3));
  beam.rotation.x = -Math.PI / 2;
  beam.rotation.y = Math.PI / 4;
  beam.position.set(0, 3.8, 10 - beamLength / 2 - 0.6);
  beam.scale.set(1, 1, 0.6);
  scene.add(beam);
  const beamMat = beam.material as MeshBasicMaterial;

  const look = new Vector3();
  return {
    dotSize: 4.4,
    keyStrength: 0.7,
    update({ p, t, mx, my }) {
      sky.rotation.y = t * 0.01 + p * 0.6;
      stars.rotation.y = sky.rotation.y;
      // Twinkle: the whole star field breathes a hair.
      stars.scale.setScalar(1 + Math.sin(t * 2.3) * 0.03);

      // Shooting star every ~5 s while looking up.
      const cycle = (t % 5) / 5;
      const up = 1 - smooth(0.25, 0.5, p);
      shooter.visible = cycle < 0.18 && up > 0.2;
      shooter.position.set(lerp(-25, 25, cycle / 0.18), lerp(58, 48, cycle / 0.18), -30);
      shooter.rotation.z = -0.2;

      // Projector lamp stutters on as the screen comes into view.
      const on = smooth(0.32, 0.4, p);
      const flick = on > 0 && on < 1 ? (Math.sin(t * 50) > 0.2 ? 1 : 0.15) : 1;
      beamMat.opacity = 0.28 * on * flick;

      // Camera path.
      const tilt = smooth(0.22, 0.52, p);
      const rise = smooth(0.5, 0.78, p);
      const push = smooth(0.8, 1, p);
      const tight = portrait() ? 1.45 : 1;
      const camZ = lerp(lerp(12, 15, rise), -16 + 9 * tight, push);
      const camY = lerp(lerp(1.6, 7.5, rise), 5.4, push);
      camera.position.set(mx * 0.8, camY - my * 0.3, camZ);
      // The projector sits behind the camera's start point: hide it while it would block the shot.
      projector.visible = camZ > projector.position.z + 2 || camY > 4;
      look.set(mx * 2, lerp(lerp(40, 4.5, tilt), 5.4, push), lerp(lerp(-30, -16, tilt), -16, push));
      camera.lookAt(look);
      camera.fov = lerp(50, 40, push);
      camera.updateProjectionMatrix();
    },
  };
};
