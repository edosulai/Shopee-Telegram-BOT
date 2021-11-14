const AllItemids = require('../request/other/AllItemids');
const FlashSaleBatchItems = require('../request/other/FlashSaleBatchItems');

const User = require('../models/User');
const FlashSale = require('../models/FlashSale');
const Event = require('../models/Event');

const { logReport, ensureRole, getCommands, numTocurrency, sendMessage, replaceMessage, sleep, setNewCookie } = require('../helpers')

module.exports = async function alarmFlashSale(ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session

  user.commands = getCommands(ctx.message.text)

  if (user.commands['-stop']) {
    return User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { alarm: false }).exec()
  }

  if (user.alarm) {
    return sendMessage(ctx, 'Alarm Sudah Berjalan!!')
  }

  user.autobuy = user.commands['-autobuy'] || false
  user.alarmMessage = []
  user.beginMax = []
  user.max = []
  user.eventLength = []

  await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { alarm: true }).exec()
  user.flashsale = (await FlashSale.find({ teleBotId: process.env.BOT_ID })).sort((a, b) => a.start_time - b.start_time);

  for await (const [index, session] of user.flashsale.entries()) {
    await sendMessage(ctx, `<code>${session.name + (session.with_mega_sale_session ? " | MEGA SALE" : "")}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
      user.alarmMessage[index] = {
        chatId: replyCtx.chat.id,
        msgId: replyCtx.message_id,
        inlineMsgId: replyCtx.inline_message_id,
        text: replyCtx.text
      }
      user.beginMax[index] = { price_before_discount: 0, url: null }
      user.max[index] = { price_before_discount: 0, url: null }
      user.eventLength[index] = 0
    })
  }

  let predictPrice = {
    "?1": 11,
    "?.000": 1000,
    "?0.000": 10000
  }

  let minPredict = 100000

  do {

    for await (const [index, session] of user.flashsale.entries()) {
      if (index == 0 && ((session.end_time - 10) * 1000) - Date.now() < 0) {
        for (const msg of user.alarmMessage) {
          await ctx.telegram.deleteMessage(msg.chatId, msg.msgId)
        }
        await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { alarm: false }).exec()
        return setTimeout(await alarmFlashSale.bind(null, ctx), 15000);
      }

      user.start = Date.now()

      await AllItemids(session).then(({ statusCode, data, headers }) => {
        setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
        let chunk = typeof data == 'string' ? JSON.parse(data) : data;
        if (chunk.data.promotionid) user.AllItemids = chunk
        else user.start = false;
      }).catch((err) => {
        user.start = false;
        return err
      })

      if (!user.start) continue;

      await FlashSaleBatchItems(ctx).then(({ statusCode, data, headers }) => {
        setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
        let chunk = typeof data == 'string' ? JSON.parse(data) : data;
        if (chunk.data) user.FlashSaleSession = chunk
        else user.start = false;
      }).catch((err) => {
        user.start = false;
        return err
      })

      if (!user.start) continue;

      let banner = session.name + (session.with_mega_sale_session ? " | MEGA SALE" : "")
      user.max[index] = { price_before_discount: 0, url: null }
      let eventLength = 0;

      for await (const item of user.FlashSaleSession.data.items) {
        if (predictPrice[item.hidden_price_display] && (item.price_before_discount / minPredict > minPredict)) {
          if (item.price_before_discount > user.max[index].price_before_discount) {
            user.max[index] = {
              price_before_discount: item.price_before_discount,
              url: `https://shopee.co.id/product/${item.shopid}/${item.itemid}`
            }
          }
          eventLength++
          banner += `\n\n${item.name} - (Rp. ${item.hidden_price_display}) - Rp. ${numTocurrency(item.price_before_discount / minPredict)} - https://shopee.co.id/product/${item.shopid}/${item.itemid}`

          await Event.findOrCreate({
            teleBotId: process.env.BOT_ID,
            itemid: item.itemid,
            shopid: item.shopid
          }, {
            barang: item.name.replace(/<[^>]*>?/gm, ""),
            url: `https://shopee.co.id/product/${item.shopid}/${item.itemid}`,
            price: predictPrice[item.hidden_price_display]
          }, async function (err, event, created) {
            if (err) return logReport(ctx, err)
          })
        }
      }

      if (
        index == 0 &&
        user.beginMax[index].url != user.max[index].url &&
        user.beginMax[index].price_before_discount != user.max[index].price_before_discount &&
        user.autobuy
      ) {
        user.beginMax[index] = user.max[index]

        await sendMessage(ctx, `Memuat... <code>${user.max[index].url}</code>`, { parse_mode: 'HTML' }).then(async (replyCtx) => {
          await ctx.telegram.deleteMessage(replyCtx.chat.id, replyCtx.message_id)
        })
      }

      if (eventLength != user.eventLength[index]) {
        user.eventLength[index] = eventLength;
        await replaceMessage(ctx, user.alarmMessage[index], banner)
      }

      await sleep(1000 - (Date.now() - user.start))
    }

  } while (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, alarm: true }));

  for (const msg of user.alarmMessage) await ctx.telegram.deleteMessage(msg.chatId, msg.msgId)
}