const psl = require('psl');
const url = require('url');

module.exports = function (urlShopee) {
  let chunk = { err: null }
  if (!isValidURL(urlShopee) || psl.get(extractRootDomain(urlShopee)) != 'shopee.co.id') {
    chunk.err = 'Format Url Salah'
    return chunk
  }

  let pathname = url.parse(urlShopee, true).pathname.split('/')
  if (pathname.length == 4) {
    chunk.itemid = parseInt(pathname[3])
    chunk.shopid = parseInt(pathname[2])
  } else {
    pathname = pathname[1].split('.')
    chunk.itemid = parseInt(pathname[pathname.length - 1])
    chunk.shopid = parseInt(pathname[pathname.length - 2])
  }

  if (!Number.isInteger(chunk.itemid) || !Number.isInteger(chunk.shopid)) {
    chunk.err = 'Bukan Url Produk Shopee'
  }

  return chunk
}