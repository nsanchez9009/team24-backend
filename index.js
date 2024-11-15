const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const Lobby = require('./api/models/Lobby'); // Ensure this path is correct

dotenv.config();

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  'https://studybuddy-team24.netlify.app',
  'https://studybuddy.ddns.net',
  /^http:\/\/localhost:\d+$/, // Allows localhost for development
];

// Setup Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware for JSON and CORS
app.use(express.json());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Routes
const authRoute = require('./api/routes/auth');
const userRoute = require('./api/routes/user');
const schoolRoute = require('./api/routes/school');
const lobbyRoute = require('./api/routes/lobbies');
app.use('/api/lobbies', lobbyRoute);
app.use('/api/schools', schoolRoute);
app.use('/api/auth', authRoute);
app.use('/api/user', userRoute);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Lobby management with Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinLobby', async ({ lobbyId, username }) => {
    try {
      console.log(`User ${username} joining lobby: ${lobbyId}`);

      // Join Socket.IO room
      socket.join(lobbyId);

      // Retrieve or initialize the lobby in MongoDB
      let lobby = await Lobby.findOne({ lobbyId });
      if (!lobby) {
        console.log(`Creating new lobby: ${lobbyId}`);
        lobby = new Lobby({
          lobbyId,
          host: username,
          users: [username],
          currentUsers: 1,
        });
        await lobby.save();
      } else if (!lobby.users.includes(username)) {
        // Add user to the lobby only if not already present
        lobby.users.push(username);
        lobby.currentUsers++;
        await lobby.save();
      }

      // Emit updated user list
      io.to(lobbyId).emit('userList', lobby.users);

      // Track the user in the in-memory `lobbies` object
      lobbies[lobbyId] = lobbies[lobbyId] || { members: {}, host: lobby.host };
      lobbies[lobbyId].members[socket.id] = username;

      // Cleanup handlers
      socket.on('leaveLobby', () => handleUserLeave(socket, lobbyId, username));
      socket.on('disconnect', () => handleUserLeave(socket, lobbyId, username));
    } catch (error) {
      console.error('Error joining lobby:', error);
    }
  });

  socket.on('sendMessage', ({ lobbyId, message, username }) => {
    console.log(`Message from ${username} in lobby ${lobbyId}: ${message}`);
    io.to(lobbyId).emit('receiveMessage', { username, text: message });
  });

  async function handleUserLeave(socket, lobbyId, username) {
    try {
      console.log(`User ${username} leaving lobby: ${lobbyId}`);
      const lobby = await Lobby.findOne({ lobbyId });
      if (!lobby) return;

      // Remove user from MongoDB
      lobby.users = lobby.users.filter(user => user !== username);
      lobby.currentUsers--;

      // If no users left or host leaves, delete the lobby
      if (lobby.currentUsers === 0 || lobby.host === username) {
        console.log(`Closing lobby: ${lobbyId}`);
        io.to(lobbyId).emit('lobbyClosed');
        await Lobby.deleteOne({ lobbyId });
        delete lobbies[lobbyId];
      } else {
        await lobby.save();
        io.to(lobbyId).emit('userList', lobby.users); // Emit updated user list
      }

      socket.leave(lobbyId); // Leave Socket.IO room
    } catch (error) {
      console.error('Error handling user leave:', error);
    }
  }
});

// Test route
app.get('/api', (req, res) => res.send('API is working'));

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
