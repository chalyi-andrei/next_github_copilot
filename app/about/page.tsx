import Link from "next/link";

export default function About() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-start justify-between py-32 px-16 bg-white dark:bg-black">
        <div className="w-full">
          <nav className="mb-8">
            <ul className="flex space-x-6">
              <li>
                <Link href="/" className="text-blue-600 hover:underline">
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-blue-600 hover:underline font-bold"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/statistics"
                  className="text-blue-600 hover:underline"
                >
                  Statistics
                </Link>
              </li>
            </ul>
          </nav>

          <h1 className="text-4xl font-bold mb-8">About</h1>

          <div className="space-y-4">
            <p className="text-lg">
              This is a Next.js application showcasing pages for Home, About,
              and Statistics.
            </p>
            <p>
              The Statistics page fetches data from GitHub API to show popular
              AI-related repositories, demonstrating real-time data fetching
              capabilities in Next.js.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
