# API

This document describes the current HTTP API and websocket protocol for the RCON Manager backend.

Base URL in local development:

- `http://<backend-host>:<backend-port>`

Authentication:

- Use `Authorization: Bearer <token>`
- Obtain the token from `POST /api/auth/login`

## Health

`GET /api/health`

Returns basic process health:

```json
{
  "ok": true,
  "at": "2026-03-09T12:00:00.000Z"
}
```

## Auth

`POST /api/auth/login`

Note:

- if `DEFAULT_ADMIN_PASSWORD` is set, the configured admin account is bootstrapped with that password
- otherwise, a one-time startup token is printed in backend logs (memory-only)

Request:

```json
{
  "username": "admin",
  "password": "sha256:<client-side-password-digest>"
}
```

Response:

```json
{
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "username": "admin",
    "role": "admin",
    "createdAt": "2026-03-09T12:00:00.000Z",
    "updatedAt": "2026-03-09T12:00:00.000Z"
  }
}
```

`GET /api/auth/me`

Returns the authenticated user.

## Servers

`GET /api/servers`

- all roles receive server records without the RCON password

`POST /api/servers`

- role required: `admin`

Request:

```json
{
  "name": "Minecraft Main",
  "host": "192.168.1.10",
  "port": 25575,
  "password": "rcon-secret"
}
```

`PUT /api/servers/:id`

- role required: `admin`
- supports partial updates
- request may include `password`, but responses never include it

`DELETE /api/servers/:id`

- role required: `admin`

`GET /api/servers/:id/history?limit=250`

- returns persisted console entries for a server

`POST /api/servers/:id/command`

- roles allowed: `admin`, or `user` with access to that server

Request:

```json
{
  "command": "list"
}
```

Response:

```json
{
  "entry": {
    "id": "entry-id",
    "serverId": "server-id",
    "userId": "user-id",
    "username": "admin",
    "command": "list",
    "response": "Players online: 0",
    "status": "ok",
    "timestamp": "2026-03-09T12:00:00.000Z"
  }
}
```

On command failure the API returns `500` with:

- `error`
- `entry.status = "error"`
- `entry.error`

## Users

All user-management routes require role `admin` unless stated otherwise.

`GET /api/users`

Returns all users without password hashes.

`POST /api/users`

Note:

- the configured reserved admin username is protected and must always have role `admin`

Request:

```json
{
  "username": "user1",
  "password": "sha256:<client-side-password-digest>",
  "role": "user"
}
```

`PUT /api/users/:id`

Supports:

- `username`
- `role`
- rejects changing your own `admin` account role
- rejects demoting the last remaining `admin` user
- rejects renaming the configured reserved admin username
- rejects demoting the configured reserved admin username

`PUT /api/users/:id/password`

Allowed for:

- `admin`
- the user updating their own password
- for the configured reserved admin username, only that same account can change its password

Request:

```json
{
  "password": "sha256:<client-side-password-digest>"
}
```

`DELETE /api/users/:id`

- cannot delete the currently logged-in admin user issuing the request
- cannot delete the last remaining `admin` user
- cannot delete the configured reserved admin username

## Admin maintenance

`GET /api/admin/cleanup-artifacts`

- role required: `admin`
- returns:
  - `files`: matching `.bk` and `.migrated` files in data directory
  - `count`: file count

`POST /api/admin/cleanup-artifacts`

- role required: `admin`
- deletes files in the data directory ending with `.bk` or `.migrated`
- returns:
  - `deleted`: list of deleted filenames
  - `count`: deleted file count

## WebSocket console

Connect to:

```text
ws://<backend-host>:<backend-port>/ws?serverId=<server-id>
```

Send auth token in websocket subprotocols:

- `rcon-manager.v1`
- `auth.<jwt>`
- query-string auth tokens are not accepted

Example (browser):

```ts
new WebSocket("ws://<backend-host>:<backend-port>/ws?serverId=<server-id>", ["rcon-manager.v1", "auth.<jwt>"]);
```

The server rejects the connection if:

- token is missing or invalid
- `serverId` is missing
- the server record does not exist

### Client messages

`ping`

```json
{
  "type": "ping"
}
```

`history`

```json
{
  "type": "history",
  "limit": 250
}
```

`command`

```json
{
  "type": "command",
  "command": "list"
}
```

### Server messages

`ready`

```json
{
  "type": "ready",
  "serverId": "server-id",
  "user": {
    "id": "user-id",
    "username": "admin",
    "role": "admin"
  },
  "canRunCommands": true
}
```

`history`

```json
{
  "type": "history",
  "serverId": "server-id",
  "entries": []
}
```

`entry`

Broadcast whenever a command is executed for the active server channel:

```json
{
  "type": "entry",
  "serverId": "server-id",
  "entry": {
    "id": "entry-id",
    "serverId": "server-id",
    "userId": "user-id",
    "username": "admin",
    "command": "list",
    "response": "Players online: 0",
    "status": "ok",
    "timestamp": "2026-03-09T12:00:00.000Z"
  }
}
```

`error`

Sent for invalid payloads, unauthorized commands, missing servers, or command validation failures.
