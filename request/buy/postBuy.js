const waitUntil = require('../../helpers/waitUntil');

module.exports = async function (user) {
  let curl = new user.Curl()

  // if (user.infoCheckoutLong) {
  //   user.infoCheckout = user.infoCheckoutLong
  //   user.config.end = Date.now();

  //   return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TIMEOUT, 3)
  //     .setHeaders([
  //       'authority: shopee.co.id',
  //       'pragma: no-cache',
  //       'cache-control: no-cache',
  //       'x-track-id: b26f0c4411c6ec81fdd4a770b81127bf82056f7c1275832a9a5aa6dc4f1b08e4aa7c97945459d6d56907f0d8e0aadf1eb5e584ef0b961ca54eb62487baf55e7b',
  //       'x-cv-id: 7',
  //       `user-agent: ${user.userLoginInfo.userAgent}`,
  //       'content-type: application/json',
  //       'accept: application/json',
  //       'x-shopee-language: id',
  //       'x-requested-with: XMLHttpRequest',
  //       'if-none-match-: 55b03-8e6117c82a707ccb01b22fc18e91caff',
  //       'x-api-source: pc',
  //       `x-csrftoken: ${user.userCookie.csrftoken}`,
  //       'origin: https://shopee.co.id',
  //       'sec-fetch-site: same-origin',
  //       'sec-fetch-mode: cors',
  //       'sec-fetch-dest: empty',
  //       'referer: https://shopee.co.id/checkout',
  //       'accept-language: en-US,en;q=0.9',
  //       `cookie: ${curl.serializeCookie(user.userCookie)}`,
  //     ]).setBody(JSON.stringify(require('../../helpers/postBuyBodyLong')(user))).post(`https://shopee.co.id/api/v2/checkout/place_order`)
  // }

  user.selectedShipping = function (logistics) {
    let channelIds = user.selectedShop.shop.enabled_channelids
    channelIds.forEach((id, i) => {
      channelIds[i] = typeof id == 'string' ? parseInt(id.split('channel_id_')[1]) : channelIds[i]
    });
    let typeLogist = { priority: Number.MAX_VALUE }
    for (const logisticType in logistics.logistic_service_types) {
      if (!Object.hasOwnProperty.call(logistics.logistic_service_types, logisticType)) continue;

      const type = logistics.logistic_service_types[logisticType];
      if (
        type.enabled &&
        type.priority < typeLogist.priority &&
        !['instant', 'next_day', 'self_collection', 'regular_cargo'].includes(type.identifier)
      ) {
        typeLogist = type
      }
    }
    let chunk = { channel: { priority: Number.MAX_VALUE } }
    for (const shippingInfo of logistics.shipping_infos) {
      if (
        channelIds.includes(shippingInfo.channel.channelid) &&
        typeLogist.channel_ids.includes(shippingInfo.channel.channelid) &&
        shippingInfo.channel.priority < chunk.channel.priority
      ) {
        chunk = {
          channel: shippingInfo.channel,
          cost_info: shippingInfo.cost_info
        }
      }
    }
    // for (const promotionRule of logistics.promotion_rules) {
    //   if (promotionRule.id == chunk.cost_info.discount_promotion_rule_id) {
    //     let channelChunk = []
    //     for (const channel in promotionRule.channels) {
    //       if (Object.hasOwnProperty.call(promotionRule.channels, channel)) {
    //         channelChunk.push(parseInt(channel))
    //       }
    //     }
    //     chunk.promotionChannels = channelChunk
    //   }
    // }
    chunk.promotionChannels = channelIds
    return chunk
  }(user.infoPengiriman)

  user.tax = function (payment) {
    if (payment.payment_channelid) {
      let value = parseInt(user.selectedShipping.cost_info.estimated_shipping_fee + user.config.price) / 100 * 3 * 3
      return {
        value: value,
        msg: {
          "learn_more_url": "https://shopee.co.id/m/biaya-penanganan-cod/",
          "description": `Besar biaya penanganan adalah Rp ${addDots(value / 100000)} dari total transaksi.`,
          "title": "Biaya Penanganan"
        }
      }
    } else if (payment.channel_id) {
      let value = parseInt(100000000)
      return {
        value: value,
        msg: {
          "learn_more_url": "https://shopee.co.id/events3/code/634289435/",
          "description": `Besar biaya penanganan adalah Rp ${addDots(value / 100000)} dari total transaksi.`,
          "title": "Biaya Penanganan"
        }
      }
    } else {
      let value = parseInt(0)
      return {
        value: value,
        msg: {
          "learn_more_url": "",
          "description": `Besar biaya penanganan adalah Rp ${addDots(value / 100000)} dari total transaksi.`,
          "title": "Biaya Penanganan"
        }
      }
    }
  }(user.payment.method)

  return waitUntil(user, 'updateKeranjang', 'infoCheckoutQuick')
    .then(async () => {

      if (user.updateKeranjang.error != 0) {
        return new Promise((resolve, reject) => {
          return reject(`Gagal Mendapatkan Update Keranjang Belanja : ${user.updateKeranjang.error}`)
        })
      }

      if (user.infoCheckoutQuick.error != null) {
        return new Promise((resolve, reject) => {
          return reject(`Gagal Mendapatkan Info Checkout Belanja : ${user.infoCheckoutQuick.error}`)
        })
      }

      user.infoCheckout = {
        "cart_type": 0,
        "shipping_orders": [
          {
            "cod_fee": user.infoCheckoutQuick.shipping_orders[0].cod_fee,
            "shipping_fee": user.infoCheckoutQuick.shipping_orders[0].shipping_fee,
            "order_total": user.infoCheckoutQuick.shipping_orders[0].order_total,
            "shipping_id": user.infoCheckoutQuick.shipping_orders[0].shipping_id,
            "fulfillment_info": user.infoCheckoutQuick.shipping_orders[0].fulfillment_info,
            "tax_payable": user.infoCheckoutQuick.shipping_orders[0].tax_payable,
            "shoporder_indexes": user.infoCheckoutQuick.shipping_orders[0].shoporder_indexes,
            "shipping_group_icon": user.infoCheckoutQuick.shipping_orders[0].shipping_group_icon,
            "shipping_fee_discount": user.infoCheckoutQuick.shipping_orders[0].shipping_fee_discount,
            "shipping_group_description": user.infoCheckoutQuick.shipping_orders[0].shipping_group_description,
            "order_total_without_shipping": user.infoCheckoutQuick.shipping_orders[0].order_total_without_shipping,
            "tax_exemption": user.infoCheckoutQuick.shipping_orders[0].tax_exemption,
            "selected_logistic_channelid_with_warning": null,
            "selected_preferred_delivery_time_option_id": 0,
            "buyer_remark": null,
            "buyer_address_data": {
              "tax_address": "",
              "error_status": "",
              "address_type": 0
            },
            "buyer_ic_number": null,
            "amount_detail": {
              "SELLER_ESTIMATED_INSURANCE_FEE": 0,
              "VOUCHER_DISCOUNT": 0,
              "SHIPPING_DISCOUNT_BY_SELLER": 0,
              "SELLER_ESTIMATED_BASIC_SHIPPING_FEE": 0,
              "INSURANCE_FEE": 0,
              "TAX_EXEMPTION": 0,
              "COD_FEE": 0,
              "TAX_FEE": 0,
              "SELLER_ONLY_SHIPPING_DISCOUNT": 0
            }
          }
        ],
        "disabled_checkout_info": {
          "auto_popup": false,
          "description": "",
          "error_infos": []
        },
        "checkout_price_data": {
          "shipping_discount_subtotal": 0,
          "bundle_deals_discount": null,
          "group_buy_discount": 0,
          "tax_payable": 0,
          "credit_card_promotion": null,
          "promocode_applied": null,
          "shopee_coins_redeemed": null,
          "tax_exemption": 0
        },
        "client_id": 0,
        "promotion_data": {
          "price_discount": 0,
          "voucher_info": {
            "coin_earned": 0,
            "promotionid": 0,
            "discount_percentage": 0,
            "discount_value": 0,
            "voucher_code": null,
            "reward_type": 0,
            "coin_percentage": 0,
            "used_price": 0
          },
          "applied_voucher_code": null,
          "voucher_code": null
        },
        "dropshipping_info": {
          "phone_number": "",
          "enabled": false,
          "name": ""
        },
        "shoporders": [
          {
            "shop": user.infoCheckoutQuick.shoporders[0].shop,
            "cod_fee": user.infoCheckoutQuick.shoporders[0].cod_fee,
            "tax_payable": user.infoCheckoutQuick.shoporders[0].tax_payable,
            "order_total": user.infoCheckoutQuick.shoporders[0].order_total,
            "amount_detail": user.infoCheckoutQuick.shoporders[0].amount_detail,
            "order_total_without_shipping": user.infoCheckoutQuick.shoporders[0].order_total_without_shipping,
            "selected_preferred_delivery_time_option_id": 0,
            "buyer_remark": null,
            "buyer_address_data": {
              "tax_address": "",
              "error_status": "",
              "address_type": 0
            },
            "buyer_ic_number": null,
            "items": function () {
              user.infoCheckoutQuick.shoporders[0].items[0].stock = 0
              return user.infoCheckoutQuick.shoporders[0].items
            }(),
            "shipping_fee_discount": user.infoCheckoutQuick.shoporders[0].shipping_fee_discount,
            "tax_info": {
              "use_new_custom_tax_msg": false,
              "custom_tax_msg": "",
              "custom_tax_msg_short": "",
              "remove_custom_tax_hint": false
            },
            "shipping_fee": user.infoCheckoutQuick.shoporders[0].shipping_fee,
            "tax_exemption": user.infoCheckoutQuick.shoporders[0].tax_exemption,
            "ext_ad_info_mappings": []
          }
        ],
        "can_checkout": true,
        "order_update_info": {},
        "captcha_version": 1
      }

      let shipping_orders = user.infoCheckout.shipping_orders[0]
      let checkout_price_data = user.infoCheckout.checkout_price_data
      let shoporders = user.infoCheckout.shoporders[0]

      user.config.price = shoporders.items[0].price

      user.shipinfo = {
        "selected_logistic_channelid": user.selectedShipping.channel.channelid,
        "cod_fee": shipping_orders.cod_fee,
        "order_total": user.selectedShipping.cost_info.estimated_shipping_fee + (user.config.price * user.config.quantity) - user.selectedShipping.cost_info.discounts.seller,//
        "shipping_id": shipping_orders.shipping_id,
        "shipping_fee_discount": shipping_orders.shipping_fee_discount + user.selectedShipping.cost_info.discounts.seller,//
        "selected_preferred_delivery_time_option_id": shipping_orders.selected_preferred_delivery_time_option_id,
        "buyer_remark": shipping_orders.buyer_remark || "",
        "buyer_address_data": {
          "tax_address": shipping_orders.buyer_address_data.tax_address,
          "error_status": shipping_orders.buyer_address_data.error_status,
          "address_type": shipping_orders.buyer_address_data.address_type,
          "addressid": user.address.id
        },
        "order_total_without_shipping": user.config.price * user.config.quantity,
        "tax_payable": shipping_orders.tax_payable,
        "buyer_ic_number": shipping_orders.buyer_ic_number || "",
        "shipping_fee": user.selectedShipping.cost_info.estimated_shipping_fee - user.selectedShipping.cost_info.discounts.seller,//
        "tax_exemption": shipping_orders.tax_exemption,
        "amount_detail": {
          "BASIC_SHIPPING_FEE": user.selectedShipping.cost_info.estimated_shipping_fee,
          "SELLER_ESTIMATED_INSURANCE_FEE": shipping_orders.amount_detail.SELLER_ESTIMATED_INSURANCE_FEE,
          "SHOPEE_OR_SELLER_SHIPPING_DISCOUNT": 0 - user.selectedShipping.cost_info.discounts.shopee,
          "VOUCHER_DISCOUNT": shipping_orders.amount_detail.VOUCHER_DISCOUNT,
          "SHIPPING_DISCOUNT_BY_SELLER": user.selectedShipping.cost_info.discounts.seller,
          "SELLER_ESTIMATED_BASIC_SHIPPING_FEE": shipping_orders.amount_detail.SELLER_ESTIMATED_BASIC_SHIPPING_FEE,
          "SHIPPING_DISCOUNT_BY_SHOPEE": user.selectedShipping.cost_info.discounts.shopee,
          "INSURANCE_FEE": shipping_orders.amount_detail.INSURANCE_FEE,
          "ITEM_TOTAL": user.config.price * user.config.quantity,
          "TAX_EXEMPTION": shipping_orders.amount_detail.TAX_EXEMPTION,
          "shop_promo_only": true,
          "COD_FEE": shipping_orders.amount_detail.COD_FEE,
          "TAX_FEE": shipping_orders.amount_detail.TAX_FEE,
          "SELLER_ONLY_SHIPPING_DISCOUNT": 0 - user.selectedShipping.cost_info.discounts.seller//
        }
      }

      user.postBuyBody = {
        "status": 200,
        "headers": {},
        "cart_type": user.infoCheckout.cart_type,
        "shipping_orders": [
          {
            "shopee_shipping_discount_id": user.selectedShipping.cost_info.discount_promotion_rule_id,
            "selected_logistic_channelid_with_warning": shipping_orders.selected_logistic_channelid_with_warning,
            "shipping_group_description": shipping_orders.shipping_group_description,
            "fulfillment_info": shipping_orders.fulfillment_info,
            "shoporder_indexes": shipping_orders.shoporder_indexes,
            "shipping_group_icon": shipping_orders.shipping_group_icon,
            "voucher_wallet_checking_channel_ids": user.selectedShipping.promotionChannels,
            ...user.shipinfo
          }
        ],
        "disabled_checkout_info": user.infoCheckout.disabled_checkout_info,
        "timestamp": Math.floor(user.config.timestamp / 1000),
        "checkout_price_data": {
          "shipping_subtotal": user.selectedShipping.cost_info.estimated_shipping_fee - user.selectedShipping.cost_info.discounts.seller,//
          "shipping_discount_subtotal": checkout_price_data.shipping_discount_subtotal + user.selectedShipping.cost_info.discounts.seller,//
          "shipping_subtotal_before_discount": user.selectedShipping.cost_info.original_cost,
          "bundle_deals_discount": checkout_price_data.bundle_deals_discount,
          "group_buy_discount": checkout_price_data.group_buy_discount,
          "merchandise_subtotal": user.config.price * user.config.quantity,
          "tax_payable": checkout_price_data.tax_payable,
          "buyer_txn_fee": user.tax.value,
          "credit_card_promotion": checkout_price_data.credit_card_promotion,
          "promocode_applied": checkout_price_data.promocode_applied,
          "shopee_coins_redeemed": checkout_price_data.shopee_coins_redeemed,
          "total_payable": user.selectedShipping.cost_info.estimated_shipping_fee + (user.config.price * user.config.quantity) + user.tax.value - user.selectedShipping.cost_info.discounts.seller,//
          "tax_exemption": checkout_price_data.tax_exemption
        },
        "client_id": user.infoCheckout.client_id,
        "promotion_data": {
          "promotion_msg": user.updateKeranjang.data.promotion_msg,
          "price_discount": user.infoCheckout.promotion_data.price_discount,
          "can_use_coins": user.updateKeranjang.data.can_use_coins,
          "voucher_info": user.infoCheckout.promotion_data.voucher_info,
          "coin_info": {
            "coin_offset": user.updateKeranjang.data.coin_info.coin_offset,
            "coin_earn": user.updateKeranjang.data.coin_info.coin_earn,
            "coin_earn_by_voucher": user.updateKeranjang.data.coin_info.coin_earn_by_voucher,
            "coin_used": user.updateKeranjang.data.coin_info.coin_used
          },
          "free_shipping_voucher_info": {
            "free_shipping_voucher_id": user.updateKeranjang.data.free_shipping_voucher_info.free_shipping_voucher_id || 0,
            "disabled_reason": user.updateKeranjang.data.free_shipping_voucher_info.disabled_reason,
            "free_shipping_voucher_code": user.updateKeranjang.data.free_shipping_voucher_info.free_shipping_voucher_code || ""
          },
          "applied_voucher_code": user.infoCheckout.promotion_data.applied_voucher_code,
          ...function (vouchers) {
            if (vouchers.length > 0) {
              for (const voucher of vouchers) {
                if (voucher.promotionid == user.config.promotionid) {
                  return {
                    shop_voucher_entrances: [{
                      "status": true,
                      "shopid": user.config.shopid
                    }]
                  }
                }
              }
            }
            return {
              shop_voucher_entrances: [{
                "status": false,
                "shopid": user.config.shopid
              }]
            }
          }(user.updateKeranjang.data.shop_vouchers),
          // }(user.infoVoucher.data.voucher_list),
          "card_promotion_enabled": user.updateKeranjang.data.card_promotion_enabled,
          "invalid_message": user.updateKeranjang.data.invalid_message || null,
          "card_promotion_id": user.updateKeranjang.data.card_promotion_id || null,
          "voucher_code": user.infoCheckout.promotion_data.voucher_code,
          "use_coins": user.updateKeranjang.data.use_coins
        },
        "dropshipping_info": user.infoCheckout.dropshipping_info,
        "selected_payment_channel_data": user.payment.method,
        "shoporders": [
          {
            ...user.shipinfo,
            // "shop": {
            //   "remark_type": shoporders.shop.remark_type,
            //   "support_ereceipt": shoporders.shop.support_ereceipt,
            //   "images": shoporders.shop.images,
            //   "is_official_shop": user.selectedShop.shop.show_official_shop_label || false,
            //   "cb_option": user.selectedShop.shop.cb_option ? user.selectedShop.shop.cb_option : false,
            //   "shopid": user.config.shopid,
            //   "shop_name": user.selectedShop.shop.shopname
            // },
            // "items": [
            //   {
            //     "itemid": user.config.itemid,
            //     "is_add_on_sub_item": user.selectedItem.is_add_on_sub_item ? user.selectedItem.is_add_on_sub_item : false,
            //     "image": user.selectedItem.image,
            //     "shopid": user.config.shopid,
            //     "opc_extra_data": shoporders.items[0].opc_extra_data,
            //     "promotion_id": user.config.promotionid,
            //     ...function (item) {
            //       if (item.add_on_deal_id) {
            //         return {
            //           "add_on_deal_id": item.add_on_deal_id,
            //           "add_on_deal_label": user.infoBarang.item.add_on_deal_info.add_on_deal_label,
            //           "addon_deal_sub_type": item.add_on_deal_info.sub_type || 0
            //         }
            //       }
            //       return {
            //         "add_on_deal_id": 0,
            //       }
            //     }(user.selectedItem),
            //     "modelid": user.config.modelid,
            //     "offerid": user.selectedItem.offerid ? user.selectedItem.offerid : 0,
            //     "source": shoporders.items[0].source,
            //     "checkout": shoporders.items[0].checkout,
            //     "item_group_id": user.selectedItem.item_group_id ? user.selectedItem.item_group_id : 0,
            //     "service_by_shopee_flag": shoporders.items[0].service_by_shopee_flag,
            //     "none_shippable_full_reason": shoporders.items[0].none_shippable_full_reason || "",
            //     "price": user.config.price,
            //     "is_flash_sale": user.config.nonflash ? false : true,
            //     // "categories": function () {
            //     //   let chuck = []
            //     //   user.infoBarang.item.categories.forEach(category => {
            //     //     chuck.push(category.catid)
            //     //   });
            //     //   return [{ "catids": chuck }]
            //     // }(),
            //     "categories": shoporders.items[0].categories,
            //     "shippable": shoporders.items[0].shippable,
            //     "name": user.selectedItem.name,
            //     "none_shippable_reason": shoporders.items[0].none_shippable_reason || "",
            //     "is_pre_order": user.selectedItem.is_pre_order,
            //     "stock": 0,
            //     "model_name": user.selectedItem.model_name,
            //     "quantity": user.config.quantity
            //   }
            // ],
            "shop": shoporders.shop,
            "items": shoporders.items,
            "tax_info": shoporders.tax_info,
            "ext_ad_info_mappings": []
          }
        ],
        "can_checkout": user.infoCheckout.can_checkout,
        "order_update_info": user.infoCheckout.order_update_info,
        "buyer_txn_fee_info": user.tax.msg,
        "captcha_version": user.infoCheckout.captcha_version
      }

      user.config.end = Date.now();

      return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TIMEOUT, 3)
        .setHeaders([
          'authority: shopee.co.id',
          'pragma: no-cache',
          'cache-control: no-cache',
          'x-track-id: b26f0c4411c6ec81fdd4a770b81127bf82056f7c1275832a9a5aa6dc4f1b08e4aa7c97945459d6d56907f0d8e0aadf1eb5e584ef0b961ca54eb62487baf55e7b',
          'x-cv-id: 7',
          `user-agent: ${user.userLoginInfo.userAgent}`,
          'content-type: application/json',
          'accept: application/json',
          'x-shopee-language: id',
          'x-requested-with: XMLHttpRequest',
          'if-none-match-: 55b03-8e6117c82a707ccb01b22fc18e91caff',
          'x-api-source: pc',
          `x-csrftoken: ${user.userCookie.csrftoken}`,
          'origin: https://shopee.co.id',
          'sec-fetch-site: same-origin',
          'sec-fetch-mode: cors',
          'sec-fetch-dest: empty',
          'referer: https://shopee.co.id/checkout',
          'accept-language: en-US,en;q=0.9',
          `cookie: ${curl.serializeCookie(user.userCookie)}`,
        ]).setBody(JSON.stringify(user.postBuyBody)).post(`https://shopee.co.id/api/v2/checkout/place_order`)

    }).catch((err) => {
      return new Promise((resolve, reject) => {
        return reject(err)
      })
    });
}

const addDots = function (nStr) {
  nStr += '';
  x = nStr.split('.');
  x1 = x[0];
  x2 = x.length > 1 ? '.' + x[1] : '';
  var rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1' + '.' + '$2');
  }
  return x1 + x2;
}