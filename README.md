# Wariatkowo

Private household dashboard for Misiek and Miśka, built around a self-hosted Node + React app with Google sign-in, household data management, smart-home controls, and Android support.

Wariatkowo keeps the app private and local-first: authenticated household members use Google OpenID Connect only to map trusted Google accounts onto the existing profiles, while tasks, shopping, calendar data, and Home Assistant actions remain behind the app's own session and local SQLite database.

## Highlights

- Household task dashboard with ownership, recurrence, and statistics
- Shopping list and product history tracking
- Shared household calendar with Google Calendar sync
- Smart-home controls backed by Home Assistant
- Android app for mobile access and widget support
- Direct server-side OAuth handling for Google and Calendar integrations

## Architecture

```text
Browser / Android app
  -> Wariatkowo Express API on port 3000
       -> React/Vite frontend bundle
       -> SQLite database
       -> Google Calendar API (server-side only)
       -> Home Assistant
```

The repo is intentionally split by responsibility:

```text
src/                 React app, routes, components, hooks, services
server/              Express server, auth, API handlers, integrations
shared/              Shared models and API contracts
server/db/           SQLite adapter and migration tooling
server/auth/         Google identity and allowlist logic
server/googleCalendar/ Google Calendar sync and encrypted token storage
server/homeAssistant/ Home Assistant config and normalized controls
apps/mobile/         Expo/React Native Android client
packages/api-client/ typed client for shared API access
migrations/          SQLite migration history
tests/               Auth, calendar, sync, home automation and API checks
```

## Main routes

- `/` — welcome screen
- `/dashboard` — household overview and smart-home summary
- `/zadania` — tasks, assignment, recurrence and stats
- `/zakupy`, `/zakupy/sklep`, `/zakupy/produkty` — shopping flows
- `/kalendarz` — household calendar and Google Calendar integration
- `/home` — smart-home controls and scenes
- `/api/health` — unauthenticated health endpoint

## Requirements

- Node.js 22+
- npm
- Docker + Docker Compose v2 for the Debian deployment
- Home Assistant long-lived access token for smart-home controls

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example env file and set your local values:

   ```bash
   copy .env.example .env
   ```

   Example:

   ```env
   COOKIE_SECURE=false
   GOOGLE_CLIENT_ID=replace-with-local-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=replace-with-local-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/google/callback
   GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:5173/api/integrations/google-calendar/callback
   GOOGLE_TOKEN_ENCRYPTION_KEY=replace-with-generated-base64url-key
   GOOGLE_ALLOWED_USERS_JSON={"first-private-account@example.com":"misiek","second-private-account@example.com":"miska"}
   DATABASE_PATH=./data/wariatkowo.db
   MIGRATIONS_PATH=./migrations
   IMAGES_PATH=./data/images
   ```

3. Create the image directories for local media:

   ```bash
   mkdir -p data/images/polaroids data/images/profiles
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Optional: initialize/update the database explicitly:

   ```bash
   npm run db:migrate
   ```

Useful commands:

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm start` serves the built frontend and API from port 3000. Vite proxies `/api` and `/media` requests to the local server during development.

## Google OAuth and Calendar setup

Wariatkowo uses Google OpenID Connect to authenticate only the explicitly allowed household accounts and map them to the existing local profiles.

### Required OAuth configuration

1. Enable the Google Calendar API in the Google Cloud project.
2. Configure the OAuth consent screen for the private household accounts.
3. Add these Calendar scopes:

   ```text
   https://www.googleapis.com/auth/calendar.calendarlist.readonly
   https://www.googleapis.com/auth/calendar.events
   ```

4. Keep the app configuration as a Web OAuth client with these redirect URIs:

   ```text
   https://wariatkowo.wwojcik.com/api/auth/google/callback
   https://wariatkowo.wwojcik.com/api/integrations/google-calendar/callback
   ```

   For local development:

   ```text
   http://localhost:5173/api/auth/google/callback
   http://localhost:5173/api/integrations/google-calendar/callback
   ```

   Or when running the built server directly on port 3000:

   ```text
   http://localhost:3000/api/auth/google/callback
   http://localhost:3000/api/integrations/google-calendar/callback
   ```

5. Generate a 32-byte token encryption key:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

### Operational notes

- Normal login requests only `openid`, `email`, and `profile`.
- Google Calendar OAuth is a separate, explicit authorization flow per member.
- Refresh tokens are encrypted with AES-256-GCM before SQLite storage.
- The app refuses to start if the token key is missing or invalid.
- Only the exact allowed Google emails can create a local household session.
- Google secrets and OAuth values never belong in `VITE_*` variables.

## Android app

The repository includes an Expo/React Native app in `apps/mobile` for Android access to the same household data and Home Assistant controls.

```bash
npm install
npm run dev:server
npm run dev:web
npm run dev:mobile
```

For Android builds:

```bash
cd apps/mobile
npm run android
```

Set the public API origin for the app:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

For a physical device, use a reachable LAN or HTTPS URL instead of the emulator default.

The native app includes widget support, authenticated API access, and direct Android package-install flows for private release distribution.

## Home Assistant integration

Create a long-lived access token in Home Assistant and keep it on the server only:

```env
HA_URL=http://home-assistant.local:8123
HA_TOKEN=replace-me
HA_TIMEOUT_MS=5000
```

Example logical device mapping:

```env
HA_LIGHTS_JSON={"living-room":{"name":"Salon","entityIds":["light.living_room_1","light.living_room_2"]},"bedroom":{"name":"Sypialnia","entityId":"light.bedroom"}}
HA_AC=climate.living_room
HA_TV=media_player.living_room_tv
HA_TV_REMOTE=remote.living_room_tv
HA_XBOX=media_player.living_room_xbox
HA_XBOX_REMOTE=remote.living_room_xbox
```

The smart-home page refreshes on a short polling cycle while mounted, and the backend enforces allowlisted actions only.

## Docker deployment

For Debian-based deployment, the project expects a persistent data directory and a production `.env` file with secure values.

```bash
docker compose build
docker compose up -d
curl http://127.0.0.1:3000/api/health
```

Recommended production settings:

```env
COOKIE_SECURE=true
DATABASE_PATH=./data/wariatkowo.db
IMAGES_PATH=./data/images
MOBILE_RELEASES_PATH=./data/mobile
```

Compose binds the data directory so app data, images, and Android release artifacts persist on the host machine. The container exposes the app on port 3000 and includes a health check.

## Security and privacy notes

- Never commit `.env`, databases, D1 exports, access tokens, or private household email addresses.
- Google client secrets and token-encryption keys stay server-side.
- OAuth state and session cookies are short-lived and bound to the correct flow.
- Calendar tokens are encrypted at rest with authenticated AES-GCM.
- Personal media is served only through the explicit media routes and file checks.
- The browser never receives Google secrets, Home Assistant credentials, or refresh tokens.

## SQLite and migrations

The app uses SQLite as the source of truth for household data. Startup automatically creates the DB directory, enables WAL mode and foreign keys, and applies any pending migration files in order.

```bash
npm run db:migrate
```

If importing from an existing Cloudflare D1 export, use the dedicated importer and verify the imported row counts before switching the database path.

## Verification checklist

Before shipping or redeploying, run:

```bash
npm run typecheck
npm test
npm run build
docker compose config
docker compose build
```

Then verify:

- both allowed Google accounts can sign in
- denied Google accounts are rejected
- household tasks, shopping, calendar, and Home Assistant flows work
- Calendar sync and event CRUD behave correctly
- profile photos and media files load correctly
- no secrets are bundled into the frontend build

## Repository structure

```text
.
├── apps/
│   └── mobile/
├── build/
├── data/
├── migrations/
├── packages/
│   └── api-client/
├── scripts/
├── server/
├── shared/
├── src/
├── tests/
├── .env.example
├── compose.yaml
├── Dockerfile
├── index.html
├── package.json
├── README.md
├── tsconfig.json
├── vite.config.ts
└── ...
```

## License and project status

This project is a private household application and is intended for self-hosted use. The repository is optimized for a single deployment target, controlled access, and low operational complexity rather than public SaaS deployment.
