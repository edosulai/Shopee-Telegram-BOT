const mongoose = require('mongoose');

module.exports = mongoose.model('Failures', {
  teleBotId: Number,
  teleChatId: Number,
  itemid: Number,
  shopid: Number,
  modelid: Number,
  buyBody: Object,
  buyBodyLong: Object,
  infoBarang: Object,
  infoPengiriman: Object,
  infoKeranjang: Object,
  updateKeranjang: Object,
  infoCheckoutQuick: Object,
  infoCheckoutLong: Object,
  updatedAt: {
    type: Date,
    default: Date.now
  }
})