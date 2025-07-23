// This QueueManager uses Redis for persistent and scalable queue management.
// It requires a Redis client instance to be passed during initialization.

class QueueManager {
    constructor(redisClient, maxActiveUsers = 5, activeSessionDurationMinutes = 5) {
        if (!redisClient) {
            throw new Error('Redis client must be provided to QueueManager');
        }
        this.redisClient = redisClient;
        this.MAX_ACTIVE_USERS = maxActiveUsers;
        this.ACTIVE_SESSION_DURATION_SECONDS = activeSessionDurationMinutes * 60; // Convert minutes to seconds for Redis SETEX

        // Redis Keys
        this.QUEUE_KEY = 'queue:waiting'; // Redis List for the queue (FIFO)
        this.ACTIVE_USERS_SET_KEY = 'queue:active_users'; // Redis Set for active users
        this.USER_SESSION_PREFIX = 'queue:user_session:'; // Prefix for individual user session keys

        // Periodically attempt to admit users if slots are available
        setInterval(() => this.admitUsersFromQueue(), 10 * 1000); // Run every 10 seconds
        console.log(`QueueManager (Redis) initialized: Max active users: ${this.MAX_ACTIVE_USERS}, Active session duration: ${activeSessionDurationMinutes} minutes.`);
    }

    /**
     * Adds a user to the queue if they are not already active or in the queue.
     * @param {string} userId - A unique identifier for the user (e.g., a cookie ID).
     * @returns {Promise<number>} A promise that resolves to the user's current position in the queue (1-indexed), or 0 if active.
     */
    async addToQueue(userId) {
        if (await this.isActive(userId)) {
            return 0; // User is already active, no need to queue
        }
        if (!(await this.getQueuePosition(userId) > 0)) { // Only add if not already in queue
            await this.redisClient.RPUSH(this.QUEUE_KEY, userId); // Add to the right (tail) of the list
            console.log(`User ${userId} added to queue. Current queue size: ${await this.getQueueSize()}`);
        }
        return await this.getQueuePosition(userId);
    }

    /**
     * Removes a user from the queue.
     * @param {string} userId - The unique identifier of the user.
     * @returns {Promise<boolean>} True if the user was removed, false otherwise.
     */
    async removeFromQueue(userId) {
        const removedCount = await this.redisClient.LREM(this.QUEUE_KEY, 0, userId);
        if (removedCount > 0) {
            console.log(`User ${userId} removed from queue. New queue size: ${await this.getQueueSize()}`);
            return true;
        }
        return false;
    }

    /**
     * Gets a user's current position in the queue.
     * @param {string} userId - The unique identifier of the user.
     * @returns {Promise<number>} The 1-indexed position, or 0 if not in queue.
     */
    async getQueuePosition(userId) {
        const queueList = await this.redisClient.LRANGE(this.QUEUE_KEY, 0, -1);
        const index = queueList.findIndex(id => id === userId);
        return index !== -1 ? index + 1 : 0;
    }

    /**
     * Attempts to admit users from the queue to the active users list if slots are available.
     * This method is called periodically.
     */
    async admitUsersFromQueue() {
        while (await this.getActiveUsersCount() < this.MAX_ACTIVE_USERS && await this.getQueueSize() > 0) {
            const nextUserId = await this.redisClient.LPOP(this.QUEUE_KEY); // Get from the left (head) of the list
            if (nextUserId) {
                await this.activateUser(nextUserId);
                console.log(`User ${nextUserId} admitted from queue. Active users: ${await this.getActiveUsersCount()}/${this.MAX_ACTIVE_USERS}. Queue size: ${await this.getQueueSize()}`);
            } else {
                break; // Queue is empty
            }
        }
    }

    /**
     * Activates a user, adding them to the active set and setting their session expiry.
     * @param {string} userId - The unique identifier of the user.
     */
    async activateUser(userId) {
        await this.redisClient.SADD(this.ACTIVE_USERS_SET_KEY, userId);
        await this.redisClient.SETEX(this.USER_SESSION_PREFIX + userId, this.ACTIVE_SESSION_DURATION_SECONDS, 'active');
        console.log(`User ${userId} activated.`);
    }

    /**
     * Checks if a user is currently active on the site.
     * An active user is in the active set AND has an unexpired session key.
     * @param {string} userId - The unique identifier of the user.
     * @returns {Promise<boolean>} True if active, false otherwise.
     */
    async isActive(userId) {
        const isInActiveSet = await this.redisClient.SISMEMBER(this.ACTIVE_USERS_SET_KEY, userId);
        if (!isInActiveSet) {
            return false;
        }
        const sessionExists = await this.redisClient.EXISTS(this.USER_SESSION_PREFIX + userId);
        if (!sessionExists) {
            // Session expired, remove from active set
            await this.redisClient.SREM(this.ACTIVE_USERS_SET_KEY, userId);
            console.log(`User ${userId} session expired (Redis TTL). Removed from active set.`);
            return false;
        }
        return true;
    }

    /**
     * Extends an active user's session by resetting their session expiry.
     * @param {string} userId - The unique identifier of the user.
     * @returns {Promise<boolean>} True if session was extended, false if user not found or not active.
     */
    async extendActiveSession(userId) {
        const sessionKey = this.USER_SESSION_PREFIX + userId;
        const sessionExists = await this.redisClient.EXISTS(sessionKey);
        if (sessionExists) {
            await this.redisClient.EXPIRE(sessionKey, this.ACTIVE_SESSION_DURATION_SECONDS);
            return true;
        }
        return false;
    }

    /**
     * Removes a user from the active list and clears their session.
     * @param {string} userId - The unique identifier of the user.
     * @returns {Promise<boolean>} True if removed, false otherwise.
     */
    async removeActiveUser(userId) {
        const removedFromSet = await this.redisClient.SREM(this.ACTIVE_USERS_SET_KEY, userId);
        const removedSession = await this.redisClient.DEL(this.USER_SESSION_PREFIX + userId);
        if (removedFromSet > 0 || removedSession > 0) {
            console.log(`User ${userId} manually removed from active users and session cleared.`);
            return true;
        }
        return false;
    }

    /**
     * Gets the current size of the queue.
     * @returns {Promise<number>} The number of users in the queue.
     */
    async getQueueSize() {
        return await this.redisClient.LLEN(this.QUEUE_KEY);
    }

    /**
     * Gets the current number of active users.
     * @returns {Promise<number>} The number of active users.
     */
    async getActiveUsersCount() {
        return await this.redisClient.SCARD(this.ACTIVE_USERS_SET_KEY);
    }

    /**
     * Gets the maximum number of active users allowed.
     * @returns {number} Max active users.
     */
    getMaxActiveUsers() {
        return this.MAX_ACTIVE_USERS;
    }

    /**
     * Clears all queue and active user data from Redis.
     * Useful for development/testing to start with a clean slate.
     */
    async clearQueueAndActiveUsers() {
        console.log('Clearing all queue and active user data from Redis...');
        // Delete the queue list
        await this.redisClient.DEL(this.QUEUE_KEY);
        // Delete the active users set
        await this.redisClient.DEL(this.ACTIVE_USERS_SET_KEY);

        // Find and delete all individual user session keys
        // WARNING: KEYS command can be slow on large production databases.
        // For production, consider using SCAN or a more targeted approach.
        const sessionKeys = await this.redisClient.KEYS(this.USER_SESSION_PREFIX + '*');
        if (sessionKeys.length > 0) {
            await this.redisClient.DEL(sessionKeys);
        }
        console.log('Queue and active user data cleared from Redis.');
    }
}

module.exports = QueueManager;
