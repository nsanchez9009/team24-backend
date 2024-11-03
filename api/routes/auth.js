// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Register new user
router.post(
  '/register',
  [
    check('email', 'Email is required').isEmail(),
    check('password', 'Password must be at least 6 characters long').isLength({ min: 6 }),
    check('username', 'Username is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password } = req.body;

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
      const newUser = new User({
        email,
        username,
        password: hashedPassword,
        isVerified: false,
        verificationToken,
      });
      await newUser.save();

      // Send verification email
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify Your Email',
        html: `<p>Please verify your email by clicking on the following link: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
      });

      res.status(201).json({ message: 'User registered successfully. Please check your email to verify your account.' });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Login user
router.post(
  '/login',
  [
    check('username', 'Username is required').exists(),
    check('password', 'Password is required').exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      const user = await User.findOne({ username });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      if (!user.isVerified) {
        return res.status(400).json({ message: 'Please verify your email before logging in.' });
      }

      const token = jwt.sign({ id: user._id }, JWT_SECRET);
      res.json({ message: 'Login successful', token: token });
    } catch (error) {
      console.error('Error logging in:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  try {
      // Decode the token
      const decoded = jwt.verify(token, JWT_SECRET);
      const email = decoded.email;

      // Find the user by email
      const user = await User.findOne({ email });

      if (!user) {
          return res.status(400).json({ message: 'Invalid or expired token' });
      }

      // Check if already verified
      if (user.isVerified) {
          return res.status(200).json({ message: 'Email is already verified' });
      }

      // Mark the user as verified
      user.isVerified = true;
      await user.save();

      res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
      console.error('Email verification error:', error);
      res.status(400).json({ message: 'Invalid or expired token' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'User not found' });

      const resetToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Password Reset',
          html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`
      });

      res.json({ message: 'Password reset link sent to your email' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return res.status(400).json({ message: 'Invalid token' });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      res.json({ message: 'Password reset successfully' });
  } catch (error) {
      console.error(error);
      res.status(400).json({ message: 'Invalid or expired token' });
  }
});


module.exports = router;
