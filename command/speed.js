const User = require('./models/User');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = function (ctx) {
  if (!ensureRole(ctx)) return
  let commands = getCommands(ctx.message.text)
  if (objectSize(commands) < 1) return ctx.reply(`/speed <code>limit=1 url=http://example.com/</code>`, { parse_mode: 'HTML' })

  if (typeof commands.url != 'string') return ctx.reply('Syntax Tidak Lengkap')
  if (!isValidURL(commands.url)) return ctx.reply('Format Url Salah')

  let howmuch = commands.time || 1;

  for (let i = 0; i < howmuch; i++) {
    let totalRequest = 0;
    let totalWaktu = 0;
    let tunggu = Date.now();

    while (totalWaktu < (commands.limit * 1000)) {
      let curl = new Curl();
      await curl.setOtherOpt(function (curl) {
        if (commands['-noresponse']) {
          curl
            .setOpt(curl.libcurl.option.TIMEOUT_MS, 1)
            .setOpt(curl.libcurl.option.NOSIGNAL, true)
        }
      }).get(commands.url).then().catch((err) => err);
      totalWaktu = Date.now() - tunggu;
      totalRequest++;
    }

    await ctx.reply(`Total cURL Dalam ${commands.limit} Detik = ${totalRequest}`)
  }
}