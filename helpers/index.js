const cookie = require('cookie');

module.exports = {
  generateString: function (length = 0, chartset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chartset.charAt(Math.floor(Math.random() * chartset.length));
    }
    return result;
  },

  getCommands: function (str, prefix, sparator = '=') {
    let commands = {};
    let firstSplit = str.split(prefix)
    Object.prototype.toString.call(firstSplit)
    if (firstSplit.length > 1) {
      let everyCommand = firstSplit[1].split(" ")
      Object.prototype.toString.call(everyCommand)
      everyCommand.forEach(command => {
        command = command.split(sparator)
        command.forEach((cmd, i) => {
          command[i] = cmd.replace(/(<([^>]+)>)/gi, "")
        });
        commands[command[0]] = command[1] ? function () {
          delete command[0]
          return command.join(sparator).substring(1)
        }() : true
      })
      return commands
    }
    return null
  },

  timeConverter: function (timestamp, { usemilis = false, countdown = false }) {
    if (countdown) {
      timestamp = Math.abs(timestamp)
      let hour = Math.floor(timestamp / 3600000).toFixed(0);
      let minutes = Math.floor((timestamp % 3600000) / 60000).toFixed(0);
      let seconds = ((timestamp % 60000) / 1000).toFixed(0);
      let clock = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      if (usemilis) {
        let milsec = (timestamp % 1000).toFixed(0);
        clock += `:${milsec.toString().padStart(3, '0')}`
      }
      return clock;
    } else {
      let time = new Date(timestamp);
      let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      let year = time.getFullYear();
      let month = months[time.getMonth()];
      let date = time.getDate();
      let hour = time.getHours();
      let min = time.getMinutes();
      let sec = time.getSeconds();
      time = `${date} ${month} ${year} ${hour}:${min}:${sec}`;
      if (usemilis) {
        let milsec = (timestamp % 1000).toFixed(0);
        time += `:${milsec.toString().padStart(3, '0')}`
      }
      return time;
    }
  },

  getSessionKey: function (ctx) {
    if (ctx.from && ctx.chat) {
      return ctx.from.id
    } else if (ctx.from && ctx.inlineQuery) {
      return ctx.from.id
    }
    return null
  },

  isValidURL: function (string) {
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
  },

  ensureRole: function (ctx, ignoreReport = false, allowRole = ['admin']) {
    if (allowRole.includes(ctx.session.userRole)) return true
    if (!ignoreReport) sendReportToDev(ctx, `Mencoba Mengakses Fitur ${allowRole.join(' ')}`, 'Info')
    return false
  },

  checkAccount: function (ctx) {
    if (
      ctx.session.userLoginInfo.email &&
      ctx.session.userLoginInfo.password
    ) return true;

    let info = `Informasi Akun Shopee Anda Belum Lengkap: `
    info += `\nEmail : ${ctx.session.userLoginInfo.email || ''} `
    info += `\nPassword : ${(ctx.session.userLoginInfo.metaPassword ? '**********' : '')} `

    ctx.reply(info)
    return false;
  },

  sleep: function (milliseconds, callback = null) {
    const date = Date.now();
    do {
      continue;
    } while (Date.now() - date < milliseconds);
    if (typeof callback == 'function') return callback()
  },

  extractHostname: function (url) {
    let hostname;
    if (url.indexOf("//") > -1) {
      hostname = url.split('/')[2];
    } else {
      hostname = url.split('/')[0];
    }

    hostname = hostname.split(':')[0];
    hostname = hostname.split('?')[0];
    return hostname;
  },

  extractRootDomain: function (url) {
    let domain = extractHostname(url),
      splitArr = domain.split('.'),
      arrLen = splitArr.length;

    if (arrLen > 2) {
      domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
      if (splitArr[arrLen - 2].length == 2 && splitArr[arrLen - 1].length == 2) {
        domain = splitArr[arrLen - 3] + '.' + domain;
      }
    }
    return domain;
  },

  userLogs: async function (ctx, msg, type = 'Info', callback = null) {
    console.log(`(${ctx.message.chat.first_name} ${ctx.message.chat.id}) ${msg.stack ? msg.stack : `${type} : ${msg}`}`);
    if (typeof callback == 'function') return callback()
  },

  replaceMessage: function (ctx, oldMsg, newMsg, filter = true) {
    if (filter) newMsg = newMsg.replace(/<[^>]*>?/gm, "");
    if (oldMsg.text.replace(/[^a-zA-Z0-9\\s]/gi, "") !== newMsg.replace(/[^a-zA-Z0-9\\s]/gi, "")) {
      return ctx.telegram.editMessageText(oldMsg.chatId, oldMsg.msgId, oldMsg.inlineMsgId, newMsg, { parse_mode: 'HTML' }).then((replyCtx) => {
        oldMsg.text = replyCtx.text
      }).catch((err) => process.stdout.write(`\r ${err}`))
    }
  },

  sendReportToDev: async function (ctx, msg, type = 'Error', callback = null) {
    if (type == 'Error') msg = new Error(msg.message || msg)
    await ctx.reply(`<code>(${ctx.message.chat.first_name} ${ctx.message.chat.id}) ${msg.stack ? msg.stack.replace(/<[^>]*>?/gm, "") : `${type} : ${msg.replace(/<[^>]*>?/gm, "")}`}</code>`, { chat_id: process.env.ADMIN_ID, parse_mode: 'HTML' })
    if (typeof callback == 'function') return callback()
  },

  setNewCookie: function (oldcookies, ...newcookies) {
    let temp = oldcookies;
    for (const cookies of newcookies) {
      for (const cook of cookies) {
        let parseCookie = cookie.parse(cook);
        let cookieName = Object.keys(parseCookie)[0]
        temp[cookieName] = parseCookie[cookieName]
      }
    }
    return temp;
  },

  objectSize: function (obj) {
    let size = 0, key;
    for (key in obj) if (obj.hasOwnProperty(key)) size++;
    return size;
  }

}