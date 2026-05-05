import { AppDataSource, initialzeDataSource } from "./config/data-source";
import { Concert } from "./entities/Concert";
import { Reservation } from "./entities/Reservation";
import { Ticket } from "./entities/Ticket";

async function seed() {
  // INITIALIZE DATABASE
  await initialzeDataSource();

  // INITIALIZE REPOSITORIES
  const concertRepo = await AppDataSource.getRepository(Concert);
  const ticketRepo = await AppDataSource.getRepository(Ticket);
  const reservationRepo = await AppDataSource.getRepository(Reservation);

  // CLEAR EXISTING DATA
  await reservationRepo.clear();
  await ticketRepo.clear();
  await concertRepo.clear();

  // CONCERT DEFINITIONS
  const concerts = [
    {
      id: "concert-01",
      title: "Midnight Pulse",
      venue: "North Pier Arena",
      vip: 10,
      general: 50,
    },
    {
      id: "concert-02",
      title: "Velvet Circuit",
      venue: "Metro Hall",
      vip: 6,
      general: 30,
    },
  ];

  for (const c of concerts) {
    const total = c.vip + c.general;

    // SEED CONCERT
    await concertRepo.save({
      id: c.id,
      title: c.title,
      venue: c.venue,
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      totalStock: total,
      availableStock: total,
      createdAt: new Date(),
    });

    // BUILD TICKET LIST
    const tickets = [
      ...Array.from({ length: c.vip }, (_, i) => ({
        id: `${c.id}-VIP-${String(i + 1).padStart(3, "0")}`,
        concertId: c.id,
        category: "VIP" as const,
        status: "AVAILABLE" as const,
        reservationId: null,
        createdAt: new Date(),
      })),
      ...Array.from({ length: c.general }, (_, i) => ({
        id: `${c.id}-GEN-${String(i + 1).padStart(3, "0")}`,
        concertId: c.id,
        category: "General" as const,
        status: "AVAILABLE" as const,
        reservationId: null,
        createdAt: new Date(),
      })),
    ];

    // SEED TICKETS
    await ticketRepo.save(tickets);
  }

  console.log("Seeded successfully.");
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
