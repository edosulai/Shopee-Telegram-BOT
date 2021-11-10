const { serializeCookie } = require('../../helpers')

module.exports = async function (user) {
  let curl = new user.Curl()

  return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, process.env.CERT_PATH).setOpt(curl.libcurl.option.TCP_KEEPALIVE, true).setOpt(curl.libcurl.option.TIMEOUT, 2)
    .setHeaders([
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      `user-agent: ${process.env.USER_AGENT}`,
      'x-api-source: pc',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-8399610321d405732373a6200cc3d210',
      'accept: */*',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      `referer: ${user.url}`,
      'accept-language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      `cookie: ${serializeCookie(user.userCookie)}`
    ]).get(`https://shopee.co.id/api/v2/voucher_wallet/get_shop_vouchers_by_shopid?itemid=${user.itemid}&shopid=${user.shopid}&with_claiming_status=true`)
}