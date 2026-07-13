# identify-service

An identity reconciliation service for Zamazon.com. Given an `email` and/or
`phoneNumber`, it links contacts that belong to the same customer even when
they used different contact details across orders.

## How it works

- A `Contact` is either `primary` (the "root" identity) or `secondary`
  (linked to a primary via `linkedId`).
- **New email+phone combo** → creates a new `primary` contact.
- **Request shares one field with an existing contact but introduces a new
  value for the other** → creates a `secondary` contact linked to that
  contact's primary.
- **Request bridges two previously separate primaries** (e.g. email belongs
  to Primary A, phone belongs to Primary B) → the **older** primary stays
  primary; the newer one (and everyone already linked to it) is demoted to
  `secondary` under the older one.
- The response always aggregates the full cluster: all known emails, phone
  numbers, and secondary contact IDs under the primary.

## Project structure

```
src/
  app.js                   Express app + middleware wiring
  server.js                Entry point
  routes/identify.js        POST /identify route
  controllers/              Request/response glue
  services/identifyService.js  All core reconciliation logic
  middleware/errorHandler.js   Centralized error handling
  db/prismaClient.js        Shared Prisma client
prisma/schema.prisma        Contact model + indexes
tests/                       Jest unit tests (in-memory fake DB, no real Postgres needed)
```

## Running locally with Docker (recommended)

Requires Docker + Docker Compose.

```bash
docker compose up --build
```

This starts Postgres and the app together. On first run, apply the schema:

```bash
docker compose exec app npx prisma migrate deploy
```

The API is now live at `http://localhost:3000`.

## Running locally without Docker

Requires Node.js 20+ and a running PostgreSQL instance.

```bash
npm install
cp .env.example .env        # edit DATABASE_URL to point at your Postgres
npm run prisma:migrate      # creates the Contact table
npm run dev                 # starts on http://localhost:3000
```

## API

### `POST /identify`

**Request body:**
```json
{
  "email": "doc@time.com",
  "phoneNumber": "123456"
}
```
Either field may be omitted, but at least one must be present.

**Response — `200 OK`:**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["doc@time.com", "doc.alt@time.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

**Response — `400 Bad Request`** (missing both fields):
```json
{ "error": "At least one of \"email\" or \"phoneNumber\" is required." }
```

### `GET /health`
Returns `200 { "status": "ok" }`. Used by Docker's `HEALTHCHECK` and would
back Kubernetes liveness/readiness probes.

### Try it with curl

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"doc@time.com","phoneNumber":"123456"}'
```

## Testing

```bash
npm test
```

Tests run against an in-memory fake of the Prisma client (see
`tests/fakePrismaClient.js`), so no live database is needed to validate the
reconciliation logic. Covers: new contact creation, secondary creation,
duplicate-request idempotency, primary/primary merging, and email-only /
phone-only requests.

## Design notes / bonus points addressed

- **Indexes** on `email`, `phoneNumber`, and `linkedId` (see `schema.prisma`)
  so lookups stay fast as the table grows.
- **Error handling**: expected errors (bad input) return a clear message;
  anything unexpected returns a generic message to the client (no stack
  traces or internal details leaked) while the real error is logged
  server-side.
- **Non-root Docker user**, multi-stage build, and a built-in `HEALTHCHECK`.
- **Edge cases handled**: email-only requests, phone-only requests, exact
  duplicate requests (no redundant secondary created), and multi-primary
  merges.

## Environment variables

| Variable       | Description                          |
|----------------|---------------------------------------|
| `PORT`         | Port the server listens on (default 3000) |
| `DATABASE_URL` | PostgreSQL connection string          |
| `NODE_ENV`     | `development` or `production`         |
