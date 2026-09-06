export function account(req: any, res: any) {
  return res.json({ subject: req.auth.sub });
}
