const postBuy = require('../request/buy/postBuy');
const postUpdateKeranjang = require('../request/buy/postUpdateKeranjang');
const postCancel = require('../request/other/postCancel');
const getOrders = require('../request/other/getOrders');
const getCheckouts = require('../request/other/getCheckouts');

const { sendReportToDev, setNewCookie, timeConverter, ensureRole } = require('./helpers')

module.exports = function buyItem(ctx) {
  let user = ctx.session;

  return postBuy(ctx).then(async ({ statusCode, body, headers, curlInstance, curl, err }) => {
    if (err) return err;

    setNewCookie(user.userCookie, headers['set-cookie'])
    user.order = typeof body == 'string' ? JSON.parse(body) : body;
    user.order.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
    curl.close()

    user.info = `\n\nMetode Pembayaran : ${user.payment.msg}`
    user.info += `\n\nBot Start : <b>${timeConverter(user.config.start, { usemilis: true })}</b>`
    user.info += `\nCheckout : <b>${timeConverter(user.config.checkout, { usemilis: true })}</b>`
    user.info += `\nBot End : <b>${timeConverter(Date.now(), { usemilis: true })}</b>`

    if (user.order.error) {
      user.config.fail = user.config.fail + 1
      user.info += `\n\n<i>Gagal Melakukan Payment Barang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b>\n${user.order.error_msg}</i>\n${ensureRole(ctx, true) ? user.order.error : null}`

      if (user.config.fail < 3 && ['error_fulfillment_info_changed_mwh', 'error_fulfillment_info_changed', 'error_creating_orders_42'].includes(user.order.error)) {
        return buyItem(ctx)
      }

      await postUpdateKeranjang(user, 2).then(({ statusCode, body, headers, curlInstance, curl }) => {
        curl.close()
        setNewCookie(user.userCookie, headers['set-cookie'])
        user.info += `\n\nBarang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b> Telah Telah Di Hapus Dari Keranjang`
      }).catch((err) => sendReportToDev(ctx, new Error(err)));

    } else {
      user.config.success = true
      user.info += `\n\n<i>Barang <b>(${user.selectedItem.name.replace(/<[^>]*>?/gm, "")})</b> Berhasil Di Pesan</i>`

      if (user.config.autocancel) {
        await postCancel(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
          curl.close()
          setNewCookie(user.userCookie, headers['set-cookie'])
          user.info += `\n\nAuto Cancel Barang (${user.selectedItem.name}) Berhasil`
        }).catch((err) => sendReportToDev(ctx, new Error(err)));
      }
    }

    return user.info
  }).catch((err) => sendReportToDev(ctx, new Error(err)));
}