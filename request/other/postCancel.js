const FormData = require('form-data')

const { serializeCookie } = require('../../helpers')

module.exports = async function (ctx) {
  let user = ctx.session;

  let curl = new user.Curl()

  let form = new FormData();
  form.append('buyer_cancel_reason_id', 507);
  delete form._streams[form._streams.length - 1]

  return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, process.env.CERT_PATH).setOpt(curl.libcurl.option.TCP_KEEPALIVE, true).setOpt(curl.libcurl.option.TIMEOUT, 2)
    .setHeaders([
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      'x-shopee-language: id',
      `x-csrftoken: ${user.userCookie.csrftoken.value}`,
      'x-requested-with: XMLHttpRequest',
      `content-type: multipart/form-data; boundary=${form._boundary}`,
      `user-agent: ${process.env.USER_AGENT}`,
      'x-api-source: pc',
      'accept: */*',
      'origin: https://shopee.co.id',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      'referer: https://shopee.co.id/user/purchase/list/?checkout=true&type=9',
      'accept-language: en-US,en;q=0.9',
      `cookie: ${serializeCookie(user.userCookie)}`,
    ]).setBody(form._streams.join('')).post(`https://shopee.co.id/api/v0/buyer/checkout/${user.order.checkoutid}/cancel`)
}