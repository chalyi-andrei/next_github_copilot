# Next.js AI Code Assistants Statistics

A Next.js application that showcases popular AI coding assistants and tools. Built with the App Router and integrates with GitHub API to display real-time data about AI tools for programming.

## Features

### 📈 Interactive Statistics Page

- **Real-time API Integration**: Fetches data from GitHub API to show popular AI coding assistants
- **Dynamic Ranking**: Displays repositories ranked by GitHub stars
- **Two Data Sources**: A curated list of well-known tools plus four GitHub topics (`coding-assistant`, `coding-agent`, `ai-coding-assistant`, `code-assistant`); "awesome" lists, books and guides found by topic are filtered out
- **Search**: Filters the list by repository name, description or topic
- **Language Filter**: Narrows the list to a single programming language
- **Sorting**: By stars, forks or the most recent push
- **Hide Inactive**: Hides archived repositories and ones without a push for more than a year; they are labelled `Archived` / `Inactive` otherwise
- **Incomplete Data Warning**: A banner tells you when some GitHub requests failed and the list may be incomplete
- **Responsive Cards**: Clean, modern UI showing repository details, stars, forks, open issues, language, license, last push and topics

### 🧭 Navigation

- **Home Page**: Welcome and overview
- **About Page**: Application information and API functionality details
- **Statistics Page**: Live data from GitHub
- **Responsive Design**: Works on all devices

### 🛠️ Technical Features

- **Next.js 16**: Latest framework with App Router
- **TypeScript**: Full type safety
- **Tailwind CSS**: Modern, responsive styling
- **Server Components**: Server-side rendering for optimal performance
- **GitHub API Integration**: Open API for reliable data sources
- **Error Handling**: Graceful fallbacks and error management

## Pages Structure

### /

**Home Page**

- Welcome message and navigation overview
- Quick access to statistics
- Clean, professional layout

### /about

**About Page**

- Application description
- How the Statistics page uses the GitHub API

### /statistics

**Statistics Page**

- Up to 30 AI coding assistants from GitHub, ranked by stars
- Search, language filter, sorting (Stars / Forks / Recently updated) and a "Hide inactive" switch
- Star, fork and open issue counts, license, last push date and topics
- Direct links to GitHub repositories
- Language and description details

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **APIs**: GitHub REST Search API (works without a token; see [API Integration](#api-integration) for rate limits)
- **Deployment**: Ready for Vercel/Netlify

## Getting Started

### Prerequisites

```bash
Node.js 20.9+
npm or yarn or pnpm
```

### Installation

1. Clone the repository:

```bash
git clone https://github.com/chalyi-andrei/next_github_copilot.git
cd next_github_copilot
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

No configuration is required. Optionally, create `.env.local` in the project root to send an authenticated request to GitHub:

```bash
GITHUB_TOKEN=your_github_token
```

- **Effect**: raises the GitHub Search API limit from 10 to 30 requests per minute
- **Scope**: server-side only; the token is never sent to the browser
- **Git**: `.env*` files are listed in `.gitignore`, so the token is not committed

## Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm test             # Run unit tests
npm run test:watch   # Run unit tests in watch mode

# Claude Office (agent visualizer)
npm run office       # Start Claude Office in the background and open it
npm run office:stop  # Stop Claude Office (ports 3333 and 3334)

# Git hooks
npm run prepare      # Point git at .githooks (runs automatically on npm install)
```

### Claude Office (agent visualizer)

`npm run office` starts the local [Claude-Office](https://github.com/W17ant/Claude-Office) checkout as background processes and opens the UI. Running it again is safe: services that are already up are not started twice.

- **Location**: `~/Claude-Office` by default; override with the `CLAUDE_OFFICE_DIR` environment variable
- **One-time setup**:

  ```bash
  git clone https://github.com/W17ant/Claude-Office ~/Claude-Office
  cd ~/Claude-Office && npm install
  ```

- **URLs**: UI at [http://localhost:3333](http://localhost:3333), server at [http://localhost:3334](http://localhost:3334)
- **Logs**: `~/.agent-office/server.log` and `~/.agent-office/vite.log`
- **Without opening the browser**: `npm run office -- --no-open`

### Git hooks

The repository ships a dependency-free pre-commit hook in `.githooks/pre-commit`. It runs `npm test` before every commit and aborts the commit if any unit test fails.

- **Activation**: automatic on `npm install` via the `prepare` script; to enable it manually run `git config core.hooksPath .githooks`
- **Bypass once**: `git commit --no-verify`
- **Disable**: `git config --unset core.hooksPath`

The hook tests the working tree, not only the staged changes. Running `npm run lint` in the hook as well is a possible future extension.

## API Integration

The statistics page fetches data from GitHub's public API:

- **Endpoint**: `https://api.github.com/search/repositories`
- **Queries**: 5 requests per page regeneration, sent one by one: 1 for the curated repository list and 1 for each of the 4 topics
- **Processing**: Results are merged, de-duplicated, filtered (lists, books and guides are dropped), sorted by stars and limited to 30 repositories
- **Caching**: Server-side caching for 1 hour (ISR), so GitHub is not called on every visit
- **Rate Limits**: The Search API allows 10 requests per minute without a token and 30 with the optional `GITHUB_TOKEN`
- **Timeout**: Every request is aborted after 8 seconds
- **Failures**: A failed request is logged on the server with `console.error`; the page shows the remaining data with a warning, or a fallback message when nothing could be loaded
- **Avatars**: `next.config.ts` allows `avatars.githubusercontent.com` as a remote host for `next/image`

## Project Structure

```
app/
├── page.tsx               # Home page
├── about/
│   └── page.tsx           # About page
├── statistics/
│   ├── page.tsx           # Statistics page (server component)
│   ├── RepoExplorer.tsx   # Search, filters and sorting (client component)
│   └── github.ts          # GitHub API data layer
├── components/
│   ├── MainNav.tsx        # Shared top navigation
│   └── PageShell.tsx      # Shared page frame
├── globals.css            # Global styles
├── layout.tsx             # Root layout
└── favicon.ico            # App icon

__tests__/                 # Unit tests (Vitest + React Testing Library)
scripts/
└── office.mjs             # Claude Office launcher
.githooks/
└── pre-commit             # Runs unit tests before every commit
public/                    # Static assets
next.config.ts             # Next.js config (allowed image hosts)
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect to Vercel
3. Deploy automatically

### Manual Deployment

```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

---

Built with ❤️ using Next.js and GitHub API
