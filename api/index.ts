import express, { type Request, Response, NextFunction } from "express";
import { clerkMiddleware } from "@clerk/express";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: Buffer;
  }
}

// JSON middleware with raw body capture (needed for Stripe webhook verification)
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Clerk authentication middleware
app.use(clerkMiddleware());

// Register all API routes (lazy loaded to catch errors)
let routesRegistered = false;
async function ensureRoutes() {
  if (!routesRegistered) {
    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(app);

    // Error handler must be registered AFTER routes
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error("Internal Server Error:", err);
      if (res.headersSent) {
        return next(err);
      }
      return res.status(status).json({ message });
    });

    routesRegistered = true;
  }
}

// Vercel serverless handler
export default async function handler(req: any, res: any) {
  try {
    await ensureRoutes();
    return app(req, res);
  } catch (error) {
    console.error("Serverless function initialization error:", error);
    return res.status(500).json({
      message: "Server initialization failed",
      error: String(error),
    });
  }
}
