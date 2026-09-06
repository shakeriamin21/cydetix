import * as oauth from "oauth4webapi";

const authorizationServer = {} as oauth.AuthorizationServer;
const client = { client_id: "public-client", token_endpoint_auth_method: "none" } as oauth.Client;
const clientAuthentication = oauth.None();
const redirectUri = "https://client.example/oauth/callback";

export async function beginAuthorization(req: any, res: any) {
  const state = oauth.generateRandomState();
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  req.session.oauthState = state;
  req.session.codeVerifier = codeVerifier;
  const parameters = new URLSearchParams();
  parameters.set("response_type", "code");
  parameters.set("client_id", client.client_id);
  parameters.set("state", state);
  parameters.set("code_challenge", codeChallenge);
  parameters.set("code_challenge_method", "S256");
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
    req.session.codeVerifier,
  );
  return res.status(204).end();
}
