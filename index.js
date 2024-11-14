const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const Lobby = require('./models/Lobby'); // Import Lobby model to handle lobby deletion in the database

dotenv.config();

const app = express();
const server = http.createServer(app); // Use HTTP server to integrate Socket.IO

// Define allowed origins for CORS
const allowedOrigins = [
  'https://studybuddy-team24.netlify.app',
  /^http:\/\/localhost:\d+$/, // Allows localhost on any port
];

// Setup Socket.IO server with CORS
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow origins from the allowedOrigins array
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
const lobbies = {}; // Store lobbies and their members

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a lobby
  socket.on('joinLobby', async ({ lobbyId, username }) => {
    socket.join(lobbyId);
    if (!lobbies[lobbyId]) {
      lobbies[lobbyId] = { members: {}, host: username };
    }
    lobbies[lobbyId].members[socket.id] = username;

    // Broadcast updated user list to the lobby
    io.to(lobbyId).emit('userList', Object.values(lobbies[lobbyId].members));
  });

  // Handle new messages
  socket.on('sendMessage', ({ lobbyId, message, username }) => {
    io.to(lobbyId).emit('receiveMessage', { username, text: message });
  });

  // Handle user leaving the lobby
  socket.on('leaveLobby', (lobbyId) => handleUserLeave(socket, lobbyId));
  socket.on('disconnect', () => {
    // Handle disconnect for each lobby the user was part of
    Object.keys(lobbies).forEach((lobbyId) => handleUserLeave(socket, lobbyId));
  });

  // Function to handle user leaving the lobby or closing it
  async function handleUserLeave(socket, lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    // Remove the user from the lobby
    delete lobby.members[socket.id];

    // Check if the lobby is empty or if the host has left
    if (Object.keys(lobby.members).length === 0 || lobby.host === lobby.members[socket.id]) {
      // Notify users that the lobby has closed
      io.to(lobbyId).emit('lobbyClosed');

      // Delete the lobby from the server memory
      delete lobbies[lobbyId];

      // Remove lobby from the database
      try {
        await Lobby.findByIdAndDelete(lobbyId);
        console.log(`Lobby ${lobbyId} closed and removed from database.`);
      } catch (error) {
        console.error(`Failed to delete lobby ${lobbyId} from database:`, error);
      }
    } else {
      // Update the user list in the lobby if other users remain
      io.to(lobbyId).emit('userList', Object.values(lobby.members));
    }
  }
});

// Test Route
app.get('/api', (req, res) => res.send('API is working'));

// Start the server with Socket.IO
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
