import { closeDatabase, connectDatabase, ensureIndexes } from "./database";
import { seedIfEmpty } from "./database/seed";
import { createAppServer } from "./server";

const port = Number(process.env.PORT) || 4000;

async function shutdown(
  server: ReturnType<typeof createAppServer>,
): Promise<void> {
  server.close();
  await closeDatabase();
  process.exit(0);
}

async function main(): Promise<void> {
  await connectDatabase();
  await ensureIndexes();
  const seeded = await seedIfEmpty();
  const server = createAppServer();

  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);

    if (seeded) {
      console.log("Seeded facilities, demo users, and TAP records.");
    }
  });

  process.on("SIGINT", () => {
    void shutdown(server);
  });
  process.on("SIGTERM", () => {
    void shutdown(server);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
