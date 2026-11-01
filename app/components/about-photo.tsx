"use client";

import Image from "next/image";
import { useState } from "react";
import { profile } from "../lib/portfolio";

/**
 * The avatar in the dossier. A tap or click plays the animation, and another stops it. It's only asked for when it
 * plays, so visitors who never press it don't download it.
 */
export function AboutPhoto() {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className="about-photo">
      <button
        type="button"
        className="photo-frame"
        aria-label={`${playing ? "Stop" : "Play"} avatar animation`}
        aria-pressed={playing}
        onClick={() => setPlaying((p) => !p)}
      >
        <Image src={profile.avatar} alt={profile.avatarAlt} width={872} height={855} sizes="(max-width: 860px) 180px, 216px" loading="eager" />
        {playing && <Image className="avatar-play" src={profile.avatarPlay} alt="" width={224} height={224} unoptimized />}
      </button>
    </figure>
  );
}
