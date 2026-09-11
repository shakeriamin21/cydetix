import Fastify from "fastify";
import { exec } from "node:child_process";

const app = Fastify();
app.get("/lookup", async (request) => exec("nslookup " + request.query.host));
