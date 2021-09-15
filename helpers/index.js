const cookie = require('cookie');
const chalk = require('chalk');

module.exports = {
  waitUntil: function (fromObject, ...wantToCheckValueIsExist) {
    const start = Date.now()
    let x = 0;
    let failed = null;
    let check = true
    let callback = null
    let timeOut = 3000
  
    return new Promise((resolve, reject) => {
      try {
        for (const each of wantToCheckValueIsExist) {
          if (typeof each == 'function') {
            callback = each;
            continue;
          } else if (typeof each == 'number') {
            timeOut = each;
            continue;
          }
          check = check && typeof fromObject[each] != 'undefined'
          if(typeof fromObject[each] == 'undefined') failed = each
        }
        if (check) {
          if (typeof callback == 'function') return callback(resolve, reject)
          return resolve()
        }
  
        let until = setInterval(function () {
          check = true
          for (const each of wantToCheckValueIsExist) {
            if (typeof each == 'function') {
              callback = each;
              continue;
            } else if (typeof each == 'number') {
              timeOut = each;
              continue;
            }
            check = check && typeof fromObject[each] != 'undefined'
            if(typeof fromObject[each] == 'undefined') failed = each
          }
          if (check) {
            clearInterval(until)
            if (typeof callback == 'function') return callback(resolve, reject)
            return resolve()
          }
  
          // process.stdout.write(`\rLoading ${["\\", "|", "/", "-"][x++]}`);
          x &= 3;
          if (Date.now() - start > timeOut) {
            clearInterval(until)
            return reject(`${failed} Timeout ${timeOut}`)
          }
        }, 0)
      } catch (error) {
        return reject(`${failed} TimeOut Error ${error}`)
      }
    });
  },

  generateString: function (length = 0, chartset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chartset.charAt(Math.floor(Math.random() * chartset.length));
    }
    return result;
  },

  splitAtFirstSpace: function (str) {
    if (!str) return [];
    let i = str.indexOf(' ');
    if (i > 0) return [str.substring(0, i), str.substring(i + 1)];

    return [str];
  },

  getCommands: function (str, sparator = ['=']) {
    let commands = {};
    if (!splitAtFirstSpace(str)[1]) return commands
    let everyCommand = splitAtFirstSpace(str)[1].split(' ')

    everyCommand.forEach(command => {
      command = command.split('=')
      command = command.map((cmd) => cmd = cmd.replace(/(<([^>]+)>)/gi, ""));

      commands[command[0]] = command[1] ? function () {
        delete command[0]
        return command.join('=').substring(1)
      }() : true
    })

    commands.prefix = splitAtFirstSpace(str)[0]
    return commands
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
    if ((ctx.from && ctx.chat) || (ctx.from && ctx.inlineQuery)) {
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

  ensureRole: function (ctx, ignoreReport = false, allowRole = [1]) {
    if (allowRole.includes(ctx.session.userRole)) return true
    if (!ignoreReport) sendReportToDev(ctx, `Mencoba Mengakses Fitur BOT`, 'Info')
    return false
  },

  checkAccount: async function (ctx) {
    if (
      ctx.session.userLoginInfo.email &&
      ctx.session.userLoginInfo.password
    ) return true;

    let info = `Informasi Akun Shopee Anda Belum Lengkap: `
    info += `\nEmail : ${ctx.session.userLoginInfo.email || ''} `
    info += `\nPassword : ${(ctx.session.userLoginInfo.metaPassword ? '**********' : '')} `

    await sendMessage(ctx, info);
    return false;
  },

  sleep(ms) {
    return new Promise(
      resolve => setTimeout(resolve, ms)
    );
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

  userLogs: function (ctx, msg, type = 'Error', callback = null) {
    console.log(chalk.blue(`(${ctx.message.chat.first_name} ${ctx.message.chat.id}) ${msg.stack ? msg.stack : `${type} : ${msg}`}`));
    if (typeof callback == 'function') return callback()
  },

  sendMessage: function (ctx, msg, extra = {}) {
    if (ctx.telegram) {
      return ctx.telegram.sendMessage(ctx.message.chat.id, msg, extra)
    } else {
      return ctx.reply(msg, extra)
    }
  },

  replaceMessage: async function (ctx, oldMsg, newMsg, filter = true) {
    if (filter) newMsg = newMsg.replace(/<[^>]*>?/gm, "");
    if (oldMsg.text.replace(/[^a-zA-Z0-9\\s]/gi, "") !== newMsg.replace(/[^a-zA-Z0-9\\s]/gi, "")) {
      return await ctx.telegram.editMessageText(oldMsg.chatId, oldMsg.msgId, oldMsg.inlineMsgId, newMsg, { parse_mode: 'HTML' }).then((replyCtx) => {
        oldMsg.text = replyCtx.text
      }).catch((err) => process.stdout.write(`\r ${err}`))
    }
  },

  sendReportToDev: function (ctx, msg, type = '') {
    if (ctx.telegram) {
      return ctx.telegram.sendMessage(process.env.ADMIN_ID, `<code>${msg.stack ? msg.stack.replace(/<[^>]*>?/gm, "") : `${type} : ${msg.replace(/<[^>]*>?/gm, "")}`}</code>`, { parse_mode: 'HTML' })
    } else {
      return ctx.reply(`<code>(${ctx.message ? ctx.message.chat.first_name : 'Unknown'} ${ctx.message ? ctx.message.chat.id : '0'}) ${msg.stack ? msg.stack.replace(/<[^>]*>?/gm, "") : `${type} : ${msg.replace(/<[^>]*>?/gm, "")}`}</code>`, { chat_id: process.env.ADMIN_ID, parse_mode: 'HTML' })
    }
  },

  setNewCookie: function (oldcookies, ...newcookies) {
    for (const cookies of newcookies) {
      for (const cook of cookies) {
        let parseCookie = cookie.parse(cook);
        let cookieName = Object.keys(parseCookie)[0]
        oldcookies[cookieName] = parseCookie[cookieName]
      }
    }
  },

  objectSize: function (obj) {
    let size = 0, key;
    for (key in obj) if (obj.hasOwnProperty(key)) size++;
    return size;
  },

  numTocurrency: function (nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + '.' + '$2');
    }
    return x1 + x2;
  },

  addDots: function (nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    let rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + '.' + '$2');
    }
    return x1 + x2;
  }

}