const { splitAtFirstSpace, logReport } = require('../helpers')

module.exports = function (ctx) {
  let commands = splitAtFirstSpace(ctx.message.text)
  if (commands.length < 2) return ctx.reply(`/help <code>...message...</code>`, { parse_mode: 'HTML' })
  return logReport(ctx, commands[1].replace(/(<([^>]+)>)/gi, ""), 'Help');
}