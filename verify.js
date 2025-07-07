#!/usr/bin/env node

// Verification script to check if the project is properly set up for npx usage
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Todoist MCP Server setup...\n');

// Check if required files exist
const requiredFiles = [
    'package.json',
    'bin/todoist-mcp.js',
    'src/server.ts'
];

const optionalFiles = [
    'dist/server.js'  // This will be built by postinstall
];

let allFilesExist = true;

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} missing`);
        allFilesExist = false;
    }
});

// Check package.json configuration
if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    console.log('\n📋 Package.json configuration:');
    
    if (packageJson.bin && packageJson.bin['todoist-mcp']) {
        console.log('✅ Binary entry point configured');
    } else {
        console.log('❌ Binary entry point not configured');
        allFilesExist = false;
    }
    
    if (packageJson.files && packageJson.files.includes('dist/**/*')) {
        console.log('✅ Distribution files included');
    } else {
        console.log('❌ Distribution files not included');
        allFilesExist = false;
    }
    
    if (packageJson.scripts && packageJson.scripts.postinstall) {
        console.log('✅ Post-install script configured');
    } else {
        console.log('❌ Post-install script not configured');
        allFilesExist = false;
    }
}

optionalFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists (built)`);
    } else {
        console.log(`ℹ️  ${file} missing (will be built by postinstall)`);
    }
});

// Check if dist/server.js has shebang (only if it exists)
if (fs.existsSync('dist/server.js')) {
    const serverContent = fs.readFileSync('dist/server.js', 'utf8');
    if (serverContent.startsWith('#!/usr/bin/env node')) {
        console.log('✅ Server script has correct shebang');
    } else {
        console.log('❌ Server script missing shebang');
        allFilesExist = false;
    }
} else {
    console.log('ℹ️  Server script will be built during installation');
}

// Check if bin/todoist-mcp.js has shebang
if (fs.existsSync('bin/todoist-mcp.js')) {
    const binContent = fs.readFileSync('bin/todoist-mcp.js', 'utf8');
    if (binContent.startsWith('#!/usr/bin/env node')) {
        console.log('✅ Binary script has correct shebang');
    } else {
        console.log('❌ Binary script missing shebang');
        allFilesExist = false;
    }
}

console.log('\n🎯 Summary:');
if (allFilesExist) {
    console.log('✅ All checks passed! The project is ready for npx usage.');
    console.log('\nTo test, run:');
    console.log('npx -y git+https://github.com/ampcome-mcps/todoist-mcp.git');
} else {
    console.log('❌ Some checks failed. Please fix the issues above.');
    process.exit(1);
}
