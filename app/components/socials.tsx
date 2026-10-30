export const SOCIALS = [
  { label: "github", href: "https://github.com/jimuelll" },
  { label: "linkedin", href: "https://www.linkedin.com/in/jimuel-jean-untalan-8b84a42a5" },
  { label: "email", href: "mailto:untalanjimueljean@gmail.com" },
];

export function Socials({ className = "", only }: { className?: string; only?: string[] }) {
  const links = only ? SOCIALS.filter((s) => only.includes(s.label)) : SOCIALS;
  return (
    <p className={`socials ${className}`}>
      {links.map(({ label, href }, i) => (
        <span key={label}>
          {i > 0 && <span className="sep"> / </span>}
          <a className="ink-link" href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{label}</a>
        </span>
      ))}
    </p>
  );
}
