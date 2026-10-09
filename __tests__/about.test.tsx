import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import About from "../app/about/page";
import { expectMainNavigation } from "./helpers/navigation";

describe("About page", () => {
  it("renders the heading and description", () => {
    render(<About />);

    expect(
      screen.getByRole("heading", { level: 1, name: "About" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/fetches data from GitHub API/)
    ).toBeInTheDocument();
  });

  it("renders the main navigation with About active", () => {
    render(<About />);

    expectMainNavigation("About");
  });
});
