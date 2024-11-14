const express = require('express');
const Lobby = require('../models/Lobby');
const router = express.Router();

// Create a lobby
router.post('/create', async (req, res) => {
  const { className, school, host, maxUsers } = req.body;
  try {
    const lobby = new Lobby({ className, school, host, maxUsers, users: [host] });
    await lobby.save();
    res.status(201).json(lobby);
  } catch (error) {
    res.status(500).json({ message: 'Error creating lobby' });
  }
});

// Get lobbies for a specific class and school
router.get('/list', async (req, res) => {
  const { className, school } = req.query;
  try {
    const lobbies = await Lobby.find({ className, school });
    res.status(200).json(lobbies);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching lobbies' });
  }
});

// Join a lobby
router.post('/join', async (req, res) => {
  const { lobbyId, username } = req.body;
  try {
    const lobby = await Lobby.findById(lobbyId);
    if (lobby.currentUsers >= lobby.maxUsers) {
      return res.status(400).json({ message: 'Lobby is full' });
    }

    lobby.users.push(username);
    lobby.currentUsers += 1;
    await lobby.save();

    res.status(200).json(lobby);
  } catch (error) {
    res.status(500).json({ message: 'Error joining lobby' });
  }
});

module.exports = router;
