import type { Metadata } from "next";
import { HomeSky } from "./components/home-sky";
import { pageMetadata } from "./lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Jimuel Jean Untalan | Software Engineer",
  description: "Portfolio of Jimuel Jean Untalan, a software engineer from Quezon, Philippines building reliable web applications with React, Node.js, databases, and cloud tooling.",
  path: "/",
});

export default function Home() {
  return <HomeSky />;
}
