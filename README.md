# Real-time Voice Translation Application

This is a real-time web application that captures user audio, performs Speech-to-Text (STT) and automatic language detection, and then translates the transcribed text into multiple target languages (English and Arabic), displaying all results live on a user-friendly interface.

## Getting Started

Follow these instructions to set up and run the application locally after cloning the repository.

### 1. Clone the Repository

```bash
git clone https://github.com/jammysunshine/cloud-stt-translate.git
cd cloud-stt-translate
```

### 2. Install Dependencies

Install the necessary Node.js and Next.js dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Environment Variables Setup

This project requires certain environment variables for Google Cloud services and the WebSocket server.

Create a file named `.env.local` in the root of your project and add the following variables:

```
GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/google-cloud-keyfile.json"
WS_PORT=3001
```

*   **`GOOGLE_APPLICATION_CREDENTIALS`**: This should be the absolute path to your Google Cloud service account key file (JSON format). This file is used by the Google Cloud client libraries to authenticate your application.
*   **`WS_PORT`**: This specifies the port on which the WebSocket server will listen. The default value is `3001`. Ensure this port is open and not in use by other applications.

**How to get `GOOGLE_APPLICATION_CREDENTIALS`:**
1.  Go to the Google Cloud Console.
2.  Navigate to "IAM & Admin" -> "Service Accounts".
3.  Create a new service account or select an existing one.
4.  Under "Keys", click "Add Key" -> "Create new key".
5.  Select "JSON" as the key type and click "Create".
6.  A JSON file will be downloaded. Save this file to a secure location on your machine and provide its absolute path in `.env.local`.

### 4. Run the WebSocket Server

The WebSocket server handles the real-time Speech-to-Text and Translation. Open a **new terminal window** and run:

```bash
npm run ws-dev
# or
yarn ws-dev
# or
pnpm ws-dev
```
You should see output similar to: `> WebSocket server listening on ws://localhost:3001`

### 5. Run the Next.js Development Server

Open **another new terminal window** and run the Next.js development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### 6. Logging

This application uses a structured logging solution for better visibility and management:

*   **Server-side:** The WebSocket server (`websocket-server.js`) uses `winston` for logging. Logs are output to the console with different levels (info, error, warn) based on the `NODE_ENV` environment variable. In production, you can view these logs in your Render dashboard.
*   **Client-side:** The frontend (`src/pages/index.js`) uses a custom `clientLogger` (`src/utils/logger.js`). Client-side logs (from `clientLogger.log`, `clientLogger.error`, etc.) are **only visible in your browser's developer console when `NODE_ENV` is set to `development`** (which is the default for `npm run dev`). In production builds, these logs are suppressed.

### 7. Usage

*   Click the "Start Session" button to begin recording audio.
*   Speak into your microphone.
*   The application will display live interim and final transcriptions, along with English and Arabic translations.
*   Click "Stop Session" to end the recording.

## Deployment and Testing on Vercel/Render

This application is designed for deployment with its frontend on Vercel and its WebSocket server on a separate platform like Render.

### Testing the Deployed Application

Once both your Vercel frontend and Render WebSocket server are deployed and configured:

1.  **Access the Deployed Frontend:**
    *   Open your web browser and navigate to the production URL of your Vercel frontend (e.g., `https://cloud-stt-translate-xxxx.vercel.app`). You can find this URL in your Vercel dashboard under your project's "Deployments" tab.

2.  **Start a Session:**
    *   On the web page, click the **"Start Session"** button.
    *   If prompted by your browser, grant microphone permissions.

3.  **Speak and Observe:**
    *   Speak clearly into your microphone. Try speaking in different languages (e.g., Hindi, English, Spanish) and observe the real-time updates.

4.  **Verify Functionality:**
    *   **Detected Languages:** Check if the "Detected Languages" section updates and accurately identifies the languages you speak, especially when you switch between them.
    *   **Live Transcription:** Confirm that your speech is being transcribed correctly.
    *   **Translations:** Verify that the English and Arabic translations appear and are accurate.
    *   **"Session too short" message:** Test if this message now appears only when you explicitly stop a very short session that didn't produce any final transcriptions, and not when you simply close the browser tab.

5.  **Check Server Logs (Render):**
    *   For detailed server-side information, go to your Render dashboard.
    *   Navigate to your WebSocket server service (e.g., `cloud-stt-websocket-server`).
    *   Click on the **"Logs"** tab.
    *   Look for messages indicating:
        *   WebSocket client connections/disconnections.
        *   `[WS Server] STT processing latency: ... ms`
        *   `[WS Server] Translation processing time: ... ms`
        *   `[WS Server] Received FINAL transcription.` (This will confirm if the Google STT API is now returning final results).

## Project Structure

*   `src/pages/index.js`: Main frontend application page.
*   `websocket-server.js`: Dedicated WebSocket server for real-time STT and translation.
*   `src/lib/services/google/SpeechToTextAndDetect.js`: Google Cloud Speech-to-Text and language detection service implementation.
*   `src/lib/services/google/Translation.js`: Google Cloud Translation service implementation.
*   `.env.local`: Local environment variables (ignored by Git).

## Important Notes

*   The `MediaRecorder` on the client-side may stop and restart automatically due to browser limitations. The application includes a mechanism to handle this by restarting the recording session seamlessly.
*   Translations are only displayed for final transcriptions (`isFinal: true`) from the Speech-to-Text API. Interim results are not translated.
