const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

// End-to-end test to verify the Next.js frontend works when a browser connects to it
describe('Next.js Frontend E2E', () => {
  let frontendProcess;
  let browser;
  let page;

  // Test that the frontend works correctly when a browser connects to it
  test('should serve pages without errors when browser connects', async () => {
    const start = Date.now();
    
    // Start the Next.js frontend process
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      env: { 
        ...process.env,
        PORT: '3003' // Use a different port to avoid conflicts
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
    });

    // Capture stderr (errors)
    frontendProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      
      // Check for common runtime errors
      if (dataStr.includes('Error:') || 
          dataStr.includes('Failed to compile') || 
          dataStr.includes('Module not found') ||
          dataStr.includes('Babel loader does not support')) {
        hasErrors = true;
      }
    });

    // Wait for the frontend to be ready
    await new Promise((resolve, reject) => {
      const checkReady = () => {
        if (output.includes('Ready in') || output.includes('Local:')) {
          resolve();
        } else if (Date.now() - start > 15000) { // 15 second timeout
          reject(new Error('Frontend did not start in time'));
        } else if (hasErrors) {
          reject(new Error(`Frontend startup error: ${errorOutput}`));
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });

    // Now launch browser and connect to the frontend
    try {
      browser = await puppeteer.launch({ 
        headless: true, // Run in headless mode for CI/CD
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // For CI/CD environments
      });
      
      page = await browser.newPage();
      
      // Listen for page errors and console errors
      page.on('error', (err) => {
        hasErrors = true;
        errorOutput += `Page error: ${err.message}\n`;
      });
      
      page.on('pageerror', (err) => {
        hasErrors = true;
        errorOutput += `Page runtime error: ${err.message}\n`;
      });
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          hasErrors = true;
          errorOutput += `Console error: ${msg.text()}\n`;
        }
      });
      
      page.on('requestfailed', (request) => {
        const failure = request.failure();
        if (failure) {
          hasErrors = true;
          errorOutput += `Request failed: ${request.url()} ${failure.errorText}\n`;
        }
      });
      
      // Navigate to the homepage
      await page.goto('http://localhost:3003', { 
        waitUntil: 'networkidle0', // Wait for network to be idle
        timeout: 10000 
      });
      
      // Check that the page loaded successfully
      const title = await page.title();
      expect(title).toBeDefined();
      
      // Check for any JavaScript errors in the console
      const errors = await page.evaluate(() => {
        return window.errors || [];
      });
      
      if (errors.length > 0) {
        hasErrors = true;
        errorOutput += `JavaScript errors: ${JSON.stringify(errors)}\n`;
      }
      
      // Wait a bit to catch any delayed errors
      await page.waitForTimeout(2000);
      
    } catch (browserError) {
      hasErrors = true;
      errorOutput += `Browser error: ${browserError.message}\n`;
    } finally {
      // Clean up browser
      if (browser) {
        await browser.close();
      }
    }
    
    // If we got here with errors, fail the test
    if (hasErrors) {
      throw new Error(`Frontend runtime error when browser connected: ${errorOutput}`);
    }
  }, 30000); // 30 second timeout for the entire test

  // Clean up: ensure frontend process and browser are killed after test
  afterEach(async () => {
    // Close browser if it's still open
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore errors when closing browser
      }
    }
    
    // Kill frontend process if it's still running
    if (frontendProcess && !frontendProcess.killed) {
      try {
        frontendProcess.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        await new Promise(resolve => {
          setTimeout(() => {
            if (frontendProcess && !frontendProcess.killed) {
              frontendProcess.kill('SIGKILL');
            }
            resolve();
          }, 1000);
        });
      } catch (e) {
        // Ignore errors when killing process
      }
    }
  });
});