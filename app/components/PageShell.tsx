import type { ReactNode } from "react";
import MainNav, { type NavHref } from "./MainNav";

// Page frame shared by every route: background, content column and navigation
export default function PageShell({
  current,
  wide = false,
  children,
}: {
  current: NavHref;
  wide?: boolean;
  children: ReactNode;
}) {
  // Full class names on purpose: Tailwind cannot detect assembled ones
  const mainClassName = wide
    ? "flex min-h-screen w-full max-w-4xl flex-col items-start justify-between px-6 py-16 sm:px-16 sm:py-32 bg-white dark:bg-black"
    : "flex min-h-screen w-full max-w-3xl flex-col items-start justify-between px-6 py-16 sm:px-16 sm:py-32 bg-white dark:bg-black";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className={mainClassName}>
        <div className="w-full">
          <MainNav current={current} />
          {children}
        </div>
      </main>
    </div>
  );
}
