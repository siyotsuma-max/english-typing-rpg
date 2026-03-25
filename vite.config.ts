import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/english-typing-rpg/',
  plugins: [react(), tailwindcss()],
})