import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { mountBiabApi } from './server/biab-api';
import { buildHomeJsonLd } from './server/biab-seo';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * BIAB server endpoints. ALL calls that hold the API key live behind these
 * routes (auth handler, revalidate webhook, sitemap/robots proxies, and the
 * JSON endpoints the Angular browser app fetches for home/store/cart/reviews/
 * portal/parallel-pages). The key never reaches the browser bundle.
 *
 * Mounted before the Angular catch-all so /api/* and /sitemap.xml /robots.txt
 * win over SSR.
 */
mountBiabApi(app);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application, then inject
 * server-built JSON-LD (localBusiness + website) into the home document's
 * <head> so crawlers see structured data. No-ops when BIAB env is unset.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then(async (response) => {
      if (!response) {
        next();
        return;
      }
      const isHomeDocument =
        req.path === '/' &&
        (response.headers.get('content-type') ?? '').includes('text/html');
      if (!isHomeDocument) {
        return writeResponseToNodeResponse(response, res);
      }
      // Read the streamed HTML, splice JSON-LD into </head>, re-emit.
      const html = await response.text();
      const jsonLd = await buildHomeJsonLd().catch(() => '');
      const injected = jsonLd
        ? html.replace('</head>', `${jsonLd}\n</head>`)
        : html;
      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'content-length') return; // length changed
        res.setHeader(key, value);
      });
      res.send(injected);
      return;
    })
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
