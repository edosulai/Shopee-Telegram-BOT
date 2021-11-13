const InfoBarang = require('../request/buy/InfoBarang');

const Event = require('../models/Event');

const { logReport, parseShopeeUrl, sendMessage } = require('./index')

module.exports = async function (ctx) {
  let user = ctx.session

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
    }).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close();
      let chunk = typeof body == 'string' ? JSON.parse(body) : body;
      if (chunk.error == null) {
        user.infoBarang = chunk;
      }
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
      user.event
    })
  }

  if (!user.commands['-silent']) return sendMessage(ctx, `<code>${JSON.stringify(await Event.find({ teleBotId: process.env.BOT_ID }), null, "\t")}</code>`, { parse_mode: 'HTML' })
}