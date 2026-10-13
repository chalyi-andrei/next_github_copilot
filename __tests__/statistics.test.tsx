import { render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import Statistics, { metadata } from "../app/statistics/page";
import {
  AVATAR_HOST,
  CURATED_REPOS,
  MAX_ASSISTANTS,
  PER_TOPIC,
  TOPICS,
} from "../app/statistics/github";
import { expectMainNavigation } from "./helpers/navigation";

interface TestRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics: string[];
  pushed_at: string;
  archived: boolean;
  license: { spdx_id: string | null } | null;
  owner: { avatar_url: string };
}

// One source per request: the curated repositories, then every topic
const SOURCES = ["curated", ...TOPICS] as const;

type Source = (typeof SOURCES)[number];

const NOW = new Date("2026-06-01T00:00:00Z");

const FALLBACK_TEXT =
  "Unable to load AI repository data. Please try again later.";

function makeRepo(
  id: number,
  stars: number,
  overrides: Partial<TestRepo> = {}
): TestRepo {
  return {
    id,
    full_name: `org/repo-${id}`,
    html_url: `https://github.com/org/repo-${id}`,
    description: `Description ${id}`,
    stargazers_count: stars,
    forks_count: 10,
    open_issues_count: 5,
    language: "TypeScript",
    topics: ["coding-assistant"],
    pushed_at: "2026-05-20T10:00:00Z",
    archived: false,
    license: { spdx_id: "MIT" },
    owner: { avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4` },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: Mock<typeof fetch>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function sourceOf(url: string): Source {
  if (url.includes("q=repo:")) return "curated";

  const topic = TOPICS.find((t) => url.includes(`q=topic:${t}+`));
  if (!topic) {
    throw new Error(`Unexpected request: ${url}`);
  }
  return topic;
}

// Routes each mocked request to a handler by its source
function mockFetchBySource(
  handler: (source: Source) => Response | Promise<Response>
) {
  fetchMock.mockImplementation(async (input) => handler(sourceOf(String(input))));
}

function getRepoHeadings(): string[] {
  return screen
    .queryAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent ?? "");
}

async function renderStatistics() {
  const pending = Statistics();
  await vi.runAllTimersAsync();
  render(await pending);
}

describe("Statistics page", () => {
  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it("exports its own page title", () => {
    expect(metadata.title).toBe("AI Code Assistants Statistics");
    expect(metadata.description).toEqual(expect.any(String));
  });

  describe("successful response", () => {
    const repos = [
      makeRepo(1, 300, {
        full_name: "org/b",
        html_url: "https://github.com/org/b",
        description: "Second repo",
        language: "Python",
      }),
      makeRepo(2, 1500, {
        full_name: "org/a",
        html_url: "https://github.com/org/a",
        description: "Top repo",
        language: "TypeScript",
        forks_count: 2300,
        open_issues_count: 41,
        license: { spdx_id: "Apache-2.0" },
        topics: ["cli", "coding-agent"],
      }),
      makeRepo(3, 50, {
        full_name: "org/c",
        html_url: "https://github.com/org/c",
        language: "Go",
      }),
    ];

    beforeEach(() => {
      mockFetchBySource((source) =>
        source === "coding-assistant"
          ? jsonResponse({ items: repos })
          : jsonResponse({ items: [] })
      );
    });

    it("renders the heading and repositories sorted by stars", async () => {
      await renderStatistics();

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "AI Code Assistants Statistics",
        })
      ).toBeInTheDocument();
      expect(screen.getByText(/ranked by/)).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([
        "#1 - org/a",
        "#2 - org/b",
        "#3 - org/c",
      ]);
      expect(screen.queryByText(FALLBACK_TEXT)).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("renders external repository links", async () => {
      await renderStatistics();

      const link = screen.getByRole("link", { name: "org/a" });
      expect(link).toHaveAttribute("href", "https://github.com/org/a");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders description, language and stars", async () => {
      await renderStatistics();

      expect(screen.getByText("Top repo")).toBeInTheDocument();
      expect(screen.getByText("Language: Python")).toBeInTheDocument();
      expect(screen.getByText("Language: Go")).toBeInTheDocument();
      expect(screen.getByText("⭐ 1,500 stars")).toBeInTheDocument();
      expect(screen.getByText("⭐ 300 stars")).toBeInTheDocument();
    });

    it("renders forks, issues, license, last push and topics", async () => {
      await renderStatistics();

      expect(screen.getByText("Forks: 2,300")).toBeInTheDocument();
      expect(screen.getByText("Open issues and PRs: 41")).toBeInTheDocument();
      expect(screen.getByText("License: Apache-2.0")).toBeInTheDocument();
      expect(screen.getAllByText("Last push: 2026-05-20")).toHaveLength(3);

      const topics = screen.getByRole("list", { name: "Topics of org/a" });
      expect(topics).toHaveTextContent("cli");
      expect(topics).toHaveTextContent("coding-agent");
    });

    it("renders a decorative owner avatar for every repository", async () => {
      await renderStatistics();

      const avatars = Array.from(document.querySelectorAll("img"));
      expect(avatars).toHaveLength(3);
      for (const avatar of avatars) {
        expect(avatar).toHaveAttribute("alt", "");
        expect(decodeURIComponent(avatar.getAttribute("src") ?? "")).toContain(
          "https://avatars.githubusercontent.com/u/"
        );
      }
    });

    it("requests the curated repositories and every topic with hourly revalidation", async () => {
      await renderStatistics();

      expect(fetchMock).toHaveBeenCalledTimes(SOURCES.length);

      const urls = fetchMock.mock.calls.map((call) => String(call[0]));
      for (const url of urls) {
        expect(url).toContain("https://api.github.com/search/repositories?q=");
        expect(url).toContain("sort=stars");
        expect(url).toContain("order=desc");
      }

      for (const repo of CURATED_REPOS) {
        expect(urls[0]).toContain(`repo:${repo}`);
      }
      expect(urls[0]).toContain(`per_page=${CURATED_REPOS.length}`);

      TOPICS.forEach((topic, index) => {
        const url = urls[index + 1];
        expect(url).toContain(`q=topic:${topic}+archived:false`);
        expect(url).toContain(`per_page=${PER_TOPIC}`);
      });

      for (const call of fetchMock.mock.calls) {
        expect(call[1]).toMatchObject({ next: { revalidate: 3600 } });
        expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
      }
    });

    it("renders the main navigation with Statistics active", async () => {
      await renderStatistics();

      expectMainNavigation("Statistics");
    });
  });

  describe("GitHub token", () => {
    beforeEach(() => {
      mockFetchBySource(() => jsonResponse({ items: [] }));
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("sends no Authorization header without GITHUB_TOKEN", async () => {
      vi.stubEnv("GITHUB_TOKEN", "");

      await renderStatistics();

      expect(fetchMock).toHaveBeenCalledTimes(SOURCES.length);
      for (const call of fetchMock.mock.calls) {
        const headers = call[1]?.headers as Record<string, string>;
        expect(headers.Accept).toBe("application/vnd.github+json");
        expect(headers).not.toHaveProperty("Authorization");
      }
    });

    it("sends GITHUB_TOKEN as a bearer token", async () => {
      vi.stubEnv("GITHUB_TOKEN", "test-token");

      await renderStatistics();

      expect(fetchMock).toHaveBeenCalledTimes(SOURCES.length);
      for (const call of fetchMock.mock.calls) {
        const headers = call[1]?.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer test-token");
      }
    });
  });

  describe("data processing", () => {
    it("removes duplicate repositories by id", async () => {
      const shared = makeRepo(42, 900, { full_name: "org/shared" });
      mockFetchBySource((source) =>
        source === "coding-agent"
          ? jsonResponse({ items: [makeRepo(7, 100)] })
          : jsonResponse({ items: [shared] })
      );

      await renderStatistics();

      expect(getRepoHeadings()).toEqual(["#1 - org/shared", "#2 - org/repo-7"]);
      expect(screen.getAllByRole("link", { name: "org/shared" })).toHaveLength(
        1
      );
    });

    it("limits the list to the most starred repositories", async () => {
      // Every source returns 10 unique repos, stars: 10, 20, ...
      mockFetchBySource((source) => {
        const offset = SOURCES.indexOf(source) * 10;
        const items = Array.from({ length: 10 }, (_, i) => {
          const id = offset + i + 1;
          return makeRepo(id, id * 10);
        });
        return jsonResponse({ items });
      });
      const total = SOURCES.length * 10;

      await renderStatistics();

      const headings = getRepoHeadings();
      expect(headings).toHaveLength(MAX_ASSISTANTS);
      expect(headings[0]).toBe(`#1 - org/repo-${total}`);
      expect(headings[MAX_ASSISTANTS - 1]).toBe(
        `#${MAX_ASSISTANTS} - org/repo-${total - MAX_ASSISTANTS + 1}`
      );
      expect(
        screen.queryByRole("link", { name: `org/repo-${total - MAX_ASSISTANTS}` })
      ).not.toBeInTheDocument();
    });

    it("drops lists, books and guides found by topic", async () => {
      mockFetchBySource((source) =>
        source === "coding-agent"
          ? jsonResponse({
              items: [
                makeRepo(1, 900, { full_name: "org/awesome-coding-agents" }),
                makeRepo(2, 800, {
                  full_name: "org/agents",
                  topics: ["coding-agent", "awesome-list"],
                }),
                makeRepo(3, 700, {
                  full_name: "org/handbook",
                  description: "The most comprehensive guide to coding agents",
                }),
                makeRepo(4, 600, { full_name: "org/ai-agent-book" }),
                makeRepo(5, 500, { full_name: "org/real-tool" }),
              ],
            })
          : jsonResponse({ items: [] })
      );

      await renderStatistics();

      expect(getRepoHeadings()).toEqual(["#1 - org/real-tool"]);
    });

    it("keeps curated repositories even when they look like a guide", async () => {
      mockFetchBySource((source) =>
        source === "curated"
          ? jsonResponse({
              items: [
                makeRepo(1, 900, {
                  full_name: "org/curated-tool",
                  description: "Your guide through any codebase",
                  topics: [],
                }),
              ],
            })
          : jsonResponse({ items: [] })
      );

      await renderStatistics();

      expect(getRepoHeadings()).toEqual(["#1 - org/curated-tool"]);
    });

    it("omits optional details when they are missing", async () => {
      mockFetchBySource((source) =>
        source === "coding-assistant"
          ? jsonResponse({
              items: [
                {
                  id: 5,
                  full_name: "org/bare",
                  html_url: "https://github.com/org/bare",
                  description: null,
                  stargazers_count: 500,
                  language: null,
                  license: { spdx_id: "NOASSERTION" },
                },
              ],
            })
          : jsonResponse({ items: [] })
      );

      await renderStatistics();

      expect(getRepoHeadings()).toEqual(["#1 - org/bare"]);
      expect(screen.queryByText(/Description/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Language:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/License:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Last push:/)).not.toBeInTheDocument();
      expect(document.querySelector("img")).toBeNull();
      expect(
        screen.queryByRole("list", { name: /Topics of/ })
      ).not.toBeInTheDocument();
      expect(screen.getByText("⭐ 500 stars")).toBeInTheDocument();
      expect(screen.getByText("Forks: 0")).toBeInTheDocument();
    });

    it("renders no avatar when it is not hosted on the allowed image host", async () => {
      mockFetchBySource((source) =>
        source === "coding-assistant"
          ? jsonResponse({
              items: [
                makeRepo(1, 400, {
                  full_name: "org/foreign",
                  owner: { avatar_url: "https://example.com/a.png" },
                }),
                makeRepo(2, 300, {
                  full_name: "org/insecure",
                  owner: {
                    avatar_url: `http://${AVATAR_HOST}/u/2?v=4`,
                  },
                }),
                makeRepo(3, 200, {
                  full_name: "org/lookalike",
                  owner: {
                    avatar_url: `https://${AVATAR_HOST}.evil.example/u/3?v=4`,
                  },
                }),
                makeRepo(4, 100, {
                  full_name: "org/broken",
                  owner: { avatar_url: "not a url" },
                }),
              ],
            })
          : jsonResponse({ items: [] })
      );

      await renderStatistics();

      expect(getRepoHeadings()).toEqual([
        "#1 - org/foreign",
        "#2 - org/insecure",
        "#3 - org/lookalike",
        "#4 - org/broken",
      ]);
      expect(document.querySelector("img")).toBeNull();
    });

    it("marks archived repositories and ones without recent pushes", async () => {
      mockFetchBySource((source) =>
        source === "curated"
          ? jsonResponse({
              items: [
                makeRepo(1, 300, { full_name: "org/fresh" }),
                makeRepo(2, 200, {
                  full_name: "org/old",
                  pushed_at: "2025-01-01T00:00:00Z",
                }),
                makeRepo(3, 100, { full_name: "org/frozen", archived: true }),
              ],
            })
          : jsonResponse({ items: [] })
      );

      await renderStatistics();

      expect(screen.getAllByText("Inactive")).toHaveLength(1);
      expect(screen.getAllByText("Archived")).toHaveLength(1);
      expect(
        screen.getByText("Inactive").closest("div")
      ).toHaveTextContent("org/old");
      expect(
        screen.getByText("Archived").closest("div")
      ).toHaveTextContent("org/frozen");
    });
  });

  describe("error handling", () => {
    it("shows the fallback when every request fails", async () => {
      fetchMock.mockImplementation(() =>
        Promise.reject(new TypeError("fetch failed"))
      );

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([]);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(SOURCES.length);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(SOURCES.length);
    });

    it("shows the fallback on rate limit (403)", async () => {
      mockFetchBySource(() =>
        jsonResponse({ message: "API rate limit exceeded" }, 403)
      );

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(SOURCES.length);
      for (const call of consoleErrorSpy.mock.calls) {
        expect(String(call[0])).toContain("403");
      }
    });

    it("ignores items from non-ok responses", async () => {
      mockFetchBySource(() =>
        jsonResponse({ items: [makeRepo(99, 999, { full_name: "org/err" })] }, 403)
      );

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "org/err" })
      ).not.toBeInTheDocument();
    });

    it("shows the fallback on server error (500)", async () => {
      mockFetchBySource(() => jsonResponse({ message: "Server error" }, 500));

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([]);
    });

    it("shows the fallback when the response has no items", async () => {
      mockFetchBySource(() => jsonResponse({}));

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(SOURCES.length);
    });

    it("shows the fallback on invalid JSON", async () => {
      mockFetchBySource(() => new Response("not json", { status: 200 }));

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("renders partial data and warns that the list may be incomplete", async () => {
      mockFetchBySource((source) => {
        switch (source) {
          case "curated":
            throw new TypeError("fetch failed");
          case "coding-assistant":
            return jsonResponse({ message: "API rate limit exceeded" }, 403);
          case "coding-agent":
            return jsonResponse({ items: [makeRepo(1, 100)] });
          default:
            return jsonResponse({ items: [makeRepo(2, 200)] });
        }
      });

      await renderStatistics();

      expect(getRepoHeadings()).toEqual(["#1 - org/repo-2", "#2 - org/repo-1"]);
      expect(screen.queryByText(FALLBACK_TEXT)).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        `2 of ${SOURCES.length} GitHub requests failed, so this list may be incomplete.`
      );
      expect(fetchMock).toHaveBeenCalledTimes(SOURCES.length);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it("renders the main navigation on fallback", async () => {
      fetchMock.mockImplementation(() =>
        Promise.reject(new TypeError("fetch failed"))
      );

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expectMainNavigation("Statistics");
    });
  });
});
