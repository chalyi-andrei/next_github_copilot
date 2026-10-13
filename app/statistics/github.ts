// Data layer for the Statistics page: loads AI coding assistants from GitHub

// Raw repository as returned by the GitHub search API (only the fields we use)
export interface GitHubRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count?: number;
  open_issues_count?: number;
  language: string | null;
  topics?: string[];
  pushed_at?: string;
  archived?: boolean;
  license?: { spdx_id: string | null } | null;
  owner?: { avatar_url?: string };
}

export interface Assistant {
  id: number;
  rank: number; // position by stars across the whole list
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number; // GitHub counts open pull requests here too
  language: string | null;
  topics: string[];
  license: string | null; // SPDX id, e.g. "MIT"
  pushedAt: string | null; // ISO date of the last push
  avatarUrl: string | null;
  archived: boolean;
  inactive: boolean; // no pushes for more than INACTIVE_AFTER_DAYS
}

export interface AssistantsResult {
  assistants: Assistant[];
  failedSources: number;
  totalSources: number;
}

// Well-known tools that do not tag themselves with any of TOPICS on GitHub,
// so a topic search alone would never find them. Loaded in a single request.
export const CURATED_REPOS = [
  "anthropics/claude-code",
  "openai/codex",
  "google-gemini/gemini-cli",
  "cline/cline",
  "Aider-AI/aider",
  "continuedev/continue",
  "Kilo-Org/kilocode",
  "anomalyco/opencode",
  "OpenHands/OpenHands",
  "aaif-goose/goose",
] as const;

// GitHub topics used to discover everything else
export const TOPICS = [
  "coding-assistant",
  "coding-agent",
  "ai-coding-assistant",
  "code-assistant",
] as const;

export const PER_TOPIC = 20;
export const MAX_ASSISTANTS = 30;
export const INACTIVE_AFTER_DAYS = 365;
export const REVALIDATE_SECONDS = 3600;
// Per request: all sources together must stay below the 60 s page generation limit
export const FETCH_TIMEOUT_MS = 8000;
// The only image host allowed for next/image in next.config.ts
export const AVATAR_HOST = "avatars.githubusercontent.com";

const SEARCH_URL = "https://api.github.com/search/repositories";
const DAY_MS = 24 * 60 * 60 * 1000;

// Topics and names that mark link lists and learning materials, not tools
const NON_TOOL_TOPICS = new Set([
  "awesome",
  "awesome-list",
  "awesome-lists",
  "book",
  "books",
  "tutorial",
  "tutorials",
  "course",
  "guide",
  "cheatsheet",
]);
const NON_TOOL_NAME = /(^|[-_.])(awesome|book|guide|tutorial|course)([-_.]|$)/i;
const NON_TOOL_DESCRIPTION =
  /\b(curated (list|collection)|hand-picked collection|tutorial|handbook|cheat ?sheet|guide|book)\b/i;

export function buildSourceUrls(): string[] {
  const curatedQuery = CURATED_REPOS.map((repo) => `repo:${repo}`).join("+");

  return [
    `${SEARCH_URL}?q=${curatedQuery}&sort=stars&order=desc&per_page=${CURATED_REPOS.length}`,
    ...TOPICS.map(
      (topic) =>
        `${SEARCH_URL}?q=topic:${topic}+archived:false&sort=stars&order=desc&per_page=${PER_TOPIC}`
    ),
  ];
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Optional: raises the search rate limit from 10 to 30 requests per minute
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

// Filters out "awesome" lists, books and guides that share the same topics
export function isLikelyTool(repo: GitHubRepo): boolean {
  const name = repo.full_name.split("/")[1] ?? repo.full_name;

  if (NON_TOOL_NAME.test(name)) return false;
  if (repo.topics?.some((topic) => NON_TOOL_TOPICS.has(topic))) return false;
  if (repo.description && NON_TOOL_DESCRIPTION.test(repo.description)) {
    return false;
  }

  return true;
}

// next/image rejects hosts missing from next.config.ts, so drop any other URL
function toAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === AVATAR_HOST
      ? value
      : null;
  } catch {
    return null;
  }
}

function toAssistant(repo: GitHubRepo, rank: number, now: number): Assistant {
  const pushedAt = repo.pushed_at ?? null;
  const pushedTime = pushedAt ? Date.parse(pushedAt) : NaN;
  const license = repo.license?.spdx_id ?? null;

  return {
    id: repo.id,
    rank,
    fullName: repo.full_name,
    url: repo.html_url,
    description: repo.description,
    stars: repo.stargazers_count,
    forks: repo.forks_count ?? 0,
    openIssues: repo.open_issues_count ?? 0,
    language: repo.language,
    topics: repo.topics ?? [],
    // GitHub reports NOASSERTION when it cannot recognise the license
    license: license === "NOASSERTION" ? null : license,
    pushedAt,
    avatarUrl: toAvatarUrl(repo.owner?.avatar_url),
    archived: repo.archived ?? false,
    inactive:
      !Number.isNaN(pushedTime) &&
      now - pushedTime > INACTIVE_AFTER_DAYS * DAY_MS,
  };
}

export async function getPopularAICodeAssistants(): Promise<AssistantsResult> {
  const urls = buildSourceUrls();
  const curated: GitHubRepo[] = [];
  const discovered: GitHubRepo[] = [];
  let failedSources = 0;

  // Fetch the sources one by one to stay within the search rate limit
  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetch(url, {
        headers: githubHeaders(),
        next: { revalidate: REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.items)) {
          (index === 0 ? curated : discovered).push(...data.items);
        } else {
          failedSources += 1;
          console.error(`GitHub response has no "items" array for "${url}"`);
        }
      } else {
        failedSources += 1;
        console.error(
          `GitHub responded with HTTP ${response.status} for "${url}"`
        );
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      failedSources += 1;
      console.error(`Error fetching "${url}":`, error);
      continue;
    }
  }

  // Curated repositories are always tools; discovered ones are filtered
  const allRepos = [...curated, ...discovered.filter(isLikelyTool)];

  // Remove duplicates by id and sort by stars
  const uniqueRepos = allRepos
    .filter(
      (repo, index, self) => index === self.findIndex((r) => r.id === repo.id)
    )
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, MAX_ASSISTANTS);

  const now = Date.now();

  return {
    assistants: uniqueRepos.map((repo, index) =>
      toAssistant(repo, index + 1, now)
    ),
    failedSources,
    totalSources: urls.length,
  };
}
