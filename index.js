const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const server = http.createServer(app);
const Lobby = require('./models/Lobby'); // Assuming your lobby schema is in models/Lobby.js

// Define allowed origins for CORS
const allowedOrigins = [
  'https://studybuddy-team24.netlify.app',
  /^http:\/\/localhost:\d+$/, // Allows localhost on any port
];

// Setup Socket.IO server with CORS
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (allowedOrigins.some(pattern => (typeof pattern === 'string' ? pattern === origin : pattern.test(origin))) || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware to handle JSON and CORS
app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    if (allowedOrigins.some(pattern => (typeof pattern === 'string' ? pattern === origin : pattern.test(origin))) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

// Import and use routes
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

// Socket.IO setup
const lobbies = {}; // Store active lobbies and their members

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a lobby and add user to the lobby members
  socket.on('joinLobby', async ({ lobbyId, username }) => {
    socket.join(lobbyId);

    if (!lobbies[lobbyId]) {
      const lobby = await Lobby.findById(lobbyId); // Fetch lobby to confirm existence
      if (!lobby) {
        socket.emit('lobbyClosed');
        return;
      }
      lobbies[lobbyId] = { members: {}, host: lobby.host };
    }

    lobbies[lobbyId].members[socket.id] = username;
    io.to(lobbyId).emit('userList', Object.values(lobbies[lobbyId].members));
  });

  // Handle sending messages
  socket.on('sendMessage', ({ lobbyId, message, username }) => {
    io.to(lobbyId).emit('receiveMessage', { username, text: message });
  });

  // Leave lobby and close if host leaves
  socket.on('leaveLobby', (lobbyId) => handleUserLeave(socket, lobbyId));

  // Disconnect from all joined lobbies
  socket.on('disconnect', () => {
    Object.keys(lobbies).forEach((lobbyId) => handleUserLeave(socket, lobbyId));
  });

  // Handle lobby cleanup and close if the host leaves
  async function handleUserLeave(socket, lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    const isHostLeaving = lobby.host === lobby.members[socket.id];
    delete lobby.members[socket.id];

    if (isHostLeaving || Object.keys(lobby.members).length === 0) {
      // If the host leaves or lobby is empty, delete lobby and notify
      io.to(lobbyId).emit('lobbyClosed');
      await Lobby.findByIdAndDelete(lobbyId); // Remove from database
      delete lobbies[lobbyId]; // Remove from active lobbies

      // Emit updated lobby list to all clients if necessary
      io.emit('updateLobbyList');
    } else {
      io.to(lobbyId).emit('userList', Object.values(lobby.members));
    }
  }
});

// Test Route
app.get('/api', (req, res) => res.send('API is working'));

// Start the server with Socket.IO
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
