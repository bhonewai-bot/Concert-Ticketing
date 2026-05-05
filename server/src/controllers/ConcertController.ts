import { Request, Response, NextFunction } from "express";
import { ConcertService } from "../services/ConcertService";

const service = new ConcertService();

export async function listConcerts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // PARSE SEARCH QUERY
    const search = req.query.search ? String(req.query.search) : undefined;

    // RETURN RESULTS
    res.json({ data: await service.listConcerts(search) });
  } catch (error) {
    next(error);
  }
}

export async function getConcert(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // PARSE CONCERT ID
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // RETURN RESULT
    res.json({ data: await service.getConcert(id) });
  } catch (error) {
    next(error);
  }
}
