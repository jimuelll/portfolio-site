import { Hero } from "./hero";
import { projects } from "../../lib/portfolio";

export function WorkView() {
  return (
    <div className="view" id="work">
      <Hero />
      <section className="work-section">
        <div className="section-heading">
          <span className="section-number">01</span>
          <div><span className="mono-label">SELECTED</span><h2>WORK</h2></div>
          <p>03 / 05 PROJECTS</p>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <article className="project" key={project.index} tabIndex={0}>
              <div className="project-visual" aria-label={`${project.name} image placeholder`}>
                <span className="placeholder-label">IMAGE / {project.index}</span>
                <div className="pixel-field" aria-hidden="true" />
                <div className="project-index">{project.index}</div>
              </div>
              <div className="project-copy">
                <div className="project-topline mono-label"><span>{project.index} / {project.type}</span><span>{project.year}</span></div>
                <h3>{project.name}</h3>
                <p className="project-summary">{project.summary}</p>
                <div className="project-bottom">
                  <div><span className="mono-label">STACK</span><p>{project.stack}</p></div>
                  <span className="view-project">VIEW PROJECT ↗</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
