#!/usr/bin/env node

// Test script to simulate what happens when npx runs the package
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing npx simulation...\n');

// Simulate removing dist folder (like in fresh npx install)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
    console.log('📁 Removing existing dist folder to simulate fresh install...');
    fs.rmSync(distPath, { recursive: true, force: true });
}

// Now run the bin script
console.log('🚀 Running bin/todoist-mcp.js...\n');

const binPath = path.join(__dirname, '..', 'bin', 'todoist-mcp.js');
const testProcess = spawn('node', [binPath], {
    stdio: 'pipe',
    env: {
        ...process.env,
        NANGO_CONNECTION_ID: 'test_connection_id',
        NANGO_INTEGRATION_ID: 'test_integration_id',
        NANGO_BASE_URL: 'https://api.nango.dev',
        NANGO_SECRET_KEY: 'test_secret_key'
    }
});

let output = '';
let errorOutput = '';

testProcess.stdout.on('data', (data) => {
    output += data.toString();
    console.log('STDOUT:', data.toString());
});

testProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.log('STDERR:', data.toString());
});

testProcess.on('exit', (code) => {
    console.log('\n📊 Test Results:');
    console.log('Exit code:', code);
    
    if (output.includes('Building') || errorOutput.includes('Building')) {
        console.log('✅ Build process was triggered');
    } else {
        console.log('❌ Build process was not triggered');
    }
    
    if (fs.existsSync(distPath)) {
        console.log('✅ dist folder was created');
    } else {
        console.log('❌ dist folder was not created');
    }
    
    if (code === 1) {
        console.log('✅ Expected exit code (server failed due to invalid credentials)');
    } else {
        console.log('❓ Unexpected exit code');
    }
    
    console.log('\n🎉 npx simulation test completed!');
});

testProcess.on('error', (err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

// Kill the process after 10 seconds
setTimeout(() => {
    console.log('⏰ Stopping test after 10 seconds...');
    testProcess.kill();
}, 10000);
