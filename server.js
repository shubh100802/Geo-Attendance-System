const express = require("express");
const app = express();
const cors = require("cors");
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { createClient } = require('redis');

dotenv.config();

const authRoutes = require('./routes/auth');

const QueueManager = require('./utils/queueManager');

app.use(cors({
  origin: [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'https://geo-attendance-system.onrender.com',
    'https://attendance-app-xyz.onrender.com' 
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

// ====================================================================
// REDIS CLIENT INITIALIZATION
// ====================================================================
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', err => console.error('Redis Client Error', err));

// ====================================================================
// VIRTUAL QUEUE/WAITING ROOM CONFIGURATION AND MIDDLEWARE
// ====================================================================
// Initialize the QueueManager INSTANCE
const queueManager = new QueueManager(
    redisClient,
    parseInt(process.env.MAX_ACTIVE_USERS || '5'),
    parseInt(process.env.ACTIVE_SESSION_DURATION_MINUTES || '5')
);
console.log('QueueManager instance created:', queueManager); // ADDED LOG HERE

// Pass the queueManager instance to the authRoutes router
if (authRoutes.setQueueManager) {
    authRoutes.setQueueManager(queueManager);
}

// Import the queueMiddleware function and immediately call it with the queueManager instance
const queueMiddleware = require('./middleware/queueMiddleware')(queueManager);

// Apply the queue middleware
app.use(queueMiddleware);
// ====================================================================


// Health check endpoint (can bypass queue if needed, but queueMiddleware handles exclusions)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/auth', require('./middleware/browserCheck').checkBrowser, authRoutes);
app.use('/teacher', require('./middleware/browserCheck').checkBrowser, require('./routes/teacher'));
app.use('/student', require('./middleware/browserCheck').checkBrowser, require('./routes/student'));

// ====================================================================
// VIRTUAL QUEUE/WAITING ROOM ROUTES
// These routes are explicitly excluded from the queueMiddleware's check
// via the `excludedPaths` array within queueMiddleware.js
// ====================================================================

// Route to serve the waiting room HTML page
app.get('/waiting-room', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'waiting-room.html'));
});

// Route to serve the thank you HTML page
app.get('/public/thank-you.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'thank-you.html'));
});

// API endpoint for the waiting room page to poll for status
app.get('/queue-status', async (req, res) => {
    const queueId = req.query.queueId || req.cookies.queue_id;
    if (!queueId) {
        return res.status(400).json({ message: 'Queue ID not provided.' });
    }

    if (await queueManager.isActive(queueId)) {
        await queueManager.removeFromQueue(queueId);
        return res.json({ status: 'ready', message: 'You are now admitted to the site!' });
    }

    const position = await queueManager.getQueuePosition(queueId);
    if (position > 0) {
        const estimatedWaitMinutes = Math.ceil(position / (queueManager.getMaxActiveUsers() / 2));
        return res.json({ status: 'waiting', position, estimatedWaitMinutes });
    } else {
        return res.status(200).json({ status: 'not_in_queue', message: 'You are not in the queue. Please try accessing the main site again.' });
    }
});

// API endpoint for a user to voluntarily leave the queue
app.post('/queue/leave', async (req, res) => {
    const { queueId } = req.body;
    if (!queueId) {
        return res.status(400).json({ message: 'Queue ID not provided.' });
    }

    if (await queueManager.removeFromQueue(queueId)) {
        res.clearCookie('queue_id');
        return res.json({ message: 'You have left the queue.' });
    } else if (await queueManager.removeActiveUser(queueId)) {
        res.clearCookie('queue_id');
        return res.json({ message: 'Your active session has been ended.' });
    } else {
        return res.status(404).json({ message: 'You were not found in the queue or active list.' });
    }
});

// API endpoint to signal a user has left the site (e.g., closed browser)
// This endpoint can be used to clean up the queue and active users when a user leaves the site
// This is useful for handling cases where the user closes the browser or navigates away without leaving
app.post('/queue/signal-departure', async (req, res) => {
    const { queueId } = req.body;
    if (!queueId) {
        return res.status(400).json({ message: 'Queue ID not provided.' });
    }
    console.log(`Received departure signal for queueId: ${queueId}`);
    // Attempt to remove from both queue and active users
    const removedFromQueue = await queueManager.removeFromQueue(queueId);
    const removedFromActive = await queueManager.removeActiveUser(queueId);

    if (removedFromQueue || removedFromActive) {
        console.log(`User ${queueId} removed from queue/active list due to departure signal.`);
        return res.status(200).json({ message: 'Departure signal processed.' });
    } else {
        return res.status(200).json({ message: 'User not found in queue or active list (already removed).' });
    }
});


// ====================================================================

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for all other unmatched routes
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

// Function to connect to Redis and MongoDB, then start the server
async function startServer() {
    try {
        // Connect to Redis first
        await redisClient.connect();
        console.log('Redis connected successfully');

        // Clear Redis queue and active users on startup for development
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            await queueManager.clearQueueAndActiveUsers();
        }

        // Then connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected successfully');

        // Start the Express server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        if (redisClient.isOpen) {
            await redisClient.quit();
        }
        process.exit(1);
    }
}

startServer();
