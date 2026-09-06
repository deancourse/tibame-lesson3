import type { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { apiError } from "@vms/shared";
import { HttpError } from "../lib/http-error.js";

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json(apiError("NOT_FOUND", `找不到 ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res
      .status(err.status)
      .json(apiError(err.code, err.message, err.details));
    return;
  }
  if (err instanceof ZodError) {
    res
      .status(400)
      .json(apiError("VALIDATION_ERROR", "輸入欄位驗證失敗", z.flattenError(err)));
    return;
  }
  console.error(err);
  res.status(500).json(apiError("INTERNAL_ERROR", "伺服器內部錯誤"));
};
