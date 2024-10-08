const { curly } = require('node-libcurl');

module.exports = async function () {

  return curly.get(`https://shopee.co.id/api/v2/flash_sale/get_all_sessions`, {
    httpHeader: [
      'authority: shopee.co.id',
      'pragma: no-cache',
      'cache-control: no-cache',
      `user-agent: ${process.env.USER_AGENT}`,
      'x-api-source: pc',
      'x-shopee-language: id',
      'x-requested-with: XMLHttpRequest',
      'if-none-match-: 55b03-445da8daf48c3630a60fdb062de8b1d4',
      'accept: */*',
      'sec-fetch-site: same-origin',
      'sec-fetch-mode: cors',
      'sec-fetch-dest: empty',
      'referer: https://shopee.co.id/flash_sale',
      'accept-language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    ]
  })
}