// Seed shapes: plain objects with references by slug/code (never ids), so they can be built and tested without a database.
import type {
  CostCategory,
  HouseSection,
  ItemKind,
  ItemStatus,
  OrgRole,
  ProjectStatus,
  Unit,
  UtilityStatus,
  UtilityType,
} from '@default-project/types';

export type { CostCategory, HouseSection, ItemKind, ItemStatus, OrgRole, ProjectStatus, Unit, UtilityStatus, UtilityType };

export interface OrganizationSeed {
  slug: string;
  name: string;
  role: OrgRole;
  legalForm: string | null;
  address: string;
  city: string;
  website: string | null;
  email: string;
  phone: string;
  contactPerson: string;
  contactRole: string;
  paymentTermsDays: number;
  rating: number | null;
  notes: string | null;
}

export interface BudgetLineSeed {
  category: CostCategory;
  section: string;
  name: string;
  approvedCents: number;
  sortOrder: number;
}

export interface CostItemSeed {
  code: string;
  category: CostCategory;
  section: string;
  kind: ItemKind;
  name: string;
  description: string | null;
  unit: Unit;
  qtyMilli: number;
  unitPriceCents: number;
  committedCents: number;
  actualCents: number;
  status: ItemStatus;
  supplierSlug: string | null;
  contractorSlug: string | null;
  deliveryDate: string | null;
  deliveredDate: string | null;
  startDate: string | null;
  endDate: string | null;
  requiredForWorkCode: string | null;
  boqCode: string | null;
  sortOrder: number;
  notes: string | null;
  /** A change order of the demo project: not copied into derived projects or the template. */
  changeOrder: boolean;
}

export interface UtilitySeed {
  type: UtilityType;
  status: UtilityStatus;
  distanceM: number | null;
  provider: string | null;
  notes: string | null;
}

export interface LandSeed {
  address: string;
  postalCode: string;
  municipality: string;
  district: string | null;
  state: string;
  cadastralRef: string | null;
  lat: number;
  lng: number;
  areaM2: number;
  plotWidthCm: number;
  plotDepthCm: number;
  landValuePerM2Cents: number;
  zoningPlan: string;
  grzBps: number;
  gfzBps: number;
  maxStoreys: number;
  roofRules: string;
  buildingLineNotes: string | null;
  soilType: string;
  soilClass: string;
  bearingCapacityKnM2: number | null;
  groundwaterDepthCm: number | null;
  contaminationNotes: string | null;
  slopeNotes: string | null;
  orientation: string | null;
  notes: string | null;
  utilities: UtilitySeed[];
}

export interface RoomSeed {
  code: string;
  floor: number;
  name: string;
  kind: string;
  xCm: number;
  yCm: number;
  wCm: number;
  hCm: number;
  sortOrder: number;
}

export interface BoqComponentSeed {
  code: string;
  houseSection: HouseSection;
  name: string;
  unit: Unit;
  qtyMilli: number;
  materialSection: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface PlanSeed {
  name: string;
  architectOrgSlug: string | null;
  style: string;
  storeys: number;
  roofType: string;
  roofPitchDeg: number;
  energyStandard: string;
  heatingSystem: string;
  occupants: number;
  footprintWidthCm: number;
  footprintDepthCm: number;
  siteOffsetXcm: number;
  siteOffsetYcm: number;
  notes: string | null;
  rooms: RoomSeed[];
  components: BoqComponentSeed[];
}

export interface DeliverySeed {
  itemCode: string;
  deliveryNoteNo: string;
  kind: 'EXPECTED' | 'DELIVERED';
  date: string;
  qtyMilli: number;
  invoiceCents: number | null;
}

export interface ProjectSeed {
  project: {
    slug: string;
    name: string;
    code: string;
    status: ProjectStatus;
    isTemplate: boolean;
    clientName: string;
    city: string;
    startDate: string;
    endDate: string;
    markupBps: number;
  };
  budgetLines: BudgetLineSeed[];
  items: CostItemSeed[];
  land: LandSeed | null;
  plan: PlanSeed | null;
  deliveries: DeliverySeed[];
}
