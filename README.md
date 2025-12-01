# Next.js AI Code Assistants Statistics

A Next.js application that showcases popular AI coding assistants and tools. Built with the App Router and integrates with GitHub API to display real-time data about AI tools for programming.

## Features

### 📈 Interactive Statistics Page

- **Real-time API Integration**: Fetches data from GitHub API to show popular AI coding assistants
- **Dynamic Ranking**: Displays repositories ranked by GitHub stars
- **Multiple Categories**: Searches across different AI topics (coding assistants, code completion, programming AI tools)
- **Responsive Cards**: Clean, modern UI showing repository details, stars, language, and descriptions

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
- API integration details
- Technology stack information

### /statistics

**Statistics Page**

- Top 10 AI coding assistants from GitHub
- Real-time star counts and repository info
- Direct links to GitHub repositories
- Language and description details

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **APIs**: GitHub REST API (unlimited public access)
- **Deployment**: Ready for Vercel/Netlify

## Getting Started

### Prerequisites

```bash
Node.js 18+
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

## Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## API Integration

The statistics page fetches data from GitHub's public API:

- **Endpoint**: `https://api.github.com/search/repositories`
- **Query**: Searches for repositories with AI-related topics
- **Caching**: Server-side caching every hour for optimal performance
- **Rate Limits**: Uses GitHub's generous public API limits

## Project Structure

```
app/
├── page.tsx            # Home page
├── about/
│   └── page.tsx       # About page
├── statistics/
│   └── page.tsx       # Statistics with API integration
├── globals.css        # Global styles
├── layout.tsx         # Root layout
└── favicon.ico        # App icon

public/                  # Static assets
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
