const { curly } = require('node-libcurl');

const { serializeCookie } = require('../../helpers')

module.exports = async function (ctx) {
  let user = ctx.session;

  return curly.post(`https://shopee.co.id/api/v2/authentication/login`, {
    httpHeader: [
      'authority: shopee.co.id',
      `user-agent: ${process.env.USER_AGENT}`,
      'x-api-source: pc',
      'accept: application/json',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-388713a4681cb46b1983b1b738173d6c',
      'content-type: application/json',
      `x-csrftoken: ${user.userCookie.csrftoken.value}`,
      'origin: https://shopee.co.id',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      'referer: https://shopee.co.id/buyer/login',
      'accept-language: en-US,en;q=0.9',
      `cookie: ${serializeCookie(user.userCookie)}`
    ],
    postFields: JSON.stringify({
      email: user.userLoginInfo.email,
      password: user.userLoginInfo.password,
      support_whats_app: true,
      support_ivs: true
    })
  })
}