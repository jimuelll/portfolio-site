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
              Hello, I'm Jean. I like making things work. When I build I try to
              place myself in the shoes of the user. I always think about the
              longevity of the product. I put a huge amount of thought too
              whenever I build UIs. A huge fan of efficiency (agentic coding
              lol). In my free time, I play video games, watch anime, or when
              I'm feeling it, I build passion projects.
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
          <span className="mono-label">START A CONVERSATION</span>
          <p className="contact-lead">
            Have a product to build, a problem to solve, or a team I could help?
            Let's talk.
          </p>
          <div className="contact-actions">
            <a className="primary-action" href="mailto:hello@example.com">
              EMAIL ME <span aria-hidden="true">↗</span>
            </a>
            <a
              href="https://www.linkedin.com/in/yourname"
              target="_blank"
              rel="noreferrer"
            >
              LINKEDIN <span aria-hidden="true">↗</span>
            </a>
            <a
              href="https://github.com/jimuelll"
              target="_blank"
              rel="noreferrer"
            >
              GITHUB <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
