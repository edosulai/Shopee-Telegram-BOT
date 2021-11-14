const { curly } = require('node-libcurl');

const { serializeCookie } = require('../../helpers')

module.exports = async function (ctx, action) {
  let user = ctx.session;

  return curly.post(`https://shopee.co.id/api/v4/cart/update`, {
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
      'if-none-match-: 55b03-102aaf9d18be237e4e5fad1e43a71a07',
      'content-type: application/json',
      `x-csrftoken: ${user.userCookie.csrftoken.value}`,
      'sec-ch-ua-platform: "Windows"',
      'origin: https://shopee.co.id',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      'referer: https://shopee.co.id/cart',
      'accept-language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      `cookie: ${serializeCookie(user.userCookie)}`,
    ],
    postFields: JSON.stringify({
      "action_type": action,
      "updated_shop_order_ids": [{
        "shopid": user.shopid,
        "item_briefs": [{
          "shopid": user.shopid,
          "itemid": user.itemid,
          "modelid": user.modelid,
          "item_group_id": user.selectedItem.item_group_id,
          "add_on_deal_id": user.selectedItem.add_on_deal_id,
          "is_add_on_sub_item": user.selectedItem.is_add_on_sub_item,
          "quantity": user.selectedItem.quantity,
          "old_modelid": null,
          "old_quantity": user.selectedItem.quantity,
          "checkout": false,
          "applied_promotion_id": user.promotionid,
          "price": user.price
        }]
      }],
      "selected_shop_order_ids": [{
        "shopid": user.shopid,
        "item_briefs": action == 2 ? [] : [{
          "itemid": user.itemid,
          "modelid": user.modelid,
          "item_group_id": user.selectedItem.item_group_id,
          "applied_promotion_id": user.promotionid,
          "offerid": user.selectedItem.offerid,
          "price": user.price,
          "quantity": user.selectedItem.quantity,
          "is_add_on_sub_item": user.selectedItem.is_add_on_sub_item,
          "add_on_deal_id": user.selectedItem.add_on_deal_id,
          "status": user.selectedItem.status,
          "cart_item_change_time": user.selectedItem.cart_item_change_time,
          "membership_offer_id": user.selectedItem.membership_offer_id
        }],
        "addin_time": user.selectedItem.addin_time,
        "auto_apply": true,
        "shop_vouchers": []
      }],
      "promotion_data": {
        "use_coins": false,
        "platform_vouchers": [],
        "free_shipping_voucher_info": {
          "free_shipping_voucher_id": 0,
          "free_shipping_voucher_code": null
        }
      },
      "add_on_deal_sub_item_list": [],
      "version": 3
    })
  })
}