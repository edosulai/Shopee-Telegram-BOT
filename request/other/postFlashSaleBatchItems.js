module.exports = async function (user) {
  let curl = new user.Curl()

  return curl.setOpt(curl.libcurl.option.SSL_VERIFYPEER, false).setOpt(curl.libcurl.option.TIMEOUT, 3)
    .setHeaders([
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      `user-agent: ${process.env.USER_AGENT}`,
      'x-api-source: pc',
      'accept: application/json',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-71711ba01c6ae116c8ced98178e5e89f',
      'content-type: application/json',
      'origin: https://shopee.co.id',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      'referer: https://shopee.co.id/flash_sale',
      'accept-language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    ]).setBody(JSON.stringify({
      "promotionid": user.getAllItemids.data.promotionid,
      "categoryid": 0,
      "itemids": user.getAllItemids.data.item_brief_list.filter((item, index) => {
        if (index < 50) return item.itemid
      }).map((item, index) => item.itemid),
      "sort_soldout": true,
      "limit": 12,
      "need_personalize": true,
      "with_dp_items": true
    })).post(`https://shopee.co.id/api/v2/flash_sale/flash_sale_batch_get_items`)
}