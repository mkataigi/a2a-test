import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { agentCard } from "./agentCard.js";
import { taskApp } from "./task.js";
const app = new Hono();
app.get("/.well-known/agent.json", (c) => {
  return c.json(agentCard);
});
app.route("/", taskApp);

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
