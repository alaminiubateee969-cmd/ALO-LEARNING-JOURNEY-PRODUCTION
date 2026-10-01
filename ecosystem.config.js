module.exports = {
  apps: [
    {
      name: "alo-learning-journey",
      script: ".next/standalone/server.js",
      interpreter: "node",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3017,
        HOSTNAME: "127.0.0.1"
      }
    }
  ]
};
