const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const lobbySchema = new mongoose.Schema({
  lobbyId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  className: { type: String, required: true },
  school: { type: String, required: true },
  host: { type: String, required: true },
  maxUsers: { type: Number, required: true },
  currentUsers: { type: Number, default: 0 },
  users: { type: [String], default: [] },
  messages: { type: [messageSchema], default: [] }, // Default empty array for messages
});

module.exports = mongoose.model('Lobby', lobbySchema);
