import cors from "cors";
import type { Application, Request, Response } from "express";

export function registerBaseHttpMiddleware(app: Application, allowedOrigins: string[]): void {
  app.disable("x-powered-by");

  if (allowedOrigins.length > 0) {
    app.use(
      cors({
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Authorization", "Content-Type"]
      })
    );
  }

  app.use((req: Request, res: Response, next) => {
    // Keep policy explicit to reduce XSS/script injection blast radius.
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; " +
        "script-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' data: https://fonts.gstatic.com; form-action 'self'"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
    if (req.secure || forwardedProto === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
}

/** Registered last: every request nothing else answered gets a plain 404 (JSON under /api). */
export function registerNotFoundHandler(app: Application): void {
  app.use((req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(404).type("text/plain").send("Not found");
  });
}
