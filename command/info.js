const User = require('../models/User');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = function (ctx) {
  if (!ensureRole(ctx)) return
  let commands = splitAtFirstSpace(ctx.message.text)
  if (commands.length < 2) return ctx.reply(`/info <code>...message...</code>`, { parse_mode: 'HTML' })
  let msg = commands[1].replace(/(<([^>]+)>)/gi, "")
  return User.find(async function (err, users) {
    if (err) return sendReportToDev(ctx, new Error(err))
    for (let user of users) {
      await ctx.reply(`<i>Info</i> : ${msg}`, { chat_id: JSON.parse(JSON.stringify(user)).teleChatData.id, parse_mode: 'HTML' })
    }
  })
}