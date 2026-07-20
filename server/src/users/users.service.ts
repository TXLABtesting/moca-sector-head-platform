import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UpsertUserDto } from './dto/upsert-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByEntraOid(oid: string): Promise<User | null> {
    return this.repo.findOne({ where: { entraOid: oid } });
  }

  findAll(): Promise<User[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<User> {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return u;
  }

  /** Create or update a user (used by the System Admin's permissions screen). */
  async upsert(dto: UpsertUserDto): Promise<User> {
    const existing = await this.repo.findOne({ where: { id: dto.id } });
    if (!existing && dto.entraOid) {
      const clash = await this.repo.findOne({ where: { entraOid: dto.entraOid } });
      if (clash) throw new ConflictException(`Entra oid already mapped to user ${clash.id}`);
    }
    const entity = this.repo.merge(existing ?? this.repo.create(), {
      ...dto,
      grants: dto.grants ?? existing?.grants ?? {},
      active: dto.active ?? existing?.active ?? true,
    });
    return this.repo.save(entity);
  }

  async setActive(id: string, active: boolean): Promise<User> {
    const u = await this.findOne(id);
    u.active = active;
    return this.repo.save(u);
  }

  /** Lightweight profile refresh from token claims (non-authoritative fields). */
  async touchProfile(id: string, patch: { email?: string | null; name?: string | null }): Promise<void> {
    const set: Partial<User> = {};
    if (patch.email !== undefined && patch.email !== null) set.email = patch.email;
    if (patch.name) set.name = patch.name;
    if (Object.keys(set).length) await this.repo.update({ id }, set);
  }
}
