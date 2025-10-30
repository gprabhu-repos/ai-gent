// Simple handler for root requests to prevent 404s in logs
export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      message: "AI-Gent Webhook Service",
      status: "active",
      webhook_url: "/agents/79913705-ac88-443f-bc68-e9dd39380ba4/webhook/events",
      timestamp: new Date().toISOString()
    });
  }

  return res.status(405).json({
    error: "Method not allowed",
    message: "Only GET requests are supported on this endpoint"
  });
}