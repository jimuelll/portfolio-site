/*
 * Everything out here is made of cubes: one instanced box per voxel (or per stretched column, for terrain), with a
 * little colour variation per voxel so surfaces look hand-placed.
 */

import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, type Material, type Object3D } from "three";
import { hash, type Rgb } from "../engine";

const UNIT = new BoxGeometry(1, 1, 1);

/** A colour nudged by where it is: mostly brightness, a touch of hue. */
export function vary(c: Rgb, x: number, y: number, z: number, amount = 0.08): Rgb {
  const ix = Math.round(x * 7), iy = Math.round(y * 7), iz = Math.round(z * 7);
  const k = 1 + (hash(ix, iy, iz) - 0.5) * 2 * amount;
  const warm = (hash(ix, iz, iy + 11) - 0.5) * amount * 22;
  return [c[0] * k + warm, c[1] * k, c[2] * k - warm];
}

export class VoxelSet {
  private data: number[] = [];

  get count() {
    return this.data.length / 9;
  }

  /** One box by its centre and size, in exactly this colour. */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, c: Rgb) {
    this.data.push(x, y, z, sx, sy, sz, c[0] / 255, c[1] / 255, c[2] / 255);
  }

  /** One cube, varied. */
  add(x: number, y: number, z: number, c: Rgb, size = 1, amount = 0.08) {
    this.box(x, y, z, size, size, size, vary(c, x, y, z, amount));
  }

  /** A solid block between two corners, in cubes of `size`; only its outside is kept. */
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Rgb | ((x: number, y: number, z: number) => Rgb), size = 1, amount = 0.08) {
    const nx = Math.max(1, Math.round((x1 - x0) / size)), ny = Math.max(1, Math.round((y1 - y0) / size)), nz = Math.max(1, Math.round((z1 - z0) / size));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        for (let k = 0; k < nz; k++) {
          if (i > 0 && j > 0 && k > 0 && i < nx - 1 && j < ny - 1 && k < nz - 1) continue;
          const x = x0 + (i + 0.5) * size, y = y0 + (j + 0.5) * size, z = z0 + (k + 0.5) * size;
          this.add(x, y, z, typeof c === "function" ? c(x, y, z) : c, size, amount);
        }
      }
    }
  }

  /** A column of ground from the floor up to height h: one stretched box, so terrain stays cheap. */
  column(x: number, z: number, h: number, floor: number, size: number, c: Rgb, amount = 0.08) {
    this.box(x, (h + floor) / 2, z, size, Math.max(0.01, h - floor), size, vary(c, x, h, z, amount));
  }

  /** The shell of a ball of `r` cubes, coloured by its surface normal. */
  ball(cx: number, cy: number, cz: number, r: number, size: number, c: (nx: number, ny: number, nz: number) => Rgb, amount = 0.06, squash = 1) {
    const R = Math.ceil(r);
    for (let i = -R; i <= R; i++) {
      for (let j = -R; j <= R; j++) {
        for (let k = -R; k <= R; k++) {
          const d = Math.hypot(i, j / squash, k);
          if (d > r || d < r - 1.5) continue;
          this.add(cx + i * size, cy + j * size, cz + k * size, c(i / d, j / d / squash, k / d), size, amount);
        }
      }
    }
  }

  /** Turns what has been added into a mesh. Lit voxels take part in the scene's light; glowing ones ignore it. */
  mesh(look: "lit" | "glow" = "lit", shadows: { cast?: boolean; receive?: boolean } = {}) {
    const n = this.count;
    const material: Material = look === "lit" ? new MeshLambertMaterial() : new MeshBasicMaterial();
    const mesh = new InstancedMesh(UNIT, material, n);
    const matrices = mesh.instanceMatrix.array as Float32Array;
    const colours = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const at = i * 9, m = i * 16;
      matrices[m] = this.data[at + 3];
      matrices[m + 5] = this.data[at + 4];
      matrices[m + 10] = this.data[at + 5];
      matrices[m + 12] = this.data[at];
      matrices[m + 13] = this.data[at + 1];
      matrices[m + 14] = this.data[at + 2];
      matrices[m + 15] = 1;
      colours.set(this.data.slice(at + 6, at + 9), i * 3);
    }
    mesh.instanceColor = new InstancedBufferAttribute(colours, 3);
    mesh.castShadow = Boolean(shadows.cast);
    mesh.receiveShadow = Boolean(shadows.receive);
    // Everything sits in view anyway, and a stretched instance would need a bounding sphere for no gain.
    mesh.frustumCulled = false;
    return mesh;
  }
}

/** A swarm of small cubes moved by hand each frame: petals, dust. */
export class Motes {
  readonly mesh: InstancedMesh;
  private matrices: Float32Array;

  constructor(n: number, colour: (i: number) => Rgb, material: "lit" | "glow" = "glow") {
    const set = new VoxelSet();
    for (let i = 0; i < n; i++) set.box(0, -1000, 0, 1, 1, 1, colour(i));
    this.mesh = set.mesh(material);
    this.matrices = this.mesh.instanceMatrix.array as Float32Array;
  }

  place(i: number, x: number, y: number, z: number, size: number) {
    const m = i * 16;
    this.matrices[m] = this.matrices[m + 5] = this.matrices[m + 10] = size;
    this.matrices[m + 12] = x;
    this.matrices[m + 13] = y;
    this.matrices[m + 14] = z;
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Lets go of whatever a scene built. The shared unit cube stays. */
export function release(root: Object3D) {
  root.traverse((node) => {
    const mesh = node as Partial<InstancedMesh>;
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
    if (mesh.geometry && mesh.geometry !== UNIT) mesh.geometry.dispose();
    if ((node as InstancedMesh).isInstancedMesh) (node as InstancedMesh).dispose();
  });
}
