export function unrelatedState(req: any, res: any) {
  const state = "draft";
  const token = "pagination-cursor";
  const session = { theme: "dark" };
  return res.json({ state, token, session, subject: req.auth.sub });
}
