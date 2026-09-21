import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as schema from "../src/db/schema";

async function main() {
  const db = drizzle(new Database("./data/windsurf.db"), { schema });
  const [u] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.username, "tom"))
    .limit(1);
  if (!u) {
    console.log("no user");
    return;
  }
  const existing = await db
    .select()
    .from(schema.eventType)
    .where(eq(schema.eventType.hostId, u.id));
  if (existing.length) {
    console.log("already has events", existing.map((e) => e.slug));
    return;
  }
  await db.insert(schema.eventType).values({
    id: nanoid(),
    hostId: u.id,
    title: "Dog walking",
    slug: "dog-walking",
    description: "30-minute neighborhood walk",
    durationMinutes: 30,
    pricingMode: "free",
    active: true,
  });
  console.log("created dog-walking");
}

main();
