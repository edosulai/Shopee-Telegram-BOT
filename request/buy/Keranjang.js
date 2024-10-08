const { curly } = require('node-libcurl');

const { serializeCookie } = require('../../helpers')

module.exports = async function (ctx) {
  let user = ctx.session;

  return curly.post(`https://shopee.co.id/api/v4/cart/add_to_cart`, {
    httpHeader: [
      'authority: shopee.co.id',
      'sec-ch-ua: "Google Chrome";v="95", "Chromium";v="95", ";Not A Brand";v="99"',
      'dnt: 1',
      'sec-ch-ua-mobile: ?0',
      `user-agent: ${process.env.USER_AGENT}`,
      'x-api-source: pc',
      'accept: application/json',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-0c7c7dcc2eed68472c867545feeae2f4',
      'content-type: application/json',
      `x-csrftoken: ${user.userCookie.csrftoken.value}`,
      'sec-ch-ua-platform: "Windows"',
      'origin: https://shopee.co.id',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      `referer: ${user.url}`,
      'accept-language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      `cookie: ${serializeCookie(user.userCookie)}`
    ],
    postFields: JSON.stringify({
      "quantity": user.quantity,
      "checkout": true,
      "update_checkout_only": false,
      "donot_add_quantity": false,
      "source": "{\"refer_urls\":[]}",
      "client_source": 1,
      "shopid": user.shopid,
      "itemid": user.itemid,
      "modelid": user.modelid,
      ...function (data) {
        if (data.add_on_deal_info != null) return { "add_on_deal_id": data.add_on_deal_id }
      }(user.infoBarang.data)
    })
  })
}

