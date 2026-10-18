// ALO Learning Journey — PM2 Ecosystem
// Production process manager config.
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup

module.exports = {
  apps: [{
    name: 'alo-learning-journey',
    script: '.next/standalone/server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3017,
      HOSTNAME: '0.0.0.0',
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: '30s',
    error_file: '/home/aloedu/logs/alo-error.log',
    out_file: '/home/aloedu/logs/alo-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    kill_timeout: 5000,
    listen_timeout: 10000,
    shutdown_with_message: false,
    // Source map support for production stack traces
    source_map_support: true,
  }],
};
