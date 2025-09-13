const { exec } = require('child_process');
const path = require('path');

console.log('Starting build test...');
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);

// Try to run build with timeout
const buildProcess = exec('npm run build', (error, stdout, stderr) => {
  if (error) {
    console.error('Build failed:', error.message);
    console.error('stderr:', stderr);
    process.exit(1);
  }
  console.log('Build output:', stdout);
});

// Set a timeout
setTimeout(() => {
  console.log('Build timed out after 30 seconds - killing process');
  buildProcess.kill();
  process.exit(1);
}, 30000);

buildProcess.stdout.on('data', (data) => {
  console.log('BUILD:', data.toString());
});

buildProcess.stderr.on('data', (data) => {
  console.error('ERROR:', data.toString());
});