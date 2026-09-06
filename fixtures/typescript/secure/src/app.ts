import argon2 from "argon2";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";

const app = express();
const trustedOrigins = ["https://app.example.test"];

function listUntrustedClaimNames(token: string): string[] {
  const untrustedClaims = jwt.decode(token);
  return typeof untrustedClaims === "object" && untrustedClaims !== null
    ? Object.keys(untrustedClaims)
    : [];
}

app.use(cors({ origin: trustedOrigins, credentials: true }));

app.post("/login", async (request, response) => {
  const password = String(request.body.password);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const token = String(request.body.token);
  const claims = jwt.verify(token, process.env.JWT_PUBLIC_KEY ?? "", {
    algorithms: ["RS256"],
    issuer: "https://issuer.example.test",
    audience: "secure-fixture",
  });
  response.setHeader("X-Untrusted-Claim-Count", String(listUntrustedClaimNames(token).length));
  response.cookie("session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });
  response.json({ passwordHash, claims });
});
