const { serializeCookie } = require('../../helpers')

module.exports = async function (ctx) {
  let user = ctx.session;

  let curl = new user.Curl()

  // return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, process.env.CERT_PATH).setOpt(curl.libcurl.option.TCP_KEEPALIVE, true).setOpt(curl.libcurl.option.TIMEOUT, 2)
  //   .setHeaders([
  //     'authority: shopee.co.id',
  //     'pragma: no-cache',
  //     'cache-control: no-cache',
  //     'sec-ch-ua: "Google Chrome";v="95", "Chromium";v="95", ";Not A Brand";v="99"',
  //     'dnt: 1',
  //     'x-cv-id: 106',
  //     'sec-ch-ua-mobile: ?0',
  //     `user-agent: ${process.env.USER_AGENT}`,
  //     'content-type: application/json',
  //     'accept: application/json',
  //     'x-shopee-language: id',
  //     'x-requested-with: XMLHttpRequest',
  //     'if-none-match-: 55b03-920e494e40a66141b9b4f44425a450e0',
  //     'x-api-source: pc',
  //     `x-csrftoken: ${user.userCookie.csrftoken.value}`,
  //     'sec-ch-ua-platform: "Windows"',
  //     'origin: https://shopee.co.id',
  //     'sec-fetch-site: same-origin',
  //     'sec-fetch-mode: cors',
  //     'sec-fetch-dest: empty',
  //     'referer: https://shopee.co.id/checkout',
  //     'accept-language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  //     `cookie: ${serializeCookie(user.userCookie)}`
  //   ]).setBody(JSON.stringify({
  //     "_cft": [11],
  //     "shoporders": [{
  //       "shop": { "shopid": user.config.shopid },
  //       "items": [{
  //         "itemid": user.config.itemid,
  //         "modelid": user.config.modelid,
  //         "quantity": user.config.quantity,
  //         "add_on_deal_id": user.selectedItem.add_on_deal_id,
  //         "is_add_on_sub_item": user.selectedItem.is_add_on_sub_item,
  //         "item_group_id": user.selectedItem.item_group_id,
  //         "insurances": []
  //       }]
  //     }],
  //     "selected_payment_channel_data": user.payment.method,
  //     "promotion_data": {
  //       "use_coins": false,
  //       "free_shipping_voucher_info": {
  //         "free_shipping_voucher_id": 0,
  //         "disabled_reason": "",
  //         "description": ""
  //       },
  //       "platform_vouchers": [],
  //       "shop_vouchers": [],
  //       "check_shop_voucher_entrances": true,
  //       "auto_apply_shop_voucher": false
  //     },
  //     "device_info": {
  //       "device_id": "",
  //       "device_fingerprint": "",
  //       "tongdun_blackbox": "",
  //       "buyer_payment_info": {}
  //     },
  //     "tax_info": { "tax_id": "" }
  //   })).post(`https://shopee.co.id/api/v4/checkout/get`)

  return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, process.env.CERT_PATH).setOpt(curl.libcurl.option.TCP_KEEPALIVE, true).setOpt(curl.libcurl.option.TIMEOUT, 2)
    .setHeaders([
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      'x-cv-id: 9',
      `user-agent: ${process.env.USER_AGENT}`,
      'content-type: application/json',
      'accept: application/json',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-dec72446a290ee789f4625e516fbd51c',
      'x-api-source: pc',
      `x-csrftoken: ${user.userCookie.csrftoken.value}`,
      'origin: https://shopee.co.id',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      'referer: https://shopee.co.id/checkout',
      'accept-language: en-US,en;q=0.9',
      `cookie: ${serializeCookie(user.userCookie)}`
    ]).setBody(JSON.stringify({
      "shoporders": [{
        "shop": { "shopid": user.config.shopid },
        "items": [{
          "itemid": user.config.itemid,
          "modelid": user.config.modelid,
          "add_on_deal_id": user.selectedItem.add_on_deal_id,
          "is_add_on_sub_item": user.selectedItem.is_add_on_sub_item,
          "item_group_id": user.selectedItem.item_group_id,
          "quantity": user.config.quantity
        }],
        "logistics": { "recommended_channelids": null },
        "buyer_address_data": {},
        "selected_preferred_delivery_time_slot_id": null
      }]
    })).post(`https://shopee.co.id/api/v2/checkout/get`)
}