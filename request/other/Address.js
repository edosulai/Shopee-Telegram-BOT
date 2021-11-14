const { curly } = require('node-libcurl');

const { serializeCookie } = require('../../helpers')

module.exports = async function (ctx) {
  let user = ctx.session;

  return curly.get(`https://shopee.co.id/api/v1/addresses/`, {
    httpHeader: [
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      'upgrade-insecure-requests: 1',
      `user-agent: ${process.env.USER_AGENT}`,
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-d4d70dfd6ebe3cbb84deeb6a32ee08e7',
      'x-api-source: pc',
      'accept: */*',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      'referer: https://shopee.co.id/checkout',
      'accept-language: en-US,en;q=0.9',
      `cookie: ${serializeCookie(user.userCookie)}`
    ]
  })
}