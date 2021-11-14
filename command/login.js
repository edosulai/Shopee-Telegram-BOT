const crypto = require('crypto');

const Address = require('../request/other/Address');

const Login = require('../request/auth/Login');
const LoginMethod = require('../request/auth/LoginMethod');
const LoginLinkVerify = require('../request/auth/LoginLinkVerify');
const LoginTokenVerify = require('../request/auth/LoginTokenVerify');
const StatusLogin = require('../request/auth/StatusLogin');
const LoginDone = require('../request/auth/LoginDone');

const User = require('../models/User');

const { logReport, getCommands, setNewCookie, checkAccount, sleep } = require('../helpers')

module.exports = function (ctx) {
  let user = ctx.session;
  let commands = getCommands(ctx.message.text)

  return Address(ctx).then(async ({ statusCode, data, headers }) => {
    setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
    user.address = typeof data == 'string' ? JSON.parse(data) : data;
    if (!user.address.error) return ctx.reply('Anda Sudah Login')

    for (let command in commands) {
      command = command.toLowerCase()
      if (Object.hasOwnProperty.call(commands, command) && ['email', 'password'].includes(command) && commands[command]) {
        if (command == 'password') {
          user.userLoginInfo.metaPassword = commands[command];
          let md5pass = crypto.createHash('md5').update(commands[command]).digest('hex');
          commands[command] = crypto.createHash('sha256').update(md5pass).digest('hex');
        }
        user.userLoginInfo[command] = commands[command]
      }
    }

    await User.updateOne({
      teleBotId: process.env.BOT_ID,
      teleChatId: ctx.message.chat.id
    }, {
      userLoginInfo: user.userLoginInfo
    }).exec()

    if (!checkAccount(ctx)) return;

    return async function tryLogin(msg) {
      if (msg) await ctx.reply(msg)
      return Login(ctx).then(async ({ statusCode, data, headers }) => {
        setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
        user.login = typeof data == 'string' ? JSON.parse(data) : data;

        switch (user.login.error) {
          case 1:
            return tryLogin('Ada Yang Error.. Sedang Mencoba Kembali..');
          case 2:
            return ctx.reply('Akun dan/atau password Anda salah, silakan coba lagi')
          case 98:
            await LoginMethod(ctx).then(({ statusCode, data, headers }) => {
              setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
              user.loginMethod = typeof data == 'string' ? JSON.parse(data) : data;
            }).catch((err) => logReport(ctx, new Error(err)));

            if (user.loginMethod.data.length == 0) {
              return ctx.reply('Maaf, kami tidak dapat memverifikasi log in kamu. Silakan hubungi Customer Service untuk bantuan.')
            }

            await LoginLinkVerify(ctx).then(({ statusCode, data, headers }) => {
              setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
              user.loginLinkVerify = typeof data == 'string' ? JSON.parse(data) : data;
            }).catch((err) => logReport(ctx, new Error(err)));

            if (user.loginLinkVerify.error && user.loginLinkVerify.error == 81900202) {
              return ctx.reply('Verifikasi gagal.. Kamu telah mencapai limit verifikasi melalui link otentikasi hari ini.')
            }

            ctx.reply('Silahkan Cek Notifikasi SMS dari Shopee di Handphone Anda')

            do {
              await StatusLogin(ctx).then(({ statusCode, data, headers }) => {
                setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
                user.loginStatus = typeof data == 'string' ? JSON.parse(data) : data;
              }).catch((err) => logReport(ctx, new Error(err)));

              if (user.loginStatus.data.link_status == 4) return ctx.reply('Login Anda Gagal Coba Beberapa Saat Lagi')

              await sleep(1000);
            } while (user.loginStatus.data.link_status != 2);

            await LoginTokenVerify(ctx).then(({ statusCode, data, headers }) => {
              setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
              user.loginTokenVerify = typeof data == 'string' ? JSON.parse(data) : data;
            }).catch((err) => logReport(ctx, new Error(err)));

            await LoginDone(ctx).then(({ statusCode, data, headers }) => {
              setNewCookie(user.userCookie, headers[0]['Set-Cookie'])
              user.loginDoneStatus = typeof data == 'string' ? JSON.parse(data) : data;
            }).catch((err) => logReport(ctx, new Error(err)));

            if (user.loginDoneStatus.data) {
              await ctx.reply('Login Berhasil')
            } else {
              await ctx.reply(`Login Gagal`)
              return logReport(ctx, new Error('Login Gagal'), 'Error')
            }

            break;

          default:
            await ctx.reply(`Auto Login Berhasil`)
        }

        return User.updateOne({
          teleBotId: process.env.BOT_ID,
          teleChatId: ctx.message.chat.id
        }, {
          userLoginInfo: user.userLoginInfo,
          userCookie: user.userCookie
        }).exec(async (err, res) => {
          if (err) return ctx.reply(`User Gagal Di Update`).then(() => logReport(ctx, new Error('User Gagal Di Update'), 'Error')).catch((err) => logReport(ctx, new Error(err)));
        })

      }).catch((err) => logReport(ctx, new Error(err)));
    }()

  }).catch((err) => logReport(ctx, new Error(err)));
}