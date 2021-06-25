const FormData = require('form-data')

module.exports = async function (user) {
  let curl = new user.Curl()

  if (user.payment.method.payment_channelid) {

    return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TIMEOUT, 3)
      .setHeaders([
        'authority: shopee.co.id',
        'pragma: no-cache',
        'cache-control: no-cache',
        `user-agent: ${process.env.USER_AGENT}`,
        'x-api-source: pc',
        'accept: application/json',
        'x-shopee-language: id',
        'x-requested-with: XMLHttpRequest',
        'if-none-match-: 55b03-17992076b01b514412d945be84811903',
        'content-type: application/json',
        `x-csrftoken: ${user.userCookie.csrftoken}`,
        'origin: https://shopee.co.id',
        'sec-fetch-site: same-origin',
        'sec-fetch-mode: cors',
        'sec-fetch-dest: empty',
        `referer: https://shopee.co.id/user/purchase/order/${user.order.orderids ? user.order.orderids[0] : user.order.orderid}/?shopid=${user.order.shopid}`,
        'accept-language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        `cookie: ${curl.serializeCookie(user.userCookie)}`,
      ]).setBody(JSON.stringify({ "orderid": user.order.orderids ? user.order.orderids[0] : user.order.orderid, "shopid": user.order.shopid, "reason": 9 })).post(`https://shopee.co.id/api/v2/order/buyer_cancel_order`)

  } else {

    let form = new FormData();
    form.append('buyer_cancel_reason_id', 507);
    delete form._streams[form._streams.length - 1]

    return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TIMEOUT, 3)
      .setHeaders([
        'authority: shopee.co.id',
        'pragma: no-cache',
        'cache-control: no-cache',
        'x-shopee-language: id',
        `x-csrftoken: ${user.userCookie.csrftoken}`,
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
        `cookie: ${curl.serializeCookie(user.userCookie)}`,
      ]).setBody(form._streams.join('')).post(`https://shopee.co.id/api/v0/buyer/checkout/${user.order.checkoutid}/cancel`)

  }
}