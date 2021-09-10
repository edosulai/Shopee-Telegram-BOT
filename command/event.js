const setEvent = require('../helpers/setEvent');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)
  return setEvent(ctx)
}