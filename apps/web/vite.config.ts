import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: the app code changes more often than these libraries
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
          'antd-x': ['@ant-design/x'],
          charts: ['@ant-design/plots'],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
    commonjsOptions: {
      include: [/shared-types/, /node_modules/],
    },
  },
  optimizeDeps: {
    include: ['@ai-corp/shared-types'],
  },
});
