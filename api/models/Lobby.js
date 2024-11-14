const mongoose = require('mongoose');

const LobbySchema = new mongoose.Schema({
    name: { type: String, required: true },
    className: { type: String, required: true },
    school: { type: String, required: true },
    host: { type: String, required: true }, // Host's username
    maxUsers: { type: Number, required: true, min: 2, max: 4 },
    currentUsers: { type: Number, default: 1 }, // Defaults to 1 (host joins the lobby)
    users: [{ type: String }], // Array of usernames
});

module.exports = mongoose.model('Lobby', LobbySchema);
