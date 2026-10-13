import Image from "next/image";
import Link from "next/link";
import PageShell from "./components/PageShell";

export default function Home() {
  return (
    <PageShell current="/">
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
          Welcome to our Next.js application with three pages: Home, About, and
          Statistics.
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
    </PageShell>
  );
}
