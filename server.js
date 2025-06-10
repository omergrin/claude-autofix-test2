const http = require('http');
const fs = require('fs').promises;
const path = require('path');

// Issue 1: Hardcoded port without environment variable fallback
const PORT = 3000;

// Issue 2: No error handling for file operations
async function readConfig() {
    const config = await fs.readFile('config.json', 'utf8');
    return JSON.parse(config);
}

// Issue 3: Synchronous file operations blocking the event loop
async function serveFile(filePath, res) {
    const data = await fs.readFile(filePath);
    res.writeHead(200);
    res.end(data);
}

// Issue 4: No input validation or sanitization
function handleUserData(userData) {
    console.log('Processing user data:', userData);
    // Directly executing without validation
    return userData.toUpperCase();
}

const server = http.createServer(async (req, res) => {
    console.log(`${req.method} ${req.url}`);
    
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Hello World!</h1><p>Server is running</p>');
    } 
    else if (req.url === '/config') {
        // Issue 5: Exposing sensitive configuration
        try {
            const config = await readConfig();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(config));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error reading config');
        }
    }
    else if (req.url.startsWith('/file/')) {
        // Issue 6: Path traversal vulnerability
        const fileName = req.url.split('/file/')[1];
        const filePath = path.join(__dirname, fileName);
        try {
            await serveFile(filePath, res);
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
        }
    }
    else if (req.method === 'POST' && req.url === '/data') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            // Issue 7: No content-type validation
            const result = handleUserData(body);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(result);
        });
    }
    else {
        // Issue 8: Information disclosure in error messages
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`File not found: ${req.url} on server ${__dirname}`);
    }
});

// Issue 9: No graceful shutdown handling
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});

// Issue 10: Missing error handling for server
// server.on('error', ...) is not implemented