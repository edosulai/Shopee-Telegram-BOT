const getAllItemids = require('../request/other/getAllItemids');
const postFlashSaleBatchItems = require('../request/other/postFlashSaleBatchItems');

const User = require('../models/User');
const FlashSale = require('../models/FlashSale');
const Event = require('../models/Event');

const setEvent = require('../helpers/setEvent');
const getItem = require('../helpers/getItem');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = async function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session

  user.commands = getCommands(ctx.message.text)

  if (user.commands['-stop']) {
    return User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { alarm: false }).exec()
  }

  if (user.alarm) {
    return sendMessage(ctx,'Alarm Sudah Berjalan!!')
  }

  user.config = {
    alarmMessage: [],
    beginMax: [],
    max: []
  }

  await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { alarm: true }).exec()

  for await (const [index, session] of (await FlashSale.find({ teleBotId: process.env.BOT_ID })).entries()) {
    await sendMessage(ctx, `Memuat... <code>${session.name + (session.with_mega_sale_session ? " | MEGA SALE" : "")}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
      user.config.alarmMessage.push({
        chatId: replyCtx.chat.id,
        msgId: replyCtx.message_id,
        inlineMsgId: replyCtx.inline_message_id,
        text: replyCtx.text
      })
      user.config.beginMax.push({ price_before_discount: 0, url: null })
      user.config.max.push({ price_before_discount: 0, url: null })
    })
  }

  do {
    for await (const [index, session] of (await FlashSale.find({ teleBotId: process.env.BOT_ID })).entries()) {
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

      let banner = timeConverter(Date.now(), { usemilis: false }) + "\n\n" + session.name + (session.with_mega_sale_session ? " | MEGA SALE" : "")
      user.config.max[index] = { price_before_discount: 0, url: null }
      let hasEvent = false;

      for await (const item of user.getFlashSaleSession.data.items) {
        if (item.hidden_price_display === "?.000" && (item.price_before_discount / 100000 > 100000)) {
          if (item.price_before_discount > user.config.max[index].price_before_discount) {
            user.config.max[index] = {
              price_before_discount: item.price_before_discount,
              url: `https://shopee.co.id/product/${item.shopid}/${item.itemid}`
            }
          }
          hasEvent = true
          banner += `\n\n${item.name} - (Rp. ${item.hidden_price_display}) - Rp. ${numTocurrency(item.price_before_discount / 100000)} - https://shopee.co.id/product/${item.shopid}/${item.itemid}`

          await Event.findOrCreate({
            teleBotId: process.env.BOT_ID,
            itemid: item.itemid,
            shopid: item.shopid
          }, {
            barang: item.name.replace(/<[^>]*>?/gm, ""),
            url: `https://shopee.co.id/product/${item.shopid}/${item.itemid}`,
            price: 1000
          }, async function (err, event, created) {
            if (err) return sendReportToDev(ctx, err)
          })
        }
      }

      if (
        index == 0 &&
        user.config.beginMax[index].url != user.config.max[index].url &&
        user.config.beginMax[index].price_before_discount != user.config.max[index].price_before_discount
      ) {
        user.config.beginMax[index] = user.config.max[index]

        user.commands = {
          url: user.config.max[index].url,
          '-vip': true
        }

        await sendMessage(ctx, `Memuat... <code>${user.config.max[index].url}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
          user.config.message = {
            chatId: replyCtx.chat.id,
            msgId: replyCtx.message_id,
            inlineMsgId: replyCtx.inline_message_id,
            text: replyCtx.text
          }
        })

        await getItem(ctx)
        // await ctx.telegram.deleteMessage(user.config.message.chatId, user.config.message.msgId)
      }

      if (hasEvent) await replaceMessage(ctx, user.config.alarmMessage[index], banner, { parse_mode: 'HTML' })
    }

    sleep(1000)

  } while (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, alarm: true }));
}