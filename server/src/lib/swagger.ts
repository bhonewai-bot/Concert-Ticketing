import swaggerJsdoc from "swagger-jsdoc";
import path from "node:path";

// In production (Docker), controllers are compiled JS in dist/.
// In development, they are TS files in src/.
const controllersPath =
  process.env.NODE_ENV === "production"
    ? path.join(__dirname, "../controllers/*.js")
    : path.join(__dirname, "../controllers/*.ts");

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Concert Ticketing API",
      version: "1.0.0",
      description: "",
    },
    servers: [
      {
        url: "/api/v1",
        description: "API v1",
      },
    ],
    components: {
      schemas: {
        // ── Request Bodies ──────────────────────────────────────────────────
        ReserveBody: {
          type: "object",
          required: ["concertId", "userId"],
          additionalProperties: false,
          properties: {
            concertId: { type: "string", example: "concert-02" },
            userId: { type: "string", example: "user-1" },
            category: {
              type: "string",
              enum: ["VIP", "General"],
              default: "General",
            },
            simulateFailure: { type: "boolean", default: false },
          },
        },
        ReserveLockBody: {
          type: "object",
          required: ["concertId", "userId"],
          additionalProperties: false,
          properties: {
            concertId: { type: "string", example: "concert-02" },
            userId: { type: "string", example: "user-1" },
            category: {
              type: "string",
              enum: ["VIP", "General"],
              default: "General",
            },
          },
        },
        PurchaseBody: {
          type: "object",
          required: ["reservationId"],
          additionalProperties: false,
          properties: {
            reservationId: {
              type: "string",
              example: "e5386143-e8fd-4663-a649-41b06e74e538",
            },
          },
        },
        CreateTicketsBody: {
          type: "object",
          required: ["concertId", "quantity"],
          additionalProperties: false,
          properties: {
            concertId: { type: "string", example: "concert-02" },
            category: {
              type: "string",
              enum: ["VIP", "General"],
              default: "General",
            },
            quantity: {
              type: "integer",
              minimum: 1,
              maximum: 5,
              example: 2,
            },
          },
        },
        // ── Response DTOs ───────────────────────────────────────────────────
        TicketDTO: {
          type: "object",
          properties: {
            id: { type: "string" },
            concertId: { type: "string" },
            category: { type: "string", enum: ["VIP", "General"] },
            status: {
              type: "string",
              enum: ["AVAILABLE", "HELD", "SOLD"],
            },
            reservationId: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ReservationDTO: {
          type: "object",
          properties: {
            reservationId: { type: "string" },
            ticketId: { type: "string" },
            expiresAt: { type: "string", format: "date-time" },
          },
        },
        ReservationWithMethodDTO: {
          allOf: [
            { $ref: "#/components/schemas/ReservationDTO" },
            {
              type: "object",
              properties: {
                method: {
                  type: "string",
                  enum: ["optimistic", "pessimistic"],
                },
              },
            },
          ],
        },
        // ── Error Responses ─────────────────────────────────────────────────
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "conflict" },
            message: { type: "string", example: "No tickets available" },
            ref: {
              type: "string",
              example: "a7b2899d-af46-4af2-babb-7e0a92e138c5",
            },
          },
        },
        LockConflictResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "lock_conflict" },
            message: {
              type: "string",
              example:
                "Ticket was modified by another request. Please try again.",
            },
            ref: { type: "string" },
          },
        },
      },
    },
  },
  apis: [controllersPath],
};

export const swaggerSpec = swaggerJsdoc(options);
