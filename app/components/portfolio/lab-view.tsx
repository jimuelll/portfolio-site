const slots = ["01", "02", "03", "04"];

export function LabView() {
  return (
    <section className="lab-page view" aria-labelledby="lab-title">
      <div className="lab-heading">
        <div>
          <span className="mono-label">EXPERIMENTAL INDEX / 00</span>
          <h1 className="lab-title" id="lab-title" aria-label="Lab">
            <span className="lab-title-base">LAB</span>
            <span className="lab-title-copy lab-title-copy-a" aria-hidden="true">LAB</span>
            <span className="lab-title-copy lab-title-copy-b" aria-hidden="true">LAB</span>
          </h1>
        </div>
        <p>A space for experiments, small tools, visual studies, and unfinished ideas.</p>
      </div>

      <div className="lab-grid" aria-label="Future lab projects">
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
