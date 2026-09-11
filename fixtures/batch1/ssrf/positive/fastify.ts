import Fastify from "fastify";
import axios from "axios";

const app = Fastify();
app.get("/proxy", async (request) => axios.get(request.query.url));
