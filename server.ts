import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { interpretNormativeAnnex } from './server/interpretAnnex.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    const key = (process.env.GEMINI_API_KEY || '').trim();
    res.json({
      ok: true,
      service: 'total-report-configurator',
      geminiConfigured: Boolean(key && key !== 'MY_GEMINI_API_KEY'),
    });
  });

  app.post('/api/totalia/interpret-annex', async (req, res) => {
    try {
      const { fileName, mimeType, base64Data, userNotes } = req.body || {};
      if (typeof fileName !== 'string' || typeof base64Data !== 'string') {
        res.status(400).json({
          error:
            'Solicitud inválida: se requieren los campos fileName y base64Data del documento normativo.',
        });
        return;
      }

      const interpretation = await interpretNormativeAnnex({
        fileName,
        mimeType: typeof mimeType === 'string' ? mimeType : '',
        base64Data,
        userNotes: typeof userNotes === 'string' ? userNotes : undefined,
      });

      res.json(interpretation);
    } catch (error) {
      const errObj = error as Error & { statusCode?: number };
      const status =
        typeof errObj.statusCode === 'number'
          ? errObj.statusCode
          : /no soportado|vacío|excede|inválid|adjuntar/i.test(errObj.message)
          ? 400
          : 500;
      res.status(status).json({
        error:
          errObj.message ||
          'No fue posible interpretar el anexo normativo con TOTALiA®.',
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`TÓTAL REPORT® server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
