# Wariatkowo

Wariatkowo is a private Polish-language household SPA for Misiek and Miśka. It keeps the existing welcome experience, profiles/PINs, tasks, recurring-task statistics, shopping/history, calendar and quiz, and adds a Home Assistant-backed smart-home page.

The supported production runtime is now a single self-hosted Node application:

```text
Browser
  -> Wariatkowo Express :3000
       -> React/Vite static bundle
       -> /api/auth, tasks, shopping, calendar -> local SQLite
       -> /api/home                         -> Home Assistant
```

For public access, put Cloudflare Access and Cloudflare Tunnel in front of port 3000. Cloudflare Pages, Pages Functions and D1 are not required at runtime.

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
- `/home` — lights, AC, TV, Xbox and optional household scenes
- `/powrot-do-wariatkowa` — quiz
- `/api/health` — unauthenticated container health endpoint

All household and smart-home APIs remain behind the existing Misiek/Miśka PIN session. Cloudflare Access is a separate outer boundary: it decides who can reach the site, while the PIN chooses the active household profile.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`. For plain HTTP development, set:

   ```env
   COOKIE_SECURE=false
   DATABASE_PATH=./data/wariatkowo.db
   MIGRATIONS_PATH=./migrations
   ```

3. Initialize/update the database. Startup does this automatically; it can also be run explicitly:

   ```bash
   npm run db:migrate
   ```

4. Set the two four-digit PINs without committing them:

   PowerShell:

   ```powershell
   $env:WARIATKOWO_MISIEK_PIN='1234'
   $env:WARIATKOWO_MISKA_PIN='5678'
   npm run setup:pins
   Remove-Item Env:WARIATKOWO_MISIEK_PIN,Env:WARIATKOWO_MISKA_PIN
   ```

   Bash:

   ```bash
   WARIATKOWO_MISIEK_PIN=1234 WARIATKOWO_MISKA_PIN=5678 npm run setup:pins
   ```

5. Start the Vite and API development servers together:

   ```bash
   npm run dev
   ```

Vite runs the browser app and proxies relative `/api` requests to `127.0.0.1:3000`. The server rebuilds/restarts when backend TypeScript changes. No production URL is embedded in the browser bundle.

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

3. Review the SQL file. Do not commit it; it contains household data and PIN/session hashes.
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

The importer preserves IDs, foreign-key relationships and existing PIN hashes, verifies the required schema, records the four repository migrations, and prints row counts for household members, tasks and completions, shopping/history, and calendar events. Compare those counts with D1 before switching `DATABASE_PATH`. Log in as both profiles and manually verify recurrence, statistics, shopping history and calendar ranges.

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
HA_URL=http://192.168.0.18:8123
HA_TOKEN=replace-me
HA_TIMEOUT_MS=5000
```

The token is never exposed through a `VITE_` variable or returned to React. The browser can invoke only Wariatkowo's whitelisted routes; there is no arbitrary domain/service/entity proxy.

Configure logical devices with server-side entity IDs:

```env
HA_LIGHT_LIVING_ROOM=light.salon
HA_LIGHT_BEDROOM=light.sypialnia
HA_AC=climate.hisense_ac
HA_TV=media_player.samsung_tv
HA_TV_REMOTE=remote.samsung_tv
HA_XBOX=media_player.xbox
HA_XBOX_REMOTE=remote.xbox
```

Additional lights can be supplied without frontend changes:

```env
HA_LIGHTS_JSON={"kitchen":{"name":"Kuchnia","entityId":"light.kitchen"}}
```

The UI exposes brightness, color, color temperature, climate modes, fan/swing, TV volume/mute/source and remote buttons only when the current entity state advertises those capabilities. State polling happens every four seconds only while `/home` is mounted and refreshes immediately after successful actions.

### TV and Xbox power

Wariatkowo calls the configured HA entity's `turn_on`/`turn_off` service. Configure and test Samsung Wake-on-LAN and Xbox wake/power behavior in Home Assistant first. Do not place MAC addresses or a second Wake-on-LAN implementation in Wariatkowo. If a dedicated HA `remote.*` entity is the working power entity, it is used when no media entity is configured.

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

If HA is offline or misconfigured, tasks, shopping, calendar, quiz, dashboard and login continue to work. `/api/home/status` returns a disconnected normalized snapshot; control calls return a controlled `503` response.

## Docker deployment on Debian

1. Copy the repository to the server.
2. Copy `.env.example` to `.env`, fill the HA/entity values, and keep it readable only by the deployment account.
3. Prepare the bind-mounted directory for the unprivileged container user, then leave `DATABASE_PATH=./data/wariatkowo.db`:

   ```bash
   mkdir -p data
   sudo chown 1000:1000 data
   ```

4. Build and start:

   ```bash
   docker compose build
   docker compose up -d
   docker compose ps
   curl http://127.0.0.1:3000/api/health
   ```

5. Initialize/change PINs if they were not imported:

   ```bash
   docker compose run --rm \
     -e WARIATKOWO_MISIEK_PIN=1234 \
     -e WARIATKOWO_MISKA_PIN=5678 \
     wariatkowo node build/server/setup-pins.js
   ```

6. Confirm persistence by adding a harmless item, running `docker compose restart wariatkowo`, and checking it remains.

The image is a Node 22 Debian multi-stage build. The final stage contains production packages, bundled server tools, the Vite `dist`, and migrations; the database is not stored in an image layer. The service binds `0.0.0.0:3000`, has a healthcheck and restarts unless stopped.

For direct LAN HTTP access set `COOKIE_SECURE=false`. For the HTTPS Cloudflare hostname set `COOKIE_SECURE=true` so the profile session cookie stays secure.

## Cloudflare Tunnel and Access

No Cloudflare account mutation is performed by this repository.

Manual setup:

1. Create a Cloudflare Tunnel in the dashboard.
2. Add a public hostname whose service/origin is `http://wariatkowo:3000` when using the optional Compose service, or the server's reachable port 3000 for an externally managed tunnel.
3. Create a Cloudflare Access self-hosted application for that exact hostname.
4. Configure Google as the Access identity provider.
5. Add an allow policy containing only the exact household email addresses.
6. Add a deny-everyone-else policy and test in a private browser window.

To run the optional Compose tunnel profile, set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`, then:

```bash
docker compose --profile tunnel up -d
```

Without the profile, `cloudflared` is not started. Google OAuth credentials do not belong in React or Node; Cloudflare Access owns public authentication.

## Security notes

- Do not commit `.env`, databases, D1 exports or access tokens.
- API SQL uses parameters; migrations are the only reviewed raw SQL scripts.
- Static serving is limited to `dist`, so `/app/data` is not web-accessible.
- Production errors do not include stack traces or filesystem paths.
- PIN attempts retain the existing five-failures/15-minute throttle.
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

Then manually verify both profiles, tasks CRUD/assignment/recurrence/statistics, shopping/history/shop mode, calendar CRUD, quiz, `/home` polling and every configured HA control. Test React deep links directly and test core features once with Home Assistant stopped.

## Current limitations

- Smart-home state uses four-second polling; no SSE/WebSocket transport is implemented yet.
- Device features depend on attributes exposed by the configured HA integration; unavailable capabilities are hidden.
- TV remote commands use a small server-side allowlist.
- Cloudflare Access identity headers are not used by application authorization; the household PIN remains the inner profile boundary.
