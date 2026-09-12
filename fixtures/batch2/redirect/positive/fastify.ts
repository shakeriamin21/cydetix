import Fastify from "fastify";

const app = Fastify();

app.get("/continue", function continueRoute(req, reply) {
  return reply.redirect(req.query.next);
});
