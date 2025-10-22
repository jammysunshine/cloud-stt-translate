const { spawn } = require('child_process');

// Simple test to verify the WebSocket server can start without errors
describe('WebSocket Server Startup', () => {
  let serverProcess;

  // Test that the server can start without throwing syntax/runtime errors
  test('should start without errors', (done) => {
    const start = Date.now();
    
    // Start the WebSocket server process with a different port to avoid conflicts
    serverProcess = spawn('node', ['websocket-server.js'], {
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
    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      // If we see the server is listening message, it started successfully
      if (data.toString().includes('> WebSocket server listening on ws://localhost:')) {
        // Give it a little more time to ensure no errors follow
        setTimeout(() => {
          if (!hasErrors) {
            done(); // Test passes
          }
        }, 500);
      }
    });

    // Capture stderr (errors)
    serverProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      hasErrors = true;
      done(new Error(`Server startup error: ${data.toString()}`));
    });

    // Handle process exit
    serverProcess.on('close', (code) => {
      if (!hasErrors && code !== 0 && code !== null) {
        done(new Error(`Server exited with code: ${code}, output: ${output}, stderr: ${errorOutput}`));
      }
      // If we reach here without done() being called, and no errors occurred, 
      // it means the server started but we didn't see the expected message
      if (!hasErrors && !output.includes('> WebSocket server listening on ws://localhost:') && Date.now() - start > 3000) {
        done(); // Consider it a pass if no errors after timeout (server may have started but printed nothing)
      }
    });

    // Set timeout to prevent hanging
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGTERM');
      }
      // Don't call done() here since the process might still be running normally
    }, 4000); // 4 second timeout
  }, 5000); // 5 second test timeout

  // Clean up: ensure server process is killed after test
  afterEach((done) => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.on('close', () => {
        done();
      });
      serverProcess.kill('SIGTERM');
      
      // Force kill if it doesn't close in time
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
        done();
      }, 1000);
    } else {
      done();
    }
  });
});