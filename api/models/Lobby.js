const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // Import uuid and use v4 for generating unique IDs

const LobbySchema = new mongoose.Schema({
    lobbyId: { type: String, default: uuidv4 }, // Automatically generate a unique lobbyId
    name: { type: String, required: true },
    className: { type: String, required: true },
    school: { type: String, required: true },
    host: { type: String, required: true }, // Host's username
    maxUsers: { type: Number, required: true, min: 2, max: 4 },
    currentUsers: { type: Number, default: 1 }, // Defaults to 1 (host joins the lobby)
    users: [{ type: String }], // Array of usernames
});

module.exports = mongoose.model('Lobby', LobbySchema);
