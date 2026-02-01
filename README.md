# Koda — Social Calendar + Discover

Koda is a privacy-first social calendar that helps friends coordinate plans and discover things to do in their city. Share availability safely (busy-only or full details), invite friends to hangouts, host public events with optional anonymity, and sync with Google Calendar.

## Getting Started

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- pnpm (recommended)

### Installation

```bash
# Install dependencies
pnpm install

# Set up git hooks (pre-commit)
pnpm husky
```

### Development

```bash
# Start development server (runs on http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Tooling & Scripts

### Code Quality

```bash
# Lint code with ESLint
pnpm lint

# Type-check with TypeScript
pnpm typecheck

# Format code with Prettier
pnpm format

# Check formatting (without making changes)
pnpm format:check
```

### Testing

```bash
# Run tests once
pnpm test

# Run tests with coverage report (must meet 93% threshold)
pnpm test:coverage
```

## Code Style & Configuration

- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Formatting**: Prettier (2-space indentation, single quotes)
- **Linting**: ESLint 9 + Next.js config
- **Pre-commit hooks**: Husky + lint-staged (auto-format staged files)
- **Editor config**: `.editorconfig` for IDE consistency

## Project Structure

```
.
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with navigation
│   ├── page.tsx           # Landing page
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # shadcn/ui components
│   └── ...                # Feature components
├── lib/
│   ├── utils.ts           # Shared utilities
│   └── ...                # Feature modules (auth, db, etc.)
├── tests/                 # Unit & integration tests
├── .github/workflows/     # GitHub Actions CI
├── .husky/               # Git hooks
├── vitest.config.ts      # Test runner config
└── next.config.ts        # Next.js config
```

## Continuous Integration

GitHub Actions workflow runs on every PR and push to `main`:

- **Linting** (`pnpm lint`)
- **Type-checking** (`pnpm typecheck`)
- **Tests** (`pnpm test:coverage`) — must meet 93% coverage threshold

See `.github/workflows/ci.yml` for details.

## Git Workflow

1. Create a feature branch
2. Make changes and commit
3. Pre-commit hook automatically:
   - Formats staged files with Prettier
   - Lints staged files with ESLint (blocks on errors)
4. Push to remote
5. CI runs on PR; merge once all checks pass

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (Radix UI + Tailwind)
- **Testing**: Vitest + React Testing Library
- **Formatting**: Prettier
- **Linting**: ESLint 9
- **Git Hooks**: Husky + lint-staged
- **Package Manager**: pnpm

## Acceptance Criteria (Epic 0.1)

`pnpm dev` starts successfully and loads homepage
`pnpm lint` passes (no errors)
`pnpm typecheck` passes
`pnpm format:check` passes
`pnpm test` passes with 16 tests
`pnpm test:coverage` reports 100% coverage
Pre-commit hook installed and working (`git commit` triggers format + lint)
CI workflow exists and runs the same commands
Coverage threshold enforced at 93% in CI

## Deployment

### Railway

This project is configured for deployment on [Railway](https://railway.app):

1. **Connect your GitHub repo** to Railway
2. **Set environment variables** (see section below)
3. **Deploy** - Railway automatically deploys on push to `main`

#### Environment Variables

For local development, create a `.env.local` file:

```bash
# Example (update with actual values)
DATABASE_URL=your_supabase_url
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

In Railway, set these via the dashboard under **Variables**.

#### Free-tier Stack

- **Frontend/Backend**: Next.js on Railway
- **Database**: Supabase Postgres (free tier)
- **Caching**: Upstash Redis (free tier)
- **Auth**: Google OAuth (free)
- **Analytics**: PostHog (free tier)
- **Error Tracking**: Sentry (free tier)

No credit card required for initial deployment!

## Next Steps

After Epic 0.1, the following features are planned:

- **S1.0**: Database setup (Prisma + Supabase)
- **S2.0**: Authentication (Auth.js + Google OAuth)
- **S3.0**: Calendar views and sharing features
- **S4.0**: Friends management
- **S5.0**: Discover and suggestions engine
- **S6.0**: Event creation and invitations

See `/docs/sprint-plan.md` for detailed roadmap.
