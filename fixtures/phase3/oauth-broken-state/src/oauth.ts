import * as oauth from "oauth4webapi";

const authorizationServer = {} as oauth.AuthorizationServer;
const client = {
  client_id: "confidential-client",
  client_secret: process.env.OAUTH_CLIENT_SECRET,
} as oauth.Client;
const clientAuthentication = oauth.ClientSecretPost(process.env.OAUTH_CLIENT_SECRET!);
const redirectUri = "https://client.example/oauth/callback";

export function beginAuthorization(_req: any, res: any) {
  const state = oauth.generateRandomState();
  const parameters = new URLSearchParams();
  parameters.set("response_type", "code");
  parameters.set("client_id", client.client_id);
  parameters.set("state", state);
  return res.redirect(`https://issuer.example/authorize?${parameters.toString()}`);
}

export async function authorizationCallback(req: any, res: any) {
  const parameters = oauth.validateAuthResponse(
    authorizationServer,
    client,
    new URL(req.originalUrl, "https://client.example"),
    oauth.skipStateCheck,
  );
  await oauth.authorizationCodeGrantRequest(
    authorizationServer,
    client,
    clientAuthentication,
    parameters,
    redirectUri,
  );
  return res.status(204).end();
}
