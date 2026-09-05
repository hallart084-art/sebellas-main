// netlify/functions/proxy.js
// Proxy untuk GitHub Models API agar bisa diakses dari browser (mengatasi CORS)

export const handler = async (event) => {
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const GITHUB_API_URL = 'https://models.inference.ai.azure.com/chat/completions';

    // Forward Authorization header dari browser ke GitHub API
    const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
    const apiKeyHeader = event.headers['api-key'] || event.headers['Api-Key'] || '';

    const response = await fetch(GITHUB_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'api-key': apiKeyHeader || authHeader.replace('Bearer ', ''),
      },
      body: event.body,
    });

    const responseText = await response.text();

    return {
      statusCode: response.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
      body: responseText,
    };
  } catch (error) {
    console.error('[proxy] Error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || 'Proxy internal error' }),
    };
  }
};
