import type { Metadata } from "next";
import PageShell from "../components/PageShell";

export const metadata: Metadata = {
  title: "About",
  description:
    "What this Next.js application is and how its Statistics page uses the GitHub API",
};

export default function About() {
  return (
    <PageShell current="/about">
      <h1 className="text-4xl font-bold mb-8">About</h1>

      <div className="space-y-4">
        <p className="text-lg">
          This is a Next.js application showcasing pages for Home, About, and
          Statistics.
        </p>
        <p>
          The Statistics page fetches data from GitHub API to show popular
          AI-related repositories, demonstrating real-time data fetching
          capabilities in Next.js.
        </p>
      </div>
    </PageShell>
  );
}
