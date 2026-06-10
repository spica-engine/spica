// Minimal http-triggered handler. The e2e only needs this to be a valid,
// uploadable function body — it asserts the schema + index land on the instance,
// not that the trigger is invoked.
export function seed(req, res) {
  return res.send({seeded: true});
}
