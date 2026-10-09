import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next GitHub Copilot",
  description: "Home, About and Statistics pages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
