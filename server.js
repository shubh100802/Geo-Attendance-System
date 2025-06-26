const express = require("express");
const app = express();
const cors = require("cors");
const path = require('path');
app.use(cors());
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const { checkBrowser } = require('./middleware/browserCheck');
require('dotenv').config();

app.use(express.json());

// API Routes
app.use('/auth', checkBrowser, authRoutes);
app.use('/teacher', checkBrowser, require('./routes/teacher'));
app.use('/student', checkBrowser, require('./routes/student'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => console.error(err));
