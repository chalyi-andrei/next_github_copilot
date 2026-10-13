import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RepoExplorer from "../app/statistics/RepoExplorer";
import type { Assistant } from "../app/statistics/github";

function makeAssistant(
  rank: number,
  overrides: Partial<Assistant> = {}
): Assistant {
  return {
    id: rank,
    rank,
    fullName: `acme/repo-${rank}`,
    url: `https://github.com/acme/repo-${rank}`,
    description: null,
    stars: 1000 - rank * 100,
    forks: 0,
    openIssues: 0,
    language: null,
    topics: [],
    license: null,
    pushedAt: null,
    avatarUrl: null,
    archived: false,
    inactive: false,
    ...overrides,
  };
}

const alpha = makeAssistant(1, {
  fullName: "acme/alpha",
  description: "Terminal agent for large codebases",
  forks: 500,
  language: "TypeScript",
  topics: ["cli"],
  pushedAt: "2026-05-01T00:00:00Z",
});
const beta = makeAssistant(2, {
  fullName: "acme/beta",
  description: "Editor extension for pair programming",
  forks: 900,
  language: "Python",
  topics: ["vscode"],
  pushedAt: "2026-05-20T00:00:00Z",
});
// Same forks as alpha, no language and no push date
const gamma = makeAssistant(3, {
  fullName: "acme/gamma",
  forks: 500,
  topics: ["refactoring"],
});
const delta = makeAssistant(4, {
  fullName: "acme/delta",
  description: "Autonomous agent",
  forks: 100,
  language: "Go",
  pushedAt: "2024-01-01T00:00:00Z",
  inactive: true,
});
const epsilon = makeAssistant(5, {
  fullName: "acme/epsilon",
  description: "Review agent",
  forks: 50,
  language: "TypeScript",
  pushedAt: "2026-03-01T00:00:00Z",
  archived: true,
});

// Deliberately not in rank order: the component must do the sorting itself
const ASSISTANTS = [gamma, epsilon, alpha, delta, beta];

const ALL_BY_RANK = [
  "#1 - acme/alpha",
  "#2 - acme/beta",
  "#3 - acme/gamma",
  "#4 - acme/delta",
  "#5 - acme/epsilon",
];

const EMPTY_TEXT = "No repositories match your filters.";

function renderExplorer() {
  render(<RepoExplorer assistants={ASSISTANTS} />);
}

function getRepoHeadings(): string[] {
  return screen
    .queryAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent ?? "");
}

function searchFor(value: string) {
  fireEvent.change(screen.getByLabelText("Search"), { target: { value } });
}

function selectLanguage(value: string) {
  fireEvent.change(screen.getByLabelText("Language"), { target: { value } });
}

function sortBy(value: "stars" | "forks" | "updated") {
  fireEvent.change(screen.getByLabelText("Sort by"), { target: { value } });
}

function toggleHideInactive() {
  fireEvent.click(screen.getByLabelText("Hide inactive"));
}

describe("RepoExplorer", () => {
  describe("initial state", () => {
    it("lists every repository by rank and shows the total", () => {
      renderExplorer();

      expect(getRepoHeadings()).toEqual(ALL_BY_RANK);
      expect(screen.getByText("Showing 5 of 5")).toBeInTheDocument();
      expect(screen.queryByText(EMPTY_TEXT)).not.toBeInTheDocument();
    });

    it("renders the repositories as a labelled list", () => {
      renderExplorer();

      const list = screen.getByRole("list", { name: "Repositories" });
      const items = Array.from(list.children);

      expect(items).toHaveLength(ASSISTANTS.length);
      for (const item of items) {
        expect(item.tagName).toBe("LI");
      }
    });

    it("starts with empty filters and sorting by stars", () => {
      renderExplorer();

      expect(screen.getByLabelText("Search")).toHaveValue("");
      expect(screen.getByLabelText("Language")).toHaveValue("all");
      expect(screen.getByLabelText("Sort by")).toHaveValue("stars");
      expect(screen.getByLabelText("Hide inactive")).not.toBeChecked();
    });
  });

  describe("search", () => {
    it("matches the repository name regardless of case", () => {
      renderExplorer();

      searchFor("ALPHA");

      expect(getRepoHeadings()).toEqual(["#1 - acme/alpha"]);
      expect(screen.getByText("Showing 1 of 5")).toBeInTheDocument();
    });

    it("matches the description and ignores surrounding spaces", () => {
      renderExplorer();

      searchFor("  Pair Programming  ");

      expect(getRepoHeadings()).toEqual(["#2 - acme/beta"]);
      expect(screen.getByText("Showing 1 of 5")).toBeInTheDocument();
    });

    it("matches a topic", () => {
      renderExplorer();

      searchFor("Refactoring");

      expect(getRepoHeadings()).toEqual(["#3 - acme/gamma"]);
      expect(screen.getByText("Showing 1 of 5")).toBeInTheDocument();
    });

    it("keeps the rank order for several matches", () => {
      renderExplorer();

      searchFor("agent");

      expect(getRepoHeadings()).toEqual([
        "#1 - acme/alpha",
        "#4 - acme/delta",
        "#5 - acme/epsilon",
      ]);
      expect(screen.getByText("Showing 3 of 5")).toBeInTheDocument();
    });

    it("shows everything again for a query of spaces only", () => {
      renderExplorer();

      searchFor("alpha");
      searchFor("   ");

      expect(getRepoHeadings()).toEqual(ALL_BY_RANK);
      expect(screen.getByText("Showing 5 of 5")).toBeInTheDocument();
    });
  });

  describe("language filter", () => {
    it("offers every language once, alphabetically, after All languages", () => {
      renderExplorer();

      const options = within(screen.getByLabelText("Language")).getAllByRole(
        "option"
      );

      expect(options.map((option) => option.textContent)).toEqual([
        "All languages",
        "Go",
        "Python",
        "TypeScript",
      ]);
    });

    it("shows only repositories in the selected language", () => {
      renderExplorer();

      selectLanguage("TypeScript");

      expect(getRepoHeadings()).toEqual([
        "#1 - acme/alpha",
        "#5 - acme/epsilon",
      ]);
      expect(screen.getByText("Showing 2 of 5")).toBeInTheDocument();
    });

    it("shows everything again for All languages", () => {
      renderExplorer();

      selectLanguage("Go");
      expect(getRepoHeadings()).toEqual(["#4 - acme/delta"]);

      selectLanguage("all");
      expect(getRepoHeadings()).toEqual(ALL_BY_RANK);
    });
  });

  describe("sorting", () => {
    it("sorts by forks descending and breaks ties by rank", () => {
      renderExplorer();

      sortBy("forks");

      expect(getRepoHeadings()).toEqual([
        "#2 - acme/beta",
        "#1 - acme/alpha",
        "#3 - acme/gamma",
        "#4 - acme/delta",
        "#5 - acme/epsilon",
      ]);
      expect(screen.getByText("Showing 5 of 5")).toBeInTheDocument();
    });

    it("sorts by the last push, newest first, without a date last", () => {
      renderExplorer();

      sortBy("updated");

      expect(getRepoHeadings()).toEqual([
        "#2 - acme/beta",
        "#1 - acme/alpha",
        "#5 - acme/epsilon",
        "#4 - acme/delta",
        "#3 - acme/gamma",
      ]);
    });

    it("returns to the rank order when sorting by stars again", () => {
      renderExplorer();

      sortBy("forks");
      sortBy("stars");

      expect(getRepoHeadings()).toEqual(ALL_BY_RANK);
    });
  });

  describe("hide inactive", () => {
    it("hides both inactive and archived repositories", () => {
      renderExplorer();

      toggleHideInactive();

      expect(getRepoHeadings()).toEqual([
        "#1 - acme/alpha",
        "#2 - acme/beta",
        "#3 - acme/gamma",
      ]);
      expect(screen.getByText("Showing 3 of 5")).toBeInTheDocument();
      expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
      expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    });

    it("shows them again when unchecked", () => {
      renderExplorer();

      toggleHideInactive();
      toggleHideInactive();

      expect(getRepoHeadings()).toEqual(ALL_BY_RANK);
      expect(screen.getByText("Inactive")).toBeInTheDocument();
      expect(screen.getByText("Archived")).toBeInTheDocument();
    });
  });

  describe("combined filters", () => {
    it("applies the search and the language together", () => {
      renderExplorer();

      searchFor("agent");
      selectLanguage("TypeScript");

      expect(getRepoHeadings()).toEqual([
        "#1 - acme/alpha",
        "#5 - acme/epsilon",
      ]);
      expect(screen.getByText("Showing 2 of 5")).toBeInTheDocument();
    });

    it("applies the search, the language and hide inactive together", () => {
      renderExplorer();

      searchFor("agent");
      selectLanguage("TypeScript");
      toggleHideInactive();

      expect(getRepoHeadings()).toEqual(["#1 - acme/alpha"]);
      expect(screen.getByText("Showing 1 of 5")).toBeInTheDocument();
    });
  });

  describe("empty result", () => {
    it("shows a message and a Clear filters button", () => {
      renderExplorer();

      searchFor("no-such-repository");

      expect(getRepoHeadings()).toEqual([]);
      expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
      expect(screen.getByText("Showing 0 of 5")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Clear filters" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("list", { name: "Repositories" })
      ).not.toBeInTheDocument();
    });

    it("clears the search, language and checkbox but keeps the sorting", () => {
      renderExplorer();

      // delta is the only Go repository and it is inactive
      sortBy("forks");
      searchFor("delta");
      selectLanguage("Go");
      toggleHideInactive();

      expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

      expect(screen.getByLabelText("Search")).toHaveValue("");
      expect(screen.getByLabelText("Language")).toHaveValue("all");
      expect(screen.getByLabelText("Hide inactive")).not.toBeChecked();
      expect(screen.getByLabelText("Sort by")).toHaveValue("forks");

      expect(screen.queryByText(EMPTY_TEXT)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Clear filters" })
      ).not.toBeInTheDocument();
      expect(screen.getByText("Showing 5 of 5")).toBeInTheDocument();
      expect(getRepoHeadings()).toEqual([
        "#2 - acme/beta",
        "#1 - acme/alpha",
        "#3 - acme/gamma",
        "#4 - acme/delta",
        "#5 - acme/epsilon",
      ]);
    });

    it("offers no Clear filters button when there are no repositories at all", () => {
      render(<RepoExplorer assistants={[]} />);

      expect(screen.getByText("Showing 0 of 0")).toBeInTheDocument();
      expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Clear filters" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("list", { name: "Repositories" })
      ).not.toBeInTheDocument();
    });
  });

  describe("topics", () => {
    it("shows only the first five topics of a repository", () => {
      const topics = [
        "cli",
        "agent",
        "llm",
        "vscode",
        "terminal",
        "refactoring",
        "testing",
      ];
      render(
        <RepoExplorer
          assistants={[makeAssistant(1, { fullName: "acme/tagged", topics })]}
        />
      );

      const items = within(
        screen.getByRole("list", { name: "Topics of acme/tagged" })
      ).getAllByRole("listitem");

      expect(items.map((item) => item.textContent)).toEqual(topics.slice(0, 5));
      expect(screen.queryByText("refactoring")).not.toBeInTheDocument();
      expect(screen.queryByText("testing")).not.toBeInTheDocument();
    });
  });
});
