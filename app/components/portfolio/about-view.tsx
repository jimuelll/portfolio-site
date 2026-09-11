import { PageTitle } from "./page-title";

export function AboutView() {
  return (
    <section className="inner-page view" id="about">
      <PageTitle index="04" eyebrow="PERSONAL FILE" title="ABOUT" />
      <div className="about-grid">
        <div className="about-copy">
          <div className="about-narrative">
            <p className="lead">I build software with equal attention to how it works, how it feels, and how long it lasts.</p>
            <p>This space will hold a concise personal introduction: working style, interests, and the perspective behind the work. The final copy should sound direct and human.</p>
          </div>
          <div className="about-facts">
            <dl>
              <div><dt>LOCATION</dt><dd>CITY, COUNTRY</dd></div>
              <div><dt>FOCUS</dt><dd>PRODUCT ENGINEERING</dd></div>
              <div><dt>STATUS</dt><dd>AVAILABLE</dd></div>
            </dl>
            <a className="contact-link" href="mailto:hello@example.com">HELLO@EXAMPLE.COM ↗</a>
          </div>
        </div>
      </div>
    </section>
  );
}
