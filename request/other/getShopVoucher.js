module.exports = async function (user) {
  let curl = new user.Curl()

  return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TIMEOUT, 3)
    .setHeaders([
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      `user-agent: ${user.userLoginInfo.userAgent}`,
      'x-api-source: pc',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-8399610321d405732373a6200cc3d210',
      'accept: */*',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      `referer: ${user.config.url}`,
      'accept-language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      `cookie: ${curl.serializeCookie(user.userCookie)}`
    ]).get(`https://shopee.co.id/api/v2/voucher_wallet/get_shop_vouchers_by_shopid?itemid=${user.config.itemid}&shopid=${user.config.shopid}&with_claiming_status=true`)
}