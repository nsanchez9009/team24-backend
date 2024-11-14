const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const server = http.createServer(app); // Use http server to integrate Socket.io
const io = socketIo(server); // Initialize Socket.io with the HTTP server

app.use(express.json());

// Simplified CORS settings
const allowedOrigins = [
  'https://studybuddy-team24.netlify.app',
  /^http:\/\/localhost:\d+$/, // Allows localhost on any port
];

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

// Socket.io setup
const lobbies = {}; // Store lobbies and their members

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a lobby
  socket.on('joinLobby', ({ lobbyId, username }) => {
    socket.join(lobbyId);
    if (!lobbies[lobbyId]) lobbies[lobbyId] = { members: {}, host: username };
    lobbies[lobbyId].members[socket.id] = username;
    io.to(lobbyId).emit('userList', Object.values(lobbies[lobbyId].members));
  });

  // Handle new messages
  socket.on('sendMessage', ({ lobbyId, message, username }) => {
    io.to(lobbyId).emit('receiveMessage', { username, message });
  });

  // Leaving or closing lobby
  socket.on('leaveLobby', (lobbyId) => handleUserLeave(socket, lobbyId));
  socket.on('disconnect', () => {
    Object.keys(lobbies).forEach((lobbyId) => handleUserLeave(socket, lobbyId));
  });

  function handleUserLeave(socket, lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;
    delete lobby.members[socket.id];
    if (Object.keys(lobby.members).length === 0 || lobby.host === lobby.members[socket.id]) {
      io.to(lobbyId).emit('lobbyClosed');
      delete lobbies[lobbyId];
    } else {
      io.to(lobbyId).emit('userList', Object.values(lobby.members));
    }
  }
});

// Test Route
app.get('/api', (req, res) => res.send('API is working'));

// Start the server with Socket.io
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
