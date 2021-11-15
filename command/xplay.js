const tr = require('tor-request');
const fs = require('fs');

const { splitAtFirstSpace, replaceMessage } = require('../helpers')

module.exports = async function (ctx) {
  let user = ctx.session;

  if (!ensureRole(ctx)) return
  if (!fs.existsSync('../temp')) fs.mkdirSync('../temp')

  user.commands = splitAtFirstSpace(ctx.message.text)
  if (user.commands.length < 2) return ctx.reply(`/xplay <code>...url...</code>`, { parse_mode: 'HTML' })

  user.url = user.commands[1].split('/')

  await ctx.reply(`Memuat... <code>${user.url[user.url.length - 1]}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
    user.message = {
      chatId: replyCtx.chat.id,
      msgId: replyCtx.message_id,
      inlineMsgId: replyCtx.inline_message_id,
      text: replyCtx.text
    }
  })

  try {
    if (!fs.existsSync(`../temp${user.url[user.url.length - 1]}`)) {
      await replaceMessage(ctx, user.message, `<code>Sedang Mendownload Video ${user.url[user.url.length - 1]}</code>`, false)

      return tr.request({
        url: `${process.env.XPLAY_DOMAIN}/hwdvideos/uploads/${user.url[user.url.length - 2]}/${user.url[user.url.length - 1]}`,
        headers: {
          'connection': 'keep-alive',
          'DNT': '1',
          'range': 'bytes=0-',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
          'accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
          'accept-language': 'en-US,en;q=0.5'
        },
        strictSSL: true,
        agentOptions: {
          socksHost: '127.0.0.1',
          socksPort: 9050,
        }
      }, async (err, response, body) => await replaceMessage(ctx, user.message, `Video ${user.url[user.url.length - 1]} Terdownload`, false)).pipe(fs.createWriteStream(`./temp/${user.url[user.url.length - 1]}`))
    }

    await ctx.telegram.deleteMessage(user.message.chatId, user.message.msgId)
  } catch (err) {
    console.error(err)
  }
}