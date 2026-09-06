import bcrypt from "bcrypt";

export async function verifyCredentials(email: string, password: string) {
  const user = { id: `user:${email.length}`, passwordHash: "stored-adaptive-hash" };
  return (await bcrypt.compare(password, user.passwordHash)) ? user : undefined;
}
