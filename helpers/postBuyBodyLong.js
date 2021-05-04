module.exports = function (user) {
  user.infoCheckout = user.infoCheckoutLong

  let shipping_orders = user.infoCheckout.shipping_orders[0]
  let checkout_price_data = user.infoCheckout.checkout_price_data
  let shoporders = user.infoCheckout.shoporders[0]
  let promotion_data = user.infoCheckout.promotion_data

  return {
    "status": 200,
    "headers": {},
    "cart_type": user.infoCheckout.cart_type,
    "shipping_orders": [
      {
        "selected_logistic_channelid": shipping_orders.selected_logistic_channelid,
        "cod_fee": shipping_orders.cod_fee,
        "order_total": shipping_orders.shipping_fee + (user.config.price * user.config.quantity),
        "shipping_id": shipping_orders.shipping_id,
        "shopee_shipping_discount_id": shipping_orders.shopee_shipping_discount_id,
        "selected_logistic_channelid_with_warning": shipping_orders.selected_logistic_channelid_with_warning,
        "shipping_fee_discount": shipping_orders.shipping_fee_discount,
        "shipping_group_description": shipping_orders.shipping_group_description,
        "selected_preferred_delivery_time_option_id": shipping_orders.selected_preferred_delivery_time_option_id,
        "buyer_remark": shipping_orders.buyer_remark || "",
        "buyer_address_data": shipping_orders.buyer_address_data,
        "order_total_without_shipping": user.config.price * user.config.quantity,
        "tax_payable": shipping_orders.tax_payable,
        "amount_detail": {
          "BASIC_SHIPPING_FEE": shipping_orders.amount_detail.BASIC_SHIPPING_FEE,
          "SELLER_ESTIMATED_INSURANCE_FEE": shipping_orders.amount_detail.SELLER_ESTIMATED_INSURANCE_FEE,
          "SHOPEE_OR_SELLER_SHIPPING_DISCOUNT": shipping_orders.amount_detail.SHOPEE_OR_SELLER_SHIPPING_DISCOUNT,
          "VOUCHER_DISCOUNT": shipping_orders.amount_detail.VOUCHER_DISCOUNT,
          "SHIPPING_DISCOUNT_BY_SELLER": shipping_orders.amount_detail.SHIPPING_DISCOUNT_BY_SELLER,
          "SELLER_ESTIMATED_BASIC_SHIPPING_FEE": shipping_orders.amount_detail.SELLER_ESTIMATED_BASIC_SHIPPING_FEE,
          "SHIPPING_DISCOUNT_BY_SHOPEE": shipping_orders.amount_detail.SHIPPING_DISCOUNT_BY_SHOPEE,
          "INSURANCE_FEE": shipping_orders.amount_detail.INSURANCE_FEE,
          "ITEM_TOTAL": user.config.price * user.config.quantity,
          "TAX_EXEMPTION": shipping_orders.amount_detail.TAX_EXEMPTION,
          "shop_promo_only": shipping_orders.amount_detail.shop_promo_only,
          "COD_FEE": shipping_orders.amount_detail.COD_FEE,
          "TAX_FEE": shipping_orders.amount_detail.TAX_FEE,
          "SELLER_ONLY_SHIPPING_DISCOUNT": shipping_orders.amount_detail.SELLER_ONLY_SHIPPING_DISCOUNT
        },
        "buyer_ic_number": shipping_orders.buyer_ic_number || "",
        "fulfillment_info": shipping_orders.fulfillment_info,
        "voucher_wallet_checking_channel_ids": shipping_orders.voucher_wallet_checking_channel_ids,
        "shoporder_indexes": shipping_orders.shoporder_indexes,
        "shipping_fee": shipping_orders.shipping_fee,
        "tax_exemption": shipping_orders.tax_exemption,
        "shipping_group_icon": shipping_orders.shipping_group_icon
      }
    ],
    "disabled_checkout_info": user.infoCheckout.disabled_checkout_info,
    "timestamp": Math.floor(user.config.timestamp / 1000),
    "checkout_price_data": {
      "shipping_subtotal": checkout_price_data.shipping_subtotal,
      "shipping_discount_subtotal": checkout_price_data.shipping_discount_subtotal,
      "shipping_subtotal_before_discount": checkout_price_data.shipping_subtotal_before_discount,
      "bundle_deals_discount": checkout_price_data.bundle_deals_discount,
      "group_buy_discount": checkout_price_data.group_buy_discount,
      "merchandise_subtotal": user.config.price * user.config.quantity,
      "tax_payable": checkout_price_data.tax_payable,
      "buyer_txn_fee": checkout_price_data.buyer_txn_fee,
      "credit_card_promotion": checkout_price_data.credit_card_promotion,
      "promocode_applied": checkout_price_data.promocode_applied,
      "shopee_coins_redeemed": checkout_price_data.shopee_coins_redeemed,
      "total_payable": shipping_orders.shipping_fee + (user.config.price * user.config.quantity) + user.tax.value,
      "tax_exemption": checkout_price_data.tax_exemption
    },
    "client_id": user.infoCheckout.client_id,
    "promotion_data": {
      "promotion_msg": promotion_data.promotion_msg,
      "price_discount": promotion_data.price_discount,
      "can_use_coins": promotion_data.can_use_coins,
      "voucher_info": promotion_data.voucher_info,
      "coin_info": promotion_data.coin_info,
      "free_shipping_voucher_info": {
        "free_shipping_voucher_id": promotion_data.free_shipping_voucher_info.free_shipping_voucher_id || 0,
        "disabled_reason": promotion_data.free_shipping_voucher_info.disabled_reason,
        "free_shipping_voucher_code": promotion_data.free_shipping_voucher_info.free_shipping_voucher_code || ""
      },
      "applied_voucher_code": promotion_data.applied_voucher_code,
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
      "card_promotion_enabled": promotion_data.card_promotion_enabled,
      "invalid_message": promotion_data.invalid_message,
      "card_promotion_id": promotion_data.card_promotion_id,
      "voucher_code": promotion_data.voucher_code,
      "use_coins": promotion_data.use_coins
    },
    "dropshipping_info": user.infoCheckout.dropshipping_info,
    "selected_payment_channel_data": user.payment.method,
    "shoporders": [
      {
        "shop": shoporders.shop,
        "buyer_remark": shoporders.buyer_remark || "",
        "shipping_fee": shoporders.shipping_fee,
        "order_total": shoporders.shipping_fee + (user.config.price * user.config.quantity),
        "shipping_id": shoporders.shipping_id,
        "buyer_ic_number": shoporders.buyer_ic_number || "",
        "items": shoporders.items,
        "selected_preferred_delivery_time_option_id": shoporders.selected_preferred_delivery_time_option_id,
        "selected_logistic_channelid": shoporders.selected_logistic_channelid,
        "cod_fee": shoporders.cod_fee,
        "tax_payable": shoporders.tax_payable,
        "buyer_address_data": shoporders.buyer_address_data,
        "shipping_fee_discount": shoporders.shipping_fee_discount,
        "tax_info": shoporders.tax_info,
        "order_total_without_shipping": user.config.price * user.config.quantity,
        "tax_exemption": shoporders.tax_exemption,
        "amount_detail": {
          "BASIC_SHIPPING_FEE": shoporders.amount_detail.BASIC_SHIPPING_FEE,
          "SELLER_ESTIMATED_INSURANCE_FEE": shoporders.amount_detail.SELLER_ESTIMATED_INSURANCE_FEE,
          "SHOPEE_OR_SELLER_SHIPPING_DISCOUNT": shoporders.amount_detail.SHOPEE_OR_SELLER_SHIPPING_DISCOUNT,
          "VOUCHER_DISCOUNT": shoporders.amount_detail.VOUCHER_DISCOUNT,
          "SHIPPING_DISCOUNT_BY_SELLER": shoporders.amount_detail.SHIPPING_DISCOUNT_BY_SELLER,
          "SELLER_ESTIMATED_BASIC_SHIPPING_FEE": shoporders.amount_detail.SELLER_ESTIMATED_BASIC_SHIPPING_FEE,
          "SHIPPING_DISCOUNT_BY_SHOPEE": shoporders.amount_detail.SHIPPING_DISCOUNT_BY_SHOPEE,
          "INSURANCE_FEE": shoporders.amount_detail.INSURANCE_FEE,
          "ITEM_TOTAL": user.config.price * user.config.quantity,
          "TAX_EXEMPTION": shoporders.amount_detail.TAX_EXEMPTION,
          "shop_promo_only": shoporders.amount_detail.shop_promo_only,
          "COD_FEE": shoporders.amount_detail.COD_FEE,
          "TAX_FEE": shoporders.amount_detail.TAX_FEE,
          "SELLER_ONLY_SHIPPING_DISCOUNT": shoporders.amount_detail.SELLER_ONLY_SHIPPING_DISCOUNT
        },
        "ext_ad_info_mappings": []
      }
    ],
    "can_checkout": user.infoCheckout.can_checkout,
    "order_update_info": {},
    "buyer_txn_fee_info": user.tax.msg,
    "captcha_version": 1
  }
}