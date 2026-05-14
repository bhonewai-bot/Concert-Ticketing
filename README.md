# Concert Ticketing

A high-demand concert ticketing platform built as a learning project focused on ACID transactions, database indexing, and concurrency control.

---

## Project Structure

```
Concert Ticketing/
└── server/     ← REST API (Node.js, Express, TypeORM, SQLite)
```

> Client app is not implemented yet.

---

## Server

See [`server/README.md`](./server/README.md) for full API documentation, setup instructions, and technical decisions.

**Quick start:**

```bash
cd server
pnpm install
pnpm dev
```

---

## Key Learning Goals

- **ACID transactions** — using `queryRunner` with `BEGIN IMMEDIATE` to prevent double-selling under concurrent load
- **Database indexing** — B-Tree indexes for query performance, partial indexes for write-heavy cleanup jobs
- **Schema migrations** — hand-written TypeORM migrations with `synchronize: false`
- **Rollback proof** — automated tests that verify stock is fully restored when a reservation fails mid-transaction
