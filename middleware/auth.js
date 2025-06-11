// middleware/auth.js

const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.role = decoded.role;
    console.log("Decoded userId:", decoded.userId);
    console.log("Authorization header:", req.headers.authorization);
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
}




module.exports = verifyToken;
