const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Store registered clients in memory (in production, use a database)
const registeredClients = new Map();

// Generate a unique client ID
function generateClientId() {
    return crypto.randomBytes(16).toString('hex');
}

// Register a new client
router.post('/register', (req, res) => {
    const { clientType, capabilities } = req.body;

    if (!clientType || !capabilities) {
        return res.status(400).json({
            error: 'Missing required registration information'
        });
    }

    const clientId = generateClientId();
    const registrationToken = crypto.randomBytes(32).toString('hex');

    // Store client information
    registeredClients.set(clientId, {
        clientType,
        capabilities,
        registrationToken,
        registeredAt: new Date(),
        status: 'active'
    });

    res.json({
        clientId,
        registrationToken,
        message: 'Registration successful'
    });
});

// Verify client registration
router.post('/verify', (req, res) => {
    const { clientId, registrationToken } = req.body;

    if (!clientId || !registrationToken) {
        return res.status(400).json({
            error: 'Missing client ID or registration token'
        });
    }

    const client = registeredClients.get(clientId);

    if (!client || client.registrationToken !== registrationToken) {
        return res.status(401).json({
            error: 'Invalid client ID or registration token'
        });
    }

    res.json({
        verified: true,
        clientType: client.clientType,
        message: 'Client verification successful'
    });
});

// Get client information
router.get('/client/:clientId', (req, res) => {
    const { clientId } = req.params;
    const client = registeredClients.get(clientId);

    if (!client) {
        return res.status(404).json({
            error: 'Client not found'
        });
    }

    // Don't send sensitive information like registration token
    const { registrationToken, ...clientInfo } = client;
    res.json(clientInfo);
});

// Deregister a client
router.delete('/deregister/:clientId', (req, res) => {
    const { clientId } = req.params;
    const { registrationToken } = req.body;

    const client = registeredClients.get(clientId);

    if (!client || client.registrationToken !== registrationToken) {
        return res.status(401).json({
            error: 'Invalid client ID or registration token'
        });
    }

    registeredClients.delete(clientId);

    res.json({
        message: 'Client deregistered successfully'
    });
});

module.exports = router;