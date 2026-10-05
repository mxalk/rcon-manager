# RCON Manager

> Commercial use requires explicit written permission from the Licensor. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Web-based RCON manager built with React, TypeScript, Express, and WebSocket live console streaming.

It is designed for small deployments first:

- no database
- file-backed storage in JSON under the persistent data directory
- JWT authentication
- role-based access control
- live shared console per server
- Docker-ready production deployment

## What it does

- Manage RCON servers from a browser
- Execute RCON commands through [`rcon-client`](https://www.npmjs.com/package/rcon-client)
- Show a shared live console feed to connected users
- Store users, servers, and console history in JSON files
- Support role + access model:
  - `admin`: manage users and servers, run commands
  - `user`: can access only assigned servers and can run commands on those servers

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Express + WebSocket + TypeScript
- Auth: JWT + bcrypt password hashes
- Storage: persistent JSON files
- RCON: `rcon-client`
- Deployment: Docker / Docker Compose

## Project layout

- `client/`: React application
- `server/`: API, websocket console gateway, file storage, RCON execution
- `data/`: persistent application state when mounted or used as the selected data directory
- `compose.yaml`: production container orchestration
- `Dockerfile`: multi-stage production image
- `docs/API.md`: API and websocket behavior
- `docs/DEPLOYMENT.md`: deployment and operations notes

## Local development

Install dependencies:

```bash
npm install
```

Run frontend and backend:

```bash
npm run dev
```

Endpoints:

- frontend: `http://<frontend-host>:<frontend-port>`
- backend: `http://<backend-host>:<backend-port>`

## Production build

Build both workspaces:

```bash
npm run build
```

Start the compiled backend:

```bash
npm run start
```

The backend serves the built frontend from `client/dist`, so production runs as one service.

## First login

If the configured admin user does not exist, the backend bootstraps it on startup:

- username: from `DEFAULT_ADMIN_USERNAME` (default: `admin`)
- password:
  - from `DEFAULT_ADMIN_PASSWORD` if provided, or
  - one-time startup token printed in backend logs (memory-only, not written to disk)

Until you set a new password for that admin account, login is only possible with the configured bootstrap password/token.
The memory-only bootstrap token is invalidated when that admin password is changed.
The configured admin username is reserved and remains role `admin` (cannot be demoted).

## Storage model

This project intentionally uses file-backed persistence instead of a full database.
For the target use case, a few servers and users do not justify the complexity of a separate DB service.
The JSON files in the data directory are the production datastore and must be preserved across upgrades, redeploys, and migrations.

The backend prefers this data directory order:

1. `DATA_DIR`
2. `/data`
3. `../data`
4. `./data`

Files created there:

- `users.json`
- `servers.json`
- `console.jsonl`

If an older `console.json` exists, it is migrated automatically on startup.

Notes:

- passwords for application users are bcrypt-hashed
- RCON server passwords are currently stored as plain text in the server JSON file
- RCON server passwords are never returned to the frontend by API responses
- console history is persisted and capped server-side
- these files are not disposable cache data; they are the canonical persisted state for the application

The user password handling is acceptable for a first version. The RCON secret storage is operational but not strong; if this will be exposed beyond a trusted environment, encrypted-at-rest storage should be the next hardening step.

## Environment variables

Backend runtime variables:

- `PORT`: HTTP port, default `3001`
- `DATA_DIR`: preferred persistent storage path, recommended `/data` in containers
- `JWT_SECRET`: optional explicit JWT signing secret; if omitted, server auto-loads `/data/jwt-secret` or generates+persistent one
- `JWT_EXPIRES_IN`: token lifetime, default `12h`
- `DEFAULT_ADMIN_USERNAME`: reserved/bootstrap admin username, default `admin`
- `DEFAULT_ADMIN_PASSWORD`: optional bootstrap admin password; if omitted, startup token is generated and logged
- `RCON_TIMEOUT_MS`: per-command timeout, default `8000`
- `RCON_IDLE_TIMEOUT_MS`: idle connection cleanup timeout, default `120000`
- `CONSOLE_MAX_LINES`: max persisted console log lines, default `100`
- `MAX_COMMAND_LENGTH`: max accepted command size for HTTP+WS, default `512`
- `WS_MAX_PAYLOAD_BYTES`: websocket payload limit, default `65536`
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`: login attempt cap per IP/window, default `10`
- `LOGIN_RATE_LIMIT_WINDOW_MS`: login attempt window size, default `900000` (15 minutes)
- `LOGIN_RATE_LIMIT_MAX_TRACKED_KEYS`: max in-memory rate-limit buckets before oldest eviction, default `10000`
- `ALLOWED_ORIGINS`: optional comma-separated allowlist for CORS and websocket origin checks
- `TRUST_PROXY`: reverse proxies allowed to set `X-Forwarded-For` (proxy IP/subnet, comma-separated, or a hop count).
  Set it behind a proxy, or every visitor shares the proxy's IP for login rate limiting.

Frontend routing in production:

- API requests use `/api`
- WebSocket console uses `/ws`

For the current Docker setup, the frontend is served by the backend and uses the same host for API + websocket, so one port/domain is enough behind your proxy.

## Docker

Start with Compose:

```bash
cp .env.docker.example .env
docker compose up --build -d
```

Useful commands:

```bash
npm run docker:build
npm run docker:up
npm run docker:down
```

Default published app URL:

- `http://<app-host>:<app-port>`

The compose file binds `./data` to `/data` for persistence. That directory must survive image rebuilds, upgrades, and host migrations.

## Operational notes

- Live console updates are broadcast to all users watching the same server
- RCON connections are reused and cleaned up after inactivity
- Server edits force RCON reconnect for that server
- The app is intended for trusted admin networks unless you add HTTPS, reverse-proxy hardening, and secret management

## Additional docs

- [API docs](docs/API.md)
- [Deployment docs](docs/DEPLOYMENT.md)

## Contributing

Contributions and pull requests are welcome.

- Bug fixes, docs improvements, refactors, and feature proposals are encouraged.
- By submitting a contribution, you agree it is provided under this project's license terms.

## License

This project is source-available under a custom license.

- Non-commercial use is allowed.
- Any direct or indirect monetization requires explicit written permission from the Licensor, including use as part of a monetized service.
- Permission requests should follow [NOTICE](NOTICE).
- Intent: support hobbyists and independent self-hosters like the author, while requiring commercial users to obtain a separate license.

See [LICENSE](LICENSE) for full terms.
