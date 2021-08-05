const mongoose = require('mongoose');
const findOrCreate = require('mongoose-findorcreate');

module.exports = mongoose.model('Others', new mongoose.Schema({
  promotionId: Array,
  disableProducts: Array,
  eventProducts: Array,
  metaPayment: Object,
  updatedAt: {
    type: Date,
    default: Date.now
  }
}).plugin(findOrCreate))