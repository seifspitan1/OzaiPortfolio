import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

// 1. Ensure .env is loaded if not already provided by --env-file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            if (!process.env[key]) {
                process.env[key] = val.replace(/^["']|["']$/g, '');
            }
        }
    }
}

// 2. Import handlers dynamically after environment variables are loaded
const { default: healthHandler } = await import('./api/v1/health.js');
const { default: loadHandler } = await import('./api/v1/load.js');
const { default: loginHandler } = await import('./api/v1/login.js');
const { default: logoutHandler } = await import('./api/v1/logout.js');
const { default: sessionHandler } = await import('./api/v1/session.js');
const { default: saveHandler } = await import('./api/v1/save.js');
const { default: uploadHandler } = await import('./api/v1/upload.js');

const app = express();

// Disable x-powered-by header for security
app.disable('x-powered-by');

// Suppress Vercel analytics / insights 404s in local development
app.use('/_vercel', (req, res) => res.status(204).end());

// Upload handler MUST be mounted before express.json() because it streams multipart via busboy
app.all('/api/v1/upload', uploadHandler);

// Parse JSON & URL-encoded bodies for remaining API routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API v1 routes
app.all('/api/v1/health', healthHandler);
app.all('/api/v1/load', loadHandler);
app.all('/api/v1/login', loginHandler);
app.all('/api/v1/logout', logoutHandler);
app.all('/api/v1/session', sessionHandler);
app.all('/api/v1/save', saveHandler);

// Serve static files from workspace root
app.use(express.static(__dirname, {
    extensions: ['html'],
    index: 'index.html'
}));

// Route fallback for /admin to /admin/index.html
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Fallback for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Port discovery & listener
const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);

function start(port) {
    const server = http.createServer(app);

    server.once('listening', () => {
        console.log('\n=================================================');
        console.log('  🚀 Ozai Portfolio Local Server is Running!');
        console.log(`  > Local:    http://localhost:${port}`);
        console.log(`  > Admin:    http://localhost:${port}/admin/`);
        console.log(`  > API:      http://localhost:${port}/api/v1/health`);
        console.log('=================================================\n');
    });

    server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`[Port ${port} in use, switching to port ${port + 1}...]`);
            start(port + 1);
        } else {
            console.error('Server error:', err);
            process.exit(1);
        }
    });

    server.listen(port, '0.0.0.0');
}

start(DEFAULT_PORT);

