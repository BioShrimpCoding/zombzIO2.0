import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    // allow access through Codespaces / any forwarded domain
    allowedHosts: true,
  },
});
