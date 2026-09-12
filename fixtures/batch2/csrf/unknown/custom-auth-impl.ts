export function requireCompanyAuth(req, res, next) {
  if (!isAuthenticatedByGateway(req)) return res.sendStatus(401);
  next();
}
