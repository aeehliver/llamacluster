const WindowsClient = require('./client');

// Crear el cliente
const client = new WindowsClient();

console.log('Iniciando cliente Windows...');

// Iniciar el cliente, que activará el P2P Discovery
client.start();

// Manejar eventos de P2P
client.on('peer-discovered', ({ nodeId, hostname }) => {
    console.log(`Peer descubierto: ${hostname} (${nodeId})`);
});

client.on('peer-lost', ({ nodeId }) => {
    console.log(`Peer perdido: ${nodeId}`);
});

client.on('leader-elected', ({ nodeId }) => {
    console.log(`Líder elegido: ${nodeId}`);
});

// Manejar el cierre limpio
process.on('SIGINT', () => {
    console.log('Apagando cliente...');
    client.stop();
    process.exit(0);
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('Error no capturado:', error);
});