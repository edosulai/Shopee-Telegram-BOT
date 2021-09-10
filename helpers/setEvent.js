const psl = require('psl');
const url = require('url');

const getInfoBarang = require('../request/buy/getInfoBarang');

const Other = require('../models/Other');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = async function (ctx) {
  let user = ctx.session
  user.other = (await Other.find())[0]

  if (user.commands.url && user.commands.price) {
    if (!isValidURL(user.commands.url)) return sendMessage(ctx, 'Format Url Salah')
    if (psl.get(extractRootDomain(user.commands.url)) != 'shopee.co.id') return sendMessage(ctx, 'Bukan Url Dari Shopee')

    let pathname = url.parse(user.commands.url, true).pathname.split('/')
    if (pathname.length == 4) {
      user.itemid = parseInt(pathname[3])
      user.shopid = parseInt(pathname[2])
    } else {
      pathname = pathname[1].split('.')
      user.itemid = parseInt(pathname[pathname.length - 1])
      user.shopid = parseInt(pathname[pathname.length - 2])
    }

    if (!Number.isInteger(user.itemid) || !Number.isInteger(user.shopid)) return sendMessage(ctx, 'Bukan Url Produk Shopee')

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

    if (user.other.eventProducts.length <= 0) {
      user.other.eventProducts.push({
        barang: user.infoBarang.item.name.replace(/<[^>]*>?/gm, ""),
        url: user.commands.url,
        itemid: user.itemid,
        shopid: user.shopid,
        price: user.commands.price
      })
    } else {
      for (const [index, product] of user.other.eventProducts.entries()) {
        if (
          product.itemid == user.itemid &&
          product.shopid == user.shopid
        ) {
          user.other.eventProducts[index] = {
            barang: user.infoBarang.item.name.replace(/<[^>]*>?/gm, ""),
            url: user.commands.url,
            itemid: user.itemid,
            shopid: user.shopid,
            price: user.commands.price
          }
          break;
        }

        if (index == user.other.eventProducts.length - 1) {
          user.other.eventProducts.push({
            barang: user.infoBarang.item.name.replace(/<[^>]*>?/gm, ""),
            url: user.commands.url,
            itemid: user.itemid,
            shopid: user.shopid,
            price: user.commands.price
          })
        }
      }
    }

    await Other.updateOne(null, {
      eventProducts: user.other.eventProducts
    }).exec()
  }

  if (user.commands['-clear']) {
    return Other.updateOne(null, {
      eventProducts: []
    }).exec(function () {
      if (!user.commands['-silent']) return sendMessage(ctx, `List Event Products Berhasil Di Hapus`)
    })
  }

  if (!user.commands['-silent']) return sendMessage(ctx, `<code>${JSON.stringify(user.other.eventProducts, null, "\t")}</code>`, { parse_mode: 'HTML' })
}