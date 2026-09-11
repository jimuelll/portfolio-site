import { PageTitle } from "./page-title";

export function ContactView() {
  return (
    <section className="inner-page contact-section view" id="contact">
      <PageTitle index="06" eyebrow="START A CONVERSATION" title="CONTACT" />
      <div className="contact-grid">
        <p className="contact-lead">
          Have a role, project, or idea where thoughtful engineering could help?
          Let&apos;s talk.
        </p>
        <div className="contact-actions">
          <a className="primary-action" href="mailto:hello@example.com">
            EMAIL ME <span aria-hidden="true">↗</span>
          </a>
          <a href="https://www.linkedin.com/in/yourname" target="_blank" rel="noreferrer">
            LINKEDIN <span aria-hidden="true">↗</span>
          </a>
          <a href="https://github.com/jimuelll" target="_blank" rel="noreferrer">
            GITHUB <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
