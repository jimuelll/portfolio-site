import { Hero } from "./hero";
import { ThreeProjectCarousel } from "./three-project-carousel";

export function WorkView() {
  return (
    <div className="view">
      <Hero />
      <section className="work-section" id="work">
        <div className="section-heading">
          <span className="section-number">01</span>
          <div><span className="mono-label">SELECTED</span><h2>WORK</h2></div>
          <p>03 / 03 PROJECTS</p>
        </div>
        <ThreeProjectCarousel />
      </section>
    </div>
  );
}
