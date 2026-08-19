# Wariatkowo

Wariatkowo is a private Polish-language household SPA for Misiek and Miśka. Google OpenID Connect authenticates two explicitly allowed accounts and maps them onto those existing household profiles. Tasks, recurring-task statistics, shopping/history, calendar and the Home Assistant-backed smart-home page continue to use the local Misiek/Miśka identity.

The supported production runtime is now a single self-hosted Node application:

```text
Browser
  -> Wariatkowo Express :3000
       -> React/Vite static bundle
       -> /api/auth, tasks, shopping, calendar -> local SQLite
       -> Google Calendar API (server-side OAuth tokens only)
       -> /api/home                         -> Home Assistant
```

For public access, put Cloudflare Access and Cloudflare Tunnel in front of port 3000. Cloudflare Pages, Pages Functions and D1 are not required at runtime.

The repository keeps runtime responsibilities explicit:

```text
src/                 React pages, components, hooks, services and browser utilities
server/api/          HTTP endpoint adapters; existing paths are public contracts
server/auth/         Google identity configuration, OIDC client and identity mapping
server/googleCalendar/  Calendar API client, encrypted-token data access and sync
server/homeAssistant/   HA configuration, normalized status and allowlisted controls
server/db/           SQLite adapter, migration runner and import tools
shared/              Domain and API types shared by browser and server
migrations/          Immutable, ordered SQLite schema history
tests/               Critical auth, data, sync and integration behavior
```

React talks to the backend through `src/services`; page-level data hooks own loading and refresh behavior. Server endpoints authenticate before calling domain modules. Google Calendar event mutation and synchronization stay server-side so refresh tokens, sync tokens and conflict metadata never cross the browser boundary.

## Requirements

- Node.js 22 or newer
- npm
- Docker Engine + Docker Compose v2 for the Debian deployment
- Home Assistant long-lived access token for smart-home controls

## Routes

- `/` — welcome
- `/dashboard` — household overview and smart-home summary
- `/zadania` — tasks, ownership, recurrence and statistics
- `/zakupy`, `/zakupy/sklep`, `/zakupy/produkty` — shopping
- `/kalendarz` — household calendar
- `/home` — lights, AC and optional household scenes
- `/api/health` — unauthenticated container health endpoint

All household and smart-home APIs remain behind the existing HTTP-only Wariatkowo session. Google authentication and Calendar access are handled only by Express; OAuth tokens, the token-encryption key and the client secret are never sent to React. Cloudflare Access may remain as an optional outer boundary, but the application whitelist is the authorization boundary that maps a Google account to Misiek or Miśka.

## Google OAuth and Calendar setup

Google login working does **not** mean Google Calendar access is configured. Normal login remains identity-only (`openid`, `email`, `profile`). Calendar access uses a separate incremental authorization that each member starts once from `/kalendarz`.

The flow follows Google's [OAuth 2.0 web-server guide](https://developers.google.com/identity/protocols/oauth2/web-server) and [OpenID Connect reference](https://developers.google.com/identity/openid-connect/reference).

1. In the existing Google Cloud project, enable **Google Calendar API**.
2. Configure the OAuth consent screen for the intended private accounts and add these Calendar scopes:

   ```text
   https://www.googleapis.com/auth/calendar.calendarlist.readonly
   https://www.googleapis.com/auth/calendar.events
   ```

   Wariatkowo deliberately does not request the broader `https://www.googleapis.com/auth/calendar` scope.

3. Reuse the existing OAuth 2.0 client with application type **Web application**. Keep the identity login redirect URI:

   ```text
   https://wariatkowo.wwojcik.com/api/auth/google/callback
   ```

4. Add the separate production Calendar redirect URI to the same Web OAuth client:

   ```text
   https://wariatkowo.wwojcik.com/api/integrations/google-calendar/callback
   ```

5. Add separate local redirect URIs when developing locally. With the Vite proxy, use:

   ```text
   http://localhost:5173/api/auth/google/callback
   http://localhost:5173/api/integrations/google-calendar/callback
   ```

   When running the built Express application directly on port 3000, use:

   ```text
   http://localhost:3000/api/auth/google/callback
   http://localhost:3000/api/integrations/google-calendar/callback
   ```

6. Generate a 32-byte refresh-token encryption key on a trusted machine:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

7. Put the server-side values in `.env`:

   ```env
   GOOGLE_CLIENT_ID=replace-with-google-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
   GOOGLE_REDIRECT_URI=https://wariatkowo.wwojcik.com/api/auth/google/callback
   GOOGLE_CALENDAR_REDIRECT_URI=https://wariatkowo.wwojcik.com/api/integrations/google-calendar/callback
   GOOGLE_TOKEN_ENCRYPTION_KEY=replace-with-generated-base64url-key
   GOOGLE_ALLOWED_USERS_JSON={"first-private-account@example.com":"misiek","second-private-account@example.com":"miska"}
   ```

`GOOGLE_ALLOWED_USERS_JSON` must contain exactly one account for each existing profile. Email keys are normalized to lowercase; values must be `misiek` or `miska`. On first successful login, the member row stores the verified email and Google's stable `sub`. Later logins prefer `sub`; a mismatch between the stored identity and current whitelist fails closed and is logged server-side.

Normal login requests only `openid`, `email` and `profile`. It uses Authorization Code flow with PKCE and its own short-lived HTTP-only state cookie. The explicit Calendar connection flow separately requests identity plus the two narrow Calendar scopes, offline access and renewed consent so a server-side refresh token is returned. Calendar state is one-time, short-lived, bound to the current application session/member, and separate from login state. The returned stable Google `sub` and email must match the identity already attached to that member.

Refresh tokens are encrypted with AES-256-GCM before SQLite persistence. The server refuses to start when `GOOGLE_TOKEN_ENCRYPTION_KEY` is missing or does not decode to exactly 32 bytes. Rotating this key requires reconnecting both Calendar accounts unless stored tokens are re-encrypted first.

After deployment, Misiek and Miśka must each log into their own profile, open `/kalendarz`, and click **Połącz Kalendarz Google**. Connecting one member does not authorize the other member's account.

Wariatkowo imports every calendar returned by each account's CalendarList, deduplicates shared calendars by Google `calendarId`, and chooses the account with the strongest access for canonical synchronization. Event and calendar-list synchronization is incremental, paginated, and automatically falls back to a full sync after Google invalidates a sync token. It runs immediately after connection, when stale calendar data is opened, on browser focus, and through the **Synchronizuj** action. Push notifications are intentionally not used in this version.

Creating an event in a writable Google destination calls Google before caching it locally. Edits use partial Google updates with an `etag` precondition, and deletion calls Google before removing the cache row. Reader/free-busy calendars and locked or unsupported recurring/special events remain view-only. Disconnecting removes the member's encrypted token and active access without deleting anything from Google; a shared calendar remains available when the other connected member can still access it.

Never commit `.env`, `GOOGLE_CLIENT_SECRET`, private household email addresses or downloaded OAuth credentials. No Google value belongs in a `VITE_*` variable.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`. Create a separate local Google OAuth client configuration (or add the local redirect URI to the web client), then set:

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

3. Create `data/images/polaroids` and `data/images/profiles`, then copy any development-only personal images there. The entire `data/` directory is ignored by Git.

4. Initialize/update the database. Startup does this automatically; it can also be run explicitly:

   ```bash
   npm run db:migrate
   ```

5. Start the Vite and API development servers together:

   ```bash
   npm run dev
   ```

Vite runs the browser app and proxies relative `/api` and `/media` requests to `127.0.0.1:3000`. The server rebuilds/restarts when backend TypeScript changes. No production URL is embedded in the browser bundle.

Useful commands:

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm start` serves the built SPA and API from port 3000. Direct React Router visits such as `/zadania`, `/kalendarz` and `/home` fall back to `dist/index.html`.

## SQLite and migrations

The default host database is `./data/wariatkowo.db`; the container uses the same path relative to `/app`, backed by the `./data:/app/data` bind mount.

On startup the server:

- creates the parent directory;
- enables foreign keys, WAL mode and a busy timeout;
- records applied files in `wariatkowo_schema_migrations`;
- applies only new `migrations/*.sql` files in filename order and in transactions;
- refuses to continue if an already-applied migration file was edited.

It never drops or recreates user tables during startup. Keep the historical migration files in Git.

### Import existing Cloudflare D1 data

The import is explicit and refuses to write into a non-empty SQLite database.

1. Stop Wariatkowo and back up any existing local DB.
2. On a trusted admin machine with Wrangler authenticated, export D1:

   ```bash
   npx wrangler d1 export wariatkowo-db --remote --output=d1-export.sql
   ```

3. Review the SQL file. Do not commit it; it contains private household data and session hashes.
4. Import it into a new path:

   PowerShell:

   ```powershell
   $env:DATABASE_PATH='./data/wariatkowo-imported.db'
   npm run db:import -- ./d1-export.sql
   ```

   Bash:

   ```bash
   DATABASE_PATH=./data/wariatkowo-imported.db npm run db:import -- ./d1-export.sql
   ```

The importer preserves IDs and foreign-key relationships, verifies the required schema, records the four legacy migrations, applies all newer Google identity and Calendar migrations, and prints row counts for household members, tasks and completions, shopping/history, and local calendar events. Compare those counts with D1 before switching `DATABASE_PATH`. Log in with both allowed Google accounts and manually verify recurrence, statistics, shopping history and calendar ranges.

For a container-based import:

```bash
docker compose run --rm \
  -v ./d1-export.sql:/tmp/d1-export.sql:ro \
  wariatkowo node build/server/db-import.js /tmp/d1-export.sql /app/data/wariatkowo.db
```

Rollback is file-based: stop the container, restore the previous `.db` plus matching `-wal`/`-shm` files if present (or a SQLite online backup), restore the previous `DATABASE_PATH`, then start again. Never copy a live WAL database without first stopping the application or using SQLite's backup API.

## Home Assistant

Create a long-lived access token in the Home Assistant user profile and place it only in the server `.env`:

```env
HA_URL=http://home-assistant.local:8123
HA_TOKEN=replace-me
HA_TIMEOUT_MS=5000
```

The token is never exposed through a `VITE_` variable or returned to React. The browser can invoke only Wariatkowo's whitelisted routes; there is no arbitrary domain/service/entity proxy.

Configure logical devices with server-side entity IDs:

```env
HA_LIGHTS_JSON={"living-room":{"name":"Salon","entityIds":["light.living_room_1","light.living_room_2"]},"bedroom":{"name":"Sypialnia","entityId":"light.bedroom"}}
HA_AC=climate.living_room
HA_TV=media_player.living_room_tv
HA_TV_REMOTE=remote.living_room_tv
HA_XBOX=media_player.living_room_xbox
HA_XBOX_REMOTE=remote.living_room_xbox
```

Additional single or grouped logical lights can be supplied without frontend changes:

```env
HA_LIGHTS_JSON={"kitchen":{"name":"Kuchnia","entityId":"light.kitchen"},"ceiling":{"name":"Sufit","entityIds":["light.ceiling_1","light.ceiling_2"]}}
```

Grouped lights are shown as on when any member is on, and every power or setting action targets all members. Brightness, RGB color and color temperature are applied independently so mutually exclusive Home Assistant color modes are never submitted together. Color temperature uses the Kelvin capabilities advertised by current Home Assistant light entities. The UI exposes controls only when the current entity state advertises those capabilities. State polling happens every four seconds only while `/home` is mounted and refreshes immediately after successful actions.

### TV and Xbox power

The server retains allowlisted TV/Xbox endpoints and normalized status support, while their cards are intentionally hidden from the current `/home` layout. Wariatkowo calls the configured HA entity's `turn_on`/`turn_off` service. Configure and test Samsung Wake-on-LAN and Xbox wake/power behavior in Home Assistant first. Do not place MAC addresses or a second Wake-on-LAN implementation in Wariatkowo. If a dedicated HA `remote.*` entity is the working power entity, it is used when no media entity is configured.

Before deployment, verify the same HA service calls in Developer Tools:

- Yeelight `light.turn_on`, `light.turn_off`, brightness and color;
- Hisense `climate.turn_on/off`, target temperature and advertised modes;
- Samsung `media_player.turn_on/off` and optional `remote.send_command`;
- Xbox media/remote power services.

### Optional household scenes

Controls are hidden unless configured. Point them at existing `scene.*` or `script.*` entities:

```env
HA_SCENE_GAMING=script.gaming_mode
HA_SCENE_MOVIE=scene.movie_mode
HA_SCENE_GOOD_NIGHT=script.good_night
```

More logical scenes can use `HA_SCENES_JSON` in the same shape as the light mapping.

If HA is offline or misconfigured, tasks, shopping, calendar, dashboard and login continue to work. `/api/home/status` returns a disconnected normalized snapshot; control calls return a controlled `503` response.

## Docker deployment on Debian

1. Copy the repository to the server.
2. Copy `.env.example` to `.env`, fill the Google OAuth, Calendar, whitelist and HA/entity values, and keep it readable only by the deployment account. Production must use both exact production Google redirect URIs and `COOKIE_SECURE=true`.
3. Prepare the database directory and confirm the external image tree exists and is readable by the unprivileged container user. Leave `DATABASE_PATH=./data/wariatkowo.db` and `IMAGES_PATH=./data/images`:

   ```bash
    mkdir -p data
    sudo chown 1000:1000 data
    find /srv/docker/wariatkowo-data/images -maxdepth 2 -type d -print
    test -r /srv/docker/wariatkowo-data/images/profiles/misiek.jpg
   ```

4. Build and start:

   ```bash
   docker compose build
   docker compose up -d
    docker compose ps
    curl http://127.0.0.1:3000/api/health
    curl http://127.0.0.1:3000/api/images/polaroids
    curl --fail --output /dev/null http://127.0.0.1:3000/media/profiles/misiek.jpg
    curl --fail --output /dev/null http://127.0.0.1:3000/media/polaroids/kajaki.jpg
    docker compose exec wariatkowo find /app/data/images -maxdepth 2 -type f -print
   ```

5. Confirm persistence by adding a harmless item, running `docker compose restart wariatkowo`, and checking it remains.

The image is a Node 22 Debian multi-stage build. The final stage contains production packages, bundled server tools, the Vite `dist`, and migrations; neither the database nor personal images are stored in an image layer. Compose mounts `/srv/docker/wariatkowo-data/images` at `/app/data/images` read-only. The service binds `0.0.0.0:3000`, has a healthcheck and restarts unless stopped.

To add a Polaroid later, upload a supported image and refresh the page—no Git commit, frontend build or Docker rebuild is needed:

```bash
scp photo.jpg th3bill@server-th3bill:/srv/docker/wariatkowo-data/images/polaroids/
```

For direct LAN HTTP development set `COOKIE_SECURE=false`. For the HTTPS Cloudflare hostname set `COOKIE_SECURE=true` so both the OAuth state cookie and household session cookie stay secure. Express trusts the first proxy hop, while the OAuth redirect remains the exact configured public URI rather than being inferred from forwarded headers.

## Cloudflare Tunnel and Access

No Cloudflare account mutation is performed by this repository.

Manual setup:

1. Create a Cloudflare Tunnel in the dashboard.
2. Add a public hostname whose service/origin is `http://wariatkowo:3000` when using the optional Compose service, or the server's reachable port 3000 for an externally managed tunnel.
3. Optionally keep a Cloudflare Access self-hosted application as an additional outer boundary for that hostname. Its allow policy should not be treated as a replacement for `GOOGLE_ALLOWED_USERS_JSON`.
4. Ensure the tunnel forwards the callback path unchanged and test both approved accounts plus an unknown account in a private browser window.

To run the optional Compose tunnel profile, set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`, then:

```bash
docker compose --profile tunnel up -d
```

Without the profile, `cloudflared` is not started. The Google client secret belongs only in the Node server environment; it must never be placed in React, a `VITE_*` variable, Compose YAML or the image.

## Security notes

- Do not commit `.env`, databases, D1 exports or access tokens.
- API SQL uses parameters; migrations are the only reviewed raw SQL scripts.
- Static SPA serving is limited to `dist`. Personal media is exposed only through `/media/{polaroids|profiles}/<filename>` with category, extension, traversal and canonical-path checks; the rest of `/app/data` is not web-accessible.
- Production errors do not include stack traces or filesystem paths.
- Google ID tokens are verified with Google's maintained authentication library for signature, issuer, audience and expiration; verified email and stable `sub` are also required.
- OAuth callback state is constant-time checked, short-lived and bound to the code exchange with PKCE.
- Calendar OAuth state is separately stored as a one-time hash and bound to the initiating session/member; Calendar tokens are encrypted at rest with authenticated AES-GCM.
- Only exact configured emails can create a local session; unique database indexes prevent one Google identity from being attached to multiple profiles.
- `HA_TOKEN` stays server-side and HA operations use configured logical IDs.

## Verification checklist

Run:

```bash
npm run typecheck
npm test
npm run build
docker compose config
docker compose build
```

Then manually verify both profile photos, Welcome/Dashboard Polaroids and missing-image fallbacks. Add a temporary Polaroid on the host and confirm that refreshing discovers it without rebuilding. Also verify both allowed Google accounts, a denied account, cancellation and an expired login attempt. Connect each member's Calendar account and verify Google-to-Wariatkowo create/edit/delete plus Wariatkowo-to-Google create/edit/delete on writable and read-only calendars. Verify tasks CRUD/assignment/recurrence/statistics, shopping/history/shop mode, local calendar CRUD, `/home` polling and every configured HA control. Test React deep links directly and test core features once with Home Assistant stopped. Inspect `dist` and confirm personal images, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, refresh tokens and access tokens are absent from the browser bundle.

## Current limitations

- Smart-home state uses four-second polling; no SSE/WebSocket transport is implemented yet.
- Device features depend on attributes exposed by the configured HA integration; unavailable capabilities are hidden.
- TV remote commands use a small server-side allowlist.
- Cloudflare Access identity headers are not used by application authorization; the Google whitelist plus local Wariatkowo session remain the application boundary.
