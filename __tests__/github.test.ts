// @vitest-environment node
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  FETCH_TIMEOUT_MS,
  INACTIVE_AFTER_DAYS,
  REVALIDATE_SECONDS,
  TOPICS,
  buildSourceUrls,
  getPopularAICodeAssistants,
  isLikelyTool,
  type AssistantsResult,
  type GitHubRepo,
} from "../app/statistics/github";

// One request for the curated repositories, then one per topic
const SOURCE_COUNT = 1 + TOPICS.length;

const NOW = new Date("2026-06-01T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: 1,
    full_name: "org/real-tool",
    html_url: "https://github.com/org/real-tool",
    description: null,
    stargazers_count: 100,
    language: null,
    topics: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

let fetchMock: Mock<typeof fetch>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

// Answers the curated request with `items` and every topic with nothing
function mockCurated(items: GitHubRepo[]) {
  fetchMock.mockImplementation(async (input) =>
    String(input).includes("q=repo:")
      ? jsonResponse({ items })
      : jsonResponse({ items: [] })
  );
}

async function loadAssistants(): Promise<AssistantsResult> {
  const pending = getPopularAICodeAssistants();
  await vi.runAllTimersAsync();
  return pending;
}

describe("isLikelyTool", () => {
  it.each<[string, GitHubRepo]>([
    ["a plain tool name", makeRepo({ full_name: "org/real-tool" })],
    // "book" and "guide" count only as whole name segments
    ["a name that merely contains book", makeRepo({ full_name: "org/notebook-agent" })],
    ["a name that merely contains guide", makeRepo({ full_name: "org/guidebook" })],
    [
      "a description that merely contains book",
      makeRepo({ description: "A notebook assistant" }),
    ],
    [
      "a description where guide only starts a longer word",
      makeRepo({ description: "Follows your coding guidelines" }),
    ],
  ])("keeps %s", (_label, repo) => {
    expect(isLikelyTool(repo)).toBe(true);
  });

  it("keeps a repository without the topics field", () => {
    const repo = makeRepo();
    delete repo.topics;

    expect(isLikelyTool(repo)).toBe(true);
  });

  it.each<[string, GitHubRepo]>([
    ["an awesome list by name", makeRepo({ full_name: "org/awesome-agents" })],
    ["a guide by name", makeRepo({ full_name: "org/agent.guide" })],
    ["a course by name, ignoring case", makeRepo({ full_name: "org/AI_Course" })],
    ["a tutorial by name", makeRepo({ full_name: "org/my-tutorial-repo" })],
    ["a tutorial by topic", makeRepo({ topics: ["tutorial"] })],
    [
      "a curated list by description",
      makeRepo({ description: "A curated list of agents" }),
    ],
    [
      "a cheat sheet by description",
      makeRepo({ description: "Cheat sheet for prompts" }),
    ],
    ["a handbook by description", makeRepo({ description: "The Handbook" })],
  ])("drops %s", (_label, repo) => {
    expect(isLikelyTool(repo)).toBe(false);
  });
});

describe("buildSourceUrls", () => {
  it("builds one search URL for the curated list and one per topic", () => {
    const urls = buildSourceUrls();

    expect(urls).toHaveLength(SOURCE_COUNT);
    for (const url of urls) {
      expect(
        url.startsWith("https://api.github.com/search/repositories?q=")
      ).toBe(true);
    }
  });
});

describe("getPopularAICodeAssistants", () => {
  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  describe("inactivity threshold", () => {
    // One day of margin: running the timers moves the fake clock a little
    it("keeps a repository active just before INACTIVE_AFTER_DAYS", async () => {
      mockCurated([makeRepo({ pushed_at: daysAgo(INACTIVE_AFTER_DAYS - 1) })]);

      const { assistants } = await loadAssistants();

      expect(assistants).toHaveLength(1);
      expect(assistants[0].inactive).toBe(false);
    });

    it("marks a repository inactive just after INACTIVE_AFTER_DAYS", async () => {
      mockCurated([makeRepo({ pushed_at: daysAgo(INACTIVE_AFTER_DAYS + 1) })]);

      const { assistants } = await loadAssistants();

      expect(assistants).toHaveLength(1);
      expect(assistants[0].inactive).toBe(true);
    });

    it("keeps a repository without a push date active", async () => {
      mockCurated([makeRepo()]);

      const { assistants } = await loadAssistants();

      expect(assistants).toHaveLength(1);
      expect(assistants[0].inactive).toBe(false);
      expect(assistants[0].pushedAt).toBeNull();
    });
  });

  describe("request options", () => {
    it("gives every source its own timeout and the shared revalidation period", async () => {
      const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
      mockCurated([]);

      await loadAssistants();

      expect(timeoutSpy).toHaveBeenCalledTimes(SOURCE_COUNT);
      for (const call of timeoutSpy.mock.calls) {
        expect(call).toEqual([FETCH_TIMEOUT_MS]);
      }

      expect(fetchMock).toHaveBeenCalledTimes(SOURCE_COUNT);
      fetchMock.mock.calls.forEach((call, index) => {
        expect(call[1]).toMatchObject({
          next: { revalidate: REVALIDATE_SECONDS },
        });
        expect(call[1]?.signal).toBe(timeoutSpy.mock.results[index].value);
      });
    });
  });

  describe("timeout of a single source", () => {
    it("counts the source as failed and still requests the others", async () => {
      const timeout = new DOMException("timeout", "TimeoutError");
      fetchMock.mockImplementation(async (input) => {
        const url = String(input);

        if (url.includes("q=repo:")) throw timeout;

        return url.includes(`q=topic:${TOPICS[0]}+`)
          ? jsonResponse({ items: [makeRepo()] })
          : jsonResponse({ items: [] });
      });

      const result = await loadAssistants();

      expect(fetchMock).toHaveBeenCalledTimes(SOURCE_COUNT);
      expect(result.failedSources).toBe(1);
      expect(result.totalSources).toBe(SOURCE_COUNT);
      expect(result.assistants).toHaveLength(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][1]).toBe(timeout);
    });
  });
});
