import { Request, Response } from "express";

export function healthController(_req: Request, res: Response) {
  res.json({ success: true, status: "ok" });
}
