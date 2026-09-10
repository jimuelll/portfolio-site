import { GlitchTitle } from "./glitch-title";
import { PhotoCard } from "./photo-card";
import { RippleGrid } from "./ripple-grid";

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-stage">
        <RippleGrid />
        <div className="hero-kicker mono-label">00 / INDEX</div>
        <div className="hero-main">
          <div className="hero-title">
            <div className="hero-name mono-label">JIMUEL JEAN UNTALAN</div>
            <GlitchTitle />
            <div className="hero-actions" aria-label="Profile links">
              <a className="primary-action" href="/cv.pdf" download>DOWNLOAD CV <span aria-hidden="true">↓</span></a>
              <a href="https://github.com/jimuelll" target="_blank" rel="noreferrer">GITHUB <span aria-hidden="true">↗</span></a>
              <a href="https://www.linkedin.com/in/yourname" target="_blank" rel="noreferrer">LINKEDIN <span aria-hidden="true">↗</span></a>
            </div>
          </div>
          <PhotoCard />
        </div>
        <div className="hero-code" aria-hidden="true">SYS::PORTFOLIO / 01</div>
      </div>
      <div className="hero-meta">
        <div><span className="mono-label">SPECIALIZATION</span><p>INTERFACE TO<br />INFRASTRUCTURE</p></div>
        <div><span className="mono-label">CURRENT STATUS</span><p><span className="status-square" />AVAILABLE FOR WORK</p></div>
        <div className="hero-intro"><p>Building precise, resilient software systems where product thinking meets technical depth.</p></div>
      </div>
    </section>
  );
}
