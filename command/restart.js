const { exec, spawn } = require("child_process");

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = async function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)

  if(user.commands['-update']){
    exec(`git reset --hard && git pull`, (error, stdout, stderr) => {
      if (error) return sendReportToDev(ctx, new Error(error.message))
    });
  }

  process.exit(1);
}