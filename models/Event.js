const mongoose = require('mongoose');
const findOrCreate = require('mongoose-findorcreate');

module.exports = mongoose.model('Events', new mongoose.Schema({
  teleBotId: Number,
  barang: Number,
  url: Number,
  itemid: Object,
  shopid: Object,
  price: Object,
  updatedAt: {
    type: Date,
    default: Date.now
  }
}).plugin(findOrCreate))