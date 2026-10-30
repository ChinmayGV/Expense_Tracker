import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH ??= resolve(serverDirectory, "data/cypress.sqlite");
await import("./start.js");
