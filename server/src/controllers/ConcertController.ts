import { Request, Response, NextFunction } from "express";
import { ConcertService } from "../services/ConcertService";

const service = new ConcertService();

/**
 * @openapi
 * /concerts:
 *   get:
 *     summary: List all concerts
 *     tags: [Concerts]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter concerts by title or venue
 *     responses:
 *       200:
 *         description: List of concerts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
export async function listConcerts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    res.json({ data: await service.listConcerts(search) });
  } catch (error) {
    next(error);
  }
}

/**
 * @openapi
 * /concerts/{id}:
 *   get:
 *     summary: Get a single concert by ID
 *     tags: [Concerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Concert details
 *       404:
 *         description: Concert not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export async function getConcert(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json({ data: await service.getConcert(id) });
  } catch (error) {
    next(error);
  }
}
