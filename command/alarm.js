const getFlashSaleSession = require('../request/other/getFlashSaleSession');
const getAllItemids = require('../request/other/getAllItemids');
const postFlashSaleBatchItems = require('../request/other/postFlashSaleBatchItems');

const User = require('../models/User');
const Other = require('../models/Other');

const setEvent = require('../helpers/setEvent');
const getItem = require('../helpers/getItem');

(function (helpers) {
  for (const key in helpers) global[key] = helpers[key];
})(require('../helpers'))

module.exports = async function (ctx) {
  if (!ensureRole(ctx)) return
  let user = ctx.session

  user.commands = getCommands(ctx.message.text)
  if (user.commands['-stop']){
    return User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { alarm: false }).exec()
  }

  await User.updateOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id }, { alarm: true }).exec()
  await sendMessage(ctx, `Prepare... Alarm Flash Sale`, { parse_mode: 'HTML' }).then((replyCtx) => {
    user.config = {
      alarmMessage: {
        chatId: replyCtx.chat.id,
        msgId: replyCtx.message_id,
        inlineMsgId: replyCtx.inline_message_id,
        text: replyCtx.text
      }
    }
  })

  do {
    user.commands = {
      "-clear": true,
      "-silent": true
    }

    await setEvent(ctx)

    await getFlashSaleSession(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
      user.getFlashSaleSession = typeof body == 'string' ? JSON.parse(body) : body;
      curl.close()
    }).catch((err) => sendReportToDev(ctx, new Error(err)));

    await Promise.all(user.getFlashSaleSession.data.sessions.map(session => {
      return new Promise(async (resolve, reject) => {
        await getAllItemids(user, session).then(({ statusCode, body, headers, curlInstance, curl }) => {
          user.getAllItemids = typeof body == 'string' ? JSON.parse(body) : body;
          curl.close()
        }).catch((err) => sendReportToDev(ctx, new Error(err)));

        return resolve(user.getAllItemids.data.promotionid)
      })
    })).then(async id => {
      await Other.updateOne(null, { promotionId: id }).exec()
    })

    for await (const [index, session] of user.getFlashSaleSession.data.sessions.entries()) {

      await getAllItemids(user, session).then(({ statusCode, body, headers, curlInstance, curl }) => {
        user.getAllItemids = typeof body == 'string' ? JSON.parse(body) : body;
        curl.close()
      }).catch((err) => sendReportToDev(ctx, new Error(err)));
    
      await postFlashSaleBatchItems(user).then(({ statusCode, body, headers, curlInstance, curl }) => {
        user.getFlashSaleSession = typeof body == 'string' ? JSON.parse(body) : body;
        curl.close()
      }).catch((err) => sendReportToDev(ctx, new Error(err)));
    
      let banner = timeConverter(Date.now(), { usemilis: false }) + "\n\n" + session.name + (session.with_mega_sale_session ? " | MEGA SALE" : "") + `\n\nList Item yang Mencurigakan : `
      user.max = { price_before_discount: 0, url: null }
      let hasEvent = false;
    
      for await (const item of user.getFlashSaleSession.data.items) {
        if (item.hidden_price_display === "?.000" && (item.price_before_discount / 100000 > 100000)) {
          if (item.price_before_discount > user.max.price_before_discount) {
            user.max = {
              price_before_discount: item.price_before_discount,
              url: `https://shopee.co.id/product/${item.shopid}/${item.itemid}`
            }
          }
          hasEvent = true
          banner += `\n\n${item.name} - (Rp. ${item.hidden_price_display}) - Rp. ${numTocurrency(item.price_before_discount / 100000)} - https://shopee.co.id/product/${item.shopid}/${item.itemid}`
          user.commands = {
            url: `https://shopee.co.id/product/${item.shopid}/${item.itemid}`,
            price: 1000,
            "-silent": true
          }
    
          await setEvent(ctx)
        }
      }
    
      if (index == 0) {
        if (user.max.url) {
    
          await sendMessage(ctx, `Prepare... <code>${user.max.url}</code>`, { parse_mode: 'HTML' }).then((replyCtx) => {
            user.config.message = {
              chatId: replyCtx.chat.id,
              msgId: replyCtx.message_id,
              inlineMsgId: replyCtx.inline_message_id,
              text: replyCtx.text
            }
          })
      
          user.commands = {
            url: user.max.url,
            '-vip': true
          }
      
          setTimeout(async function () {
            await getItem(ctx)
            // return ctx.telegram.deleteMessage(user.config.message.chatId, user.config.message.msgId)
          }, 0)
        }
      } else {
        if (hasEvent) await replaceMessage(ctx, user.config.alarmMessage, banner, { parse_mode: 'HTML' })
      }
    }

    sleep(1000)

  } while (await User.findOne({ teleBotId: process.env.BOT_ID, teleChatId: ctx.message.chat.id, alarm: true }));
}