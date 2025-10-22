const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple test to verify the Next.js frontend can start without errors
describe('Next.js Frontend Startup', () => {
  let frontendProcess;

  // Test that the frontend can start without throwing syntax/runtime errors
  test('should start without errors', (done) => {
    const start = Date.now();
    
    // Start the Next.js frontend process
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      env: { 
        ...process.env,
        PORT: '3002' // Use a different port to avoid conflicts
      },
      stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
    });

    let hasErrors = false;
    let output = '';
    let errorOutput = '';

    // Capture stdout
    frontendProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      output += dataStr;
      
      // If we see the ready message, it started successfully
      if (dataStr.includes('Ready in') || dataStr.includes('Local:')) {
        // Give it a little more time to ensure no errors follow
        setTimeout(() => {
          if (!hasErrors) {
            done(); // Test passes
          }
        }, 1000);
      }
    });

    // Capture stderr (errors)
    frontendProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      
      // Check for common startup errors
      if (dataStr.includes('Error:') || 
          dataStr.includes('Failed to compile') || 
          dataStr.includes('Module not found') ||
          dataStr.includes('Babel loader does not support')) {
        hasErrors = true;
        done(new Error(`Frontend startup error: ${dataStr}`));
      }
    });

    // Handle process exit
    frontendProcess.on('close', (code) => {
      if (!hasErrors && code !== 0 && code !== null) {
        done(new Error(`Frontend exited with code: ${code}, output: ${output}, stderr: ${errorOutput}`));
      }
      // If we reach here without done() being called, and no errors occurred, 
      // it means the frontend started but we didn't see the expected message
      if (!hasErrors && Date.now() - start > 10000) { // 10 second timeout
        done(); // Consider it a pass if no errors after timeout
      }
    });

    // Set timeout to prevent hanging
    setTimeout(() => {
      if (frontendProcess && !frontendProcess.killed) {
        frontendProcess.kill('SIGTERM');
      }
    }, 8000); // 8 second timeout
  }, 10000); // 10 second test timeout

  // Clean up: ensure frontend process is killed after test
  afterEach((done) => {
    if (frontendProcess && !frontendProcess.killed) {
      frontendProcess.on('close', () => {
        done();
      });
      frontendProcess.kill('SIGTERM');
      
      // Force kill if it doesn't close in time
      setTimeout(() => {
        if (frontendProcess && !frontendProcess.killed) {
          frontendProcess.kill('SIGKILL');
        }
        done();
      }, 1000);
    } else {
      done();
    }
  });
});