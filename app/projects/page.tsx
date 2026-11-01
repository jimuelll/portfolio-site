import type { Metadata } from "next";
import { PageShell } from "../components/page-shell";
import { ProjectDossier } from "../components/project-dossier";
import { pageMetadata } from "../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Projects | Jimuel Jean Untalan",
  description: "Projects by software engineer Jimuel Jean Untalan, including the Enverga-Candelaria Library System, with AI recommendations, analytics, and library operations.",
  path: "/projects",
});

export default function ProjectsPage() {
  return (
    <PageShell wide centered>
      <ProjectDossier />
    </PageShell>
  );
}
