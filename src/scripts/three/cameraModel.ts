/**
 * Placeholder low-poly film camera built from primitives (two reels on top,
 * box body, lens with hood, viewfinder, handle). Replaced automatically by
 * /public/models/camera.glb when that file exists (see HalftoneCamera.astro).
 *
 * Only tone matters: the halftone shader turns brightness into dot size, so
 * parts use different greys to read clearly as dots.
 */
import {
  Box3,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';

const mat = (grey: number) =>
  new MeshStandardMaterial({ color: new Color(grey, grey, grey), roughness: 1, metalness: 0, flatShading: true });

export function buildCameraModel(): Group {
  const camera = new Group();
  const body = mat(0.42);
  const dark = mat(0.12);
  const mid = mat(0.62);
  const light = mat(0.85);

  // Body
  const box = new Mesh(new BoxGeometry(2.3, 1.45, 1.05), body);
  camera.add(box);

  // Side door panel (slightly raised) for a little more shading detail
  const door = new Mesh(new BoxGeometry(1.5, 0.95, 0.06), mid);
  door.position.set(-0.15, 0, 0.55);
  camera.add(door);

  // Two film reels on top, Mickey-ears style. The camera points along +x,
  // so the reels face the sides (disc axis along z).
  const reel = (radius: number, x: number, y: number) => {
    const g = new Group();
    const disc = new Mesh(new CylinderGeometry(radius, radius, 0.26, 12), light);
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
    const hub = new Mesh(new CylinderGeometry(radius * 0.22, radius * 0.22, 0.34, 8), dark);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const hole = new Mesh(new CylinderGeometry(radius * 0.2, radius * 0.2, 0.3, 8), dark);
      hole.rotation.x = Math.PI / 2;
      hole.position.set(Math.cos(a) * radius * 0.55, Math.sin(a) * radius * 0.55, 0);
      g.add(hole);
    }
    g.position.set(x, y, 0);
    return g;
  };
  camera.add(reel(0.72, -0.5, 1.35));
  camera.add(reel(0.6, 0.75, 1.22));

  // Lens: barrel + hood, built along z, then turned to point forward along +x
  const lens = new Group();
  const barrel = new Mesh(new CylinderGeometry(0.36, 0.4, 0.8, 12), dark);
  barrel.rotation.x = Math.PI / 2;
  lens.add(barrel);
  const ring = new Mesh(new CylinderGeometry(0.43, 0.43, 0.12, 12), mid);
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 0.15;
  lens.add(ring);
  const hood = new Mesh(new CylinderGeometry(0.62, 0.42, 0.45, 12, 1, true), body);
  hood.rotation.x = Math.PI / 2;
  hood.position.z = 0.6;
  lens.add(hood);
  const glass = new Mesh(new CircleGeometry(0.34, 12), light);
  glass.position.z = 0.42;
  lens.add(glass);
  lens.position.set(1.15, -0.05, 0);
  lens.rotation.y = Math.PI / 2;
  camera.add(lens);

  // Viewfinder at the back
  const finder = new Mesh(new BoxGeometry(0.55, 0.35, 0.35), dark);
  finder.position.set(-1.35, 0.35, -0.15);
  camera.add(finder);
  const eyepiece = new Mesh(new CylinderGeometry(0.16, 0.2, 0.3, 10), mid);
  eyepiece.rotation.z = Math.PI / 2;
  eyepiece.position.set(-1.72, 0.35, -0.15);
  camera.add(eyepiece);

  // Pistol handle underneath
  const handle = new Mesh(new BoxGeometry(0.42, 0.85, 0.45), body);
  handle.position.set(0.15, -1.05, 0);
  handle.rotation.z = -0.25;
  camera.add(handle);

  // Centre the model around the origin
  const bounds = new Box3().setFromObject(camera);
  const centre = bounds.getCenter(new Vector3());
  camera.children.forEach((c) => c.position.sub(centre));
  return camera;
}
