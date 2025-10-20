
// src/lib/services/google/Translation.js

const { TranslationServiceClient } = require('@google-cloud/translate');
const fs = require('fs');
const path = require('path');

const translationClient = new TranslationServiceClient();

// Function to get project ID from credentials file
let projectId = null;
function getProjectId() {
  if (projectId) return projectId;

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.');
  }

  try {
    const credentials = JSON.parse(fs.readFileSync(path.resolve(credentialsPath), 'utf8'));
    projectId = credentials.project_id;
    if (!projectId) {
      throw new Error('Project ID not found in credentials file.');
    }
    return projectId;
  } catch (error) {
    console.error('Error reading or parsing Google credentials file:', error);
    throw new Error('Failed to get Google Cloud Project ID from credentials.');
  }
}

async function translateText(text, sourceLang, targetLang) {
  console.log(`Translating "${text}" from ${sourceLang} to ${targetLang} with Google Cloud`);

  const currentProjectId = getProjectId();

  const request = {
    parent: `projects/${currentProjectId}/locations/global`,
    contents: [text],
    mimeType: 'text/plain',
    sourceLanguageCode: sourceLang,
    targetLanguageCode: targetLang,
  };

  try {
    const [response] = await translationClient.translateText(request);
    const translatedText = response.translations[0].translatedText;
    return { translatedText };
  } catch (error) {
    console.error('ERROR in Google Translation service:', error);
    return {
      translatedText: `Translation Error: ${error.message}`,
    };
  }
}

module.exports = { translateText };
