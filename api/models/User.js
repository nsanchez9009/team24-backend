// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  school: { type: String },
  classes: { type: [String] }
});

module.exports = mongoose.model('User', UserSchema);
