const fs = require('fs');

const Log = require('../models/Log');

const { ensureRole, getCommands, objectSize, parseShopeeUrl, sendMessage, logReport } = require('../helpers')

module.exports = function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session;
  user.commands = getCommands(ctx.message.text)
  if (objectSize(user.commands) < 1) return ctx.reply(`/log <code>url=...</code>`, { parse_mode: 'HTML' })

  if (user.commands.url) {
    let { itemid, shopid, err } = parseShopeeUrl(user.commands.url)
    if (err) return sendMessage(ctx, err)
    user.itemid = itemid
    user.shopid = shopid
  }

  if (user.commands['-clear']) {
    return Log.deleteMany(user.itemid ? { teleBotId: process.env.BOT_ID, itemid: user.itemid, shopid: user.shopid } : { teleBotId: process.env.BOT_ID })
      .then((result) => {
        return ctx.reply(`${result.deletedCount} Log Telah Terhapus`)
      }).catch((err) => logReport(ctx, new Error(err)));
  }

  return Log.findOne({ teleBotId: process.env.BOT_ID, itemid: user.itemid, shopid: user.shopid }, async function (err, log) {
    if (err || !log) return ctx.reply('Log Untuk Produk Ini Tidak Tersedia!!')
    fs.writeFileSync(`log-${user.itemid}.json`, JSON.stringify(log));
    await ctx.telegram.sendDocument(ctx.message.chat.id, { source: `./log-${user.itemid}.json` }).catch((err) => console.error(chalk.red(err)))
    return fs.unlinkSync(`./log-${user.itemid}.json`);
  })
}