const express = require('express');
const Lobby = require('../models/Lobby');
const router = express.Router();

// Create a lobby
router.post('/create', async (req, res) => {
  const { name, className, school, host, maxUsers } = req.body;

  if (!name || !className || !school || !host || !maxUsers) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newLobby = new Lobby({
      name,
      className,
      school,
      host,
      maxUsers,
      currentUsers: 0,
      users: [host], // Initialize with the host in the users array
      messages: [],  // Initialize an empty messages array
    });
    await newLobby.save();
    res.status(201).json(newLobby);
  } catch (error) {
    console.error('Error creating lobby:', error);
    res.status(500).json({ message: 'Error creating lobby' });
  }
});

// Get lobbies for a specific class and school
router.get('/list', async (req, res) => {
  const { className, school } = req.query;

  if (!className || !school) {
    return res.status(400).json({ message: 'Class name and school are required' });
  }

  try {
    const lobbies = await Lobby.find({ className, school });
    res.status(200).json(lobbies);
  } catch (error) {
    console.error('Error fetching lobbies:', error);
    res.status(500).json({ message: 'Error fetching lobbies' });
  }
});

// Join a lobby
router.post('/join', async (req, res) => {
  const { lobbyId, username } = req.body;

  if (!lobbyId || !username) {
    return res.status(400).json({ message: 'Lobby ID and username are required' });
  }

  try {
    const lobby = await Lobby.findOne({ lobbyId });

    if (!lobby) {
      return res.status(404).json({ message: 'Lobby not found' });
    }

    if (lobby.currentUsers >= lobby.maxUsers) {
      return res.status(400).json({ message: 'Lobby is full' });
    }

    if (!lobby.users.includes(username)) {
      lobby.users.push(username);
      lobby.currentUsers += 1;
      await lobby.save();
    }

    res.status(200).json(lobby);
  } catch (error) {
    console.error('Error joining lobby:', error);
    res.status(500).json({ message: 'Error joining lobby' });
  }
});

// Get messages for a lobby
router.get('/:lobbyId/messages', async (req, res) => {
  const { lobbyId } = req.params;

  try {
    const lobby = await Lobby.findOne({ lobbyId });

    if (!lobby) {
      return res.status(404).json({ message: 'Lobby not found' });
    }

    res.status(200).json(lobby.messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Add a message to a lobby
router.post('/:lobbyId/messages', async (req, res) => {
  const { lobbyId } = req.params;
  const { username, text } = req.body;

  if (!username || !text) {
    return res.status(400).json({ message: 'Username and message text are required' });
  }

  try {
    const lobby = await Lobby.findOne({ lobbyId });

    if (!lobby) {
      return res.status(404).json({ message: 'Lobby not found' });
    }

    const newMessage = { username, text };
    lobby.messages.push(newMessage);
    await lobby.save();

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ message: 'Error adding message' });
  }
});

module.exports = router;
