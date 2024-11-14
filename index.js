// backend/index.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());

// Simplified CORS settings
const allowedOrigins = [
  'https://studybuddy-team24.netlify.app',
  /^http:\/\/localhost:\d+$/,      // Allows localhost on any port
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow all localhost origins in development or specify frontend URL for production
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

// Test Route
app.get('/api', (req, res) => res.send('API is working'));

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
