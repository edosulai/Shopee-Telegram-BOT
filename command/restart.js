const { exec, spawn } = require("child_process");

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = async function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)

  exec(`${user.commands['-update'] ? 'git pull && ' : ''}touch index.js`, (error, stdout, stderr) => {
    if (error) return sendReportToDev(ctx, new Error(error.message))
    return ctx.reply(`Restart ${user.commands['-update'] ? 'dan Update Code ' : ''}Server Telah Berhasil`)
  });
}