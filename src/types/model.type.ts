export interface ModelOptions {
  tableName?: string;
  timestamps?: boolean;
}

export interface FieldOptions {
  type: 'string' | 'number' | 'boolean' | 'date' | 'uuid';
  required?: boolean;
  unique?: boolean;
  default?: any;
  length?: number;
  primary?: boolean;
}
