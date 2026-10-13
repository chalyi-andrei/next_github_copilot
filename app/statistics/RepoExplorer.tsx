"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Assistant } from "./github";

type SortKey = "stars" | "forks" | "updated";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "stars", label: "Stars" },
  { value: "forks", label: "Forks" },
  { value: "updated", label: "Recently updated" },
];

const ALL_LANGUAGES = "all";
const MAX_TOPICS = 5;

// Fixed locale: the server and the browser must render the same text
function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function compareAssistants(a: Assistant, b: Assistant, sort: SortKey): number {
  switch (sort) {
    case "forks":
      return b.forks - a.forks || a.rank - b.rank;
    case "updated":
      return (
        (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "") || a.rank - b.rank
      );
    default:
      return a.rank - b.rank;
  }
}

export default function RepoExplorer({
  assistants,
}: {
  assistants: Assistant[];
}) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState(ALL_LANGUAGES);
  const [sort, setSort] = useState<SortKey>("stars");
  const [hideInactive, setHideInactive] = useState(false);

  const languages = useMemo(
    () =>
      Array.from(
        new Set(
          assistants
            .map((assistant) => assistant.language)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [assistants]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return assistants
      .filter((assistant) => {
        if (language !== ALL_LANGUAGES && assistant.language !== language) {
          return false;
        }
        if (hideInactive && (assistant.inactive || assistant.archived)) {
          return false;
        }
        if (!needle) return true;

        return [assistant.fullName, assistant.description ?? "", ...assistant.topics]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => compareAssistants(a, b, sort));
  }, [assistants, query, language, sort, hideInactive]);

  const isFiltered =
    query.trim() !== "" || language !== ALL_LANGUAGES || hideInactive;

  function resetFilters() {
    setQuery("");
    setLanguage(ALL_LANGUAGES);
    setHideInactive(false);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <label className="flex min-w-48 flex-1 flex-col text-sm">
          <span className="mb-1 text-gray-600 dark:text-gray-300">Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, description or topic"
            className="rounded-lg border px-3 py-2 bg-white dark:bg-gray-900"
          />
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600 dark:text-gray-300">
            Language
          </span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-lg border px-3 py-2 bg-white dark:bg-gray-900"
          >
            <option value={ALL_LANGUAGES}>All languages</option>
            {languages.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600 dark:text-gray-300">Sort by</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-lg border px-3 py-2 bg-white dark:bg-gray-900"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 py-2 text-sm">
          <input
            type="checkbox"
            checked={hideInactive}
            onChange={(event) => setHideInactive(event.target.checked)}
          />
          Hide inactive
        </label>
      </div>

      <p className="mb-4 text-sm text-gray-500" aria-live="polite">
        Showing {visible.length} of {assistants.length}
      </p>

      {visible.length > 0 ? (
        <ul aria-label="Repositories" className="space-y-4">
          {visible.map((assistant) => (
            <li
              key={assistant.id}
              className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
            >
              <div className="flex items-start gap-4">
                {assistant.avatarUrl && (
                  <Image
                    src={assistant.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold mb-2">
                    #{assistant.rank} -{" "}
                    <a
                      href={assistant.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {assistant.fullName}
                    </a>
                  </h2>
                  {(assistant.archived || assistant.inactive) && (
                    <p className="mb-2">
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {assistant.archived ? "Archived" : "Inactive"}
                      </span>
                    </p>
                  )}
                  {assistant.description && (
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      {assistant.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span>⭐ {formatCount(assistant.stars)} stars</span>
                    <span>Forks: {formatCount(assistant.forks)}</span>
                    <span>
                      Open issues and PRs: {formatCount(assistant.openIssues)}
                    </span>
                    {assistant.language && (
                      <span>Language: {assistant.language}</span>
                    )}
                    {assistant.license && (
                      <span>License: {assistant.license}</span>
                    )}
                    {assistant.pushedAt && (
                      <span>Last push: {formatDate(assistant.pushedAt)}</span>
                    )}
                  </div>
                  {assistant.topics.length > 0 && (
                    <ul
                      aria-label={`Topics of ${assistant.fullName}`}
                      className="mt-3 flex flex-wrap gap-2"
                    >
                      {assistant.topics.slice(0, MAX_TOPICS).map((topic) => (
                        <li
                          key={topic}
                          className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                        >
                          {topic}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">
            No repositories match your filters.
          </p>
          {isFiltered && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
