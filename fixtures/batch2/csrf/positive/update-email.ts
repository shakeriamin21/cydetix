export function updateEmail(req, res) {
  req.session.email = req.body.email;
  return res.json({ updated: true });
}
