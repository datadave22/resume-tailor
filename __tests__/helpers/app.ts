/**
 * Creates a test Express app with mocked auth middleware.
 * Used by route tests with supertest.
 */
import express from "express";
import { registerRoutes } from "../../server/routes";

export async function createTestApp() {
  const app = express();

  // Raw body capture (same as production for Stripe webhooks)
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  // Register all API routes
  await registerRoutes(app);

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  return app;
}
