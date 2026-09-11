type PageTitleProps = {
  index: string;
  eyebrow: string;
  title: string;
  className?: string;
  glitchTitle?: boolean;
};

export function PageTitle({
  index,
  eyebrow,
  title,
  className,
  glitchTitle = false,
}: PageTitleProps) {
  return (
    <div className={`page-title ${className ?? ""}`}>
      <span className="page-index">{index}</span>
      <div>
        <span className="mono-label">{eyebrow}</span>
        <h2>
          <span className={glitchTitle ? "page-title-base" : undefined}>{title}</span>
          {glitchTitle ? (
            <>
              <span className="page-title-glitch-layer layer-a" aria-hidden="true">{title}</span>
              <span className="page-title-glitch-layer layer-b" aria-hidden="true">{title}</span>
            </>
          ) : null}
        </h2>
      </div>
      <span className="page-state mono-label">STATE / LOADED</span>
    </div>
  );
}
