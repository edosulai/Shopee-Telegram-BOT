module.exports = function (user, channels, checkEnable = false) {
  let payment = user.config.payment

  let paymentMethod = {}
  for (const channel of channels) {
    if (!Object.hasOwnProperty.call(channel, 'name')) continue;

    if (channel.name_label == 'label_shopee_wallet_v2') {
      paymentMethod.shopeePay = ShopeePayTransFunc(channel, checkEnable)
    }

    if (channel.name_label == 'label_cod') {
      paymentMethod.cod = CODTransFunc(channel, checkEnable)
    }

    if (Object.hasOwnProperty.call(channel, 'banks')) {
      paymentMethod.transferBank = BankTransFunc(payment, channel, checkEnable)
    }
  }

  // let allowingPayment = paymentMethod.filter(method => typeof method == 'object');

  if (payment.cod && paymentMethod.cod) return paymentMethod.cod
  if (payment.shopeePay && paymentMethod.shopeePay) return paymentMethod.shopeePay
  if (paymentMethod.transferBank && paymentMethod.transferBank) return paymentMethod.transferBank

  return {
    method: user.payment.method,
    msg: `Semua Metode Pembayaran Tidak Tersedia`,
    enable: false
  }
}

let BankTransFunc = function (payment, channel, checkEnable) {
  let bank_name = {
    bca: 'Bank BCA (Dicek Otomatis)',
    mandiri: 'Bank Mandiri (Dicek Otomatis)',
    bni: 'Bank BNI (Dicek Otomatis)',
    bri: 'Bank BRI (Dicek Otomatis)',
    bsi: 'Bank Syariah Indonesia (BSI) (Dicek Otomatis)',
    permata: 'Bank Permata (Dicek Otomatis)'
  }

  for (const eachTransfer of payment.transferBank) {
    for (const bank of channel.banks) {
      if (bank.bank_name != bank_name[eachTransfer]) continue;

      if (!checkEnable) {
        return {
          method: {
            channel_id: channel.channel_id,
            channel_item_option_info: { option_info: bank.option_info },
            version: channel.version,
            text_info: {}
          },
          msg: `Transfer ${bank.bank_name}`,
          enable: true
        }
      }

      if (!bank.enabled) continue;

      return {
        method: {
          channel_id: channel.channel_id,
          channel_item_option_info: { option_info: bank.option_info },
          version: channel.version,
          text_info: {}
        },
        msg: `Transfer ${bank.bank_name}`,
        enable: true
      }
    }
  }

  return false;
}

let ShopeePayTransFunc = function (channel, checkEnable) {
  if (!checkEnable) {
    return {
      method: {
        channel_id: channel.channel_id,
        version: channel.version
      },
      msg: 'ShopeePay',
      enable: true
    }
  }

  if (!channel.enabled) return false;

  return {
    method: {
      channel_id: channel.channel_id,
      version: channel.version
    },
    msg: 'ShopeePay',
    enable: true
  }
}

let CODTransFunc = function (channel, checkEnable) {
  if (!checkEnable) {
    return {
      method: {
        payment_channelid: channel.channelid,
        version: channel.version
      },
      msg: 'COD',
      enable: true
    }
  }

  if (!channel.enabled) return false;

  return {
    method: {
      payment_channelid: channel.channelid,
      version: channel.version
    },
    msg: 'COD',
    enable: true
  }
}