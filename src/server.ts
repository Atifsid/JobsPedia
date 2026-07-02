import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { openDb } from "./db.js";
import { searchJobs, searchRequestSchema } from "./search.js";

const db = openDb();
const app = new Hono();

app.post("/jobs/search", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = searchRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
  }
  return c.json(searchJobs(db, parsed.data));
});

const port = 8080;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[serve] jobspedia listening on http://localhost:${info.port}`);
});
