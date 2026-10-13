import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "../app/components/MainNav";
import PageShell from "../app/components/PageShell";
import { expectMainNavigation } from "./helpers/navigation";

describe("PageShell", () => {
  it("renders its children inside the main landmark in a narrow column", () => {
    render(
      <PageShell current="/about">
        <p>content</p>
      </PageShell>
    );

    const main = screen.getByRole("main");

    expect(main).toContainElement(screen.getByText("content"));
    expect(main).toHaveClass("max-w-3xl");
    expect(main).not.toHaveClass("max-w-4xl");
  });

  it("widens the column when wide is set", () => {
    render(
      <PageShell current="/about" wide>
        <p>content</p>
      </PageShell>
    );

    const main = screen.getByRole("main");

    expect(main).toContainElement(screen.getByText("content"));
    expect(main).toHaveClass("max-w-4xl");
    expect(main).not.toHaveClass("max-w-3xl");
  });

  it("renders the main navigation with an accessible name and the current page", () => {
    render(
      <PageShell current="/about">
        <p>content</p>
      </PageShell>
    );

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("navigation", { name: "Main" })
    );
    expectMainNavigation("About");
  });
});

describe("NAV_ITEMS", () => {
  it("links to the existing routes only", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/about",
      "/statistics",
    ]);
  });
});
