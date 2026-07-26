import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// 인천 1인가구 대시보드(보존본) 전용 설정.
// 루트를 legacy-incheon/ 으로 잡아 SSI 앱(src/)과 완전히 분리해 빌드한다.
// 실행: npm run dev:incheon / npm run build:incheon / npm run deploy:incheon
export default defineConfig({
  root: path.resolve(process.cwd(), 'legacy-incheon'),
  publicDir: path.resolve(process.cwd(), 'legacy-incheon/public'),
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: path.resolve(process.cwd(), 'legacy-incheon/dist'),
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000,
  },
})
