const getAllItemids = require('../request/other/getAllItemids');
const postFlashSaleBatchItems = require('../request/other/postFlashSaleBatchItems');

const User = require('../models/User');
const FlashSale = require('../models/FlashSale');
const Event = require('../models/Event');

const getItem = require('../helpers/getItem');

const { sendReportToDev, ensureRole, getCommands, numTocurrency, sendMessage, replaceMessage, sleep, setNewCookie } = require('../helpers')

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

  user.config = {
    autobuy: user.commands['-autobuy'],
    alarmMessage: [],
    beginMax: [],
    max: [],
    eventLength: []
  }

  await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { alarm: true }).exec()
  user.flashsale = (await FlashSale.find({ teleBotId: process.env.BOT_ID })).sort((a, b) => a.start_time - b.start_time);

  for await (const [index, session] of user.flashsale.entries()) {
    await sendMessage(ctx, `<code>${session.name + (session.with_mega_sale_session ? " | MEGA SALE" : "")}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
      user.config.alarmMessage[index] = {
        chatId: replyCtx.chat.id,
        msgId: replyCtx.message_id,
        inlineMsgId: replyCtx.inline_message_id,
        text: replyCtx.text
      }
      user.config.beginMax[index] = { price_before_discount: 0, url: null }
      user.config.max[index] = { price_before_discount: 0, url: null }
      user.config.eventLength[index] = 0
    })
  }

  let predictPrice = {
    "?.000": 1000,
    "?0.000": 10000
  }

  let minPredict = 100000

  do {

    for await (const [index, session] of user.flashsale.entries()) {
      if (index == 0 && ((session.end_time - 10) * 1000) - Date.now() < 0) {
        for (const msg of user.config.alarmMessage) {
          await ctx.telegram.deleteMessage(msg.chatId, msg.msgId)
        }
        await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { alarm: false }).exec()
        return setTimeout(await alarmFlashSale.bind(null, ctx), 15000);
      }

      user.start = Date.now()

      await getAllItemids(user, session).then(({ statusCode, body, headers, curlInstance, curl }) => {
        setNewCookie(user.userCookie, headers['set-cookie'])
        let chunk = typeof body == 'string' ? JSON.parse(body) : body;
        if (chunk.data.promotionid) {
          user.getAllItemids = chunk
          user.getAllItemids.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
          user.getAllItemids.now = Date.now()
        } else {
          user.start = false;
        }
        curl.close()
      }).catch((err) => {
        user.start = false;
        return err
      })

      if (!user.start) continue;

      await postFlashSaleBatchItems(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
        setNewCookie(user.userCookie, headers['set-cookie'])
        let chunk = typeof body == 'string' ? JSON.parse(body) : body;
        if (chunk.data) {
          user.getFlashSaleSession = chunk
          user.getFlashSaleSession.time = Math.floor(curlInstance.getInfo('TOTAL_TIME') * 1000);
          user.getFlashSaleSession.now = Date.now()
        } else {
          user.start = false;
        }
        curl.close()
      }).catch((err) => {
        user.start = false;
        return err
      })

      if (!user.start) continue;

      let banner = session.name + (session.with_mega_sale_session ? " | MEGA SALE" : "")
      user.config.max[index] = { price_before_discount: 0, url: null }
      let eventLength = 0;

      for await (const item of user.getFlashSaleSession.data.items) {
        if (predictPrice[item.hidden_price_display] && (item.price_before_discount / minPredict > minPredict)) {
          if (item.price_before_discount > user.config.max[index].price_before_discount) {
            user.config.max[index] = {
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
            if (err) return sendReportToDev(ctx, err)
          })
        }
      }

      if (
        index == 0 &&
        user.config.beginMax[index].url != user.config.max[index].url &&
        user.config.beginMax[index].price_before_discount != user.config.max[index].price_before_discount &&
        user.config.autobuy
      ) {
        user.config.beginMax[index] = user.config.max[index]

        let newCtx = function (theCtx) {
          let newCtx = theCtx
          return newCtx
        }(ctx)

        newCtx.session.commands = {
          url: user.config.max[index].url,
          '-vip': true
        }

        await sendMessage(ctx, `Memuat... <code>${user.config.max[index].url}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
          newCtx.session.config.message = {
            chatId: replyCtx.chat.id,
            msgId: replyCtx.message_id,
            inlineMsgId: replyCtx.inline_message_id,
            text: replyCtx.text
          }
        })

        await getItem(newCtx)
        // await ctx.telegram.deleteMessage(user.config.message.chatId, user.config.message.msgId)
      }

      if (eventLength != user.config.eventLength[index]) {
        user.config.eventLength[index] = eventLength;
        await replaceMessage(ctx, user.config.alarmMessage[index], banner)
      }

      await sleep(1000 - (Date.now() - user.start))
    }

  } while (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, alarm: true }));
}