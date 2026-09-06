import session from "express-session";

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  cookie: { httpOnly: false, secure: true },
});
