// ---------------------------------------------------------------------------
// glow-hotspot.js — MetaRoom3D glowing navigation hotspots
//
// Drop-in replacement for the textures/hotspot.png sprite used by
// HotspotManager.createPanoramaHotspots(). Builds real geometry instead:
// a shader glow ring lying in the floor plane, an expanding pulse, and --
// floating above the ring -- the MetaRoom3D logo loaded from
// textures/hotspot.glb, wrapped in a fake bloom so it reads as a lit sign.
//
// The old procedural chevron is still here (buildChevron) and is used as
// the fallback if the GLB fails to load, or if you pass `model: null`.
//
// Everything is unlit and additive, so it needs no lights, no bloom pass
// and no EffectComposer -- the existing single renderer.render() call in
// main.js animate() stays exactly as it is. That applies to the GLB too:
// its PBR materials are converted to MeshBasicMaterial on load, because
// the panorama scene has no lights to shade them with (a MeshStandard
// material in there renders black).
//
// three r163 (matches the import map in index.html).
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Where the badge model lives. Tried in order -- see loadHotspotModel().
export const DEFAULT_MODEL_URL = [
  'textures/hotspot.glb',
  'hotspot.glb',
  '../hotspot.glb',
];

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Bright annulus with soft bloom bleeding in and out. Done in the shader
// rather than as a blurred PNG so it stays sharp at every FOV -- the old
// sprite went visibly soft as soon as you zoomed in.
const RING_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uHover;
  uniform float uBreatheSpeed;
  uniform float uBreatheDepth;
  uniform float uHoverBoost;
  varying vec2  vUv;

  void main() {
    float d = length(vUv - 0.5) * 2.0;

    float ring  = smoothstep(0.86, 0.80, d) * smoothstep(0.62, 0.70, d);
    float halo  = pow(clamp(1.0 - abs(d - 0.76) / 0.42, 0.0, 1.0), 2.6);
    float inner = pow(clamp(1.0 - d / 0.72, 0.0, 1.0), 2.2) * 0.28;

    // Swings between 1 - depth and 1 + depth, so depth 0 is a steady ring.
    float breathe = 1.0 + uBreatheDepth * sin(uTime * uBreatheSpeed);

    float a = (ring * 0.95 + halo * 0.55 + inner) * breathe;
    a *= mix(1.0, uHoverBoost, uHover);
    a *= smoothstep(1.0, 0.94, d);   // clip the quad's square silhouette

    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * mix(1.0, 1.35, uHover), a);
  }
`;

const PULSE_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform float uPhase;
  varying vec2  vUv;

  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float r     = mix(0.30, 1.0, uPhase);
    float width = mix(0.16, 0.05, uPhase);
    float ring  = pow(clamp(1.0 - abs(d - r) / width, 0.0, 1.0), 1.8);
    float fade  = 1.0 - smoothstep(0.45, 1.0, uPhase);

    float a = ring * fade * 0.55 * smoothstep(1.0, 0.94, d);
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

// Soft round glow sitting BEHIND the badge and billboarded with it. This
// is what stands in for a real bloom pass: the model's own emissive parts
// are drawn additively, and this spreads light around them.
const HALO_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform float uIntensity;
  varying vec2  vUv;

  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float core = pow(clamp(1.0 - d, 0.0, 1.0), 3.0);
    float wide = pow(clamp(1.0 - d, 0.0, 1.0), 1.3) * 0.35;
    float a = (core + wide) * uIntensity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

// Backface shell pushed out along the normals -- the cheap outline trick,
// drawn additively so it reads as light spilling off the model's edge
// rather than as a black cartoon outline. Brightest at the silhouette,
// where the surface turns away from the eye.
const OUTLINE_VERT = /* glsl */ `
  uniform float uThickness;
  varying float vFacing;
  void main() {
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position + normal * uThickness, 1.0);
    vFacing = 1.0 - abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

const OUTLINE_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform float uIntensity;
  varying float vFacing;
  void main() {
    float a = pow(clamp(vFacing, 0.0, 1.0), 1.4) * uIntensity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

// Shared geometry -- one quad and one chevron for every hotspot on screen.
const QUAD  = new THREE.PlaneGeometry(1, 1);
const CONE  = new THREE.ConeGeometry(0.30, 0.46, 4);
const SHAFT = new THREE.CylinderGeometry(0.085, 0.085, 0.34, 12);

// ---------------------------------------------------------------------------
// Badge model
//
// Loaded once and cached: every hotspot clones the prepared prototype, so
// the GLB is fetched and parsed a single time no matter how many hotspots
// a panorama has.
//
// PREPARATION does three things the raw file needs:
//   1. Materials -> MeshBasicMaterial. The scene is unlit (see the header),
//      and a strongly emissive material -- the logo's cyan edges carry
//      KHR_materials_emissive_strength 60 -- becomes an ADDITIVE basic
//      material, which is what makes them glow without a bloom pass.
//   2. Orientation. The logo is modelled lying flat, facing +Y. It is
//      stood upright here so its face points along +Z, which is what
//      lookAt() expects when the badge billboards to the camera.
//   3. Normalisation. The export is ~0.08 units across and sits off-origin,
//      so it is recentred and scaled to a largest dimension of exactly 1.
//      createGlowHotspot then sizes it in ring radii, and swapping in a
//      different GLB later needs no new numbers.
// ---------------------------------------------------------------------------
let _modelUrl = null;
let _modelPromise = null;

function prepareBadgeModel(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;

    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    // KHR_materials_emissive_strength arrives as emissiveIntensity, so a
    // "this part is a light" material stands out clearly from one that
    // merely has a faint emissive tint.
    const emissiveLit = !!src.emissive && src.emissive.getHex() !== 0x000000 &&
                        (src.emissiveIntensity ?? 1) > 1.5;
    const seeThrough = src.transparent || (src.opacity ?? 1) < 1;

    o.material = new THREE.MeshBasicMaterial({
      // An emissive-driven part is effectively a light source in the
      // original, so take its emissive colour, not its base colour.
      color: emissiveLit
        ? src.emissive.clone()
        : (src.color ? src.color.clone() : new THREE.Color(0xffffff)),
      map: src.map || null,
      transparent: emissiveLit || seeThrough,
      opacity: emissiveLit ? 1 : (src.opacity ?? 1),
      side: THREE.DoubleSide,
      blending: emissiveLit ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !(emissiveLit || seeThrough),
      toneMapped: false,
    });

    o.userData._emissivePart = emissiveLit;

    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
  });

  // Stand the logo up: modelled facing +Y, rotated so it faces +Z.
  const inner = new THREE.Group();
  root.rotation.x = Math.PI / 2;
  inner.add(root);

  const model = new THREE.Group();
  model.add(inner);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // inner is unrotated, so shifting its position moves the model in the
  // parent's space regardless of root's own rotation.
  inner.position.sub(center);
  model.scale.setScalar(1 / Math.max(size.x, size.y, size.z, 1e-6));

  return model;
}

/**
 * Fetch and prepare the badge model. Cached per URL, so calling this from
 * every hotspot is free after the first.
 *
 * Each candidate is tried in order, because where the .glb ends up varies:
 * next to the other art in textures/, beside index.html, or alongside the
 * panoramas in the task folder. The first one that loads wins, and the
 * miss is logged with its fully-resolved URL so a 404 is obvious rather
 * than showing up as "the arrow never changed".
 *
 * @param {string|string[]} url
 * @returns {Promise<THREE.Group>}
 */
export function loadHotspotModel(url = DEFAULT_MODEL_URL) {
  const candidates = Array.isArray(url) ? url : [url];
  const key = candidates.join('|');
  if (_modelPromise && _modelUrl === key) return _modelPromise;
  _modelUrl = key;

  const loader = new GLTFLoader();
  const tryOne = (u) => new Promise((resolve, reject) => {
    loader.load(u, (gltf) => resolve({ gltf, u }), undefined, reject);
  });

  _modelPromise = (async () => {
    const tried = [];
    for (const u of candidates) {
      try {
        const { gltf } = await tryOne(u);
        console.info(`[glow-hotspot] badge model loaded from ${new URL(u, document.baseURI).href}`);
        return prepareBadgeModel(gltf.scene);
      } catch (err) {
        tried.push(new URL(u, document.baseURI).href);
      }
    }
    throw new Error(`none of these loaded:\n  ${tried.join('\n  ')}`);
  })();

  return _modelPromise;
}

/** The old procedural chevron, kept as the fallback when there is no GLB. */
function buildChevron(color, R, billboard) {
  const arrow = new THREE.Group();
  const solid = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false,
  });
  const head = new THREE.Mesh(CONE, solid);
  head.rotation.y = Math.PI / 4;     // square base reads as a diamond
  head.position.y = 0.30;
  const shaft = new THREE.Mesh(SHAFT, solid);
  shaft.position.y = 0.02;
  head.renderOrder = shaft.renderOrder = 11;
  arrow.add(head, shaft);
  arrow.scale.setScalar(R);
  // Tilted forward so it points along the floor rather than at the ceiling
  // (the billboard variant stays upright, like the old sprite).
  if (!billboard) arrow.rotation.x = -Math.PI / 4;
  return arrow;
}

/**
 * Wrap a clone of the prepared model in its glow: a soft halo quad behind
 * it, and an additive backface shell hugging its silhouette.
 */
function buildBadge(model, color, R, o) {
  const badge = new THREE.Group();
  // Two ways to size it: modelSize is absolute world units, modelScale is
  // a multiple of the ring's radius. Absolute wins if both are given --
  // use it when you want the badge to stop tracking the ring's size.
  const scale = o.modelSize ?? (R * (o.modelScale ?? 1.0));
  const haloSpread = o.halo ?? 2.3;

  const haloMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uIntensity: { value: o.glow ?? 0.55 },
    },
    vertexShader: VERT, fragmentShader: HALO_FRAG,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(QUAD, haloMat);
  halo.scale.setScalar(scale * haloSpread);
  halo.position.z = -scale * 0.06;   // just behind the logo
  halo.renderOrder = 10;

  const mesh = model.clone(true);
  mesh.scale.multiplyScalar(scale);   // model.scale already normalises to 1

  // Collect first, THEN add the shells. Object3D.traverse() walks the live
  // children array, so adding a shell mesh from inside the callback means
  // the walk immediately visits that shell, gives it a shell of its own,
  // and recurses until the stack blows ("Maximum call stack size
  // exceeded"), which surfaces as a rejected model load.
  const parts = [];
  mesh.traverse((child) => { if (child.isMesh) parts.push(child); });

  const outlineMats = [];
  for (const child of parts) {
    child.renderOrder = 11;
    // Object3D.clone() SHARES materials with the source. The prototype is
    // cached for the life of the page, so each hotspot takes its own copy
    // -- otherwise disposeGlowHotspot() on one hotspot would free the
    // materials every future hotspot is still relying on.
    child.material = child.material.clone();
    // Emissive parts already glow; shelling them too just blows them out.
    if (child.userData._emissivePart) continue;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: color.clone() },
        uIntensity: { value: o.glow ?? 0.55 },
        // Local geometry units, which differ per GLB -- derive it from the
        // part's own size so this holds up if the model is ever swapped.
        uThickness: {
          value: (child.geometry.boundingSphere?.radius ?? 1) * (o.outline ?? 0.02),
        },
      },
      vertexShader: OUTLINE_VERT, fragmentShader: OUTLINE_FRAG,
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.BackSide,
    });
    const shell = new THREE.Mesh(child.geometry, mat);
    shell.renderOrder = 10;
    child.add(shell);          // inherits the child's transform exactly
    outlineMats.push(mat);
  }

  badge.add(halo, mesh);
  // Base orientation: facing back toward the camera at the origin. This is
  // only what you see before the first billboard update -- once a camera is
  // passed to updateGlowHotspots(), lookAt() replaces the whole quaternion
  // every frame, and modelYaw/Tilt/Roll are re-applied on top of it there.
  // Setting a rotation on the badge from outside will NOT stick, for the
  // same reason; use those options instead.
  badge.rotation.set(0, Math.PI, 0);
  badge.rotateY(THREE.MathUtils.degToRad((o.modelYaw ?? 0) + (o.modelFlip ? 180 : 0)));
  badge.rotateX(THREE.MathUtils.degToRad(o.modelTilt ?? 0));
  badge.rotateZ(THREE.MathUtils.degToRad(o.modelRoll ?? 0));

  return { badge, haloMat, outlineMats, size: scale };
}

/**
 * Build one glowing hotspot.
 *
 * The camera sits at the origin inside the photo sphere, so "toward the
 * viewer" is simply the direction back to (0,0,0). The ring is laid flat in
 * the world XZ plane rather than billboarded, which is what makes it read as
 * a marker resting on the floor instead of a decal stuck to the sphere --
 * the old hotspot.png faked this by being drawn as a squashed ellipse.
 *
 * The badge above the ring is asynchronous: the group comes back
 * immediately with the fallback chevron in place, and the chevron is
 * swapped for the logo as soon as the GLB resolves.
 *
 * @param {object}       o
 * @param {THREE.Vector3} o.position   world position from phi/theta/radius
 * @param {number}       [o.size=40]   diameter, matching the old 40x40 plane
 * @param {number}       [o.ringHeight=0]  raise (+) or lower (-) the ring
 *                                     relative to the hotspot point
 * @param {number}       [o.ringForward=0] push the ring away from the
 *                                     camera (+) or pull it nearer (-)
 * @param {number}       [o.ringSide=0]    slide the ring right (+) or
 *                                     left (-) as you face the marker
 * @param {number}       [o.color=0x2f6bff]
 * @param {number}       [o.lift=0.55] float height as a fraction of size
 * @param {boolean}      [o.billboard=false] flat marker facing the camera
 * @param {string|null}  [o.model]     GLB to float above the ring; pass null
 *                                     to keep the old procedural chevron
 * @param {number}       [o.modelScale=1] badge size, in ring radii. 1 means
 *                                     the logo's largest dimension equals
 *                                     the ring's radius (half its diameter)
 * @param {number}       [o.modelSize]  badge size in absolute world units.
 *                                     Overrides modelScale -- use it when
 *                                     the badge should NOT track the ring
 * @param {number}       [o.modelLift]  badge height above the ring, in ring
 *                                     radii. Defaults to lift + 0.55
 * @param {number}       [o.modelHeight] badge height in absolute world
 *                                     units. Overrides modelLift
 * @param {number}       [o.halo=2.3]   glow spread, as a multiple of the
 *                                     badge's size. This, not the logo, is
 *                                     the visible top of the marker
 * @param {number}       [o.modelYaw=0]  extra spin about the vertical axis,
 *                                     in degrees, applied ON TOP of the
 *                                     billboard -- 180 shows the back face
 * @param {number}       [o.modelTilt=0] lean the top away (+) or toward (-)
 *                                     the viewer, in degrees
 * @param {number}       [o.modelRoll=0] in-plane rotation, in degrees
 * @param {number}       [o.glow=0.55] halo + outline strength
 * @param {number}       [o.outline=0.02] shell thickness, as a fraction of
 *                                     each part's radius
 * @param {boolean}      [o.modelFlip=false] shorthand for modelYaw: 180
 * @param {object}       [o.anim]      motion settings; see the defaults at
 *                                     the top of this function. Partial --
 *                                     anything you leave out keeps its
 *                                     default, and a 0 turns that piece of
 *                                     motion off
 * @returns {THREE.Group}
 */
export function createGlowHotspot(o) {
  const size  = o.size ?? 40;
  const color = new THREE.Color(o.color ?? 0x2f6bff);
  const lift  = o.lift ?? 0.55;
  const R     = size / 2;
  const modelUrl = o.model === undefined ? DEFAULT_MODEL_URL : o.model;

  // Animation settings, all overridable through o.anim. Anything left out
  // falls back to the default here, so passing `anim: { ringPulse: 0 }`
  // changes only the pulse. Set a speed or depth to 0 to switch that piece
  // of motion off entirely.
  const A = Object.assign({
    ringPulse: 1.8,        // seconds per expanding pulse ring; 0 = no pulse
    ringBreathe: 2.0,      // brightness breathing, radians per second
    ringBreatheDepth: 0.14,// how deep that breath is, 0..1
    ringHover: 1.7,        // ring brightness multiplier while hovered

    badgeBob: 2.2,         // float speed, radians per second
    badgeBobAmount: 0.05,  // bob height, as a fraction of badge size
    badgeSpin: 0,          // degrees per second about the vertical axis
    badgeGlow: 2.0,        // glow breathing speed
    badgeGlowDepth: 0.15,

    hoverLift: 0.12,       // extra height on hover, fraction of badge size
    hoverScale: 0.08,      // extra badge scale on hover
    hoverSpeed: 10,        // how quickly hover eases in and out
  }, o.anim || {});

  const group = new THREE.Group();
  group.position.copy(o.position);

  const ringMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uTime: { value: Math.random() * 10 },
      uHover: { value: 0 },
      uBreatheSpeed: { value: A.ringBreathe },
      uBreatheDepth: { value: A.ringBreatheDepth },
      uHoverBoost: { value: A.ringHover },
    },
    vertexShader: VERT, fragmentShader: RING_FRAG,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(QUAD, ringMat);
  ring.scale.setScalar(size);
  ring.renderOrder = 10;

  const pulseMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uPhase: { value: Math.random() } },
    vertexShader: VERT, fragmentShader: PULSE_FRAG,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  });
  const pulse = new THREE.Mesh(QUAD, pulseMat);
  pulse.scale.setScalar(size * 1.35);
  pulse.renderOrder = 10;
  // A pulse period of 0 means "no pulse": leave the mesh out rather than
  // animating it at zero speed, which would freeze one ring on screen.
  pulse.visible = A.ringPulse > 0;

  // Fallback chevron, in place until (and unless) the GLB arrives.
  const arrow = buildChevron(color, R, !!o.billboard);

  // Ring placement, in the GROUP's local space -- which is yawed to face
  // away from the camera below, so +Z is "further into the room" and +X is
  // to the right as you look at the marker. Only the ring and its pulse
  // move: the badge's height and the label's are measured from the hotspot
  // point itself, so nudging the ring down onto the floor leaves them
  // where they are. Note this also moves the clickable area, since the
  // ring quad is what the raycaster hits.
  const ringOffset = new THREE.Vector3(
    o.ringSide ?? 0,
    o.ringHeight ?? 0,
    o.ringForward ?? 0
  );
  ring.position.copy(ringOffset);
  pulse.position.copy(ringOffset);

  if (o.billboard) {
    // Flat marker facing the camera, like the old sprite.
    arrow.position.y = 0;
    group.add(ring, pulse, arrow);
    group.userData._billboard = true;
  } else {
    // Lay the ring flat in world space and float the badge above it.
    ring.rotation.x = -Math.PI / 2;
    pulse.rotation.x = -Math.PI / 2;
    arrow.position.y = R * lift;
    group.add(ring, pulse, arrow);

    // Aim away from the camera at the origin, staying level. The target
    // shares the group's Y, so this is a pure yaw: the group's up axis
    // stays world up and anything floating above the ring hangs upright.
    const away = group.position.clone().multiplyScalar(2);
    away.y = group.position.y;
    group.lookAt(away);
    group.userData._billboard = false;
  }

  const state = {
    ringMat, pulseMat,
    float: arrow,               // whichever object is hovering over the ring
    floatBaseY: arrow.position.y,
    floatR: R,                  // bob amplitude reference, in world units
    badge: null,                // set once the GLB lands
    haloMat: null,
    outlineMats: [],
    badgeYaw: 0, badgeTilt: 0, badgeRoll: 0,  // radians, filled in on load
    baseGlow: o.glow ?? 0.55,
    anim: A,
    hover: 0,
    seed: Math.random() * Math.PI * 2,
  };
  group.userData._glow = state;

  if (modelUrl) {
    loadHotspotModel(modelUrl).then((model) => {
      // The panorama may already have been torn down by the time this
      // resolves -- disposeGlowHotspot() nulls _glow, which is the signal.
      if (!group.userData._glow) return;

      const built = buildBadge(model, color, R, o);
      // Height above the ring: modelHeight is absolute world units,
      // modelLift is a multiple of the ring's radius. Absolute wins.
      built.badge.position.y = o.modelHeight ?? (R * (o.modelLift ?? (lift + 0.55)));

      group.remove(state.float);
      disposeSubtreeMaterials(state.float);
      group.add(built.badge);

      state.float = built.badge;
      state.floatBaseY = built.badge.position.y;
      // Bob and hover-lift scale with the BADGE from here on, not the
      // ring -- otherwise a big ring with a small badge makes the logo
      // swing much further than its own size.
      state.floatR = built.size;
      state.badge = built.badge;
      state.haloMat = built.haloMat;
      state.outlineMats = built.outlineMats;
      state.badgeYaw = THREE.MathUtils.degToRad((o.modelYaw ?? 0) + (o.modelFlip ? 180 : 0));
      state.badgeTilt = THREE.MathUtils.degToRad(o.modelTilt ?? 0);
      state.badgeRoll = THREE.MathUtils.degToRad(o.modelRoll ?? 0);
    }).catch((err) => {
      console.warn(`[glow-hotspot] could not load ${modelUrl}, keeping the chevron:`,
                   err && err.message ? err.message : err);
    });
  }

  return group;
}

function disposeSubtreeMaterials(obj) {
  obj.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.material.dispose();
  });
}

/**
 * Advance every hotspot's animation. Call once per frame.
 *
 * @param {THREE.Group[]}      groups
 * @param {number}             dt       seconds since last frame
 * @param {THREE.Group|null}  [hovered]
 * @param {THREE.Camera|null} [camera] pass main.js's activeCamera so the
 *        badge turns to face the viewer. Without it the logo keeps a fixed
 *        facing (back toward the sphere's centre), which is right from the
 *        default view and increasingly oblique as you look around.
 */
export function updateGlowHotspots(groups, dt, hovered = null, camera = null) {
  const t = performance.now() / 1000;
  const _p = new THREE.Vector3();
  const _target = new THREE.Vector3();

  for (const g of groups) {
    const s = g.userData._glow;
    if (!s) continue;

    const A = s.anim;

    s.ringMat.uniforms.uTime.value = t + s.seed;
    if (A.ringPulse > 0) {
      s.pulseMat.uniforms.uPhase.value =
        (s.pulseMat.uniforms.uPhase.value + dt / A.ringPulse) % 1;
    }

    const target = hovered === g ? 1 : 0;
    s.hover += (target - s.hover) * Math.min(1, dt * A.hoverSpeed);
    s.ringMat.uniforms.uHover.value = s.hover;

    if (!g.userData._billboard) {
      const R = s.floatR;
      const bob = Math.sin(t * A.badgeBob + s.seed) * R * A.badgeBobAmount;
      s.float.position.y = s.floatBaseY + bob + s.hover * R * A.hoverLift;
    }

    if (s.badge) {
      // Yaw-only billboard: the logo turns to face the viewer but never
      // tips, so it always reads as a sign standing over the ring.
      // lookAt() writes the whole quaternion, so the modelYaw/Tilt/Roll
      // offsets have to be re-applied on top of it every frame -- and the
      // no-camera branch has to reset first, or they would accumulate.
      if (camera) {
        s.badge.getWorldPosition(_p);
        _target.set(camera.position.x, _p.y, camera.position.z);
        s.badge.lookAt(_target);
      } else {
        s.badge.rotation.set(0, Math.PI, 0);
      }
      // badgeSpin turns the logo continuously about its vertical axis.
      // It rides on top of the billboard, so the badge still faces you --
      // it just turns edge-on and back, like a slowly spinning coin.
      if (s.badgeYaw || A.badgeSpin) {
        s.badge.rotateY(s.badgeYaw + THREE.MathUtils.degToRad(A.badgeSpin) * t);
      }
      if (s.badgeTilt) s.badge.rotateX(s.badgeTilt);
      if (s.badgeRoll) s.badge.rotateZ(s.badgeRoll);
      // Breathe in step with the ring, and brighten on hover.
      const glow = s.baseGlow *
        (1 + A.badgeGlowDepth * Math.sin(t * A.badgeGlow + s.seed)) *
        (1 + s.hover * 0.9);
      if (s.haloMat) s.haloMat.uniforms.uIntensity.value = glow;
      for (const m of s.outlineMats) m.uniforms.uIntensity.value = glow;
      s.badge.scale.setScalar(1 + s.hover * A.hoverScale);
    }
  }
}

/** Free the per-hotspot shader materials. Geometry is shared, so leave it. */
export function disposeGlowHotspot(group) {
  const s = group.userData._glow;
  if (!s) return;
  s.ringMat.dispose();
  s.pulseMat.dispose();
  if (s.haloMat) s.haloMat.dispose();
  for (const m of s.outlineMats) m.dispose();
  disposeSubtreeMaterials(group);
  // Badge materials are clones of the cached prototype's, so dropping the
  // reference is enough; the prototype itself stays loaded for the next
  // panorama. Nulling this also tells an in-flight loadHotspotModel()
  // callback that its hotspot is gone.
  group.userData._glow = null;
}
