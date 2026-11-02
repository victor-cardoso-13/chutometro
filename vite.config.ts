import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// "base: './'" faz o jogo funcionar em qualquer endereço (GitHub Pages, computador, celular pelo Wi-Fi).
export default defineConfig({
  base: './',
  plugins: [
    // Vira "app": dá para pôr na Tela de Início e jogar sem internet.
    VitePWA({
      registerType: 'autoUpdate', // versão nova é baixada sozinha e vale na próxima vez que abrir
      includeAssets: ['apple-touch-icon-2.png'],
      manifest: {
        name: 'Chutômetro',
        short_name: 'Chutômetro',
        description: 'Chutômetro. Sem anúncios.',
        lang: 'pt-BR',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#171a22',
        theme_color: '#171a22',
        icons: [
          { src: 'icone-2-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-2-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-2-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3_000_000, // a parte do Firebase passa do limite padrão
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
