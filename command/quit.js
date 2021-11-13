const { logReport } = require('../helpers')

module.exports = function (ctx) {
  return ctx.telegram.leaveChat(ctx.message.chat.id).then().catch((err) => logReport(ctx, `Meninggalkan BOT`, 'Info'))
}