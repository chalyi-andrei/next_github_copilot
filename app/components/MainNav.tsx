import Link from "next/link";

export const NAV_ITEMS = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about" },
  { name: "Statistics", href: "/statistics" },
] as const;

export type NavHref = (typeof NAV_ITEMS)[number]["href"];

// Shared top navigation; `current` marks the page it is rendered on
export default function MainNav({ current }: { current: NavHref }) {
  return (
    <nav aria-label="Main" className="mb-8">
      <ul className="flex space-x-6">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.href === current ? "page" : undefined}
              className={
                item.href === current
                  ? "text-blue-600 hover:underline font-bold"
                  : "text-blue-600 hover:underline"
              }
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
