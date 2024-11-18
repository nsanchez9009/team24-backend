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
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

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
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error(err));

// Lobby management with Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle joining a lobby
  socket.on('joinLobby', async ({ lobbyId, username, name, className, school, maxUsers }) => {
    try {
      console.log(`User ${username} attempting to join lobby: ${lobbyId}`);
      socket.join(lobbyId);

      let lobby = await Lobby.findOne({ lobbyId });

      // Create a new lobby if it doesn't exist
      if (!lobby) {
        if (!name || !className || !school || !maxUsers) {
          console.error('Missing required fields for lobby creation.');
          socket.emit('error', 'Lobby creation failed: Missing required fields.');
          return;
        }

        console.log(`Creating new lobby: ${lobbyId}`);
        lobby = new Lobby({
          lobbyId,
          name,
          className,
          school,
          host: username,
          maxUsers,
          users: [username],
          currentUsers: 1,
          messages: [], // Initialize an empty messages array
        });
        await lobby.save();
      } else {
        // If lobby exists, add user if not already in the list
        if (!lobby.users.includes(username)) {
          if (lobby.currentUsers < lobby.maxUsers) {
            lobby.users.push(username);
            lobby.currentUsers++;
            await lobby.save();
          } else {
            socket.emit('error', 'Lobby is full.');
            return;
          }
        }
      }

      // Emit existing messages and updated user list
      socket.emit('initialMessages', lobby.messages);
      io.to(lobbyId).emit('userList', lobby.users);

      // Handle user leaving or disconnecting
      socket.on('leaveLobby', () => handleUserLeave(socket, lobbyId, username));
      socket.on('disconnect', () => handleUserLeave(socket, lobbyId, username));
    } catch (error) {
      console.error('Error joining lobby:', error);
      socket.emit('error', 'An error occurred while joining the lobby.');
    }
  });

  // Handle sending messages
  socket.on('sendMessage', async ({ lobbyId, message, username }) => {
    try {
      if (!message.trim() || !username) {
        console.error('Invalid message format.');
        return;
      }

      console.log(`Message from ${username} in lobby ${lobbyId}: ${message}`);
      const lobby = await Lobby.findOne({ lobbyId });

      if (!lobby) {
        console.error('Lobby not found for message storage.');
        return;
      }

      // Save the message to the database
      const newMessage = { username, text: message, timestamp: new Date() };
      lobby.messages.push(newMessage);
      await lobby.save();

      // Emit the message to the lobby
      io.to(lobbyId).emit('receiveMessage', newMessage);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Handle user leaving the lobby
  async function handleUserLeave(socket, lobbyId, username) {
    try {
      console.log(`User ${username} leaving lobby: ${lobbyId}`);
      const lobby = await Lobby.findOne({ lobbyId });
      if (!lobby) return;

      // Remove the user from the lobby
      lobby.users = lobby.users.filter((user) => user !== username);
      lobby.currentUsers--;

      // If no users left or the host leaves, delete the lobby
      if (lobby.currentUsers === 0 || lobby.host === username) {
        console.log(`Closing lobby: ${lobbyId}`);
        io.to(lobbyId).emit('lobbyClosed');
        await Lobby.deleteOne({ lobbyId });
      } else {
        await lobby.save();
        io.to(lobbyId).emit('userList', lobby.users); // Emit updated user list
      }

      socket.leave(lobbyId);
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
