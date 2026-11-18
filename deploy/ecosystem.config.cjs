module.exports = {
  apps: [
    {
      name: "debug-quest",
      cwd: "/opt/debug-quest",
      script: "npm",
      args: "start",
      instances: 1,
      autorestart: true,
      max_memory_restart: "750M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
