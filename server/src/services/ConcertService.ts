import { DataSource } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Concert } from "../entities/Concert";
import { notFound } from "../errors";

export class ConcertService {
  constructor(private datasource: DataSource = AppDataSource) {}

  async listConcerts(search?: string): Promise<Concert[]> {
    // INITIALIZE BASE QUERY
    const query = await this.datasource
      .getRepository(Concert)
      .createQueryBuilder("concert")
      .orderBy("concert.startsAt", "ASC");

    // SEARCH FUNCTIONALITY
    if (search) {
      query.where(
        "LOWER(concert.title) LIKE LOWER(:search) OR LOWER(concert.venue) LIKE LOWER(:search)",
        { search: `%${search}%` },
      );
    }

    // RETURN RESULTS
    return query.getMany();
  }

  async getConcert(id: string): Promise<Concert> {
    // FIND CONCERT BY ID
    const concert = await this.datasource
      .getRepository(Concert)
      .findOneBy({ id });

    // VALIDATE CONCERT EXISTS
    if (!concert) throw notFound("Concert not found");

    // RETURN RESULT
    return concert;
  }
}
