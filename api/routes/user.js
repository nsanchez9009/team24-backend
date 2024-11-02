const express = require('express');
const User = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/getuser', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user).select('-password'); // Exclude password from the response
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/updateSchool', verifyToken, async (req, res) => {
  const { school } = req.body;
  try {
    const updatedUser = await User.findByIdAndUpdate(req.user, { school }, { new: true });
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating school:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
