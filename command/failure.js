const User = require('./models/User');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session;
  user.commands = getCommands(ctx.message.text)
  if (objectSize(user.commands) < 1) return ctx.reply(`/failure <code>url=...</code>`, { parse_mode: 'HTML' })

  if (user.commands.url) {
    if (psl.get(extractRootDomain(user.commands.url)) != 'shopee.co.id') return ctx.reply('Bukan Url Dari Shopee')

    let pathname = url.parse(user.commands.url, true).pathname.split('/')

    if (pathname.length == 4) {
      user.itemid = parseInt(pathname[3])
      user.shopid = parseInt(pathname[2])
    } else {
      pathname = pathname[1].split('.')
      user.itemid = parseInt(pathname[pathname.length - 1])
      user.shopid = parseInt(pathname[pathname.length - 2])
    }

    if (!Number.isInteger(user.itemid) || !Number.isInteger(user.shopid)) return ctx.reply('Bukan Url Produk Shopee')
  }

  if (user.commands['-clear']) {
    return Failure.deleteMany(user.itemid ? { itemid: user.itemid, shopid: user.shopid } : null)
      .then((result) => {
        return ctx.reply(`${result.deletedCount} Failure Telah Terhapus`)
      }).catch((err) => sendReportToDev(ctx, new Error(err)));
  }

  return Failure.findOne({ itemid: user.itemid, shopid: user.shopid }, async function (err, failure) {
    if (err || !failure) return ctx.reply('Failure Untuk Produk Ini Tidak Tersedia!!')
    fs.writeFileSync(`failure-${user.itemid}.json`, JSON.stringify(failure));
    await ctx.telegram.sendDocument(ctx.message.chat.id, { source: `./failure-${user.itemid}.json` }).catch((err) => console.error(chalk.red(err)))
    return fs.unlinkSync(`./failure-${user.itemid}.json`);
  })
}