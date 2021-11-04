const mongoose = require('mongoose');

module.exports = mongoose.model('Logs', {
  teleBotId: Number,
  teleChatId: Number,
  itemid: Number,
  shopid: Number,
  modelid: Number,
  status: Boolean,
  buyBody: Object,
  infoKeranjang: Object,
  updateKeranjang: Object,
  infoCheckout: Object,
  payment: Object,
  selectedShop: Object,
  selectedItem: Object,
  updatedAt: {
    type: Date,
    default: Date.now
  }
})