(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = function (ctx) {
  return ctx.telegram.leaveChat(ctx.message.chat.id).then().catch((err) => sendReportToDev(ctx, `Meninggalkan BOT`, 'Info'))
}