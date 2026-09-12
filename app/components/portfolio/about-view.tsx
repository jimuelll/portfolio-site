import { PlatformIcon } from "./platform-icon";

export function AboutView() {
  return (
    <section className="inner-page about-contact-section view" id="about">
      <div className="section-heading about-section-heading">
        <span className="section-number">04</span>
        <div>
          <span className="mono-label">PERSONAL FILE / OPEN CHANNEL</span>
          <h2>ABOUT ME</h2>
        </div>
        <p>STATE / LOADED</p>
      </div>
      <div className="about-contact-grid">
        <div className="about-contact-profile">
          <div className="about-narrative">
            <p className="lead">
              I build software with equal attention to how it works, how it
              feels, and how long it lasts.
            </p>
            <p>
              Hello, I&apos;m Jean. I like making things work. When I build I
              try to place myself in the shoes of the user. I always think about
              the longevity of the product. I put a huge amount of thought too
              whenever I build UIs. A huge fan of efficiency (agentic coding
              lol). In my free time, I play video games, watch anime, or when
              I&apos;m feeling it, I build passion projects. hmu if you&apos;re
              down for some pokemon showdown haha :p
            </p>
          </div>
          <div className="about-facts">
            <dl>
              <div>
                <dt>LOCATION</dt>
                <dd>QUEZON, PHILIPPINES</dd>
              </div>
              <div>
                <dt>FOCUS</dt>
                <dd>FULL STACK DEVELOPMENT</dd>
              </div>
              <div>
                <dt>STATUS</dt>
                <dd>AVAILABLE</dd>
              </div>
              <div>
                <dt>CURRENTLY</dt>
                <dd>OPEN TO OPPORTUNITIES</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="about-contact-reach">
          <div className="contact-channel-heading">
            <span className="mono-label">OPEN CHANNEL</span>
            <span className="contact-channel-status mono-label">
              RESPONSE / AVAILABLE
            </span>
          </div>
          <div className="contact-console">
            <div className="contact-message">
              <span className="mono-label">TRANSMISSION / READY</span>
              <p className="contact-lead">Let&apos;s build something useful.</p>
              <p className="contact-subcopy">
                Have a product to build, a problem to solve, or a team I could
                help?
              </p>
            </div>
            <div className="contact-link-groups">
              <a
                className="contact-email"
                href="mailto:untalanjimueljean@gmail.com"
              >
                <span className="contact-link-icon">
                  <PlatformIcon kind="mail" />
                </span>
                <span className="contact-link-copy">
                  <span className="mono-label">EMAIL / PRIMARY</span>
                  <strong>untalanjimueljean@gmail.com</strong>
                </span>
                <span className="contact-link-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
              <div className="contact-link-group">
                <span className="mono-label">PROFESSIONAL / 01</span>
                <div className="contact-link-row">
                  <a
                    href="https://www.linkedin.com/in/jimuel-jean-untalan-8b84a42a5"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <PlatformIcon kind="linkedin" />
                    <span>LINKEDIN</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                  <a
                    href="https://github.com/jimuelll"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <PlatformIcon kind="github" />
                    <span>GITHUB</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
              <div className="contact-link-group contact-link-group-personal">
                <span className="mono-label">ELSEWHERE / 02</span>
                <div className="contact-link-row">
                  <a
                    href="https://www.instagram.com/jimuel.jean/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <PlatformIcon kind="instagram" />
                    <span>INSTAGRAM</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                  <a
                    href="https://www.facebook.com/jimueljean"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <PlatformIcon kind="facebook" />
                    <span>FACEBOOK</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
