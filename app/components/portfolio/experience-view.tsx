import { experienceRoles } from "../../lib/portfolio";
import { PageTitle } from "./page-title";

export function ExperienceView() {
  return (
    <section className="inner-page view">
      <PageTitle index="02" eyebrow="CAREER LOG" title="EXPERIENCE" />
      <div className="timeline">
        {experienceRoles.map((role, index) => (
          <article className="role" key={role.date}>
            <span className="role-index mono-label">0{index + 1}</span>
            <span className="role-date mono-label">{role.date}</span>
            <div><h2>{role.role}</h2><p className="company">{role.company}</p></div>
            <p className="role-copy">{role.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
