import fs from 'fs/promises';
import express, { Express, Request, Response } from 'express';
// Тип для манифеста SSR
interface SSRManifest {
    [key: string]: string[];
}

interface Renderer { head?: string;  html?: string };

// Асинхронная самовызывающаяся функция для поддержки верхнеуровневого await
(async () => {
    // Constants
    const isProduction: boolean = process.env.NODE_ENV === 'production';
    const port: string | number = process.env.PORT || 5173;
    const base: string = process.env.BASE || '/';

    // Cached production assets
    const templateHtml: string = isProduction
        ? await fs.readFile('./dist/client/index.html', 'utf-8')
        : '';
    const ssrManifest: SSRManifest | undefined = isProduction
        ? JSON.parse(await fs.readFile('./dist/client/.vite/ssr-manifest.json', 'utf-8'))
        : undefined;

    // Create http server
    const app: Express = express();

    let vite: any;
    if (!isProduction) {
        const { createServer } = await import('vite');
        vite = await createServer({
            server: { middlewareMode: true },
            appType: 'custom',
            base,
        });
        app.use(vite.middlewares);
    } else {
        const compression = (await import('compression')).default;
        const sirv = (await import('sirv')).default;
        app.use(compression());
        app.use(base, sirv('./dist/client', { extensions: [] }));
    }

    // Serve HTML
    app.use('*', async (req: Request, res: Response) => {
        try {
            const url = req.originalUrl.replace(base, '');

            let template: string;
            let render: (url: string, manifest?: SSRManifest) => Promise<Renderer> | Renderer;
            if (!isProduction) {
                template = await fs.readFile('index.html', 'utf-8');
                template = await vite.transformIndexHtml(url, template);
                render = (await vite.ssrLoadModule('./src/entry/entry-server.tsx')).render;
            } else {
                template = templateHtml;
                render = (await import('./dist/server/entry-server')).render;
            }

            const rendered = await render(url, ssrManifest);

            const html = template
                .replace(`<!--app-head-->`, rendered.head ?? '')
                .replace(`<!--app-html-->`, rendered.html ?? '');

            res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
        } catch (e: unknown) {
            if (e instanceof  Error){
                vite?.ssrFixStacktrace(e);
                res.status(500).end(e.stack);
            }
        }
    });

    // Start http server
    app.listen(port, () => {
        console.log(`Server started at http://localhost:${port}`);
        });
})();
