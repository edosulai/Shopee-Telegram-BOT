const mongoose = require('mongoose');

module.exports = mongoose.model('Failures', {
  teleChatId: Number,
  itemid: Number,
  shopid: Number,
  modelid: Number,
  postBuyBody: Object,
  postBuyBodyLong: Object,
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