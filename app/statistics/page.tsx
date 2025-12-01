import Link from "next/link";

interface Repo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  language: string;
}

async function getPopularAICodeAssistants(): Promise<Repo[]> {
  try {
    // Search for popular AI coding assistants on GitHub
    const searchTerms = [
      "ai+coding+assistant",
      "ai+code+assistant",
      "ai+copilot+programming",
      "ai+code+completion",
    ];

    const allRepos: Repo[] = [];

    // Fetch data from multiple search queries
    for (const term of searchTerms) {
      try {
        const response = await fetch(
          `https://api.github.com/search/repositories?q=topic:${term}+sort:stars&order=desc&per_page=5`,
          {
            next: { revalidate: 3600 }, // Revalidate every hour
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.items) {
            allRepos.push(...data.items);
          }
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`Error fetching for term "${term}":`, error);
        continue;
      }
    }

    // Remove duplicates by id and sort by stars
    const uniqueRepos = allRepos
      .filter(
        (repo, index, self) => index === self.findIndex((r) => r.id === repo.id)
      )
      .sort((a, b) => b.stargazers_count - a.stargazers_count);

    return uniqueRepos.slice(0, 10);
  } catch (error) {
    console.error("Error fetching AI repos:", error);
    return [];
  }
}

export default async function Statistics() {
  const repos = await getPopularAICodeAssistants();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-start justify-between py-32 px-16 bg-white dark:bg-black">
        <div className="w-full">
          <nav className="mb-8">
            <ul className="flex space-x-6">
              <li>
                <Link href="/" className="text-blue-600 hover:underline">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-blue-600 hover:underline">
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/statistics"
                  className="text-blue-600 hover:underline font-bold"
                >
                  Statistics
                </Link>
              </li>
            </ul>
          </nav>

          <h1 className="text-4xl font-bold mb-8">
            AI Code Assistants Statistics
          </h1>

          <p className="text-lg mb-8">
            Popular AI coding assistants and tools from GitHub (ranked by
            stars):
          </p>

          {repos.length > 0 ? (
            <div className="space-y-4">
              {repos.map((repo: Repo, index: number) => (
                <div
                  key={repo.id}
                  className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">
                        #{index + 1} -{" "}
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {repo.full_name}
                        </a>
                      </h3>
                      {repo.description && (
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>
                          ⭐ {repo.stargazers_count.toLocaleString()} stars
                        </span>
                        {repo.language && (
                          <span>Language: {repo.language}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">
                Unable to load AI repository data. Please try again later.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
