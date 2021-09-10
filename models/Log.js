const mongoose = require('mongoose');

module.exports = mongoose.model('Logs', {
  teleBotId: Number,
  teleChatId: Number,
  itemid: Number,
  shopid: Number,
  modelid: Number,
  status: Boolean,
  buyBody: Object,
  buyBodyLong: Object,
  infoPengiriman: Object,
  infoKeranjang: Object,
  updateKeranjang: Object,
  infoCheckoutQuick: Object,
  infoCheckoutLong: Object,
  payment: Object,
  selectedShop: Object,
  selectedItem: Object,
  updatedAt: {
    type: Date,
    default: Date.now
  }
})