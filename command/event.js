const setEvent = require('../helpers/setEvent');

const { ensureRole, getCommands } = require('../helpers')

module.exports = function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)
  return setEvent(ctx)
}