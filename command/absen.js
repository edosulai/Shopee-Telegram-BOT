const { curly } = require('node-libcurl');
const { parse } = require('node-html-parser');

const { logReport, replaceMessage, ensureRole, getCommands } = require('../helpers')

module.exports = async function (ctx) {
  let user = ctx.session;
  if (!ensureRole(ctx)) return
  user.commands = getCommands(ctx.message.text)
  if (user.commands.length < 2) return

  await ctx.reply(`Memuat... <code>${user.commands.krs}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
    user.message = {
      chatId: replyCtx.chat.id,
      msgId: replyCtx.message_id,
      inlineMsgId: replyCtx.inline_message_id,
      text: replyCtx.text
    }
  })

  const users_token = 'MTgxMDExNTI2MzAwOTIjMTgxMDExNTI2MzAwOTIjRURPIFNVTEFJTUFOI01haGFzaXN3YQ%3D%3D'
  const PHPSESSID = 'ucvudhljklv7crc7cjhbo4e184'

  let START = user.commands.start || 0;

  while (START < Number.MAX_VALUE) {

    await curly.get(`https://estudy-filkom.upiyptk.ac.id//kuliah/masuk/${START}/${user.commands.kode}/${user.commands.krs}`, {
      httpHeader: [
        'Connection: keep-alive',
        'Pragma: no-cache',
        'Cache-Control: no-cache',
        'sec-ch-ua: " Not A;Brand";v="99", "Chromium";v="96", "Google Chrome";v="96"',
        'sec-ch-ua-mobile: ?0',
        'sec-ch-ua-platform: "Windows"',
        'DNT: 1',
        'Upgrade-Insecure-Requests: 1',
        `User-Agent: ${process.env.USER_AGENT}`,
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Sec-Fetch-Site: none',
        'Sec-Fetch-Mode: navigate',
        'Sec-Fetch-User: ?1',
        'Sec-Fetch-Dest: document',
        'Accept-Language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        `Cookie: PHPSESSID=${PHPSESSID}; users_token=${users_token}`,
      ],
      caInfo: process.env.CERT_PATH
    }).then(async ({ statusCode, data, headers }) => {
      let document = parse(data);
      
      if (!Array.from(document.querySelectorAll('span')).find(el => el.textContent === ': IF-3')) {
        await replaceMessage(ctx, user.message, `Searching Ke : ${START}`)
        START++
      } else {
        await ctx.reply(`https://estudy-filkom.upiyptk.ac.id//kuliah/masuk/${START}/${user.commands.kode}/${user.commands.krs}`)
        START = Number.MAX_VALUE
      }

    }).catch((err) => console.log(err));

  }
}