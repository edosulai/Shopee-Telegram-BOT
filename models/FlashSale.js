const mongoose = require('mongoose');
const findOrCreate = require('mongoose-findorcreate');

module.exports = mongoose.model('FlashSales', new mongoose.Schema({
  teleBotId: Number,
  description: String,
  end_time: Number,
  is_ongoing: Boolean,
  name: String,
  promotionid: Number,
  start_time: Number,
  status: Number,
  updatedAt: {
    type: Date,
    default: Date.now
  }
}).plugin(findOrCreate))