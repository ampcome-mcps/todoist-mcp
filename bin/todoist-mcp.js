#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Get the directory of this script
const scriptDir = path.dirname(__filename);
const serverPath = path.join(scriptDir, '..', 'dist', 'server.js');

// Check if dist/server.js exists, if not, try to build it
if (!fs.existsSync(serverPath)) {
    console.error('📦 Building Todoist MCP server...');
    
    const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: path.join(scriptDir, '..'),
        stdio: 'inherit',
        env: process.env
    });
    
    buildProcess.on('exit', (code) => {
        if (code === 0) {
            console.error('✅ Build completed successfully');
            startServer();
        } else {
            console.error('❌ Build failed');
            process.exit(1);
        }
    });
    
    buildProcess.on('error', (err) => {
        console.error('❌ Failed to build:', err);
        process.exit(1);
    });
} else {
    startServer();
}

function startServer() {
    // Start the MCP server
    const server = spawn('node', [serverPath], {
        stdio: 'inherit',
        env: process.env
    });
    
    server.on('exit', (code) => {
        process.exit(code);
    });
    
    server.on('error', (err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}
