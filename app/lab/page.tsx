import type { Metadata } from "next";
import { LabShell } from "../components/portfolio/lab-shell";

export const metadata: Metadata = {
  title: "Lab — Untalan J.",
  description: "Experiments, small tools, and visual studies by Untalan J.",
};

export default function LabPage() {
  return <LabShell />;
}
