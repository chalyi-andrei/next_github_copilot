import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "../app/layout";

describe("Root layout", () => {
  it("exports page metadata", () => {
    expect(metadata).toEqual({
      title: "Next GitHub Copilot",
      description: "Home, About and Statistics pages",
    });
  });

  it("renders children inside html and body", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <p>child content</p>
      </RootLayout>
    );

    expect(markup).toContain('<html lang="en">');
    expect(markup).toContain("<body><p>child content</p></body>");
  });
});
