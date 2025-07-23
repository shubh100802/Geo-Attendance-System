const crypto = require('crypto'); 

module.exports = (queueManagerInstance) => { 
    if (!queueManagerInstance) {
        throw new Error('QueueManager instance must be provided to queueMiddleware.');
    }

    // Middleware to manage the virtual queue
    const queueMiddleware = async (req, res, next) => { 
        const excludedPaths = [
            '/public/', 
            '/auth/login', 
            '/waiting-room', 
            '/queue-status', 
            '/queue/leave', 
            '/queue/signal-departure', 
            '/favicon.ico' 
        ];

        // Check if the current request path should bypass the queue
        if (excludedPaths.some(path => req.path.startsWith(path))) {
            // console.log(`[QueueMiddleware] Bypassing queue for path: ${req.path}`); // Log removed
            return next(); 
        }

        let queueId = req.cookies.queue_id; 

        // If no queue ID, generate one and set it as a cookie
        if (!queueId) {
            queueId = crypto.randomUUID(); 
            res.cookie('queue_id', queueId, {
                maxAge: 7 * 24 * 60 * 60 * 1000, 
                httpOnly: false, 
                secure: process.env.NODE_ENV === 'production', 
                sameSite: 'Lax' 
            });
            console.log(`[QueueMiddleware] New queue_id generated: ${queueId}`); // Keep this one, it's useful
        } else {
            // console.log(`[QueueMiddleware] Existing queue_id: ${queueId} for path: ${req.path}`); 
        }

        // Fetch current state of active users and queue
        const activeUsersCount = await queueManagerInstance.getActiveUsersCount();
        const maxActiveUsers = queueManagerInstance.getMaxActiveUsers();
        const queueSize = await queueManagerInstance.getQueueSize();

        // console.log(`[QueueMiddleware] Current state for ${queueId}: Active=${activeUsersCount}/${maxActiveUsers}, Queue=${queueSize}`); 

        // 1. Check if the user is already active (e.g., returning user, or just admitted)
        const userIsCurrentlyActive = await queueManagerInstance.isActive(queueId);
        if (userIsCurrentlyActive) {
            await queueManagerInstance.extendActiveSession(queueId); 
            // console.log(`[QueueMiddleware] User ${queueId} is active, proceeding to main site.`); 
            return next(); 
        }

        // 2. If user is not active, check if there's a slot available for them to be admitted
        if (activeUsersCount < maxActiveUsers) {
            await queueManagerInstance.removeFromQueue(queueId); 
            await queueManagerInstance.activateUser(queueId); 
            console.log(`[QueueMiddleware] Slot available. User ${queueId} admitted to main site.`); 
            return next(); 
        }

        // 3. If no slots available and user is not active, put them in queue and redirect
        console.log(`[QueueMiddleware] No slots available. Redirecting user ${queueId} to waiting room.`);
        await queueManagerInstance.addToQueue(queueId); 
        return res.redirect('/waiting-room');
    };

    return queueMiddleware; 
};
