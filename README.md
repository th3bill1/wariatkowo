# Wariatkowo

Wariatkowo is a private household web app. It starts with a playful welcome screen, then moves into a real shared home shell with today, tasks, and shopping.

## Development

- Install dependencies: `npm install`
- Run the frontend only: `npm run dev`
- Build production assets: `npm run build`
- Preview production build: `npm run preview`
- Typecheck Pages Functions: `npm run typecheck:functions`
- Run the full app with Pages Functions: `npm run dev:full`

## Architecture

React
	↓
same-origin `/api/*`
	↓
Cloudflare Pages Functions
	↓
Cloudflare D1

The frontend never talks to D1 directly. All task and shopping data goes through Pages Functions.

## Routes

- `/` - welcome experience
- `/dashboard` - Wariatkowo dziś
- `/zadania` - task list
- `/zakupy` - shopping list
- `/powrot-do-wariatkowa` - quiz Powrót do Wariatkowa

## Project structure

- `src/components/app/` - app shell wordmark and shell-level UI pieces
- `src/components/ui/` - reusable page chrome, cards, states, and icons
- `src/content/` - editable Polish copy for greetings, subtitles, statuses, navigation, tasks, shopping, and dashboard text
- `src/hooks/` - data hooks and interaction hooks
- `src/layouts/` - app shell layout
- `src/pages/` - route-level pages
- `src/services/` - frontend API clients
- `src/styles/` - global visual language and responsive layout rules
- `src/utils/` - shared helpers for local UI behavior
- `shared/` - TypeScript models and API response shapes shared by frontend and Functions
- `functions/` - Cloudflare Pages Functions for `/api/*`
- `migrations/` - D1 migrations
- `public/_redirects` - Cloudflare Pages SPA fallback

## Content

Editable copy lives in a few small files so it stays easy to change later:

- Welcome greetings: `src/content/greetings.ts`
- Welcome subtitles: `src/content/subtitles.ts`
- Wariatkowo status phrases: `src/content/statuses.ts`
- App shell labels: `src/content/appShell.ts`
- Dashboard copy: `src/content/dashboard.ts`
- Tasks copy: `src/content/tasks.ts`
- Shopping copy and categories: `src/content/shopping.ts`, `src/content/shoppingCategories.ts`
- Loading copy: `src/content/loading.ts`
- Quiz questions: `src/content/quiz/questions.ts`
- Quiz result messages: `src/content/quiz/results.ts`

## Doodles and welcome visuals

- Household doodles live in `src/content/doodles.ts`
- They are data-driven so a doodle can later be replaced with an image URL or local asset without changing the welcome layout
- Random welcome events live in `src/content/randomEvents.ts`

## Data model

- Shared types live in `shared/models.ts`
- Shared API response shapes live in `shared/api.ts`

## D1

- Initial schema lives in `migrations/0001_initial.sql`
- The D1 binding name is `DB`
- Functions use `Env.DB` server-side only
- Database creation example: `npx wrangler d1 create wariatkowo-db`
- Local migration example: `npx wrangler d1 migrations apply wariatkowo-db --local --folder migrations`
- Remote migration example: `npx wrangler d1 migrations apply wariatkowo-db --remote --folder migrations`

## Cloudflare Pages setup

Use these settings in Cloudflare Pages:

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`

Add the D1 binding in the Cloudflare Pages project settings under Functions / D1 database bindings, with the binding name `DB`. Redeploy after adding or changing the binding.

## SPA routing

`public/_redirects` routes client-side paths back to `index.html`, so direct visits like `/dashboard`, `/zadania`, `/zakupy`, and `/powrot-do-wariatkowa` work on Cloudflare Pages.

## Powrót do Wariatkowa quiz

- Quiz questions live in `src/content/quiz/questions.ts`
- Quiz images live in `public/quiz/`
- Add a question by copying an image into `public/quiz/`, adding a new object to `quizQuestions`, and setting `correctAnswer` to the zero-based index of the right answer
- `correctAnswer` uses `0` to `3`
- Scoring is frontend-only: self-answer mode can award 2 points, multiple-choice mode can award at most 1 point
- Result copy is editable in `src/content/quiz/results.ts`

## Notes

- The API is currently unauthenticated
- Do not store sensitive household information here until access control is added
- If no Cloudflare database ID is available locally, keep the migration files and binding steps as the source of truth instead of inventing IDs
