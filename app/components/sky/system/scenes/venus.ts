/*
 * Venus: Navka Planitia in March 1982, where Venera 13 came down and sent home the first colour pictures from the surface.
 * Cracked plates of basalt run off into a thick amber murk, under a lid of cloud that goes right round the planet every four
 * days while the air at the ground barely moves. A shield volcano smoulders in the haze, and there are hardly any shadows,
 * since the light arrives from everywhere. Tap the lander and it pushes its arm into the soil, as it did, for as long as it
 * could stand it.
 */

import { Fog, Group, HemisphereLight, type MeshBasicMaterial, Scene, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { Motes, VoxelSet } from "../voxels";
import { cells, flows, skyDome, sloped, sunlight, type Flow, type Place } from "./kit";

const BASALT: Rgb = [128, 104, 80], BASALT_DARK: Rgb = [78, 60, 46], SOIL: Rgb = [50, 38, 32], SEAM: Rgb = [46, 34, 30];
const HAZE: Rgb = [226, 166, 84];
const SUN_AT = new Vector3(-180, 300, -420);
const VENT = new Vector3(150, 0, -420);
const SHIELD_R = 330, SHIELD_H = 74;
/** One lap of the clouds, in scene units: the deck is laid out twice this wide and slides back when it's gone one length. */
const DECK_LAP = 1500;

/** A plate of rock: each its own height and tilt, with its layers worn into steps and a crack around it. */
function plate(x: number, z: number) {
  const c = cells(x, z, 11, 122);
  const lift = hash(c.i, c.j, 123) * 1.5, tx = (hash(c.i, c.j, 124) - 0.5) * 0.17, tz = (hash(c.i, c.j, 125) - 0.5) * 0.17;
  const raw = lift + (x - c.x) * tx + (z - c.z) * tz;
  return { h: Math.round(raw / 0.4) * 0.4 - smoothstep(0.14, 0.02, c.edge) * 0.8, seam: c.edge < 0.05, sunk: hash(c.i, c.j, 126) < 0.22 };
}

/** How far from the lander, which came down on the flattest ground it could find. */
const away = (x: number, z: number) => smoothstep(7, 34, Math.hypot(x, z));

const shield = (x: number, z: number) => {
  const r = Math.hypot(x - VENT.x, z - VENT.z) / SHIELD_R;
  if (r >= 1) return 0;
  const summit = smoothstep(0.03, 0.07, r);
  return SHIELD_H * (1 - r) ** 1.5 * summit * (0.82 + noise(x * 0.04, z * 0.04, 127) * 0.36);
};

function height(x: number, z: number) {
  const k = away(x, z);
  return 2 + (noise(x * 0.02, z * 0.02, 128) * 6 + noise(x * 0.07, z * 0.07, 129) * 1.2) * k + plate(x, z).h * (0.3 + 0.7 * k) + shield(x, z);
}

function groundColour(x: number, z: number): Rgb {
  const p = plate(x, z);
  if (p.seam) return SEAM;
  if (p.sunk) return mix(SOIL, [96, 74, 58], noise(x * 0.5, z * 0.5, 130) * 0.7);
  // The layers show as stripes along the worn edges of each plate.
  const layer = Math.abs(Math.round(p.h / 0.4)) % 2;
  const rock = mix(mix(BASALT, BASALT_DARK, noise(x * 0.12 + 4, z * 0.12, 131)), [204, 174, 136], layer * 0.2);
  return mix(rock, SOIL, hash(Math.round(x * 3), Math.round(z * 3), 132) ** 5 * 0.8);
}

function ground(v: VoxelSet, coarse: boolean) {
  const fine = coarse ? 0.74 : 0.46, mid = coarse ? 1.6 : 1.2, far = 4;
  for (let x = -52; x < 52; x += fine) {
    for (let z = -30; z < 50; z += fine) {
      const h = height(x, z);
      v.column(x, z, h, h - 4, fine, sloped(groundColour(x, z), height, x, z, 0.16), 0.05);
    }
  }
  for (let x = -170; x < 170; x += mid) {
    for (let z = -120; z < 70; z += mid) {
      if (Math.abs(x) < 52 && z > -30 && z < 50) continue;
      const h = height(x, z);
      v.column(x, z, h, h - 6, mid, sloped(groundColour(x, z), height, x, z, 0.16), 0.05);
    }
  }
  for (let x = -560; x < 560; x += far) {
    for (let z = -760; z < -120; z += far) {
      if (Math.hypot(x, z) > 800) continue;
      const h = height(x, z);
      v.column(x, z, h, -6, far, sloped(mix(BASALT_DARK, SOIL, noise(x * 0.03, z * 0.03, 133)), height, x, z, 0.14), 0.05);
    }
  }
}

function strewn(v: VoxelSet, coarse: boolean) {
  for (let i = 0; i < (coarse ? 1200 : 3400); i++) {
    const x = (hash(i, 1, 134) - 0.5) * 110, z = 48 - hash(i, 2, 134) * 76;
    const s = 0.08 + hash(i, 3, 134) ** 3 * 0.34;
    v.box(x, height(x, z) + s / 2, z, s * (0.7 + hash(i, 4, 134)), s, s, mix(SOIL, BASALT_DARK, hash(i, 5, 134)));
  }
}

/**
 * Venera 13, near enough: the toothed ring it landed on, the white sphere holding the air and the electronics, the disc that
 * braked it through air as thick as soup, and the helical antenna on top. It carried a colour chart so that the pictures
 * could be trusted, and threw off its lens caps on landing. The arm and the camera each move.
 */
function lander() {
  const white: Rgb = [255, 250, 236], scorched: Rgb = [196, 178, 154], metal: Rgb = [134, 128, 122], dark: Rgb = [46, 42, 44];
  const body = new Group();
  const set = new VoxelSet();
  const s = 0.22;
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2, c = Math.cos(a) * 4.4, d = Math.sin(a) * 4.4;
    for (let y = 0; y < 3; y++) set.box(c, 0.12 + y * s, d, 0.42, s, 0.42, mix(metal, dark, hash(k, y, 135) * 0.5));
    if (k % 6 === 0) set.box(Math.cos(a) * 4.9, 0.4, Math.sin(a) * 4.9, 0.7, 0.26, 0.36, metal);
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (let f = 0; f < 1; f += 0.06) set.box(Math.cos(a) * (4.3 - f * 2.5), 0.7 + f * 3.1, Math.sin(a) * (4.3 - f * 2.5), 0.2, 0.28, 0.2, metal);
  }
  set.ball(0, 5.2, 0, 3 / s, s, (x, y, z) => {
    const band = Math.abs(y) < 0.09 ? metal : Math.abs(y) < 0.6 && Math.round(Math.atan2(x, z) * 8) % 4 === 0 ? scorched : white;
    return mix(band, scorched, noise(x * 3 + 1, y * 3 + z * 3, 136) * 0.42);
  }, 0.03);
  // The brake: a broad flat disc over the sphere, its rim scalloped by the plunge.
  for (let a = -24; a <= 24; a++) {
    for (let b = -24; b <= 24; b++) {
      const d = Math.hypot(a, b) * 0.23;
      if (d > 5.3 + Math.sin(Math.atan2(b, a) * 12) * 0.14) continue;
      const hole = d > 3 && Math.round(Math.atan2(b, a) * 3.8) % 2 === 0 && d < 4.4;
      set.box(a * 0.23, 9 + d * 0.05, b * 0.23, 0.23, 0.14, 0.23, hole ? dark : mix(white, scorched, noise(a * 0.3, b * 0.3, 137) * 0.6));
    }
  }
  set.fill(-0.5, 8.1, -0.5, 0.5, 9, 0.5, metal, 0.18, 0.04);
  // The antenna: one wire wound up around a thin mast.
  set.box(0, 11.3, 0, 0.12, 4.4, 0.12, metal);
  for (let k = 0; k < 90; k++) {
    const f = k / 90, a = f * 36;
    set.box(Math.cos(a) * 0.72, 9.4 + f * 3.8, Math.sin(a) * 0.72, 0.15, 0.15, 0.15, [214, 198, 168]);
  }
  // The colour chart, and the two lens caps it threw off, lying where they fell.
  const chart: Rgb[] = [[210, 44, 40], [236, 196, 60], [62, 150, 74], [52, 92, 196], [236, 236, 236], [28, 28, 30]];
  chart.forEach((c, k) => set.box(-2.05 + k * 0.72, 1.45, 4.46, 0.68, 0.72, 0.1, c));
  for (const [x, z] of [[5.7, 3.4], [-3.4, 7.2]]) {
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (a * a + b * b < 11) set.box(x + a * 0.17, 0.14, z + b * 0.17, 0.17, 0.12, 0.17, a * a + b * b < 3 ? dark : white);
  }
  body.add(set.mesh("lit", { cast: true, receive: true }));

  const head = new Group();
  const headSet = new VoxelSet();
  headSet.fill(-0.55, -0.3, -0.35, 0.55, 0.36, 0.35, white, 0.14, 0.04);
  headSet.box(-0.26, 0.04, 0.38, 0.32, 0.32, 0.1, [22, 24, 38]);
  headSet.box(0.26, 0.04, 0.38, 0.32, 0.32, 0.1, [22, 24, 38]);
  head.add(headSet.mesh("lit", { cast: true }));
  head.position.set(1.5, 7.6, 2.1);
  body.add(head);

  const arm = new Group();
  const armSet = new VoxelSet();
  for (let k = 0; k < 18; k++) armSet.box(0.12 + k * 0.2, 0, 0, 0.2, 0.17, 0.17, k % 4 ? metal : white);
  armSet.fill(3.5, -0.34, -0.3, 4.1, 0.1, 0.3, [188, 180, 164], 0.13, 0.05);
  arm.add(armSet.mesh("lit", { cast: true }));
  arm.position.set(2.8, 3.1, 2.4);
  arm.rotation.y = -0.7;
  body.add(arm);
  return { body, head, arm };
}

/** The lid: rolls of cloud low and heavy overhead, paling into the same murk as everything else with distance. */
function cloudDeck() {
  const set = new VoxelSet();
  const w = 34, deep = 40;
  for (let x = -DECK_LAP; x < DECK_LAP; x += w) {
    for (let k = 0; k < deep; k++) {
      const z = 150 - k * 34;
      const a = (x / DECK_LAP) * Math.PI * 2;
      // Measured around a circle, so its two ends meet and the deck can slide for ever.
      const n = noise(Math.cos(a) * 7 + z * 0.012 + 40, Math.sin(a) * 7 - z * 0.022 + 40, 138);
      const fold = noise(Math.cos(a) * 18 + z * 0.03 + 40, Math.sin(a) * 18 + 40, 139);
      const shade = mix([120, 76, 38], [226, 172, 98], smoothstep(0.28, 0.72, n * 0.75 + fold * 0.25));
      const c = mix(shade, HAZE, smoothstep(0, 1, k / deep) ** 0.8);
      set.box(x, 186 - fold * 22, z, w, 18 + n * 26, 34, c);
    }
  }
  const mesh = set.mesh("glow");
  (mesh.material as MeshBasicMaterial).fog = false;
  return mesh;
}

/** Everything else that moves, in air so thick that it all moves slowly. */
function airborne(coarse: boolean) {
  const list: Flow[] = [];
  const scale = coarse ? 0.5 : 1;
  const r = (i: number, s: number) => hash(i, s, 140);
  // Banks of haze, crossing at a walking pace.
  for (let i = 0; i < 110 * scale; i++) {
    const z = 40 - r(i, 1) * 300;
    list.push({
      start: [-280, 6 + r(i, 2) * 46, z], drift: [560, 8, -20], size: 24 + r(i, 3) * 44, colour: mix([230, 170, 90], [255, 204, 130], r(i, 4)), alpha: 0.06, fade: 0.2,
      rate: 0.012 + r(i, 5) * 0.014, phase: r(i, 6), wobble: 5,
    });
  }
  // Heat coming off the rock: small and slow, wavering upward.
  for (let i = 0; i < 1300 * scale; i++) {
    const x = (r(i, 11) - 0.5) * 110, z = 48 - r(i, 12) * 90;
    list.push({
      start: [x, height(x, z) + 0.1, z], drift: [1.5, 3 + r(i, 13) * 7, 0], size: 0.1 + r(i, 14) * 0.16, colour: [255, 196, 118], alpha: 0.38, fade: 0.9,
      rate: 0.05 + r(i, 15) * 0.1, phase: r(i, 16), wobble: 0.9,
    });
  }
  // The volcano: lava creeping down from the vent in one long bright line, and a low dark-bellied plume going up.
  const top = height(VENT.x + SHIELD_R * 0.07, VENT.z);
  for (let i = 0; i < 1600 * scale; i++) {
    const branch = Math.floor(r(i, 21) * 3), a = 1.75 + branch * 0.5, reach = 90 + r(i, 22) * 170;
    const tx = Math.cos(a) * reach, tz = Math.abs(Math.sin(a)) * reach;
    list.push({
      start: [VENT.x + (r(i, 23) - 0.5) * 4, top + 2, VENT.z], drift: [tx, height(VENT.x + tx, VENT.z + tz) - top + 2, tz], size: 1.6 + r(i, 24) * 2.6, colour: mix([255, 214, 110], [255, 86, 28], r(i, 25)),
      alpha: 0.85, fade: 0.5, rate: 0.008 + r(i, 26) * 0.012, phase: r(i, 27), wobble: 2,
    });
  }
  for (let i = 0; i < 260 * scale; i++) {
    list.push({
      start: [VENT.x, top, VENT.z], drift: [30 + r(i, 31) * 90, 60 + r(i, 32) * 70, (r(i, 33) - 0.5) * 30], size: 12 + r(i, 34) * 24, colour: mix([255, 120, 50], [214, 150, 90], r(i, 35)), alpha: 0.075, fade: 1,
      rate: 0.012 + r(i, 36) * 0.018, phase: r(i, 37), wobble: 4,
    });
  }
  return flows(list);
}

export const navka: Place = {
  id: "venus",
  name: "navka planitia",
  world: "venus",
  coords: "7.5°s 303°e · march 1982",
  build(coarse) {
    const scene = new Scene();
    scene.fog = new Fog(0xe2a654, 70, 700);
    // Faint: what little sun gets down here is spread over the whole sky.
    const sun = sunlight(0xffbc72, 0.9, new Vector3(-60, 130, 40), 92, coarse);
    scene.add(sun, new HemisphereLight(0xffc27a, 0x7a4a24, 2.5));
    scene.add(skyDome([142, 88, 40], [204, 142, 66], [226, 166, 84], SUN_AT, [255, 216, 150], 5));

    const land = new VoxelSet();
    ground(land, coarse);
    strewn(land, coarse);
    scene.add(land.mesh("lit", { cast: true, receive: true }));

    const deck = cloudDeck();
    const air = airborne(coarse);
    scene.add(deck, air.mesh);

    const { body, head, arm } = lander();
    const g = height(0, 0) - 0.2;
    body.position.set(0, g, 0);
    body.rotation.z = -0.025;
    body.rotation.x = 0.02;
    scene.add(body);

    const spot = new Vector3(0, g + 5.5, 0);
    let pushedAt = -100;

    const GRAINS = coarse ? 60 : 130;
    const puff = new Motes(GRAINS, (i) => mix(SOIL, [176, 136, 96], hash(i, 1, 141)), "lit");
    scene.add(puff.mesh);
    let live = GRAINS;
    const tip = new Vector3(5.5, g + 0.2, 5.2);

    return {
      scene,
      eye: new Vector3(14, 16, 36),
      at: new Vector3(-1, 13, -16),
      fov: 40,
      lens: { center: 0.36, band: 0.24, blur: 8 },
      cell: 0.72,
      pullback: 0.7,
      ground: height,
      sun,
      actor: spot,
      actorSize: 6,
      update(t, dt) {
        air.tick(t);
        deck.position.x = ((t * 3.4) % DECK_LAP) - DECK_LAP / 2;

        const since = t - pushedAt;
        const pushing = since < 7;
        // It looks at everything in turn, a strip of picture at a time; asked for more, it looks at the arm.
        const aim = pushing ? 0.5 : Math.sin(t * 0.17) * 1.1;
        head.rotation.y += (aim - head.rotation.y) * (1 - Math.exp(-dt * 1.8));
        // A slow spring down onto the ground, a press, and back up.
        const down = smoothstep(0.1, 1.1, since) * (1 - smoothstep(4.8, 6.4, since));
        arm.rotation.z = 0.95 - down * 1.6;
        for (let i = 0; i < live; i++) {
          const age = (since - 1) / 4.5 - hash(i, 2, 141) * 0.25;
          if (age < 0 || age > 1) { puff.place(i, 0, -1000, 0, 0.001); continue; }
          // The air is ninety times as thick as ours, so the dust rolls lazily out and hardly settles.
          const o = hash(i, 3, 141) * 6.28, far = 0.2 + (1 - (1 - age) ** 3) * (0.6 + hash(i, 4, 141) * 2.6);
          puff.place(i, tip.x + Math.cos(o) * far, tip.y + (1 - (1 - age) ** 2) * (0.2 + hash(i, 5, 141) * 1.1), tip.z + Math.sin(o) * far, 0.1 + hash(i, 6, 141) * 0.15 * (1 - age));
        }
        puff.commit();
      },
      poke(t) {
        pushedAt = t;
        return "venera 13 · built for 32 minutes · lasted 127";
      },
      thin(share) {
        live = Math.round(GRAINS * share);
        puff.mesh.count = live;
      },
    };
  },
};
