import Fastify from "fastify";
import { readFile } from "node:fs/promises";

const app = Fastify();
app.get("/files", async (request) => readFile("uploads/" + request.query.path, "utf8"));
