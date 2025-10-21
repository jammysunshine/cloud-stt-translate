import { TranslationServiceClient } from '@google-cloud/translate';
import logger from '../../../config/logger.js'; // Import the logger
import { TRANSLATION_MIME_TYPE, TRANSLATION_LOCATION } from '../../../config/appConfig.js';

const translationClient = new TranslationServiceClient();

export async function translateText(text, sourceLang, targetLang) {
  logger.info(`Translating "${text}" from ${sourceLang} to ${targetLang} with Google Cloud`);

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is not set.');
  }

  const request = {
    parent: `projects/${projectId}/locations/${TRANSLATION_LOCATION}`,
    contents: [text],
    mimeType: TRANSLATION_MIME_TYPE,
    sourceLanguageCode: sourceLang,
    targetLanguageCode: targetLang,
  };

  try {
    const [response] = await translationClient.translateText(request);
    const translatedText = response.translations[0].translatedText;
    return { translatedText };
  } catch (error) {
    logger.error('ERROR in Google Translation service:', error);
    throw new Error(`Translation failed: ${error.message}`); // Throw the error
  }
}