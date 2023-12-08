const redis = require('redis');

const client = redis.createClient({
    // Default configuration for local development
    host: 'localhost',
    port: 6379
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.connect();

module.exports = client;
