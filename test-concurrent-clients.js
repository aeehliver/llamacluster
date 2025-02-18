const { spawn } = require('child_process');
const path = require('path');

// Number of concurrent clients to spawn
const NUM_CLIENTS = 5;

// Array to store client processes
const clients = [];

// Function to spawn a client process
function spawnClient(index) {
    const clientPath = path.join(__dirname, 'client', 'windows', 'index.js');
    const client = spawn('node', [clientPath], {
        stdio: 'pipe'
    });

    client.stdout.on('data', (data) => {
        console.log(`Client ${index + 1}: ${data}`);
    });

    client.stderr.on('data', (data) => {
        console.error(`Client ${index + 1} Error: ${data}`);
    });

    client.on('close', (code) => {
        console.log(`Client ${index + 1} exited with code ${code}`);
    });

    return client;
}

// Spawn multiple clients
console.log(`Spawning ${NUM_CLIENTS} concurrent clients...`);
for (let i = 0; i < NUM_CLIENTS; i++) {
    const client = spawnClient(i);
    clients.push(client);
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nGracefully shutting down clients...');
    clients.forEach(client => client.kill());
    process.exit(0);
});