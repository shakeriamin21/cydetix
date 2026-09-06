import * as oauth from "oauth4webapi";

const authorizationServer = {} as oauth.AuthorizationServer;
const client = { client_id: "public-client", token_endpoint_auth_method: "none" } as oauth.Client;
const clientAuthentication = oauth.None();
const redirectUri = "https://client.example/oauth/callback";

export function beginAuthorization(req: any, res: any) {
  const state = oauth.generateRandomState();
  req.session.oauthState = state;
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
    req.session.oauthState,
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
