import * as Sentry from "@sentry/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import "express-async-errors";
import "reflect-metadata";
import "./bootstrap";

import bodyParser from 'body-parser';
import { appConfig } from "./config/AppConfig";
import uploadConfig from "./config/upload";
import "./database";
import AppError from "./shared/errors/AppError";
import { messageQueue, sendScheduledMessages } from "./queues";
import routes from "./routes";
import { logger } from "./utils/logger";

// Sem SENTRY_DSN o Sentry fica desligado por completo (init e handlers).
const sentryEnabled = Boolean(appConfig.server.sentryDsn);
if (sentryEnabled) {
  Sentry.init({ dsn: appConfig.server.sentryDsn });
}

const app = express();

app.set("queues", {
  messageQueue,
  sendScheduledMessages
});

app.use(bodyParser.json({ limit: '10mb' }));

app.use(
  cors({
    credentials: true,
    origin: appConfig.server.frontendUrl
  })
);
app.use(cookieParser());
if (sentryEnabled) {
  app.use(Sentry.Handlers.requestHandler());
}
app.use("/public", express.static(uploadConfig.directory));
app.use(routes);

if (sentryEnabled) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(err?.stack || err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err?.stack || err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
