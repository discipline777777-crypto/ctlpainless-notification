import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// GitHub Pages 部署配置 - 使用相对路径，支持任意域名
export default defineConfig({
  plugins: [react()],
  base: './', // 关键：使用相对路径，避免白屏
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
})
