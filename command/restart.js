const { exec, spawn } = require("child_process");

const { sendReportToDev, ensureRole, getCommands } = require('../helpers')

module.exports = async function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)

  if (user.commands['-update']) {
    exec(`git reset --hard && git pull`, (error, stdout, stderr) => {
      if (error) return sendReportToDev(ctx, new Error(error.message))
    });
  }

  process.exit(1);
}