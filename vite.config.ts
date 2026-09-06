import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import https from 'https';
import { defineConfig, Plugin } from 'vite';

function yahooFinanceProxyPlugin(): Plugin {
  return {
    name: 'yahoo-finance-proxy',
    configureServer(server) {
      server.middlewares.use('/api/yahoo', (req, res) => {
        try {
          const parsedUrl = new URL(req.url || '', 'http://localhost:3000');
          const symbol = parsedUrl.searchParams.get('symbol') || 'SXR8.DE';
          const range = parsedUrl.searchParams.get('range') || '1mo';
          const interval = parsedUrl.searchParams.get('interval') || '1d';

          const targetUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            symbol
          )}?range=${range}&interval=${interval}`;

          const yahooReq = https.get(
            targetUrl,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                Accept: '*/*',
              },
            },
            (yahooRes) => {
              res.statusCode = yahooRes.statusCode || 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              yahooRes.pipe(res);
            }
          );

          yahooReq.on('error', (err) => {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          });
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e?.message || 'Proxy error' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), yahooFinanceProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
