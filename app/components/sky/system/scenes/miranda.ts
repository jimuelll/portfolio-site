/*
 * Miranda, the small patched-together moon of Uranus, on the lip of Verona Rupes: a cliff of ice up to twenty kilometres high,
 * perhaps the tallest in the solar system, on a world so slight that it looks like it was smashed apart and put back wrong.
 * Uranus fills a fifth of the sky, which it really does from here, on its side, with its rings seen edge-on as one thin line. The
 * gravity's next to nothing. Tap the boulder on the edge: you've got twelve minutes before it lands.
 */

import { AmbientLight, type MeshBasicMaterial, Scene, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { VoxelSet } from "../voxels";
import { stars } from "./moon";
import { flows, sloped, sunlight, type Flow, type Place } from "./kit";

const ICE: Rgb = [214, 216, 218], ICE_DIM: Rgb = [146, 150, 158], DARK: Rgb = [84, 84, 92], DARKEST: Rgb = [50, 50, 60];
const PLATEAU = 40, FLOOR = -92;
const SUNWARD = new Vector3(0.66, 0.34, 0.66).normalize();

/** The cliff line: straight by your feet, then swinging away to the right, so that its far reach faces you across the drop. */
const edge = (z: number) => -6 + Math.max(0, 10 - z) ** 2 / 900 + (noise(z * 0.02, 3, 350) - 0.5) * 14;

function height(x: number, z: number) {
  const d = x - edge(z);
  const top = PLATEAU + noise(x * 0.02, z * 0.02, 351) * 5 + noise(x * 0.12, z * 0.12, 352) * 0.9;
  const bottom = FLOOR + noise(x * 0.012, z * 0.012, 353) * 26 + Math.sin(x * 0.11 + z * 0.03 + noise(x * 0.01, z * 0.01, 354) * 4) * 2.4;
  if (d < 0) return top;
  // A sheer face, in stacked benches where it's slumped, with a long scree at its foot.
  const fall = smoothstep(0, 16, d);
  const stepped = Math.round(fall * 9) / 9;
  const scree = smoothstep(16, 70, d);
  const face = top + (bottom + 20 - top) * (fall * 0.45 + stepped * 0.55);
  return face - 20 * scree;
}

function colour(x: number, z: number, h: number): Rgb {
  const d = x - edge(z);
  // The bands of Miranda: bright and dark, running on in chevrons nobody has quite explained.
  if (d < 0 || h < FLOOR + 40) {
    const chevron = Math.abs(((x * 0.5 + Math.abs(z * 0.33 + 40) * 0.8 + noise(x * 0.02, z * 0.02, 355) * 26) % 22) - 11) / 11;
    const c = mix(mix(DARKEST, DARK, noise(x * 0.3, z * 0.3, 356)), mix(ICE_DIM, ICE, noise(x * 0.2, z * 0.2, 357)), smoothstep(0.34, 0.6, chevron));
    return mix(c, [34, 34, 42], hash(Math.round(x * 2), Math.round(z * 2), 358) ** 7);
  }
  // On the face, its strata, tipped and broken.
  const layer = Math.floor((h + noise(x * 0.05, z * 0.05, 359) * 8) / 7);
  return mix(layer % 2 ? ICE : ICE_DIM, DARK, layer % 5 === 0 ? 0.72 : noise(x * 0.4, z * 0.4, 360) * 0.2);
}

function ground(v: VoxelSet, coarse: boolean) {
  const near = coarse ? 0.95 : 0.6, far = coarse ? 3.4 : 2.4;
  const lay = (x: number, z: number, s: number) => {
    const h = height(x, z);
    // Darkening with the drop, which is all that tells you how far down it goes.
    const depth = 0.2 + 0.8 * smoothstep(FLOOR, PLATEAU - 8, h) ** 1.4;
    const c = sloped(colour(x, z, h), height, x, z, 0.09);
    v.column(x, z, h, FLOOR - 40, s, [c[0] * depth, c[1] * depth, c[2] * depth], 0.05);
  };
  for (let x = -60; x < 60; x += near) for (let z = -60; z < 70; z += near) lay(x, z, near);
  for (let x = -220; x < 340; x += far) {
    for (let z = -520; z < 110; z += far) {
      if (!(x >= -60 && x < 60 && z >= -60 && z < 70)) lay(x, z, far);
    }
  }
  // Rubble along the lip, where the edge keeps giving way.
  for (let i = 0; i < (coarse ? 500 : 1300); i++) {
    const z = 66 - hash(i, 1, 361) * 130, x = edge(z) - hash(i, 2, 361) ** 2 * 34 - 1, s = 0.14 + hash(i, 3, 361) ** 3 * 1.1;
    v.box(x, height(x, z) + s / 2, z, s * (0.7 + hash(i, 4, 361)), s, s, mix(DARK, ICE, hash(i, 5, 361)));
  }
}

/** Uranus: lit from the side, and very nearly featureless, as it is. The light's put in the colour, since the sun's not moving. */
function planet(coarse: boolean) {
  const r = 164, voxel = coarse ? 7 : 5;
  const set = new VoxelSet();
  set.ball(0, 0, 0, r / voxel, voxel, (x, y, z) => {
    const lit = smoothstep(-0.06, 0.34, x * SUNWARD.x + y * SUNWARD.y + z * SUNWARD.z);
    const c = mix([96, 164, 178], [146, 204, 208], 0.5 + 0.5 * Math.sin(x * 2.6 + y * 1.2) * 0.4);
    return mix([6, 12, 22], c, lit);
  }, 0.015);
  const mesh = set.mesh("glow");
  (mesh.material as MeshBasicMaterial).fog = false;
  return { mesh, r };
}

export const veronaRupes: Place = {
  id: "miranda",
  name: "verona rupes",
  world: "miranda",
  coords: "the tallest cliff there is",
  build(coarse) {
    const scene = new Scene();
    const sun = sunlight(0xf2f6ff, 4, SUNWARD.clone().multiplyScalar(300), 210, coarse);
    scene.add(sun, new AmbientLight(0x88c4cc, 0.7));

    const sky = stars(coarse ? 1400 : 2800);
    scene.add(sky.mesh);

    const land = new VoxelSet();
    ground(land, coarse);
    scene.add(land.mesh("lit", { cast: true, receive: true }));

    const world = planet(coarse);
    const AT = new Vector3(186, 196, -820);
    world.mesh.position.copy(AT);
    scene.add(world.mesh);

    // The rings, in the plane of the moon's own orbit, and so exactly edge-on: one bright thread through the disc. It's the same
    // hoop you see from the clouds, from the only angle where it's a line.
    const list: Flow[] = [];
    const r = (i: number, s: number) => hash(i, s, 362);
    const toEye = new Vector3(-16, 58, 46).sub(AT).normalize();
    const along = new Vector3(0.42, 0.91, 0).cross(toEye).cross(toEye).normalize().negate();
    for (const [radius, size, alpha] of [[1.64, 1.6, 0.34], [1.73, 1.6, 0.34], [1.86, 1.8, 0.4], [2, 2.6, 0.7]]) {
      for (let i = 0; i < (coarse ? 240 : 520); i++) {
        const a = (i / (coarse ? 240 : 520)) * Math.PI * 2, far = radius * world.r;
        const u = Math.cos(a) * far, v = Math.sin(a) * far;
        list.push({ start: [AT.x + along.x * u + toEye.x * v, AT.y + along.y * u + toEye.y * v, AT.z + along.z * u + toEye.z * v], drift: [0, 0, 0], size, colour: [214, 230, 236], alpha, rate: 0, phase: 0.2, twinkle: 0.2 });
      }
    }
    // Ariel, Umbriel, and the sun as a hard small star, off behind you. Above it, far off, its glare on nothing.
    list.push({ start: [-300, 150, -700], drift: [0, 0, 0], size: 7, colour: [226, 228, 232], alpha: 1.2, rate: 0, phase: 0.2 });
    list.push({ start: [46, 96, -760], drift: [0, 0, 0], size: 5, colour: [170, 170, 176], alpha: 1.1, rate: 0, phase: 0.2 });
    // Grains coming off the face, falling so slowly you'd take them for hanging.
    for (let i = 0; i < (coarse ? 190 : 460); i++) {
      const z = 40 - r(i, 1) * 360, x = edge(z) + 2 + r(i, 2) * 8, top = PLATEAU - r(i, 3) * 60;
      list.push({ start: [x, top, z], drift: [2 + r(i, 4) * 6, -38 - r(i, 5) * 30, 0], size: 0.18 + r(i, 6) * 0.3, colour: [226, 230, 236], alpha: 0.55, fade: 0.6, rate: 0.012 + r(i, 7) * 0.02, phase: r(i, 8) });
    }
    const lights = flows(list);
    scene.add(lights.mesh);

    // The boulder, and the puff it makes, a good while later.
    const rockSet = new VoxelSet();
    rockSet.ball(0, 0, 0, 2.2 / 0.26, 0.26, (x, y, z) => mix(DARK, ICE, noise(x * 3 + 2, y * 3 + z * 3, 363)), 0.1, 0.84);
    const rock = rockSet.mesh("lit", { cast: true });
    scene.add(rock);
    const HOME = new Vector3(edge(-14) - 3, height(edge(-14) - 3, -14) + 1.6, -14);
    const spot = HOME.clone();
    let shovedAt = -100;
    const FALL_SECONDS = 26;

    return {
      scene,
      eye: new Vector3(-16, 58, 46),
      at: new Vector3(46, 50, -130),
      fov: 52,
      lens: { center: 0.42, band: 0.4, blur: 5 },
      cell: 0.72,
      pullback: 0.5,
      ground: height,
      sun,
      actor: spot,
      actorSize: 3.6,
      update(t) {
        sky.tick(t);
        lights.tick(t);
        const since = t - shovedAt;
        if (since < FALL_SECONDS) {
          // Over the edge at a walking pace, and then only very, very gradually faster. Sped up, or you'd be here all day.
          const k = since / FALL_SECONDS;
          rock.visible = true;
          spot.set(HOME.x + since * 0.9, HOME.y - k * k * 130, HOME.z - since * 0.06);
          rock.rotation.set(since * 0.3, since * 0.2, 0);
        } else {
          // Someone's always left another one up there.
          rock.visible = since > FALL_SECONDS + 1.5;
          spot.copy(HOME);
          rock.rotation.set(0, 0, 0);
        }
        rock.position.copy(spot);
      },
      poke(t) {
        if (t - shovedAt > FALL_SECONDS + 1.5) shovedAt = t;
        return "verona rupes · a dropped rock falls for 12 minutes";
      },
      thin(share) {
        const { geometry } = lights.mesh;
        geometry.setDrawRange(0, Math.round(geometry.getAttribute("position").count * share));
      },
    };
  },
};
