// frontend\vite.config.js

import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')

    return {
        root: '.',
        base: '/',
        build: {
            outDir: 'dist',
            assetsDir: 'assets',
            emptyOutDir: true,
            sourcemap: false,
            rollupOptions: {
                input: {
                    main: resolve(__dirname, 'index.html'),
                    admin: resolve(__dirname, 'admin.html'),
                },
                output: {
                    manualChunks: undefined
                }
            }
        },
        server: {
            port: 5500,
            host: true,
            open: false
        },
        preview: {
            port: 5500,
            host: true,
            allowedHosts: [
                '.len.co.id',
                '.husnifd.my.id',
            ]
        },
        plugins: [
            {
                name: 'html-env-inject',
                transformIndexHtml(html) {
                    return html
                        .replace('%VITE_APP_TITLE%', env.VITE_APP_TITLE || 'GEOSAVE')
                        .replace('__VITE_API_BASE_URL__', env.VITE_API_BASE_URL || 'http://localhost:5000/api')
                        .replace("'development'", `'${env.VITE_ENV || 'development'}'`)
                }
            }
        ]
    }
})
