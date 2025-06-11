const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Student = require('../models/Student');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    let user;
    if (role === 'teacher') {
      user = await User.findOne({ email });
    } else if (role === 'student') {
      user = await Student.findOne({ email });
    } else {
      return res.status(400).json({ message: 'Invalid role selected' });
    }

    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    // ✅ Role check
    if (user.role && user.role !== role) {
      return res.status(403).json({ message: `Unauthorized: Please log in as a ${user.role}` });
    }

    const token = jwt.sign(
      { userId: user._id, role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, role, name: user.name, slot: user.slot });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});


// console.log("Received token:", token);
// console.log("Decoded token:", decoded);

module.exports = router;
