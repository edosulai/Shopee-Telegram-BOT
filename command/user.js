const User = require('../models/User');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = async function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session;
  user.commands = getCommands(ctx.message.text)

  if (objectSize(user.commands) < 1) {
    return User.find({ teleBotId: process.env.BOT_ID }, function (err, users) {
      if (err) return sendReportToDev(ctx, new Error(err))
      let alluser = ``
      for (let user of users) {
        let theUser = JSON.parse(JSON.stringify(user)).teleChatData
        alluser += `\n`
        for (const key in theUser) { if (Object.hasOwnProperty.call(theUser, key)) { alluser += `<code>${key}: ${theUser[key]}, </code>` } }
      }
      return ctx.reply(alluser, { parse_mode: 'HTML' })
    })
  }

  if (user.commands.id) {
    
    await User.updateOne({
      teleBotId: process.env.BOT_ID,
      teleChatId: parseInt(user.commands.id)
    }, {
      ...(user.commands.userRole ? { userRole: user.commands.userRole } : null)
    }).exec()

    return User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: user.commands.id }, async function (err, newUser) {
      if (err) return sendReportToDev(ctx, new Error(err))
      return ctx.reply(`<code>${newUser}</code>`, { parse_mode: 'HTML' })
    })
  }
}