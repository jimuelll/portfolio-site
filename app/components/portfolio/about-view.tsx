import { PageTitle } from "./page-title";

export function AboutView() {
  return (
    <section className="inner-page about-contact-section view" id="about">
      <PageTitle index="04" eyebrow="PERSONAL FILE / OPEN CHANNEL" title="ABOUT + CONTACT" />
      <div className="about-contact-grid">
        <div className="about-contact-profile">
          <div className="about-narrative">
            <p className="lead">I build software with equal attention to how it works, how it feels, and how long it lasts.</p>
            <p>This space will hold a concise personal introduction: working style, interests, and the perspective behind the work. The final copy should sound direct and human.</p>
          </div>
          <div className="about-facts">
            <dl>
              <div><dt>LOCATION</dt><dd>QUEZON, PHILIPPINES</dd></div>
              <div><dt>FOCUS</dt><dd>PRODUCT ENGINEERING</dd></div>
              <div><dt>STATUS</dt><dd>AVAILABLE</dd></div>
            </dl>
          </div>
        </div>
        <div className="about-contact-reach">
          <span className="mono-label">START A CONVERSATION</span>
          <p className="contact-lead">Have a role, project, or idea where thoughtful engineering could help? Let&apos;s talk.</p>
          <div className="contact-actions">
            <a className="primary-action" href="mailto:hello@example.com">EMAIL ME <span aria-hidden="true">↗</span></a>
            <a href="https://www.linkedin.com/in/yourname" target="_blank" rel="noreferrer">LINKEDIN <span aria-hidden="true">↗</span></a>
            <a href="https://github.com/jimuelll" target="_blank" rel="noreferrer">GITHUB <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </div>
    </section>
  );
}
