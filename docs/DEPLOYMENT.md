# Deployment

This project is designed to run as a single service:

- backend serves the API
- backend serves the built frontend
- persistent data is stored in `/data`
- the JSON files in `/data` are the primary production datastore

There is intentionally no separate database service here. The expected scale is small enough that persistent file-backed storage is the simpler and more defensible deployment model.

## Recommended deployment path

Use Docker Compose.

### 1. Prepare environment

Create an environment file:

```bash
cp .env.docker.example .env
```

At minimum, change:

- `DEFAULT_ADMIN_PASSWORD` (recommended, otherwise a startup token is generated and logged once)
- `ALLOWED_ORIGINS` (recommended in production; comma-separated trusted origins)
- `LOGIN_RATE_LIMIT_MAX_TRACKED_KEYS` (optional hard cap for in-memory login limiter buckets; defaults to `10000`)

### 2. Start the service

```bash
docker compose up --build -d
```

### 3. Check logs

```bash
docker compose logs -f
```

### 4. Stop the service

```bash
docker compose down
```

## Persistence

The compose setup mounts:

```text
./data -> /data
```

That directory contains:

- `users.json`
- `servers.json`
- `console.jsonl`

If an older `console.json` exists, startup migrates it to `console.jsonl` automatically.

Back it up like application state, because it is the application state.
If you replace the container image, move hosts, or upgrade the stack, this directory must move with it.

## Container behavior

The runtime container:

- listens on port `3001`
- runs as the `node` user
- uses `NODE_ENV=production`
- stores state in `/data`
- exposes a healthcheck through `/api/health`

## Reverse proxy recommendation

For anything beyond local LAN testing, run the app behind a reverse proxy such as Nginx, Caddy, or Traefik and add:

- HTTPS
- auth-aware access control at the edge if needed
- request logging
- IP filtering if the admin surface is private

WebSocket upgrade support must be enabled because the live console uses `/ws`.
The app and websocket are intended to share the same domain (for example `https://rcon.example.com` with websocket at `wss://rcon.example.com/ws`).
HTTP API traffic should be routed on the same domain under `/api`.

## Security notes

Current strengths:

- app user passwords are bcrypt-hashed
- JWT auth is enforced on API and websocket console access
- role checks are enforced server-side
- login route has per-IP rate limiting
- persisted data files are created with restrictive permissions
- websocket auth can use subprotocol token transport (avoids query token in URL logs)

Current limits:

- RCON server passwords are stored in plain text in the JSON data store
- there is no audit log beyond console history
- the built-in rate limiting only covers login (not all API routes)
- there is no CSRF strategy because auth is bearer-token based, but you still should avoid exposing the app broadly without a proxy and TLS

For a harder production target, the next improvements should be:

1. encrypt stored RCON credentials
2. put the app behind HTTPS
3. expand rate limiting and request logging coverage
4. rotate bootstrap defaults out of the environment
5. only move to a separate datastore if concurrency, scale, or operational requirements actually justify it

## Manual non-Docker deployment

Build:

```bash
npm install
npm run build
```

Run:

```bash
PORT=3001 DATA_DIR=/data npm run start
```

If `JWT_SECRET` is not set, the app will use `/data/jwt-secret` when available, or generate and persist one automatically.

The backend serves the built frontend automatically when `client/dist` exists.
