const mongoose = require('mongoose');
const findOrCreate = require('mongoose-findorcreate');

module.exports = mongoose.model('Users', new mongoose.Schema({
  teleChatId: Number,
  teleChatData: Object,
  userLoginInfo: Object,
  userCookie: Object,
  userRole: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
}).plugin(findOrCreate))