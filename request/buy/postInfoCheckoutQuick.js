module.exports = async function (user, getCache) {
  let curl = new user.Curl()

  return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TIMEOUT, 3)
    .setOtherOpt(function (curl) {
      if ((user.infoCheckoutLong || user.infoCheckoutQuick) && !getCache) curl.setOpt(curl.libcurl.option.TIMEOUT_MS, 1).setOpt(curl.libcurl.option.NOSIGNAL, true)
    }).setHeaders([
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      `user-agent: ${user.userLoginInfo.userAgent}`,
      'content-type: application/json',
      'accept: application/json',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-92b0689536981c768409319957205dc3',
      'x-api-source: pc',
      `x-csrftoken: ${user.userCookie.csrftoken}`,
      'origin: https://shopee.co.id',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      'referer: https://shopee.co.id/checkout',
      'accept-language: en-US,en;q=0.9',
      `cookie: ${curl.serializeCookie(user.userCookie)}`
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
      }],
      // "selected_payment_channel_data": {},
      // "promotion_data": {
      //   "use_coins": user.updateKeranjang.data.use_coins,
      //   "free_shipping_voucher_info": {
      //     "free_shipping_voucher_id": user.updateKeranjang.data.free_shipping_voucher_info.free_shipping_voucher_id,
      //     // "free_shipping_voucher_code": null,
      //     "disabled_reason": user.updateKeranjang.data.free_shipping_voucher_info.disabled_reason,
      //     "description": user.updateKeranjang.data.free_shipping_voucher_info.description
      //   },
      //   "platform_vouchers": user.updateKeranjang.data.platform_vouchers,
      //   // "shop_vouchers": user.updateKeranjang.data.shop_vouchers,
      //   "shop_vouchers": [],
      //   "check_shop_voucher_entrances": true,
      //   "auto_apply_shop_voucher": false
      // },
      // "device_info": {
      //   "device_id": "",
      //   "device_fingerprint": "",
      //   "tongdun_blackbox": "",
      //   "buyer_payment_info": {}
      // },
      // "tax_info": { "tax_id": "" }
    })).post(`https://shopee.co.id/api/v2/checkout/get_quick`)
}