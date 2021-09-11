const getInfoBarang = require('../request/buy/getInfoBarang');

const Event = require('../models/Event');

const parseShopeeUrl = require('./parseShopeeUrl');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

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

    await getInfoBarang({
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
      itemid: user.itemid,
      shopid: user.shopid,
      price: user.commands.price
    }, async function (err, event, created) {
      if (err) return sendReportToDev(bot, err)
      user.event
    })
  }

  if (!user.commands['-silent']) return sendMessage(ctx, `<code>${JSON.stringify(user.event, null, "\t")}</code>`, { parse_mode: 'HTML' })
}