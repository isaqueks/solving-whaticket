import * as Sentry from "@sentry/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import "express-async-errors";
import "reflect-metadata";
import "./bootstrap";

import bodyParser from 'body-parser';
import uploadConfig from "./config/upload";
import "./database";
import AppError from "./errors/AppError";
import { messageQueue, sendScheduledMessages } from "./queues";
import routes from "./routes";
import { logger } from "./utils/logger";
import Contact from "./models/Contact";
import CheckContactNumber from "./services/WbotServices/CheckNumber";

Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

app.set("queues", {
  messageQueue,
  sendScheduledMessages
});

const bodyparser = require('body-parser');
app.use(bodyParser.json({ limit: '10mb' }));

app.use(
  cors({
    credentials: true,
    origin: process.env.FRONTEND_URL
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.use("/public", express.static(uploadConfig.directory));
app.use(routes);

app.use(Sentry.Handlers.errorHandler());

app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(err?.stack || err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err?.stack || err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
