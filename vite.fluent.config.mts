import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/renderer/src/components/common/react/register-fluent.ts'),
      // entry: path.resolve(__dirname, 'src/preload/register-fluent.ts'),
      // entry: path.resolve(__dirname, 'generated/register-fluent.ts'),
      name: 'FluentRegistry',
      fileName: () => 'register-fluent.js',
      formats: ['es']
    },
    outDir: 'src/renderer/src/components/common/react/dist',
    // outDir: 'dist',
    // emptyOutDir: true,
    emptyOutDir: false,
    minify: true
  }
});
