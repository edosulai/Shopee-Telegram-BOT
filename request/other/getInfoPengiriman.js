const querystring = require('querystring')

module.exports = async function (ctx) {
  let user = ctx.session;

  let curl = new user.Curl()

  return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TCP_KEEPALIVE, true).setOpt(curl.libcurl.option.TIMEOUT, 2)
    .setHeaders([
      'authority: shopee.co.id',
      'x-shopee-language: id',
      'dnt: 1',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-193f286fdb52e9db94f50cad3b7fcdc7',
      `user-agent: ${process.env.USER_AGENT}`,
      'x-api-source: pc',
      'accept: */*',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      'referer: https://shopee.co.id/product/206338277/4910439682',
      'accept-language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'if-none-match: 9d55f0614ad43cbf71e15642d1989d6b',
      `cookie: ${curl.serializeCookie(user.userCookie)}`
    ]).get(`https://shopee.co.id/api/v0/shop/${user.config.shopid}/item/${user.config.itemid}/shipping_info_to_address/?${querystring.stringify({ city: user.address.city, district: user.address.district, state: user.address.state })}`)
}