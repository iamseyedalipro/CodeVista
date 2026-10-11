import { registerSnapshots } from "./snapshots.js";
import { configFromEnv } from "./config.js";
import { createApp } from "./app.js";

const config = configFromEnv();
const service = await createApp(config);
registerSnapshots(service);
const { app } = service;
await app.listen({
  host: process.env.LISTEN_HOST ?? "127.0.0.1",
  port: config.port,
});
console.log(
  `CodeVista is listening on port ${config.port}. GitHub integration ${config.githubClientId ? "configured" : "not configured; public demo available"}.`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
