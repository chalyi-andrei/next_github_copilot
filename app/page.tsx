import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-start justify-between py-32 px-16 bg-white dark:bg-black">
        <div className="w-full">
          <nav className="mb-8">
            <ul className="flex space-x-6">
              <li>
                <Link
                  href="/"
                  className="text-blue-600 hover:underline font-bold"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-blue-600 hover:underline">
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

          <div className="flex items-center space-x-4 mb-8">
            <Image
              className="dark:invert"
              src="/next.svg"
              alt="Next.js logo"
              width={100}
              height={20}
              priority
            />
            <h1 className="text-4xl font-bold">Home</h1>
          </div>

          <div className="space-y-4">
            <p className="text-lg">
              Welcome to our Next.js application with three pages: Home, About,
              and Statistics.
            </p>
            <p>
              Navigate between pages using the links above to explore different
              sections of the application.
            </p>
            <div className="mt-8">
              <Link
                href="/statistics"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View AI Statistics →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
