const cookie = require('cookie');

const { sendReportToDev, addDots, serializeCookie } = require('../../helpers')

module.exports = async function (ctx) {
  let user = ctx.session;

  user.postBuyBody = user.postBuyBody || function (user) {

    let shipping_orders = user.infoCheckout.shipping_orders[0]
    let checkout_price_data = user.infoCheckout.checkout_price_data
    let shoporders = user.infoCheckout.shoporders[0]
    let promotion_data = user.infoCheckout.promotion_data
    let logistic = shoporders.logistics.logistic_channels[shipping_orders.selected_logistic_channelid]
    let tax = function (payment, shipping_fee, price) {
      if (payment.payment_channelid) {
        let value = parseInt(shipping_fee + price) / 100 * 3 * 3
        return {
          value: value,
          msg: {
            "title": "Biaya Penanganan",
            "description": `Besar biaya penanganan adalah Rp ${addDots(value / 100000)} dari total transaksi.`,
            "learn_more_url": "https://shopee.co.id/m/biaya-penanganan-cod/"
          }
        }
      } else if (payment.channel_id) {
        let value = parseInt(100000000)
        return {
          value: value,
          msg: {
            "title": "Biaya Penanganan",
            "description": `Besar biaya penanganan adalah Rp ${addDots(value / 100000)} dari total transaksi.`,
            "learn_more_url": "https://shopee.co.id/events3/code/634289435/"
          }
        }
      } else {
        let value = parseInt(0)
        return {
          value: value,
          msg: {
            "title": "Biaya Penanganan",
            "description": `Besar biaya penanganan adalah Rp ${addDots(value / 100000)} dari total transaksi.`,
            "learn_more_url": ""
          }
        }
      }
    }(user.payment.method, shipping_orders.shipping_fee, user.price)

    if (!user.infoCheckout.can_checkout) sendReportToDev(ctx, `${user.infoCheckout.disabled_checkout_info.description} - ${user.infoBarang.item.name.replace(/<[^>]*>?/gm, "")}`)

    return {
      status: 200,
      headers: {},
      client_id: user.infoCheckout.client_id,
      cart_type: user.infoCheckout.cart_type,
      timestamp: Math.floor(user.config.start / 1000),
      checkout_price_data: {
        merchandise_subtotal: user.price * user.config.quantity,
        total_payable: shipping_orders.shipping_fee + (user.price * user.config.quantity) + tax.value,
        shipping_subtotal: checkout_price_data.shipping_subtotal,
        shipping_subtotal_before_discount: checkout_price_data.shipping_subtotal_before_discount,
        shipping_discount_subtotal: checkout_price_data.shipping_discount_subtotal,
        tax_payable: checkout_price_data.tax_payable,
        tax_exemption: checkout_price_data.tax_exemption,
        custom_tax_subtotal: checkout_price_data.custom_tax_subtotal,
        promocode_applied: checkout_price_data.promocode_applied,
        credit_card_promotion: checkout_price_data.credit_card_promotion,
        shopee_coins_redeemed: checkout_price_data.shopee_coins_redeemed,
        group_buy_discount: checkout_price_data.group_buy_discount,
        bundle_deals_discount: checkout_price_data.bundle_deals_discount,
        buyer_txn_fee: checkout_price_data.buyer_txn_fee,
        insurance_subtotal: checkout_price_data.insurance_subtotal,
        insurance_before_discount_subtotal: checkout_price_data.insurance_before_discount_subtotal,
        insurance_discount_subtotal: checkout_price_data.insurance_discount_subtotal,
        vat_subtotal: checkout_price_data.vat_subtotal
      },
      order_update_info: {},
      dropshipping_info: user.infoCheckout.dropshipping_info,
      promotion_data: {
        applied_voucher_code: promotion_data.applied_voucher_code,
        voucher_code: promotion_data.voucher_code,
        can_use_coins: promotion_data.can_use_coins,
        use_coins: promotion_data.use_coins,
        platform_vouchers: promotion_data.platform_vouchers,
        free_shipping_voucher_info: {
          free_shipping_voucher_id: promotion_data.free_shipping_voucher_info.free_shipping_voucher_id || 0,
          free_shipping_voucher_code: promotion_data.free_shipping_voucher_info.free_shipping_voucher_code || "",
          disabled_reason: promotion_data.free_shipping_voucher_info.disabled_reason,
          banner_info: promotion_data.free_shipping_voucher_info.banner_info
        },
        invalid_message: promotion_data.invalid_message,
        price_discount: promotion_data.price_discount,
        voucher_info: promotion_data.voucher_info,
        coin_info: promotion_data.coin_info,
        card_promotion_id: promotion_data.card_promotion_id,
        card_promotion_enabled: promotion_data.card_promotion_enabled,
        promotion_msg: promotion_data.promotion_msg,
        ...function (vouchers) {
          if (vouchers.length > 0) {
            for (const voucher of vouchers) {
              return {
                shop_voucher_entrances: [{
                  shopid: user.config.shopid,
                  status: true
                }]
              }
            }
          }
          return {
            shop_voucher_entrances: [{
              shopid: user.config.shopid,
              status: false
            }]
          }
        }(user.updateKeranjang.data.shop_vouchers)
      },
      selected_payment_channel_data: user.payment.method,
      shoporders: [
        {
          shop: {
            shopid: shoporders.shop.shopid,
            shop_name: shoporders.shop.shop_name,
            cb_option: shoporders.shop.cb_option,
            is_official_shop: shoporders.shop.is_official_shop,
            remark_type: shoporders.shop.remark_type,
            support_ereceipt: shoporders.shop.support_ereceipt,
            seller_user_id: shoporders.shop.seller_user_id,
            shop_tag: shoporders.shop.shop_tag
          },
          items: [{
            itemid: shoporders.items[0].itemid,
            modelid: shoporders.items[0].modelid,
            quantity: shoporders.items[0].quantity,
            item_group_id: shoporders.items[0].item_group_id,
            insurances: shoporders.items[0].insurances,
            shopid: shoporders.items[0].shopid,
            shippable: shoporders.items[0].shippable,
            non_shippable_err: shoporders.items[0].non_shippable_err,
            none_shippable_reason: shoporders.items[0].none_shippable_reason,
            none_shippable_full_reason: shoporders.items[0].none_shippable_full_reason,
            price: user.price,
            name: shoporders.items[0].name,
            model_name: shoporders.items[0].model_name,
            add_on_deal_id: shoporders.items[0].add_on_deal_id,
            is_add_on_sub_item: shoporders.items[0].is_add_on_sub_item,
            is_pre_order: shoporders.items[0].is_pre_order,
            is_streaming_price: shoporders.items[0].is_streaming_price,
            image: shoporders.items[0].image,
            checkout: shoporders.items[0].checkout,
            categories: shoporders.items[0].categories
          }],
          tax_info: shoporders.tax_info,
          tax_payable: shoporders.tax_payable,
          shipping_id: shoporders.shipping_id,
          shipping_fee_discount: shoporders.shipping_fee_discount,
          shipping_fee: shoporders.shipping_fee,
          order_total_without_shipping: user.price * user.config.quantity,
          order_total: shoporders.shipping_fee + (user.price * user.config.quantity),
          buyer_remark: shoporders.buyer_remark || "",
          buyer_ic_number: shoporders.buyer_ic_number || "",
          ext_ad_info_mappings: [],

          // selected_preferred_delivery_time_option_id: shoporders.selected_preferred_delivery_time_option_id,
          // selected_logistic_channelid: shoporders.selected_logistic_channelid,
          // cod_fee: shoporders.cod_fee,
          // buyer_address_data: shoporders.buyer_address_data,
          // tax_exemption: shoporders.tax_exemption,
        }
      ],
      shipping_orders: [
        {
          shipping_id: shipping_orders.shipping_id,
          shoporder_indexes: shipping_orders.shoporder_indexes,
          selected_logistic_channelid: shipping_orders.selected_logistic_channelid,
          selected_preferred_delivery_time_option_id: 0,
          buyer_remark: shipping_orders.buyer_remark || "",
          buyer_address_data: shipping_orders.buyer_address_data,
          fulfillment_info: shipping_orders.fulfillment_info,
          order_total: shipping_orders.shipping_fee + (user.price * user.config.quantity),
          order_total_without_shipping: user.price * user.config.quantity,
          selected_logistic_channelid_with_warning: shipping_orders.selected_logistic_channelid_with_warning,
          shipping_fee: shipping_orders.shipping_fee,
          shipping_fee_discount: shipping_orders.shipping_fee_discount,
          shipping_group_description: shipping_orders.shipping_group_description,
          shipping_group_icon: shipping_orders.shipping_group_icon,
          tax_payable: shipping_orders.tax_payable,
          is_fsv_applied: shipping_orders.is_fsv_applied,
          buyer_ic_number: shipping_orders.buyer_ic_number || "",

          // cod_fee: shipping_orders.cod_fee,
          // shopee_shipping_discount_id: shipping_orders.shopee_shipping_discount_id,
          // voucher_wallet_checking_channel_ids: shipping_orders.voucher_wallet_checking_channel_ids,
          // tax_exemption: shipping_orders.tax_exemption,
        }
      ],
      fsv_selection_infos: user.infoCheckout.fsv_selection_infos,
      buyer_info: user.infoCheckout.buyer_info,
      buyer_txn_fee_info: tax.msg,
      disabled_checkout_info: user.infoCheckout.disabled_checkout_info,
      can_checkout: true,
      _cft: [11],
      device_info: cookie.parse(`device_sz_fingerprint=${user.userCookie.shopee_webUnique_ccd.value}`),
      captcha_version: 1
    }
  }(user)

  let curl = new user.Curl()

  return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TCP_KEEPALIVE, true).setOpt(curl.libcurl.option.TIMEOUT, 2)
    .setOtherOpt(function (curl) {
      user.config.end = Date.now();
      user.config.checkout = user.config.checkout || user.config.end
    }).setHeaders([
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      'x-track-id: b26f0c4411c6ec81fdd4a770b81127bf82056f7c1275832a9a5aa6dc4f1b08e4aa7c97945459d6d56907f0d8e0aadf1eb5e584ef0b961ca54eb62487baf55e7b',
      'x-cv-id: 106',
      `user-agent: ${process.env.USER_AGENT}`,
      'content-type: application/json',
      'accept: application/json',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-8e6117c82a707ccb01b22fc18e91caff',
      'x-api-source: pc',
      `x-csrftoken: ${user.userCookie.csrftoken.value}`,
      'origin: https://shopee.co.id',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      'referer: https://shopee.co.id/checkout',
      'accept-language: en-US,en;q=0.9',
      `cookie: ${serializeCookie(user.userCookie)}`,
    ]).setBody(JSON.stringify(user.postBuyBody)).post(`https://shopee.co.id/api/v2/checkout/place_order`)

}