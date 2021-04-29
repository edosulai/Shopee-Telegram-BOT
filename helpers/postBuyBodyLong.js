module.exports = function (user) {
  return {
    "status": 200,
    "headers": {},
    "cart_type": user.infoCheckout.cart_type,
    "shipping_orders": [
      {
        "selected_logistic_channelid": user.infoCheckout.shipping_orders[0].selected_logistic_channelid,
        "cod_fee": user.infoCheckout.shipping_orders[0].cod_fee,
        "order_total": user.infoCheckout.shipping_orders[0].order_total,
        "shipping_id": user.infoCheckout.shipping_orders[0].shipping_id,
        "shopee_shipping_discount_id": user.infoCheckout.shipping_orders[0].shopee_shipping_discount_id,
        "selected_logistic_channelid_with_warning": user.infoCheckout.shipping_orders[0].selected_logistic_channelid_with_warning,
        "shipping_fee_discount": user.infoCheckout.shipping_orders[0].shipping_fee_discount,
        "shipping_group_description": user.infoCheckout.shipping_orders[0].shipping_group_description,
        "selected_preferred_delivery_time_option_id": user.infoCheckout.shipping_orders[0].selected_preferred_delivery_time_option_id,
        "buyer_remark": user.infoCheckout.shipping_orders[0].buyer_remark || "",
        "buyer_address_data": user.infoCheckout.shipping_orders[0].buyer_address_data,
        "order_total_without_shipping": user.infoCheckout.shipping_orders[0].order_total_without_shipping,
        "tax_payable": user.infoCheckout.shipping_orders[0].tax_payable,
        "amount_detail": user.infoCheckout.shipping_orders[0].amount_detail,
        "buyer_ic_number": user.infoCheckout.shipping_orders[0].buyer_ic_number || "",
        "fulfillment_info": user.infoCheckout.shipping_orders[0].fulfillment_info,
        "voucher_wallet_checking_channel_ids": user.infoCheckout.shipping_orders[0].voucher_wallet_checking_channel_ids,
        "shoporder_indexes": user.infoCheckout.shipping_orders[0].shoporder_indexes,
        "shipping_fee": user.infoCheckout.shipping_orders[0].shipping_fee,
        "tax_exemption": user.infoCheckout.shipping_orders[0].tax_exemption,
        "shipping_group_icon": user.infoCheckout.shipping_orders[0].shipping_group_icon
      }
    ],
    "disabled_checkout_info": user.infoCheckout.disabled_checkout_info,
    "timestamp": Math.floor(user.config.timestamp / 1000),
    "checkout_price_data": user.infoCheckout.checkout_price_data,
    "client_id": user.infoCheckout.client_id,
    "promotion_data": {
      "promotion_msg": user.infoCheckout.promotion_data.promotion_msg,
      "price_discount": user.infoCheckout.promotion_data.price_discount,
      "can_use_coins": user.infoCheckout.promotion_data.can_use_coins,
      "voucher_info": user.infoCheckout.promotion_data.voucher_info,
      "coin_info": user.infoCheckout.promotion_data.coin_info,
      "free_shipping_voucher_info": {
        "free_shipping_voucher_id": user.infoCheckout.promotion_data.free_shipping_voucher_info.free_shipping_voucher_id || 0,
        "disabled_reason": user.infoCheckout.promotion_data.free_shipping_voucher_info.disabled_reason,
        "free_shipping_voucher_code": user.infoCheckout.promotion_data.free_shipping_voucher_info.free_shipping_voucher_code || ""
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
      "card_promotion_enabled": user.infoCheckout.promotion_data.card_promotion_enabled,
      "invalid_message": user.infoCheckout.promotion_data.invalid_message,
      "card_promotion_id": user.infoCheckout.promotion_data.card_promotion_id,
      "voucher_code": user.infoCheckout.promotion_data.voucher_code,
      "use_coins": user.infoCheckout.promotion_data.use_coins
    },
    "dropshipping_info": user.infoCheckout.dropshipping_info,
    "selected_payment_channel_data": user.payment.method,
    "shoporders": [
      {
        "shop": user.infoCheckout.shoporders[0].shop,
        "buyer_remark": user.infoCheckout.shoporders[0].buyer_remark || "",
        "shipping_fee": user.infoCheckout.shoporders[0].shipping_fee,
        "order_total": user.infoCheckout.shoporders[0].order_total,
        "shipping_id": user.infoCheckout.shoporders[0].shipping_id,
        "buyer_ic_number": user.infoCheckout.shoporders[0].buyer_ic_number || "",
        "items": user.infoCheckout.shoporders[0].items,
        "selected_preferred_delivery_time_option_id": user.infoCheckout.shoporders[0].selected_preferred_delivery_time_option_id,
        "selected_logistic_channelid": user.infoCheckout.shoporders[0].selected_logistic_channelid,
        "cod_fee": user.infoCheckout.shoporders[0].cod_fee,
        "tax_payable": user.infoCheckout.shoporders[0].tax_payable,
        "buyer_address_data": user.infoCheckout.shoporders[0].buyer_address_data,
        "shipping_fee_discount": user.infoCheckout.shoporders[0].shipping_fee_discount,
        "tax_info": user.infoCheckout.shoporders[0].tax_info,
        "order_total_without_shipping": user.infoCheckout.shoporders[0].order_total_without_shipping,
        "tax_exemption": user.infoCheckout.shoporders[0].tax_exemption,
        "amount_detail": user.infoCheckout.shoporders[0].amount_detail,
        "ext_ad_info_mappings": []
      }
    ],
    "can_checkout": user.infoCheckout.can_checkout,
    "order_update_info": {},
    "buyer_txn_fee_info": user.infoCheckout.buyer_txn_fee_info,
    "captcha_version": 1
  }
}