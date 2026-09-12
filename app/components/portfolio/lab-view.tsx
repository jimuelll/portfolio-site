import { GlitchTitle } from "./glitch-title";

const slots = ["01", "02", "03", "04"];

export function LabView() {
  return (
    <section className="lab-page view" aria-labelledby="lab-title">
      <div className="lab-heading">
        <div>
          <span className="mono-label">EXPERIMENTAL INDEX / 00</span>
          <GlitchTitle variant="lab" id="lab-title" />
        </div>
        <p>
          A space for experiments, small tools, visual studies, and unfinished
          ideas.
        </p>
      </div>

      <div className="lab-grid" aria-label="Future lab work">
        {slots.map((slot) => (
          <article className="lab-slot" key={slot}>
            <span className="mono-label">SLOT / {slot}</span>
            <span className="lab-slot-state mono-label">STATUS::AVAILABLE</span>
            <strong>{slot}</strong>
            <p>RESERVED FOR A FUTURE EXPERIMENT</p>
          </article>
        ))}
      </div>
    </section>
  );
}
