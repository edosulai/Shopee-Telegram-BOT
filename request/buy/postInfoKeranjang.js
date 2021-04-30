module.exports = async function (user, getCache) {
  let curl = new user.Curl()

  return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TIMEOUT, 3)
    .setOtherOpt(function (curl) {
      if (user.infoKeranjang && !getCache) curl.setOpt(curl.libcurl.option.TIMEOUT_MS, 1).setOpt(curl.libcurl.option.NOSIGNAL, true)
    }).setHeaders([
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      `user-agent: ${user.userLoginInfo.userAgent}`,
      'x-api-source: pc',
      'accept: application/json',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-1b0fd928d8c948f4ab007af348d7551d',
      'content-type: application/json',
      `x-csrftoken: ${user.userCookie.csrftoken}`,
      'origin: https://shopee.co.id',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      `referer: https://shopee.co.id/cart?itemKeys=${user.config.itemid}.${user.config.modelid}.&shopId=${user.config.shopid}`,
      'accept-language: en-US,en;q=0.9',
      `cookie: ${curl.serializeCookie(user.userCookie)}`,
    ]).setBody(JSON.stringify({ "pre_selected_item_list": [] })).post(`https://shopee.co.id/api/v4/cart/get`)
}