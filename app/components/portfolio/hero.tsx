import { GlitchTitle } from "./glitch-title";
import { PhotoCard } from "./photo-card";
import { RippleGrid } from "./ripple-grid";
import { GithubContributions } from "./github-contributions";

export function Hero() {
  return (
    <section className="hero" id="start">
      <div className="hero-stage">
        <RippleGrid />
        <div className="hero-kicker mono-label">00 / INDEX</div>
        <div className="hero-main">
          <div className="hero-title">
            <div className="hero-name mono-label">JIMUEL JEAN UNTALAN</div>
            <GlitchTitle />
            <p className="hero-summary">
              Building precise, resilient software systems where product
              thinking meets technical depth.
            </p>
            <div className="hero-actions" aria-label="Profile links">
              <a className="primary-action" href="/cv.pdf" download>
                DOWNLOAD CV <span aria-hidden="true">↓</span>
              </a>
              <GithubContributions />
              <a
                href="https://www.linkedin.com/in/yourname"
                target="_blank"
                rel="noreferrer"
              >
                LINKEDIN <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <PhotoCard />
        </div>
        <div className="hero-code" aria-hidden="true">
          SYS::PORTFOLIO / 01
        </div>
      </div>
      <div className="hero-meta">
        <div>
          <span className="mono-label">01 / FOCUS</span>
          <p>INTERFACE TO INFRASTRUCTURE</p>
        </div>
        <div>
          <span className="mono-label">02 / STATUS</span>
          <p>
            <span className="status-square" />
            AVAILABLE FOR WORK
          </p>
        </div>
        <div>
          <span className="mono-label">03 / LOCATION</span>
          <p>QUEZON, PHILIPPINES</p>
        </div>
      </div>
    </section>
  );
}
