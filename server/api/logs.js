const express = require('express');
const router = express.Router();

// Store logs in memory (in production, use a proper logging system)
const logs = [];
const MAX_LOGS = 1000; // Maximum number of logs to keep in memory

// Add a new log entry
function addLog(level, message, metadata = {}) {
    const logEntry = {
        timestamp: Date.now(),
        level,
        message,
        metadata,
    };

    logs.unshift(logEntry); // Add to beginning of array
    if (logs.length > MAX_LOGS) {
        logs.pop(); // Remove oldest log if we exceed maximum
    }

    return logEntry;
}

// Get all logs
router.get('/', (req, res) => {
    const { level, limit = 100, before, after } = req.query;
    
    let filteredLogs = [...logs];

    // Filter by level if specified
    if (level) {
        filteredLogs = filteredLogs.filter(log => log.level === level);
    }

    // Filter by timestamp if specified
    if (before) {
        filteredLogs = filteredLogs.filter(log => log.timestamp < parseInt(before));
    }
    if (after) {
        filteredLogs = filteredLogs.filter(log => log.timestamp > parseInt(after));
    }

    // Apply limit
    filteredLogs = filteredLogs.slice(0, parseInt(limit));

    res.json({
        total: filteredLogs.length,
        logs: filteredLogs
    });
});

// Add a new log entry
router.post('/', (req, res) => {
    const { level, message, metadata } = req.body;

    if (!level || !message) {
        return res.status(400).json({
            error: 'Missing required log information'
        });
    }

    if (!['debug', 'info', 'warn', 'error'].includes(level)) {
        return res.status(400).json({
            error: 'Invalid log level'
        });
    }

    const logEntry = addLog(level, message, metadata);

    res.json({
        message: 'Log entry added successfully',
        log: logEntry
    });
});

// Clear all logs
router.delete('/', (req, res) => {
    logs.length = 0;
    
    res.json({
        message: 'All logs cleared successfully'
    });
});

// Get logs by node ID
router.get('/node/:nodeId', (req, res) => {
    const { nodeId } = req.params;
    const { limit = 100 } = req.query;

    const nodeLogs = logs
        .filter(log => log.metadata && log.metadata.nodeId === nodeId)
        .slice(0, parseInt(limit));

    res.json({
        nodeId,
        total: nodeLogs.length,
        logs: nodeLogs
    });
});

// Get error logs
router.get('/errors', (req, res) => {
    const { limit = 100 } = req.query;

    const errorLogs = logs
        .filter(log => log.level === 'error')
        .slice(0, parseInt(limit));

    res.json({
        total: errorLogs.length,
        logs: errorLogs
    });
});

module.exports = router;