import {defineConfig, loadEnv} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({mode})=>{
  const env = loadEnv(mode, process.cwd())

  return {
    plugins: [react()],
    build:{
      outDir: "release/public",
    },
    server:{
      port:3000,
      proxy:{
        "/yts":{
          target: env.VITE_YTS_PROXY || "https://yts.mx",
          changeOrigin: true,
          secure: false,
        },
        "/api":{
          target: env.VITE_PROXY,
          changeOrigin: true,
          secure: false,
          headers:{
            "referer": env.VITE_PROXY,
            "origin": env.VITE_PROXY,
          },
        }
      }
    }
  }
})
