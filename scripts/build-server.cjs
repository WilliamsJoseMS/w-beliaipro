/**
 * Build script for W-Beli.Ai Pro
 * 
 * Compiles the TypeScript server into a single bundled CommonJS file.
 * We bundle almost everything to make the pkg step faster and more reliable.
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const appRoot = path.join(__dirname, '..');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(appRoot, '.env') });

async function buildServer() {
    console.log('📦 Building server bundle with esbuild...');

    try {
        await esbuild.build({
            entryPoints: [path.join(appRoot, 'server.ts')],
            bundle: true,
            platform: 'node',
            target: 'node18',
            format: 'cjs',
            outfile: path.join(appRoot, 'server-compiled.cjs'),

            // Externalize only native modules that pkg/esbuild cannot handle
            // These will be copied manually to the dist-standalone folder
            external: ['better-sqlite3', 'sharp', 'vite', '@whiskeysockets/baileys'],

            // Inject environment variables at build time so they are baked into the binary
            define: {
                'process.env.NODE_ENV': '"production"',
                'process.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
                'process.env.SUPABASE_SERVICE_ROLE': JSON.stringify(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
                'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ''),
            },

            // Replace vite/baileys imports with stubs or handle them carefully
            plugins: [
                {
                    name: 'ignore-vite',
                    setup(build) {
                        build.onResolve({ filter: /^vite$/ }, () => ({
                            path: 'vite',
                            namespace: 'vite-stub',
                        }));
                        build.onLoad({ filter: /.*/, namespace: 'vite-stub' }, () => ({
                            contents: 'module.exports = { createServer: () => null };',
                            loader: 'js',
                        }));
                    },
                },
            ],

            splitting: false,
            sourcemap: false,
            minify: false,
            logLevel: 'info',
        });

        const stats = fs.statSync(path.join(appRoot, 'server-compiled.cjs'));
        console.log(`✅ Server compiled successfully!`);
        console.log(`   Output: server-compiled.cjs (${(stats.size / 1024).toFixed(1)} KB)`);

    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

buildServer();
