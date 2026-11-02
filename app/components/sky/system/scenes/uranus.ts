/*
 * Uranus: the quiet one. A pale haze with almost nothing in it, the coldest air of any planet, on a world knocked over on its
 * side, so that its poles take turns with forty-two years of sun and forty-two of none. It has rings, thin as wire and dark as
 * coal, standing overhead in a hoop, with the five big moons strung along it. Everything drifts. Tap Voyager, if you can find it.
 */

import { AmbientLight, DirectionalLight, Fog, Scene, Vector3 } from "three";
import { hash, mix, smoothstep, type Rgb } from "../../engine";
import { stars } from "./moon";
import { voyager } from "./neptune";
import { cloudDeck, onRingPlane, thinRings, wrapped } from "./giants";
import { flows, skyDome, type Flow, type Place } from "./kit";

const R = 1100;
const WRAP = 520;
const LATITUDE = 0.6;
const HAZE: Rgb = [116, 176, 186], DEEPER: Rgb = [78, 138, 154];

export const paleHaze: Place = {
  id: "uranus",
  name: "the haze",
  world: "uranus",
  coords: "98° on its side · -224°c",
  build(coarse) {
    const scene = new Scene();
    scene.fog = new Fog(0x8cc2c8, 120, 520);
    const sun = new DirectionalLight(0xe8fbff, 1.5);
    sun.position.set(-70, 110, 60);
    scene.add(sun, new AmbientLight(0xb0e4e8, 1.4));
    const sunward = new Vector3(-0.52, 0.42, -0.74);
    scene.add(skyDome([8, 22, 48], [62, 128, 150], [148, 198, 202], sunward, [226, 244, 244], 900));

    const sky = stars(coarse ? 700 : 1500);
    scene.add(sky.mesh);

    const rows = [
      { fromZ: -130, toZ: 66, step: coarse ? 3.8 : 2.6, halfX: WRAP },
      { fromZ: -500, toZ: -130, step: coarse ? 8 : 5.4, halfX: WRAP },
    ];
    const deck = cloudDeck({
      R, wrap: WRAP, lift: 0, rows, wind: "2.4",
      rise: (x, z) => wrapped(x, z * 0.8, WRAP, 6, 330) * 7,
      // Bands so faint you only half believe in them, and that's the whole of the weather.
      paint: (x, z) => mix(DEEPER, HAZE, 0.5 + 0.5 * Math.sin(z * 0.02 + wrapped(x, z, WRAP, 3, 331) * 2) * 0.8 + wrapped(x, z * 2, WRAP, 12, 332) * 0.2),
    });
    // The one or two methane clouds a year, for anyone who waits.
    const wisps = cloudDeck({
      R, wrap: WRAP, lift: 14, rows, wind: "4.2",
      rise: () => 0,
      paint: (x, z) => {
        const k = smoothstep(0.72, 0.84, wrapped(x, z * 5, WRAP, 2.6, 333)) * smoothstep(0.5, 0.7, wrapped(x, z, WRAP, 2, 334));
        return k > 0.2 ? mix(HAZE, [214, 238, 240], k) : null;
      },
    });
    scene.add(deck.mesh, wisps.mesh);

    const SKY_R = 620;
    const rings = thinRings([
      { radius: 1.64, size: 3.4, colour: [170, 190, 204], alpha: 0.5 },
      { radius: 1.73, size: 3.4, colour: [170, 190, 204], alpha: 0.5 },
      { radius: 1.79, size: 3.6, colour: [180, 198, 210], alpha: 0.55 },
      { radius: 1.86, size: 3.6, colour: [180, 198, 210], alpha: 0.55 },
      { radius: 2.0, size: 7, colour: [236, 246, 248], alpha: 0.9 },
    ], SKY_R, LATITUDE, coarse);
    scene.add(rings.mesh);

    const list: Flow[] = [];
    const r = (i: number, s: number) => hash(i, s, 335);
    list.push({ start: [sunward.x * 800, sunward.y * 800, sunward.z * 800], drift: [0, 0, 0], size: 10, colour: [255, 255, 250], alpha: 1.5, rate: 0, phase: 0.2 });
    for (const [a, far, size] of [[-2.5, 2.4, 3.6], [-2.05, 2.9, 5], [-1.55, 3.4, 6], [-1.1, 2.8, 5], [-0.62, 3.1, 4.4]]) {
      const p = onRingPlane(a, far, SKY_R, LATITUDE);
      list.push({ start: [p.x, p.y, p.z], drift: [0, 0, 0], size, colour: [226, 232, 234], alpha: 1.2, rate: 0, phase: 0.2, twinkle: 0.2 });
    }
    // Ice crystals, very few, hanging more than falling.
    for (let i = 0; i < (coarse ? 170 : 420); i++) {
      list.push({ start: [(r(i, 1) - 0.5) * 200, 22 + r(i, 2) * 60, 36 - r(i, 3) * 130], drift: [4, -2, 0], size: 0.14 + r(i, 4) * 0.2, colour: [244, 254, 255], alpha: 0.55, fade: 0.2, rate: 0.018 + r(i, 5) * 0.03, phase: r(i, 6), wobble: 1, twinkle: 1.4 });
    }
    const lights = flows(list);
    scene.add(lights.mesh);

    const probe = voyager();
    scene.add(probe);
    const spot = new Vector3();
    let calledAt = -100;

    return {
      scene,
      eye: new Vector3(6, 60, 42),
      at: new Vector3(-4, 74, -80),
      fov: 54,
      lens: { center: 0.5, band: 0.5, blur: 3 },
      cell: 0.72,
      pullback: 0.5,
      ground: (x, z) => -(x * x + z * z) / (2 * R),
      sun,
      actor: spot,
      actorSize: 4,
      update(t, dt) {
        sky.tick(t);
        deck.time.value = wisps.time.value = t;
        rings.tick(t);
        lights.tick(t);
        spot.set(9 + Math.sin(t * 0.025) * 9, 68 + Math.sin(t * 0.04) * 3, -12);
        probe.position.copy(spot);
        const homing = t - calledAt < 8;
        const k = 1 - Math.exp(-dt * 1.2);
        probe.rotation.x += ((homing ? 1.1 : 0.4 + Math.sin(t * 0.06) * 0.2) - probe.rotation.x) * k;
        probe.rotation.y += ((homing ? 2.4 : 0.9 + Math.sin(t * 0.04) * 0.4) - probe.rotation.y) * k;
      },
      poke(t) {
        calledAt = t;
        return "voyager 2 · january 1986 · the only visit there's been";
      },
      thin(share) {
        const { geometry } = lights.mesh;
        geometry.setDrawRange(0, Math.round(geometry.getAttribute("position").count * share));
      },
    };
  },
};
