const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // For generating unique lobby IDs

const LobbySchema = new mongoose.Schema({
    lobbyId: { type: String, default: uuidv4, unique: true }, // Unique identifier for the lobby
    name: { type: String, required: true },
    className: { type: String, required: true },
    school: { type: String, required: true },
    host: { type: String, required: true }, // Host's username
    maxUsers: { type: Number, required: true, min: 2, max: 4 },
    currentUsers: { type: Number, default: 1 }, // Starts with the host
    users: [{ type: String }] // Array of usernames
});

// Initialize the users array with the host as the first user
LobbySchema.pre('save', function(next) {
    if (!this.users.includes(this.host)) {
        this.users.push(this.host);
    }
    next();
});

module.exports = mongoose.model('Lobby', LobbySchema);
