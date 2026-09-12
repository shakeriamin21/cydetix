import Fastify from "fastify";

const app = Fastify();

app.get("/echo", function echo(req, reply) {
  return reply.send(String(req.query.message));
});
