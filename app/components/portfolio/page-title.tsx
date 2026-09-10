type PageTitleProps = {
  index: string;
  eyebrow: string;
  title: string;
};

export function PageTitle({ index, eyebrow, title }: PageTitleProps) {
  return (
    <div className="page-title">
      <span className="page-index">{index}</span>
      <div>
        <span className="mono-label">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <span className="page-state mono-label">STATE / LOADED</span>
    </div>
  );
}
