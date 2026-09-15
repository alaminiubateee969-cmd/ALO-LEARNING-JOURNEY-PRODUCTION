module.exports = {
  apps: [
    {
      name: "alo-learning-journey",
      script: ".next/standalone/server.js",
      interpreter: "bun",
      cwd: "/root/alo-github-verify",
      env: {
        NODE_ENV: "production",
        PORT: 3017,
        HOSTNAME: "0.0.0.0"
      }
    }
  ]
};
