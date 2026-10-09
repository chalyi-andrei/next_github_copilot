import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import Statistics from "../app/statistics/page";
import { expectMainNavigation } from "./helpers/navigation";

interface TestRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
}

const SEARCH_TERMS = [
  "ai+coding+assistant",
  "ai+code+assistant",
  "ai+copilot+programming",
  "ai+code+completion",
] as const;

type SearchTerm = (typeof SEARCH_TERMS)[number];

const FALLBACK_TEXT =
  "Unable to load AI repository data. Please try again later.";

function makeRepo(
  id: number,
  stars: number,
  overrides: Partial<TestRepo> = {}
): TestRepo {
  return {
    id,
    name: `repo-${id}`,
    full_name: `org/repo-${id}`,
    html_url: `https://github.com/org/repo-${id}`,
    description: `Description ${id}`,
    stargazers_count: stars,
    language: "TypeScript",
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
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

// Routes each mocked request to a handler by its search term
function mockFetchByTerm(
  handler: (term: SearchTerm) => Response | Promise<Response>
) {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    const term = SEARCH_TERMS.find((t) => url.includes(`topic:${t}+sort`));
    if (!term) {
      throw new Error(`Unexpected request: ${url}`);
    }
    return handler(term);
  });
}

function getRepoHeadings(): string[] {
  return screen
    .queryAllByRole("heading", { level: 3 })
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
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
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
      }),
      makeRepo(3, 50, {
        full_name: "org/c",
        html_url: "https://github.com/org/c",
        language: "Go",
      }),
    ];

    beforeEach(() => {
      mockFetchByTerm((term) =>
        term === "ai+coding+assistant"
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
      expect(screen.getByText("Language: TypeScript")).toBeInTheDocument();
      expect(screen.getByText("Language: Python")).toBeInTheDocument();

      // Star count formatting depends on the OS locale
      const expectedStars = `⭐ ${(1500).toLocaleString()} stars`;
      expect(
        screen.getByText(
          (_, element) =>
            element?.tagName === "SPAN" &&
            element.textContent === expectedStars
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          (_, element) =>
            element?.tagName === "SPAN" &&
            element.textContent === `⭐ ${(300).toLocaleString()} stars`
        )
      ).toBeInTheDocument();
    });

    it("requests every search term with hourly revalidation", async () => {
      await renderStatistics();

      expect(fetchMock).toHaveBeenCalledTimes(SEARCH_TERMS.length);
      SEARCH_TERMS.forEach((term, index) => {
        expect(fetchMock).toHaveBeenNthCalledWith(
          index + 1,
          expect.stringContaining(
            "https://api.github.com/search/repositories?q=topic:"
          ),
          { next: { revalidate: 3600 } }
        );

        const url = String(fetchMock.mock.calls[index][0]);
        expect(url).toContain(`topic:${term}+`);
        expect(url).toContain("sort:stars");
        expect(url).toContain("order=desc");
        expect(url).toContain("per_page=5");
      });
    });

    it("renders the main navigation with Statistics active", async () => {
      await renderStatistics();

      expectMainNavigation("Statistics");
    });
  });

  describe("data processing", () => {
    it("removes duplicate repositories by id", async () => {
      const shared = makeRepo(42, 900, { full_name: "org/shared" });
      mockFetchByTerm((term) =>
        term === "ai+copilot+programming"
          ? jsonResponse({ items: [makeRepo(7, 100)] })
          : jsonResponse({ items: [shared] })
      );

      await renderStatistics();

      expect(getRepoHeadings()).toEqual(["#1 - org/shared", "#2 - org/repo-7"]);
      expect(screen.getAllByRole("link", { name: "org/shared" })).toHaveLength(
        1
      );
    });

    it("limits the list to the top 10 repositories", async () => {
      // 4 terms x 5 unique repos, stars: 10, 20, ..., 200
      mockFetchByTerm((term) => {
        const offset = SEARCH_TERMS.indexOf(term) * 5;
        const items = Array.from({ length: 5 }, (_, i) => {
          const id = offset + i + 1;
          return makeRepo(id, id * 10);
        });
        return jsonResponse({ items });
      });

      await renderStatistics();

      const headings = getRepoHeadings();
      expect(headings).toHaveLength(10);
      expect(headings[0]).toBe("#1 - org/repo-20");
      expect(headings[9]).toBe("#10 - org/repo-11");
      expect(
        screen.queryByRole("link", { name: "org/repo-10" })
      ).not.toBeInTheDocument();
    });

    it("omits description and language when they are missing", async () => {
      mockFetchByTerm((term) =>
        term === "ai+coding+assistant"
          ? jsonResponse({
              items: [
                makeRepo(5, 500, {
                  full_name: "org/bare",
                  description: null,
                  language: null,
                }),
              ],
            })
          : jsonResponse({ items: [] })
      );

      await renderStatistics();

      expect(getRepoHeadings()).toEqual(["#1 - org/bare"]);
      expect(screen.queryByText(/Description/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Language:/)).not.toBeInTheDocument();
      expect(screen.getByText(/500 stars/)).toBeInTheDocument();
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
      expect(fetchMock).toHaveBeenCalledTimes(SEARCH_TERMS.length);
      expect(consoleLogSpy).toHaveBeenCalledTimes(SEARCH_TERMS.length);
    });

    it("shows the fallback on rate limit (403)", async () => {
      mockFetchByTerm(() =>
        jsonResponse({ message: "API rate limit exceeded" }, 403)
      );

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([]);
    });

    it("ignores items from non-ok responses", async () => {
      mockFetchByTerm(() =>
        jsonResponse({ items: [makeRepo(99, 999, { full_name: "org/err" })] }, 403)
      );

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "org/err" })
      ).not.toBeInTheDocument();
    });

    it("shows the fallback on server error (500)", async () => {
      mockFetchByTerm(() => jsonResponse({ message: "Server error" }, 500));

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([]);
    });

    it("shows the fallback when the response has no items", async () => {
      mockFetchByTerm(() => jsonResponse({}));

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([]);
    });

    it("shows the fallback on invalid JSON", async () => {
      mockFetchByTerm(() => new Response("not json", { status: 200 }));

      await renderStatistics();

      expect(screen.getByText(FALLBACK_TEXT)).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([]);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("renders data from successful requests on partial failure", async () => {
      mockFetchByTerm((term) => {
        switch (term) {
          case "ai+coding+assistant":
            throw new TypeError("fetch failed");
          case "ai+code+assistant":
            return jsonResponse({ message: "API rate limit exceeded" }, 403);
          case "ai+copilot+programming":
            return jsonResponse({ items: [makeRepo(1, 100)] });
          case "ai+code+completion":
            return jsonResponse({ items: [makeRepo(2, 200)] });
        }
      });

      await renderStatistics();

      expect(getRepoHeadings()).toEqual(["#1 - org/repo-2", "#2 - org/repo-1"]);
      expect(screen.queryByText(FALLBACK_TEXT)).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(SEARCH_TERMS.length);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
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
