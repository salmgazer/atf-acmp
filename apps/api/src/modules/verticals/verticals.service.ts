import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Vertical } from "../../database/entities/vertical.entity";
import { Cohort } from "../../database/entities/cohort.entity";
import {
  CreateVerticalDto,
  UpdateVerticalDto,
  VerticalQueryDto,
  VerticalResponseDto,
  BulkCreateVerticalsDto,
} from "./dto/vertical.dto";

@Injectable()
export class VerticalsService {
  private readonly logger = new Logger(VerticalsService.name);

  constructor(
    @InjectRepository(Vertical)
    private readonly verticalRepository: Repository<Vertical>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>
  ) {}

  async create(createVerticalDto: CreateVerticalDto): Promise<VerticalResponseDto> {
    // Verify cohort exists
    const cohort = await this.cohortRepository.findOne({
      where: { id: createVerticalDto.cohortId },
    });
    if (!cohort) {
      throw new NotFoundException(`Cohort with ID ${createVerticalDto.cohortId} not found`);
    }

    // Check for duplicate name within cohort
    const existing = await this.verticalRepository.findOne({
      where: {
        cohortId: createVerticalDto.cohortId,
        name: createVerticalDto.name,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Vertical "${createVerticalDto.name}" already exists in this cohort`
      );
    }

    const vertical = this.verticalRepository.create({
      ...createVerticalDto,
      briefCap: createVerticalDto.briefCap ?? 10,
      displayOrder: createVerticalDto.displayOrder ?? 0,
    });

    const saved = await this.verticalRepository.save(vertical);
    this.logger.log(`Created vertical: ${saved.id} - ${saved.name}`);
    return this.toResponseDto(saved);
  }

  async bulkCreate(dto: BulkCreateVerticalsDto): Promise<VerticalResponseDto[]> {
    // Verify cohort exists
    const cohort = await this.cohortRepository.findOne({
      where: { id: dto.cohortId },
    });
    if (!cohort) {
      throw new NotFoundException(`Cohort with ID ${dto.cohortId} not found`);
    }

    // Check for existing verticals with same names
    const existingVerticals = await this.verticalRepository.find({
      where: { cohortId: dto.cohortId },
    });
    const existingNames = new Set(existingVerticals.map((v) => v.name.toLowerCase()));

    const duplicates = dto.names.filter((name) => existingNames.has(name.toLowerCase()));
    if (duplicates.length > 0) {
      throw new ConflictException(
        `Verticals already exist: ${duplicates.join(", ")}`
      );
    }

    // Create verticals
    const verticals = dto.names.map((name, index) =>
      this.verticalRepository.create({
        name,
        cohortId: dto.cohortId,
        briefCap: dto.defaultBriefCap ?? 10,
        displayOrder: existingVerticals.length + index,
      })
    );

    const saved = await this.verticalRepository.save(verticals);
    this.logger.log(`Bulk created ${saved.length} verticals for cohort ${dto.cohortId}`);
    return saved.map((v) => this.toResponseDto(v));
  }

  async findAll(query: VerticalQueryDto): Promise<VerticalResponseDto[]> {
    const queryBuilder = this.verticalRepository
      .createQueryBuilder("vertical")
      .orderBy("vertical.displayOrder", "ASC")
      .addOrderBy("vertical.name", "ASC");

    if (query.cohortId) {
      queryBuilder.where("vertical.cohortId = :cohortId", { cohortId: query.cohortId });
    }

    if (!query.includeInactive) {
      queryBuilder.andWhere("vertical.isActive = :isActive", { isActive: true });
    }

    const verticals = await queryBuilder.getMany();
    return verticals.map((v) => this.toResponseDto(v));
  }

  async findByCohort(cohortId: string): Promise<VerticalResponseDto[]> {
    return this.findAll({ cohortId, includeInactive: false });
  }

  async findOne(id: string): Promise<VerticalResponseDto> {
    const vertical = await this.verticalRepository.findOne({ where: { id } });
    if (!vertical) {
      throw new NotFoundException(`Vertical with ID ${id} not found`);
    }
    return this.toResponseDto(vertical);
  }

  async update(id: string, updateDto: UpdateVerticalDto): Promise<VerticalResponseDto> {
    const vertical = await this.verticalRepository.findOne({ where: { id } });
    if (!vertical) {
      throw new NotFoundException(`Vertical with ID ${id} not found`);
    }

    // Check for duplicate name if name is being changed
    if (updateDto.name && updateDto.name !== vertical.name) {
      const existing = await this.verticalRepository.findOne({
        where: {
          cohortId: vertical.cohortId,
          name: updateDto.name,
        },
      });
      if (existing) {
        throw new ConflictException(
          `Vertical "${updateDto.name}" already exists in this cohort`
        );
      }
    }

    // Validate briefCap isn't below current briefCount
    if (updateDto.briefCap !== undefined && updateDto.briefCap < vertical.briefCount) {
      throw new BadRequestException(
        `Cannot set brief cap (${updateDto.briefCap}) below current brief count (${vertical.briefCount})`
      );
    }

    Object.assign(vertical, updateDto);
    const saved = await this.verticalRepository.save(vertical);
    this.logger.log(`Updated vertical: ${id}`);
    return this.toResponseDto(saved);
  }

  async remove(id: string): Promise<void> {
    const vertical = await this.verticalRepository.findOne({ where: { id } });
    if (!vertical) {
      throw new NotFoundException(`Vertical with ID ${id} not found`);
    }

    // Check if any briefs are assigned
    if (vertical.briefCount > 0) {
      throw new BadRequestException(
        `Cannot delete vertical with ${vertical.briefCount} assigned briefs. ` +
          `Reassign or delete the briefs first.`
      );
    }

    await this.verticalRepository.softRemove(vertical);
    this.logger.log(`Soft deleted vertical: ${id}`);
  }

  async deactivate(id: string): Promise<VerticalResponseDto> {
    const vertical = await this.verticalRepository.findOne({ where: { id } });
    if (!vertical) {
      throw new NotFoundException(`Vertical with ID ${id} not found`);
    }

    vertical.isActive = false;
    const saved = await this.verticalRepository.save(vertical);
    this.logger.log(`Deactivated vertical: ${id}`);
    return this.toResponseDto(saved);
  }

  async reorder(cohortId: string, verticalIds: string[]): Promise<VerticalResponseDto[]> {
    const verticals = await this.verticalRepository.find({
      where: { cohortId },
    });

    const verticalMap = new Map(verticals.map((v) => [v.id, v]));

    // Validate all IDs belong to this cohort
    for (const id of verticalIds) {
      if (!verticalMap.has(id)) {
        throw new BadRequestException(
          `Vertical ${id} not found in cohort ${cohortId}`
        );
      }
    }

    // Update display order
    const updates = verticalIds.map((id, index) => {
      const vertical = verticalMap.get(id)!;
      vertical.displayOrder = index;
      return vertical;
    });

    const saved = await this.verticalRepository.save(updates);
    return saved.map((v) => this.toResponseDto(v));
  }

  async incrementBriefCount(id: string): Promise<void> {
    await this.verticalRepository.increment({ id }, "briefCount", 1);
  }

  async decrementBriefCount(id: string): Promise<void> {
    const vertical = await this.verticalRepository.findOne({ where: { id } });
    if (vertical && vertical.briefCount > 0) {
      await this.verticalRepository.decrement({ id }, "briefCount", 1);
    }
  }

  private toResponseDto(vertical: Vertical): VerticalResponseDto {
    return {
      id: vertical.id,
      name: vertical.name,
      description: vertical.description,
      cohortId: vertical.cohortId,
      briefCap: vertical.briefCap,
      briefCount: vertical.briefCount,
      displayOrder: vertical.displayOrder,
      isActive: vertical.isActive,
      remainingCapacity: vertical.getRemainingCapacity(),
      createdAt: vertical.createdAt,
      updatedAt: vertical.updatedAt,
    };
  }
}
