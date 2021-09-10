(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = async function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session
  user.commands = getCommands(ctx.message.text)
  if (objectSize(user.commands) < 1) return ctx.reply(`/speed <code>limit=1 url=http://example.com/</code>`, { parse_mode: 'HTML' })

  if (typeof user.commands.url != 'string') return ctx.reply('Syntax Tidak Lengkap')
  if (!isValidURL(user.commands.url)) return ctx.reply('Format Url Salah')

  let howmuch = commands.time || 1;

  for (let i = 0; i < howmuch; i++) {
    let totalRequest = 0;
    let totalWaktu = 0;
    let tunggu = Date.now();

    while (totalWaktu < (user.commands.limit * 1000)) {
      let curl = new user.Curl();
      await curl.setOtherOpt(function (curl) {
        if (user.commands['-noresponse']) {
          curl
            .setOpt(curl.libcurl.option.TIMEOUT_MS, 1)
            .setOpt(curl.libcurl.option.NOSIGNAL, true)
        }
      }).get(user.commands.url).then().catch((err) => err);
      totalWaktu = Date.now() - tunggu;
      totalRequest++;
    }

    await ctx.reply(`Total cURL Dalam ${user.commands.limit} Detik = ${totalRequest}`)
  }
}