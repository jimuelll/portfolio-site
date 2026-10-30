import type { Metadata } from "next";
import { PageShell } from "../components/page-shell";
import { ProjectIndex } from "../components/projects/project-index";
import { projects } from "../lib/portfolio";

export const metadata: Metadata = {
  title: "Projects | Jimuel Jean Untalan",
  description: "Projects by Jimuel Jean Untalan, including the Enverga-Candelaria Library System.",
};

export default function ProjectsPage() {
  const launched = projects.filter((p) => p.status === "launched").length;
  return (
    <PageShell wide>
      <header className="page-head compact">
        <p className="eyebrow">projects · {launched} launched · {projects.length - launched} in orbit</p>
        <h1>Things I&apos;ve launched into orbit.</h1>
      </header>
      <ProjectIndex projects={projects} />
    </PageShell>
  );
}
