const mongoose = require('mongoose');

module.exports = mongoose.model('Logs', {
  teleChatId: Number,
  itemid: Number,
  shopid: Number,
  modelid: Number,
  buyBody: Object,
  buyBodyLong: Object,
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