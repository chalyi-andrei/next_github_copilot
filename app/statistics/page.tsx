import type { Metadata } from "next";
import PageShell from "../components/PageShell";
import RepoExplorer from "./RepoExplorer";
import { getPopularAICodeAssistants } from "./github";

export const metadata: Metadata = {
  title: "AI Code Assistants Statistics",
  description:
    "Popular AI coding assistants and tools from GitHub, ranked by stars",
};

export default async function Statistics() {
  const { assistants, failedSources, totalSources } =
    await getPopularAICodeAssistants();

  return (
    <PageShell current="/statistics" wide>
      <h1 className="text-4xl font-bold mb-8">AI Code Assistants Statistics</h1>

      <p className="text-lg mb-8">
        Popular AI coding assistants and tools from GitHub (ranked by stars):
      </p>

      {failedSources > 0 && assistants.length > 0 && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {failedSources} of {totalSources} GitHub requests failed, so this
          list may be incomplete.
        </p>
      )}

      {assistants.length > 0 ? (
        <RepoExplorer assistants={assistants} />
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">
            Unable to load AI repository data. Please try again later.
          </p>
        </div>
      )}
    </PageShell>
  );
}
