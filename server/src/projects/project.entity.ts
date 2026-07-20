import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Project record. Scalar/queryable fields are real columns; the variable-shape
 * nested structures (tasks, timeline, directives, scope list, attachments) are
 * stored as JSONB — same approach used for every other collection so the schema
 * mirrors the frontend data model without exploding into dozens of child tables.
 */
@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  no!: string;

  @Column({ type: 'varchar', length: 300 })
  name!: string;

  @Column({ type: 'varchar', length: 300, name: 'name_en', nullable: true })
  nameEn!: string | null;

  /** Owner user id (FK-by-convention to users.id). Indexed for scoping. */
  @Index()
  @Column({ type: 'varchar', length: 64 })
  owner!: string;

  /** Organizational unit / department (used for scope-based filtering). */
  @Index()
  @Column({ type: 'varchar', length: 64, default: '' })
  unit!: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  status!: string;

  @Column({ type: 'int', default: 0 })
  progress!: number;

  @Column({ type: 'varchar', length: 24, default: '' })
  priority!: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  stage!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  budget!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  spent!: string | null;

  @Column({ type: 'text', default: '' })
  desc!: string;

  @Column({ type: 'text', name: 'final_output', default: '' })
  finalOutput!: string;

  @Column({ type: 'text', name: 'next_step', default: '' })
  nextStep!: string;

  @Column({ type: 'varchar', length: 32, name: 'start_date', nullable: true })
  startDate!: string | null;

  @Column({ type: 'varchar', length: 32, name: 'due_date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'text', nullable: true })
  risks!: string | null;

  @Column({ type: 'text', name: 'chairman_notes', nullable: true })
  chairmanNotes!: string | null;

  /**
   * Approval state for project completion. Only the Sector Head transitions
   * this. null/'' = not submitted; 'بانتظار الاعتماد' = pending; 'معتمد' =
   * approved; 'مرفوض' = returned.
   */
  @Column({ type: 'varchar', length: 32, name: 'completion_state', nullable: true })
  completionState!: string | null;

  // ── JSONB nested structures (mirror the TS interfaces) ──
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  scope!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  people!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  attachments!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tasks!: Array<{ name: string; owner: string; status: string }>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  timeline!: Array<{ text: string; by: string; date: string }>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  directives!: Array<{ text: string; date: string }>;

  @Column({ type: 'jsonb', name: 'extend_req', nullable: true })
  extendReq!: { from: string; to: string; by: string } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
