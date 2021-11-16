module.exports = function (ctx) {
  let banner = `${process.env.BOT_NAME} <b>v.${require('../package.json').version}</b>`
  banner += `\n\n<b>==== LIST OPSI SHOP BOT ====</b>`
  banner += `\n\nOpsi <code>/beli</code> ini lah BOT online shopee nya, Agan akan Diperingatkan Login terlebih dahulu apabila email password Agan masih kosong`
  banner += `\n >> Contohnya : /beli <code>url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`
  banner += `\n\nOpsi <code>/login</code> di gunakan untuk melakukan input data untuk Login Sekaligus Login ke akun Shopee Agan`
  banner += `\n >> Contohnya : /login <code>email=emailagan@email.com password=rahasia</code>`
  banner += `\n\n==== CATATAN TAMBAHAN ====`
  banner += `\n\nPada opsi <code>/beli</code> Transaksi Bank Cek Otomasis akan terdefault pada Bank BNI agan bisa merubah nya dengan menuliskan opsi payment ketika menggunakan opsi beli`
  banner += `\n\List Opsi Pembayaran : `
  banner += `\n # Bank BCA <code>payment=bca</code>`
  banner += `\n # Bank Mandiri <code>payment=mandiri</code>`
  banner += `\n # Bank BNI <code>payment=bni</code>`
  banner += `\n # Bank BRI <code>payment=bri</code>`
  banner += `\n # Bank BSI <code>payment=bsi</code>`
  banner += `\n # Bank Permata <code>payment=permata</code>`
  banner += `\n # COD <code>payment=cod</code>`
  banner += `\n # SHOPEEPAY <code>payment=shopeepay</code>`
  banner += `\n >> Contohnya : /beli <code>payment=mandiri url=https://shopee.co.id/Sebuah-Produk-Shop.....</code>`
  banner += `\n\n<b>"SEMUA PERINTAH DI ATAS BOLEH DI INPUT TIDAK BERURUTAN ASALKAN DENGAN SYNTAX YANG BENAR"</b>`
  banner += `\n\n<i>Contact Person : ngufeel@gmail.com | +6282386007722</i>`
  banner += `\n<i>BOT Created by: @edosulai</i>`
  return ctx.reply(banner, { parse_mode: 'HTML' });
}