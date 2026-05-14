# Concert Ticketing — Server

REST API for a high-demand concert ticketing platform built with Node.js, TypeScript, Express, TypeORM, and SQLite.

---

## Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **ORM:** TypeORM (`synchronize: false`)
- **Database:** SQLite via `better-sqlite3`
- **Validation:** Zod

---

## Getting Started

```bash
pnpm install
pnpm dev
```

Seed demo data:

```bash
pnpm seed
```

Run tests:

```bash
pnpm test
```

---

## API Endpoints

| Method | Path            | Description                                 |
| ------ | --------------- | ------------------------------------------- |
| GET    | `/concerts`     | List all concerts with available stock      |
| GET    | `/concerts/:id` | Get a single concert                        |
| POST   | `/reserve`      | Reserve a ticket for 5 minutes              |
| POST   | `/purchase`     | Confirm a pending reservation               |
| POST   | `/cleanup`      | Expire stale reservations and restore stock |

### POST `/reserve`

```json
{
  "concertId": "concert-01",
  "userId": "user-123",
  "category": "VIP"
}
```

### POST `/purchase`

```json
{
  "reservationId": "<uuid>"
}
```

---

## Migrations

Migrations are written by hand and run automatically on server start.

```
src/migrations/
├── 1700000000000-CreateSchema.ts      ← concerts, tickets, reservations + indexes
└── 1700000001000-AddTicketCategory.ts ← adds category column + composite index
```

To revert:

```bash
pnpm migration:revert
```

---

## How the Double-Selling Problem is Solved

Two concurrent `POST /reserve` requests for the last ticket could both read `availableStock = 1` before either writes — this is a classic read-then-write race condition.

**Solution: `BEGIN IMMEDIATE`**

TypeORM's default `startTransaction()` issues `BEGIN DEFERRED`, which only acquires a write lock when the first write happens. Under concurrent load, two requests can both enter the deferred transaction and both read stock > 0 before either writes.

We replace this with `BEGIN IMMEDIATE`, which acquires the write lock at transaction start. The second concurrent request is blocked at the door and waits — it cannot even begin reading until the first transaction commits or rolls back.

This is implemented in `createImmediateQueryRunner()` in `data-source.ts`, which is called at the start of every write flow. TypeORM's `commitTransaction()` and `rollbackTransaction()` are then used for the actual commit/rollback so the ORM tracks state correctly.

**Rollback proof:**

The `reserve` endpoint accepts a `simulateFailure` flag. When set to `true`, it throws after decrementing `availableStock` but before saving the reservation. The rollback restores stock atomically — verified in `test/reservation.test.ts`:

```
✓ rolls stock back when failure occurs mid-transaction
```

---

## Why These Indexes Were Chosen

### B-Tree index on `tickets.concert_id`

Every seat query filters by concert. Without this index, SQLite scans every row in the tickets table regardless of concert. With it, it jumps directly to the matching block. This is the most frequently hit query path.

### Composite index on `tickets(concert_id, category, status)`

The reserve query filters on all three columns simultaneously. A composite index serves this exact query pattern without a table scan. Column order is intentional: `concert_id` is the most selective filter, followed by `category`, then `status`.

### Partial index on `reservations(expires_at) WHERE status = 'PENDING'`

The cleanup job only ever reads and updates `PENDING` rows. A standard index on `status` would include every `COMPLETED` and `EXPIRED` row — potentially millions of records that cleanup never touches. A partial index only indexes rows matching the `WHERE` clause, so at any given moment the index contains only the small set of active pending reservations.

**Result:** smaller index, fits in memory, faster range scan on `expires_at`, and cheaper to maintain on every write. Verified with `EXPLAIN QUERY PLAN` — see the index proof test in `test/reservation.test.ts`.

---

## How AI Helped and Where It Had Limits

AI (Claude) was used throughout this project for boilerplate generation, debugging error messages, and explaining TypeORM internals.

**Where it helped:**

- Scaffolding the project structure and entity definitions quickly
- Explaining the `tsx`/`esbuild` decorator metadata limitation (why `emitDecoratorMetadata` doesn't work with `tsx`) and suggesting the fix of adding explicit `type:` to all `@Column()` decorators
- Identifying that TypeORM's default `startTransaction()` uses `BEGIN DEFERRED` and suggesting `BEGIN IMMEDIATE` as the correct fix for the concurrency problem
- Debugging the "cannot start a transaction within a transaction" error caused by issuing raw `BEGIN IMMEDIATE` without setting TypeORM's internal `isTransactionActive` flag

**Where it had limits:**

- AI initially missed that `tsx` uses esbuild and doesn't emit decorator metadata — this caused a runtime crash that required manual diagnosis
- The `ROLLBACK` secondary crash (when `BEGIN IMMEDIATE` itself failed) was not caught in the first AI suggestion — required an additional iteration
- AI cannot verify that the architecture decisions are correct for your specific use case — every suggestion had to be manually understood and verified before applying
