import Fastify from "fastify";

const app = Fastify();

app.get("/preview", function preview(req, reply) {
  reply.type("text/html");
  return reply.send(`<p>${req.query.message}</p>`);
});
