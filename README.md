# Y2 Project Management System

An AI-powered project management system built for university-level team projects. Features real-time collaboration, document management with semantic search, AI-assisted decision tracking, and automated progress reporting.

## Features

- **AI Chat** — Ask questions about your project documents using RAG (retrieval-augmented generation)
- **Document Management** — Upload and semantically search project files
- **Decision Log** — Track and query past project decisions
- **Progress Tracking** — Image-based progress updates with AI captioning
- **Todo Management** — Team task tracking with real-time sync
- **Overview Dashboard** — Auto-generated project summaries

## Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** [Convex](https://convex.dev) (real-time database + serverless functions)
- **AI:** OpenAI (embeddings + image captioning), OpenRouter (LLM)

## Prerequisites

Before setting up, you will need free/paid accounts for:

1. [Convex](https://convex.dev) — free tier available
2. [OpenAI](https://platform.openai.com) — for embeddings and image captioning
3. [OpenRouter](https://openrouter.ai) — for LLM access (supports many models)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/TanHongZhe/Y2_Project_Management_System.git
cd Y2_Project_Management_System/app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Convex

```bash
npx convex dev
```

This will prompt you to log in and create a new Convex project. Once done, it will print your deployment URL — keep it handy for the next step.

### 4. Configure environment variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

Then open `.env.local` and fill in your keys:

```env
# From openrouter.ai → Keys
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=Y2 PMS

# From platform.openai.com → API Keys
OPENAI_API_KEY=sk-...

# From your Convex dashboard → Settings → URL & Deploy Key
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
```

Also add `OPENAI_API_KEY` to your **Convex dashboard** under Settings → Environment Variables, so the backend functions can access it.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## License

[MIT](../LICENSE) — Tan Hong Zhe, 2026
