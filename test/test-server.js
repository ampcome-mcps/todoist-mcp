#!/usr/bin/env node

// Simple test script to verify the MCP server can be started
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Testing Todoist MCP Server...');

// Set test environment variables
process.env.NANGO_CONNECTION_ID = 'test_connection_id';
process.env.NANGO_INTEGRATION_ID = 'test_integration_id';
process.env.NANGO_BASE_URL = 'https://api.nango.dev';
process.env.NANGO_SECRET_KEY = 'test_secret_key';

const serverPath = path.join(__dirname, '..', 'dist', 'server.js');

// Check if server exists, if not build it first
if (!fs.existsSync(serverPath)) {
    console.log('Building server first...');
    
    const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        env: process.env
    });
    
    buildProcess.on('exit', (code) => {
        if (code === 0) {
            console.log('Build completed, starting test...');
            startTest();
        } else {
            console.error('Build failed');
            process.exit(1);
        }
    });
    
    buildProcess.on('error', (err) => {
        console.error('Build error:', err);
        process.exit(1);
    });
} else {
    startTest();
}

function startTest() {
    console.log('Starting server at:', serverPath);
    
    const server = spawn('node', [serverPath], {
        stdio: 'pipe',
        env: process.env
    });
    
    let output = '';
    let errorOutput = '';
    
    server.stdout.on('data', (data) => {
        output += data.toString();
        console.log('STDOUT:', data.toString());
    });
    
    server.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log('STDERR:', data.toString());
    });
    
    server.on('exit', (code) => {
        console.log('\nServer exited with code:', code);
        console.log('Output:', output);
        console.log('Error output:', errorOutput);
        
        if (code === 0) {
            console.log('✅ Test passed!');
        } else {
            console.log('❌ Test failed!');
        }
        
        process.exit(code);
    });
    
    server.on('error', (err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
    
    // Kill the server after 5 seconds
    setTimeout(() => {
        console.log('Stopping server...');
        server.kill();
    }, 5000);
}
