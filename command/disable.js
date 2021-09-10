const User = require('./models/User');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)

  user.other = (await Other.find())[0]

  if (user.commands.url) {
    if (!isValidURL(user.commands.url)) return ctx.reply('Format Url Salah')
    if (psl.get(extractRootDomain(user.commands.url)) != 'shopee.co.id') return ctx.reply('Bukan Url Dari Shopee')

    let pathname = url.parse(user.commands.url, true).pathname.split('/')
    if (pathname.length == 4) {
      user.itemid = parseInt(pathname[3])
      user.shopid = parseInt(pathname[2])
    } else {
      pathname = pathname[1].split('.')
      user.itemid = parseInt(pathname[pathname.length - 1])
      user.shopid = parseInt(pathname[pathname.length - 2])
    }

    if (!Number.isInteger(user.itemid) || !Number.isInteger(user.shopid)) return ctx.reply('Bukan Url Produk Shopee')

    await getInfoBarang({
      Curl: user.Curl,
      config: {
        url: user.commands.url,
        itemid: user.itemid,
        shopid: user.shopid,
      }
    }).then(async ({ statusCode, body, headers, curlInstance, curl }) => {
      curl.close();
      user.infoBarang = typeof body == 'string' ? JSON.parse(body) : body;
    }).catch((err) => sendReportToDev(ctx, new Error(err)));

    if (user.other.disableProducts.length <= 0) {
      user.other.disableProducts.push({
        barang: user.infoBarang.item.name.replace(/<[^>]*>?/gm, ""),
        url: user.commands.url,
        itemid: user.itemid,
        shopid: user.shopid,
        allowed: user.commands.allowed ? user.commands.allowed.toLowerCase().split(',') : [1],
        message: user.commands.msg
      })
    } else {
      for (const [index, product] of user.other.disableProducts.entries()) {
        if (
          product.itemid == user.itemid &&
          product.shopid == user.shopid
        ) {
          user.other.disableProducts[index] = {
            barang: user.infoBarang.item.name.replace(/<[^>]*>?/gm, ""),
            url: user.commands.url,
            itemid: user.itemid,
            shopid: user.shopid,
            allowed: user.commands.allowed ? user.commands.allowed.toLowerCase().split(',') : [1],
            message: user.commands.msg
          }
          break;
        }

        if (index == user.other.disableProducts.length - 1) {
          user.other.disableProducts.push({
            barang: user.infoBarang.item.name.replace(/<[^>]*>?/gm, ""),
            url: user.commands.url,
            itemid: user.itemid,
            shopid: user.shopid,
            allowed: user.commands.allowed ? user.commands.allowed.toLowerCase().split(',') : [1],
            message: user.commands.msg
          })
        }
      }
    }

    await Other.updateOne(null, {
      disableProducts: user.other.disableProducts
    }).exec()
  }

  if (user.commands['-clear']) {
    return Other.updateOne(null, {
      disableProducts: []
    }).exec(function () {
      return ctx.reply(`List Disable Products Berhasil Di Hapus`)
    })
  }

  return ctx.reply(`<code>${JSON.stringify(user.other.disableProducts, null, "\t")}</code>`, { parse_mode: 'HTML' })
}