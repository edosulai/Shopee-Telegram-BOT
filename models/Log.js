const mongoose = require('mongoose');

module.exports = mongoose.model('Logs', {
  teleBotId: Number,
  teleChatId: Number,
  itemid: Number,
  shopid: Number,
  modelid: Number,
  infoKeranjang: Object,
  updateKeranjang: Object,
  checkout: Object,
  infoCheckout: Object,
  selectedShop: Object,
  selectedItem: Object,
  updatedAt: {
    type: Date,
    default: Date.now
  }
})