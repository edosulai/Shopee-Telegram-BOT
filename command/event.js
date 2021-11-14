const InfoBarang = require('../request/buy/InfoBarang');

const Event = require('../models/Event');

const { ensureRole, getCommands, logReport, parseShopeeUrl, sendMessage } = require('../helpers')

module.exports = function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)

  if (user.commands['-clear']) {
    return Event.deleteMany({ teleBotId: process.env.BOT_ID }).exec(function () {
      if (!user.commands['-silent']) return sendMessage(ctx, `List Event Products Berhasil Di Hapus`)
    })
  }

  if (user.commands.url && user.commands.price) {
    let { itemid, shopid, err } = parseShopeeUrl(user.commands.url)
    if (err) return sendMessage(ctx, err)
    user.itemid = itemid
    user.shopid = shopid

    await InfoBarang({
      Curl: user.Curl,
      config: {
        url: user.commands.url,
        itemid: user.itemid,
        shopid: user.shopid,
      }
    }).then(async ({ statusCode, data, headers }) => {
      let chunk = typeof data == 'string' ? JSON.parse(data) : data;
      if (chunk.error == null) user.infoBarang = chunk;
    }).catch((err) => err)

    if (!user.infoBarang) return

    await Event.findOrCreate({
      teleBotId: process.env.BOT_ID,
      itemid: user.itemid,
      shopid: user.shopid
    }, {
      barang: user.infoBarang.item.name.replace(/<[^>]*>?/gm, ""),
      url: user.commands.url,
      price: user.commands.price
    }, async function (err, event, created) {
      if (err) return logReport(ctx, err)
    })
  }

  if (!user.commands['-silent']) return sendMessage(ctx, `<code>${JSON.stringify(await Event.find({ teleBotId: process.env.BOT_ID }), null, "\t")}</code>`, { parse_mode: 'HTML' })
}