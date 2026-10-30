import Image from "next/image";
import { profile } from "../lib/portfolio";

const RAMP = " .:-=+*#%@";
const COLS = 44;
const ROWS = 26;

/**
 * Stand-in until there's a portrait: a head-and-shoulders bust drawn like the sky's moon, a shaded sphere and
 * a shaded mound lit from the upper left. Characters are about twice as tall as wide, so y is stretched.
 */
const BUST = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => {
    const x = c - COLS / 2 + 0.5, y = (r + 0.5) * 1.9;
    // Head: a sphere. Shoulders: the top of a wide ellipse rising from the bottom edge.
    const hx = x / 8.5, hy = (y - 18) / 15;
    const sx = x / 19, sy = (y - 56) / 18;
    let nx: number, ny: number;
    if (hx * hx + hy * hy <= 1) [nx, ny] = [hx, hy];
    else if (sx * sx + sy * sy <= 1 && y > 34) [nx, ny] = [sx, sy];
    else return " ";
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const b = 0.15 + 0.85 * Math.max(0, -0.55 * nx - 0.45 * ny + 0.7 * nz);
    return RAMP[1 + Math.round(b * 7)];
  }).join(""),
).join("\n");

/** The portrait in the dossier: a theme-tinted duotone of the photo, or the ASCII stand-in until there is one. */
export function AboutPhoto() {
  return (
    <figure className="about-photo">
      <div className="photo-frame">
        {profile.photo ? (
          <div className="duotone">
            <Image src={profile.photo} alt={profile.photoAlt} fill sizes="300px" />
          </div>
        ) : (
          <div className="photo-placeholder" role="img" aria-label="Photo coming soon">
            <pre aria-hidden="true">{BUST}</pre>
            <span>photo landing soon</span>
          </div>
        )}
      </div>
      <figcaption>fig. 0 — jean</figcaption>
    </figure>
  );
}
