const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const Lobby = require('./api/models/Lobby');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  'https://studybuddy-team24.netlify.app',
  'https://studybuddy.ddns.net',
  /^http:\/\/localhost:\d+$/, // Allows localhost on any port
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
const lobbies = {}; // Tracks lobbies and members

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinLobby', async ({ lobbyId, username }) => {
    try {
      socket.join(lobbyId);

      // Retrieve or create the lobby in MongoDB
      let lobby = await Lobby.findOne({ lobbyId });
      if (!lobby) {
        lobby = new Lobby({
          lobbyId,
          host: username,
          users: [username],
          currentUsers: 1,
        });
        await lobby.save();
      } else {
        // Add user to the lobby if not already present
        if (!lobby.users.includes(username)) {
          lobby.users.push(username);
          lobby.currentUsers++;
          await lobby.save();
        }
      }

      lobbies[lobbyId] = lobbies[lobbyId] || { members: {}, host: username };
      lobbies[lobbyId].members[socket.id] = username;

      io.to(lobbyId).emit('userList', lobby.users);

      // Handle when the host disconnects, close the lobby and remove it from the database
      socket.on('leaveLobby', () => handleUserLeave(socket, lobbyId));
      socket.on('disconnect', () => handleUserLeave(socket, lobbyId));
    } catch (error) {
      console.error('Error joining lobby:', error);
    }
  });

  socket.on('sendMessage', ({ lobbyId, message, username }) => {
    io.to(lobbyId).emit('receiveMessage', { username, text: message });
  });

  async function handleUserLeave(socket, lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    const username = lobby.members[socket.id];
    delete lobby.members[socket.id];

    // Update MongoDB: Remove user from the lobby
    const dbLobby = await Lobby.findOne({ lobbyId });
    if (dbLobby) {
      dbLobby.users = dbLobby.users.filter(user => user !== username);
      dbLobby.currentUsers--;

      // Close lobby if host leaves or lobby is empty
      if (dbLobby.currentUsers === 0 || dbLobby.host === username) {
        io.to(lobbyId).emit('lobbyClosed');
        delete lobbies[lobbyId];
        await dbLobby.deleteOne();
      } else {
        await dbLobby.save();
        io.to(lobbyId).emit('userList', dbLobby.users);
      }
    }
  }
});

// Test route
app.get('/api', (req, res) => res.send('API is working'));

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
