import type { Metadata } from "next";
import { PortfolioShell } from "../components/portfolio/portfolio-shell";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
const title = "Lab | Jimuel Jean Untalan";
const description =
  "Experimental interface studies and in-progress builds by Jimuel Jean Untalan, a full-stack developer from Quezon, Philippines.";

export const metadata: Metadata = {
  title,
  description,
  alternates: siteOrigin ? { canonical: "/lab" } : undefined,
  openGraph: {
    title,
    description,
    type: "website",
    ...(siteOrigin ? { url: `${siteOrigin}/lab` } : {}),
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function LabPage() {
  return <PortfolioShell initialPage="lab" />;
}
