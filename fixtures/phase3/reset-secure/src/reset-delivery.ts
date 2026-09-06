export async function queueResetDelivery(userId: string, resetToken: string): Promise<void> {
  await Promise.resolve({ recipient: userId, credentialLength: resetToken.length });
}
