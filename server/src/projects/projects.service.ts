import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { ApprovalDecisionDto, UpsertProjectDto } from './dto/project.dto';
import { Principal } from '../rbac/permissions';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly repo: Repository<Project>,
  ) {}

  /**
   * List projects visible to the principal. `all`/`office`-scoped users see
   * everything; department-scoped (sector) users see only their unit. This is
   * the row-level counterpart to the section-level RBAC guard.
   */
  findAll(principal: Principal): Promise<Project[]> {
    const qb = this.repo.createQueryBuilder('p').orderBy('p.created_at', 'DESC');
    if (!principal.all && principal.type === 'sector' && principal.scope !== 'all') {
      qb.where('p.unit = :unit', { unit: principal.scope });
    }
    return qb.getMany();
  }

  async findOne(id: string): Promise<Project> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Project ${id} not found`);
    return p;
  }

  create(dto: UpsertProjectDto): Promise<Project> {
    return this.repo.save(this.repo.create(this.normalize(dto)));
  }

  async update(id: string, dto: UpsertProjectDto): Promise<Project> {
    const p = await this.findOne(id);
    return this.repo.save(this.repo.merge(p, this.normalize(dto)));
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw new NotFoundException(`Project ${id} not found`);
  }

  /** Owner submits the completed project for the Sector Head's approval. */
  async submitForApproval(id: string, principal: Principal): Promise<Project> {
    const p = await this.findOne(id);
    if (p.owner !== principal.id && !principal.all) {
      throw new ForbiddenException('Only the project owner may submit it for approval');
    }
    p.completionState = 'بانتظار الاعتماد';
    return this.repo.save(p);
  }

  /**
   * Sector-Head decision. The controller already restricts this route to the
   * chair via @RequirePermission('projects','approve') + RbacGuard; here we
   * only apply the state transition and record the directive.
   */
  async decide(id: string, dto: ApprovalDecisionDto, principal: Principal): Promise<Project> {
    const p = await this.findOne(id);
    p.completionState = dto.decision === 'approve' ? 'معتمد' : 'مرفوض';
    if (dto.note) {
      p.directives = [...(p.directives || []), { text: dto.note, date: new Date().toISOString().slice(0, 10) }];
    }
    p.timeline = [
      ...(p.timeline || []),
      {
        text: dto.decision === 'approve' ? 'اعتماد إنجاز المشروع' : 'إرجاع المشروع للتعديل',
        by: principal.name,
        date: new Date().toISOString().slice(0, 10),
      },
    ];
    return this.repo.save(p);
  }

  private normalize(dto: UpsertProjectDto): Partial<Project> {
    return {
      ...dto,
      budget: dto.budget != null ? String(dto.budget) : undefined,
      spent: dto.spent != null ? String(dto.spent) : undefined,
    } as Partial<Project>;
  }
}
