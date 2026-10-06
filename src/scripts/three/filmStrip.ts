/**
 * The festival journey as a 3D film strip. Scrolling through the pinned
 * section slides a curved strip of frames past the camera: for each event a
 * title card, its b-roll and its film posters, all printed through the
 * halftone pass. As an event's frames reach the centre the pinned stage
 * re-inks in that event's colours (data-theme on the stage, not <body>:
 * re-theming the whole page restyled every element each frame of the colour
 * fade and stuttered on mid-range phones), and the HTML overlay
 * shows the event. Scrolling fast makes the dots chunkier and the plates
 * slip out of register, like a riso running too hot.
 */
import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  type Camera,
  type Material,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { createHalftonePass, createRenderer, ease, frameLoop, releaseRenderer, setInk, clamp01 } from './post';
import { coverFit, filmFrameTexture, loadMediaTexture, placeholderTexture, titleCardTexture } from './textures';
import type { SceneHandle } from './scene';

export interface StripEvent {
  id: string;
  theme: string;
  name: string;
  date: string;
}

export interface StripFrame {
  event: number;
  kind: 'title' | 'media';
  label?: string;
  type?: 'image' | 'video';
  src?: string | null;
}

export interface StripData {
  events: StripEvent[];
  frames: StripFrame[];
}

const SPACING = 2.0; // frame pitch along the strip (frames touch: continuous film)
const PICTURE_ASPECT = 1.6 / 1.2;


/**
 * How the strip is printed. classic: render, then halftone the whole screen.
 * solid (EXPERIMENT, stripSolidLook.ts): each surface prints its own dots.
 */
export interface StripLook {
  ink: Color;
  key: Color;
  antialias?: boolean;
  borderMaterial(tex: Texture): Material;
  pictureMaterial(aspect: number): Material;
  setPictureMap(mat: Material, tex: Texture): void;
  update(speed: number, t: number, dpr: number): void;
  setSize(width: number, height: number, dpr: number): void;
  render(renderer: WebGLRenderer, scene: Scene, camera: Camera): void;
  dispose(): void;
}

/** The original look: screen-space halftone post-pass over the whole strip. */
function classicLook(renderer: WebGLRenderer, dpr: number, lite: boolean): StripLook {
  const BASE_DOT = lite ? 5 : 4.5;
  const pass = createHalftonePass(renderer, dpr, { dotSize: BASE_DOT, keyStrength: 0.55 });
  const { uniforms } = pass;
  return {
    ink: uniforms.uInk.value,
    key: uniforms.uKey.value,
    borderMaterial: (tex) => new MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: DoubleSide }),
    pictureMaterial: () => new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }),
    setPictureMap(mat, tex) {
      (mat as MeshBasicMaterial).map = tex;
      mat.needsUpdate = true;
    },
    update(speed, t, dpr) {
      uniforms.uDotSize.value = BASE_DOT * dpr * (1 + speed * 0.9);
      uniforms.uMisregister.value.set((1.5 + speed * 9) * dpr, (-1 - speed * 6) * dpr);
      uniforms.uTime.value = t;
    },
    setSize: (width, height, dpr) => pass.setSize(width, height, dpr),
    render: (_, scene, camera) => pass.render(scene, camera),
    dispose: () => pass.dispose(),
  };
}

export async function mountFilmStrip(
  host: HTMLElement,
  data: StripData,
  { lite = false, look: lookName = 'classic', maxDpr: dprCap }: { lite?: boolean; look?: string; maxDpr?: number } = {},
): Promise<SceneHandle> {
  const stage = (host.querySelector('[data-strip-stage]') as HTMLElement) ?? host;
  const solidLook = lookName === 'solid' ? (await import('./stripSolidLook')).createSolidLook() : undefined;
  // Full device resolution (up to 2x) so it's crisp on retina; drops if frames run slow.
  // Phones/tablets (lite) start lower and use slightly bigger dots.
  const { renderer, canvas, dpr: maxDpr } = createRenderer(stage, { maxDpr: dprCap ?? (lite ? 1.25 : 2), antialias: !!solidLook });
  let dpr = maxDpr;
  const look: StripLook = (solidLook as StripLook | undefined) ?? classicLook(renderer, dpr, lite);

  const scene = new Scene();
  const strip = new Group();
  // Sits in the top two-thirds, leaving the bottom for the event panel.
  strip.position.y = 0.72;
  scene.add(strip);
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.25, 5.4);

  // ---- Frames ----
  const borderTex = filmFrameTexture();
  const borderGeo = new PlaneGeometry(2.0, 1.62);
  const pictureGeo = new PlaneGeometry(1.6, 1.2);
  const borderMat = look.borderMaterial(borderTex);
  const textures: Texture[] = [borderTex];
  const videos: HTMLVideoElement[] = [];
  // Built a couple of frames at a time, yielding in between: drawing all the
  // canvas textures in one go froze scrolling for ~180 ms on mid-range phones.
  const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));
  const frames: { group: Group; index: number; event: number }[] = [];
  for (const [i, f] of data.frames.entries()) {
    if (i % 2 === 1) await yieldToBrowser();
    const g = new Group();
    const pictureMat = look.pictureMaterial(PICTURE_ASPECT);
    const picture = new Mesh(pictureGeo, pictureMat);
    picture.position.z = -0.004;
    g.add(picture, new Mesh(borderGeo, borderMat));
    strip.add(g);

    const ev = data.events[f.event];
    const setMap = (t: Texture) => {
      look.setPictureMap(pictureMat, t);
      textures.push(t);
      // Upload now rather than on the frame it first scrolls into view.
      renderer.initTexture(t);
    };
    if (f.kind === 'title') {
      setMap(titleCardTexture({ number: f.event + 1, total: data.events.length, name: ev.name, date: ev.date }));
    } else {
      setMap(placeholderTexture(f.label ?? ''));
      if (f.src) {
        loadMediaTexture(f.src, f.type ?? 'image')
          .then(({ texture, video, aspect }) => {
            coverFit(texture, aspect, PICTURE_ASPECT);
            setMap(texture);
            if (video) {
              videos.push(video);
              if (active) video.play().catch(() => {});
            }
          })
          .catch((err) => console.warn('[film-strip]', err));
      }
    }
    frames.push({ group: g, index: i, event: f.event });
  }

  // Ink colours per event, read from the theme CSS.
  const probe = document.createElement('span');
  probe.hidden = true;
  host.append(probe);
  const inks = data.events.map((e) => {
    probe.dataset.theme = e.theme;
    const cs = getComputedStyle(probe);
    const ink = new Color();
    const key = new Color();
    setInk(ink, cs.getPropertyValue('--c-primary').trim());
    setInk(key, cs.getPropertyValue('--c-dark').trim());
    return { ink, key };
  });
  probe.remove();
  look.ink.copy(inks[0].ink);
  look.key.copy(inks[0].key);

  // ---- HUD (HTML overlay) ----
  const panels = [...host.querySelectorAll<HTMLElement>('[data-strip-panel]')];
  const segments = [...host.querySelectorAll<HTMLElement>('[data-strip-seg]')];
  const timecode = host.querySelector<HTMLElement>('[data-strip-timecode]');
  // Last values written to the HUD: rewriting unchanged text still forces a layout.
  let lastTimecode = '';
  const lastFill: string[] = [];
  const eventFrames = data.events.map((_, i) => data.frames.map((fr, idx) => (fr.event === i ? idx : -1)).filter((x) => x >= 0));
  let currentEvent = -1;

  // While pinned, the stage fills the screen, so only it (and the custom
  // cursor on top) needs the event's colours. Outside the pin they inherit
  // the page theme again.
  const themed = () => [stage, document.querySelector<HTMLElement>('.cursor')].filter((el): el is HTMLElement => !!el);
  let stageTheme: string | undefined;
  const setStageTheme = (theme: string | undefined) => {
    if (theme === stageTheme) return;
    stageTheme = theme;
    themed().forEach((el) => (theme ? (el.dataset.theme = theme) : delete el.dataset.theme));
  };

  const showEvent = (e: number, pinned: boolean) => {
    setStageTheme(pinned ? data.events[e].theme : undefined);
    if (e === currentEvent) return;
    currentEvent = e;
    panels.forEach((p, i) => p.classList.toggle('is-current', i === e));
  };

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    look.setSize(width, height, dpr);
    camera.aspect = width / height;
    // Keep roughly the same strip width on narrow (tablet) screens.
    camera.position.z = camera.aspect < 1.2 ? 7.2 : 5.4;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  const last = frames.length - 1;
  /**
   * Progress through the pinned section: 0 at the top, 1 when it unpins.
   * Measured against the sticky stage (100svh), not innerHeight: on iPhone
   * innerHeight changes while the toolbar slides away, which shook the strip.
   */
  const progress = () => {
    const r = host.getBoundingClientRect();
    const span = r.height - stage.offsetHeight;
    return span > 0 ? clamp01(-r.top / span) : 0;
  };
  const isPinned = () => {
    const r = host.getBoundingClientRect();
    return r.top <= 1 && r.bottom >= stage.offsetHeight - 1;
  };

  let offset = progress() * last;
  let velocity = 0;
  let active = false;
  const start = performance.now();

  const render = (dt = 1000 / 60) => {
    const t = (performance.now() - start) / 1000;
    const target = progress() * last;
    const prev = offset;
    offset += (target - offset) * ease(0.1, dt);
    // Velocity per 60 fps frame, so the bend/tilt is the same at any frame rate.
    // Smoothed more than the offset: Safari delivers momentum scroll in uneven
    // steps, and raw velocity made the strip's bend and tilt shake.
    const step = (offset - prev) * (1000 / 60 / Math.max(dt, 1));
    velocity += (step - velocity) * ease(0.08, dt);
    const speed = Math.min(Math.abs(velocity) * 12, 1.6);

    // Strip bends tighter and tilts with speed.
    const radius = 6.2 - speed * 1.4;
    strip.rotation.set(0.16, 0, -0.05 - velocity * 1.5);
    for (const f of frames) {
      const theta = ((f.index - offset) * SPACING) / radius;
      const visible = Math.abs(theta) < 1.45;
      f.group.visible = visible;
      if (!visible) continue;
      f.group.position.set(
        Math.sin(theta) * radius,
        Math.sin(theta * 1.6 + t * 0.6) * 0.12,
        (Math.cos(theta) - 1) * radius,
      );
      f.group.rotation.set(0, theta, Math.sin(theta * 2 + t * 0.4) * 0.03);
    }

    // Which event is at the centre, and re-ink towards it.
    const centre = Math.min(last, Math.max(0, Math.round(offset)));
    const ev = data.frames[centre].event;
    const pinned = isPinned();
    showEvent(ev, pinned);
    look.ink.lerp(inks[ev].ink, ease(0.08, dt));
    look.key.lerp(inks[ev].key, ease(0.08, dt));
    look.update(speed, t, dpr);

    // HUD: per-event progress bars and a running timecode (24 fps).
    segments.forEach((seg, i) => {
      const own = eventFrames[i];
      const fill = (own.length ? clamp01((offset - own[0] + 0.5) / own.length) : 0).toFixed(3);
      if (fill !== lastFill[i]) seg.style.setProperty('--fill', (lastFill[i] = fill));
    });
    if (timecode) {
      const total = Math.floor(offset * 48);
      const ff = total % 24;
      const ss = Math.floor(total / 24) % 60;
      const mm = Math.floor(total / 1440);
      const text = `00:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
      if (text !== lastTimecode) timecode.textContent = lastTimecode = text;
    }

    look.render(renderer, scene, camera);
  };

  // 60 fps cap; adaptive resolution: if frames keep running slow, step the pixel ratio down.
  const loop = frameLoop(render, {
    onSlow() {
      if (dpr <= 1) return;
      dpr = Math.max(1, dpr - 0.5);
      resize();
    },
  });
  // Compile shaders and upload the frame border now, not mid-scroll.
  renderer.compile(scene, camera);
  renderer.initTexture(borderTex);
  render();

  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      videos.forEach((v) => (active ? v.play().catch(() => {}) : v.pause()));
      if (active) loop.start();
      else {
        loop.stop();
        setStageTheme(undefined);
      }
    },
    refreshColours() {
      // Inks follow the event at the centre, not the surrounding theme.
    },
    dispose() {
      active = false;
      loop.stop();
      ro.disconnect();
      videos.forEach((v) => {
        v.pause();
        v.removeAttribute('src');
        v.load();
      });
      textures.forEach((t) => t.dispose());
      frames.forEach((f) => ((f.group.children[0] as Mesh).material as Material).dispose());
      borderMat.dispose();
      borderGeo.dispose();
      pictureGeo.dispose();
      look.dispose();
      releaseRenderer(renderer, canvas);
      setStageTheme(undefined);
    },
  };
}
