import bcrypt from "bcrypt";

export async function verifyCredentials(email: string, password: string) {
  const user = await loadUser(email);
  return (await bcrypt.compare(password, user.passwordHash)) ? user : undefined;
}

async function loadUser(email: string) {
  return { id: `user:${email.length}`, passwordHash: "stored-adaptive-hash" };
}
