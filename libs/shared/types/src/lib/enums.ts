import { z } from 'zod';

// Const arrays are the single source for zod enums, class-validator @IsIn and UI pickers.
export const COST_CATEGORIES = [
  'LAND',
  'ARCHITECTURE',
  'MATERIALS',
  'CONSTRUCTION',
  'MARKETING',
] as const;
export const ITEM_KINDS = ['MATERIAL', 'WORK', 'SERVICE'] as const;
export const ITEM_STATUSES = [
  'PLANNED',
  'PARTIAL',
  'CONTRACTED',
  'DONE',
] as const;
export const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'COMPLETED'] as const;
export const ORG_ROLES = [
  'SUPPLIER',
  'CONTRACTOR',
  'CONSULTANT',
  'AGENCY',
  'AUTHORITY',
] as const;
export const UTILITY_TYPES = [
  'WATER',
  'SEWER',
  'STORMWATER',
  'POWER',
  'GAS',
  'TELECOM',
  'DISTRICT_HEATING',
] as const;
export const UTILITY_STATUSES = [
  'CONNECTED',
  'AT_BOUNDARY',
  'IN_STREET',
  'NOT_AVAILABLE',
] as const;
export const HOUSE_SECTIONS = [
  'SITE_FOUNDATION',
  'STRUCTURE',
  'ROOF',
  'OPENINGS',
  'ELECTRICAL',
  'PLUMBING',
  'HEATING_VENTILATION',
  'INTERIOR_FINISHES',
  'FACADE_INSULATION',
  'EXTERIOR',
] as const;
export const DELIVERY_KINDS = ['EXPECTED', 'DELIVERED'] as const;
export const UNITS = [
  'm3',
  'm2',
  'm',
  't',
  'kg',
  'pcs',
  'h',
  'set',
  'lump',
] as const;

export const costCategorySchema = z.enum(COST_CATEGORIES);
export const itemKindSchema = z.enum(ITEM_KINDS);
export const itemStatusSchema = z.enum(ITEM_STATUSES);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const orgRoleSchema = z.enum(ORG_ROLES);
export const utilityTypeSchema = z.enum(UTILITY_TYPES);
export const utilityStatusSchema = z.enum(UTILITY_STATUSES);
export const houseSectionSchema = z.enum(HOUSE_SECTIONS);
export const deliveryKindSchema = z.enum(DELIVERY_KINDS);
export const unitSchema = z.enum(UNITS);

export type CostCategory = z.infer<typeof costCategorySchema>;
export type ItemKind = z.infer<typeof itemKindSchema>;
export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type OrgRole = z.infer<typeof orgRoleSchema>;
export type UtilityType = z.infer<typeof utilityTypeSchema>;
export type UtilityStatus = z.infer<typeof utilityStatusSchema>;
export type HouseSection = z.infer<typeof houseSectionSchema>;
export type DeliveryKind = z.infer<typeof deliveryKindSchema>;
export type Unit = z.infer<typeof unitSchema>;

export const UNIT_LABELS: Record<Unit, string> = {
  m3: 'm³',
  m2: 'm²',
  m: 'm',
  t: 't',
  kg: 'kg',
  pcs: 'pcs',
  h: 'h',
  set: 'set',
  lump: 'lump sum',
};

/** Row code kind prefix: `<KIND>-<PREFIX>-NNN` (CONTRACTS §4). */
export const ITEM_KIND_CODE: Record<ItemKind, string> = {
  MATERIAL: 'MAT',
  WORK: 'WRK',
  SERVICE: 'SRV',
};
