import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../app/page";
import { expectMainNavigation } from "./helpers/navigation";

describe("Home page", () => {
  it("renders the heading, logo and welcome text", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Home" })
    ).toBeInTheDocument();
    expect(screen.getByAltText("Next.js logo")).toBeInTheDocument();
    expect(
      screen.getByText(/Welcome to our Next.js application/)
    ).toBeInTheDocument();
  });

  it("renders the CTA link to the statistics page", () => {
    render(<Home />);

    expect(
      screen.getByRole("link", { name: /View AI Statistics/ })
    ).toHaveAttribute("href", "/statistics");
  });

  it("renders the main navigation with Home active", () => {
    render(<Home />);

    expectMainNavigation("Home");
  });

  it("links only to existing routes", () => {
    render(<Home />);

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    for (const href of hrefs) {
      expect(["/", "/about", "/statistics"]).toContain(href);
    }
  });
});
