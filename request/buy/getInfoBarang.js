const { serializeCookie } = require('../../helpers')

module.exports = async function (ctx) {
  let user = ctx.session;
  
  let curl = new user.Curl()

  return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, process.env.CERT_PATH).setOpt(curl.libcurl.option.TCP_KEEPALIVE, true).setOpt(curl.libcurl.option.TIMEOUT, 2)
    .setHeaders([
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-39155c622be48dcc9e152107052ce172',
      `user-agent: ${process.env.USER_AGENT}`,
      'x-api-source: pc',
      'accept: */*',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      `referer: ${user.url}`,
      'accept-language: en-US,en;q=0.9',
      `cookie: ${serializeCookie(user.userCookie)}`
    ]).get(`https://shopee.co.id/api/v2/item/get?itemid=${user.itemid}&shopid=${user.shopid}`)
}