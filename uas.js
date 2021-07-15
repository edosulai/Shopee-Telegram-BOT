const Curl = require('./helpers/curl');

const PHPSESSID = `jsdhrfcbcjdpc39lvkh8cq654k`
const users_token = `MTgxMDExNTI2MzAwOTUjMTgxMDExNTI2MzAwOTUjRkFIUkkgQUtCQVIgVEFOSlVORyNNYWhhc2lzd2E%3D`
const KODE_KULIAH = `KBKF63108`

let ndaktau = 1;
let koktanya = 700;

(async function () {
  while (true) {
    let curl = new Curl()

    await curl.setOpt(curl.libcurl.option.CAINFO, './helpers/cacert.pem').setOpt(curl.libcurl.option.SSL_VERIFYPEER, true).setOpt(curl.libcurl.option.TIMEOUT, 3)
      .setHeaders([
        'Connection: keep-alive',
        'Cache-Control: max-age=0',
        'Upgrade-Insecure-Requests: 1',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36 Edg/88.0.705.63',
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Sec-Fetch-Site: none',
        'Sec-Fetch-Mode: navigate',
        'Sec-Fetch-User: ?1',
        'Sec-Fetch-Dest: document',
        'Accept-Language: en-US,en;q=0.9',
        `Cookie: PHPSESSID=${PHPSESSID}; users_token=${users_token}`,
      ]).get(`https://estudy-filkom.upiyptk.ac.id//ujian/masuk/${ndaktau}/${koktanya}/${KODE_KULIAH}`)
      .then(({ statusCode, body, headers, curlInstance, curl }) => {
        if (body.includes("Maaf, Halaman yang anda cari tidak ditemukan dalam situs ini, silahkan koreksi lagi keyword yang anda masukan...")) {
          process.stdout.write(`\rSearching Tahap Ke : ${ndaktau} , ${koktanya}`);
        } else {
          console.log(`\nhttps://estudy-filkom.upiyptk.ac.id//ujian/masuk/${ndaktau}/${koktanya}/${KODE_KULIAH}`);
        }
      }).catch((err) => console.log(err));

    ndaktau++

    if (ndaktau >= 3000) {
      ndaktau = 1
      koktanya++
    }
  }
})()