import {
  IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min,
} from 'class-validator';

/** Create/replace payload. Kept permissive to mirror the frontend model. */
export class UpsertProjectDto {
  @IsOptional() @IsString() no?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsString() owner!: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() stage?: string;
  @IsOptional() @IsNumber() budget?: number;
  @IsOptional() @IsNumber() spent?: number;
  @IsOptional() @IsString() desc?: string;
  @IsOptional() @IsString() finalOutput?: string;
  @IsOptional() @IsString() nextStep?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() risks?: string;
  @IsOptional() @IsArray() scope?: string[];
  @IsOptional() @IsArray() people?: string[];
  @IsOptional() @IsArray() attachments?: string[];
  @IsOptional() @IsArray() tasks?: Array<{ name: string; owner: string; status: string }>;
}

/** Sector-Head decision on a project's completion request. */
export class ApprovalDecisionDto {
  /** 'approve' → معتمد, 'return' → مرفوض (sent back for edits). */
  @IsString() decision!: 'approve' | 'return';
  /** Optional directive/reason shown to the owner. */
  @IsOptional() @IsString() note?: string;
}
