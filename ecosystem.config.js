module.exports = {
  apps: [{
    name: 'alo-learning-journey',
    script: '.next/standalone/server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3017,
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '512M',
  }],
};
