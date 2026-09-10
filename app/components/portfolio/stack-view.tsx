import { stackGroups } from "../../lib/portfolio";
import { PageTitle } from "./page-title";

export function StackView() {
  return (
    <section className="inner-page view">
      <PageTitle index="03" eyebrow="CAPABILITY MAP" title="STACK" />
      <div className="stack-grid">
        {stackGroups.map((group, index) => (
          <article key={group.name}>
            <span className="stack-number">0{index + 1}</span>
            <span className="mono-label">{group.name}</span>
            <p>{group.items}</p>
          </article>
        ))}
      </div>
      <div className="stack-note"><span className="mono-label">PRINCIPLE</span><p>Tools are selected for the problem. Fundamentals stay constant.</p></div>
    </section>
  );
}
