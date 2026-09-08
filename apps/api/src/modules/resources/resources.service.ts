import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Resource, ResourceType, ResourceVisibility } from "@/database/entities/resource.entity";
import {
  CreateResourceDto,
  UpdateResourceDto,
  ResourceQueryDto,
} from "./dto/resource.dto";

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
  ) {}

  async create(userId: string, dto: CreateResourceDto): Promise<Resource> {
    const resource = this.resourceRepository.create({
      ...dto,
      uploadedBy: userId,
    });
    return this.resourceRepository.save(resource);
  }

  async update(id: string, dto: UpdateResourceDto): Promise<Resource> {
    const resource = await this.resourceRepository.findOne({ where: { id } });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }

    Object.assign(resource, dto);
    return this.resourceRepository.save(resource);
  }

  async delete(id: string): Promise<void> {
    const resource = await this.resourceRepository.findOne({ where: { id } });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }
    await this.resourceRepository.remove(resource);
  }

  async getById(id: string): Promise<Resource> {
    const resource = await this.resourceRepository.findOne({
      where: { id },
      relations: ["vertical", "cohort"],
    });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }
    return resource;
  }

  async getResources(
    query: ResourceQueryDto,
    includeUnpublished: boolean = false,
  ): Promise<{
    resources: Resource[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.resourceRepository
      .createQueryBuilder("resource")
      .leftJoinAndSelect("resource.vertical", "vertical");

    // Filter by cohort
    if (query.cohortId) {
      qb.andWhere("(resource.cohort_id = :cohortId OR resource.cohort_id IS NULL)", {
        cohortId: query.cohortId,
      });
    }

    // Filter by vertical
    if (query.verticalId) {
      qb.andWhere("(resource.vertical_id = :verticalId OR resource.vertical_id IS NULL)", {
        verticalId: query.verticalId,
      });
    }

    // Filter by type
    if (query.type) {
      qb.andWhere("resource.type = :type", { type: query.type });
    }

    // Filter by tag
    if (query.tag) {
      qb.andWhere("resource.tags @> :tag", { tag: JSON.stringify([query.tag]) });
    }

    // Search in title and description
    if (query.search) {
      qb.andWhere(
        "(resource.title ILIKE :search OR resource.description ILIKE :search)",
        { search: `%${query.search}%` },
      );
    }

    // Featured only
    if (query.featuredOnly) {
      qb.andWhere("resource.is_featured = true");
    }

    // Only published for non-admin
    if (!includeUnpublished) {
      qb.andWhere("resource.is_published = true");
    }

    qb.orderBy("resource.is_featured", "DESC")
      .addOrderBy("resource.sort_order", "ASC")
      .addOrderBy("resource.created_at", "DESC");

    const [resources, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { resources, total, page, limit };
  }

  async getResourcesForParticipant(
    cohortId: string,
    verticalId: string | null,
    query: ResourceQueryDto,
  ): Promise<{
    resources: Resource[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.resourceRepository
      .createQueryBuilder("resource")
      .leftJoinAndSelect("resource.vertical", "vertical")
      .where("resource.is_published = true")
      .andWhere("resource.visibility != :staffOnly", {
        staffOnly: ResourceVisibility.STAFF,
      });

    // Show resources for this cohort or global resources
    qb.andWhere("(resource.cohort_id = :cohortId OR resource.cohort_id IS NULL)", {
      cohortId,
    });

    // Filter by visibility and vertical
    if (verticalId) {
      qb.andWhere(
        "(resource.visibility = :all OR (resource.visibility = :vertical AND resource.vertical_id = :verticalId) OR resource.vertical_id IS NULL)",
        {
          all: ResourceVisibility.ALL,
          vertical: ResourceVisibility.VERTICAL,
          verticalId,
        },
      );
    } else {
      qb.andWhere("resource.visibility = :all", { all: ResourceVisibility.ALL });
    }

    // Filter by type
    if (query.type) {
      qb.andWhere("resource.type = :type", { type: query.type });
    }

    // Filter by tag
    if (query.tag) {
      qb.andWhere("resource.tags @> :tag", { tag: JSON.stringify([query.tag]) });
    }

    // Search
    if (query.search) {
      qb.andWhere(
        "(resource.title ILIKE :search OR resource.description ILIKE :search)",
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy("resource.is_featured", "DESC")
      .addOrderBy("resource.sort_order", "ASC")
      .addOrderBy("resource.created_at", "DESC");

    const [resources, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { resources, total, page, limit };
  }

  async incrementDownloadCount(id: string): Promise<void> {
    await this.resourceRepository.increment({ id }, "downloadCount", 1);
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.resourceRepository.increment({ id }, "viewCount", 1);
  }

  async getAllTags(cohortId?: string): Promise<string[]> {
    const qb = this.resourceRepository
      .createQueryBuilder("resource")
      .select("DISTINCT jsonb_array_elements_text(resource.tags)", "tag")
      .where("resource.is_published = true");

    if (cohortId) {
      qb.andWhere("(resource.cohort_id = :cohortId OR resource.cohort_id IS NULL)", {
        cohortId,
      });
    }

    const results = await qb.getRawMany();
    return results.map((r) => r.tag).sort();
  }

  async getStats(cohortId?: string): Promise<{
    total: number;
    byType: { type: ResourceType; count: number }[];
    totalDownloads: number;
    totalViews: number;
  }> {
    const qb = this.resourceRepository.createQueryBuilder("resource");

    if (cohortId) {
      qb.where("resource.cohort_id = :cohortId", { cohortId });
    }

    const total = await qb.getCount();

    const byType = await this.resourceRepository
      .createQueryBuilder("resource")
      .select("resource.type", "type")
      .addSelect("COUNT(*)", "count")
      .where(cohortId ? "resource.cohort_id = :cohortId" : "1=1", { cohortId })
      .groupBy("resource.type")
      .getRawMany();

    const stats = await this.resourceRepository
      .createQueryBuilder("resource")
      .select("SUM(resource.download_count)", "totalDownloads")
      .addSelect("SUM(resource.view_count)", "totalViews")
      .where(cohortId ? "resource.cohort_id = :cohortId" : "1=1", { cohortId })
      .getRawOne();

    return {
      total,
      byType: byType.map((b) => ({ type: b.type, count: parseInt(b.count, 10) })),
      totalDownloads: parseInt(stats.totalDownloads || "0", 10),
      totalViews: parseInt(stats.totalViews || "0", 10),
    };
  }
}
