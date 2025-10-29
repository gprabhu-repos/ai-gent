// Minimal webhook for testing Vercel deployment

export default async function handler(req, res) {
  console.log('Minimal handler invoked');

  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'Only POST requests are accepted'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Minimal webhook working',
      timestamp: new Date().toISOString(),
      method: req.method,
      hasBody: !!req.body
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Internal error',
      message: error.message
    });
  }
}