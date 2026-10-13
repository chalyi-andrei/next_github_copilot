import { screen, within } from "@testing-library/react";
import { expect } from "vitest";

type NavItem = "Home" | "About" | "Statistics";

const NAV_ITEMS: { name: NavItem; href: string }[] = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about" },
  { name: "Statistics", href: "/statistics" },
];

// Checks the shared top navigation and its active item
export function expectMainNavigation(activeName: NavItem) {
  const nav = within(screen.getByRole("navigation"));
  const links = nav.getAllByRole("link");

  expect(links).toHaveLength(NAV_ITEMS.length);
  expect(links.map((link) => link.getAttribute("href"))).toEqual(
    NAV_ITEMS.map((item) => item.href)
  );

  for (const item of NAV_ITEMS) {
    const link = nav.getByRole("link", { name: item.name });
    expect(link).toHaveAttribute("href", item.href);

    if (item.name === activeName) {
      expect(link).toHaveClass("font-bold");
      expect(link).toHaveAttribute("aria-current", "page");
    } else {
      expect(link).not.toHaveClass("font-bold");
      expect(link).not.toHaveAttribute("aria-current");
    }
  }

  // Regression: broken routes must not come back
  expect(document.querySelector('a[href="/about1"]')).toBeNull();
  expect(document.querySelector('a[href="/statistics2"]')).toBeNull();
}
