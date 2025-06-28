const express = require("express");
const app = express();
const cors = require("cors");
const path = require('path');

// Configure CORS for deployment
app.use(cors({
  origin: [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'https://geo-attendance-system.onrender.com',
    'https://attendance-app-xyz.onrender.com' // Add your actual deployment URL
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const { checkBrowser } = require('./middleware/browserCheck');
require('dotenv').config();

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => console.error(err));
