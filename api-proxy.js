// api-proxy.js
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all requests
app.use(cors({
  origin: '*', // In production, specify your frontend domain
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Forward OpenAI API requests
app.use('/v1', createProxyMiddleware({
  target: 'https://api.openai.com',
  changeOrigin: true,
  pathRewrite: {
    '^/v1': '/v1' // don't rewrite the path
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add the OpenAI API key from environment
    if (process.env.OPENAI_API_KEY) {
      proxyReq.setHeader('Authorization', `Bearer ${process.env.OPENAI_API_KEY}`);
    }
    
    // Log the request (for debugging)
    console.log(`Proxying ${req.method} request to ${req.path}`);
  }
}));

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Proxy server is running');
});

app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
  console.log(`Example usage: http://localhost:${port}/v1/chat/completions`);
}); 