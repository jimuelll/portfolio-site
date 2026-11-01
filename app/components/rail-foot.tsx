import { CvButton } from "./cv-button";

/** The foot of the side rail on the about and projects pages: how to reach you, and the CV. */
export function RailFoot({ className = "" }: { className?: string }) {
  return (
    <div className={`rail-foot ${className}`}>
      <ul className="contact-line">
        <li><a className="ink-link" href="mailto:untalanjimueljean@gmail.com">untalanjimueljean@gmail.com</a></li>
        <li><a className="ink-link" href="https://github.com/jimuelll" target="_blank" rel="noopener noreferrer">github</a></li>
        <li><a className="ink-link" href="https://www.linkedin.com/in/jimuel-jean-untalan-8b84a42a5" target="_blank" rel="noopener noreferrer">linkedin</a></li>
        <li>Quezon, PH · UTC+8</li>
      </ul>
      <CvButton />
    </div>
  );
}
