-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "clientName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "markupBps" INTEGER NOT NULL DEFAULT 1500,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "approvedCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CostItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "qtyMilli" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "committedCents" INTEGER NOT NULL DEFAULT 0,
    "actualCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "supplierId" TEXT,
    "contractorId" TEXT,
    "deliveryDate" TEXT,
    "deliveredDate" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "requiredForWorkId" TEXT,
    "boqComponentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CostItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CostItem_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CostItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostItem_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostItem_requiredForWorkId_fkey" FOREIGN KEY ("requiredForWorkId") REFERENCES "CostItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostItem_boqComponentId_fkey" FOREIGN KEY ("boqComponentId") REFERENCES "BoqComponent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "legalForm" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "website" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactRole" TEXT NOT NULL,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "rating" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LandParcel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "municipality" TEXT NOT NULL,
    "district" TEXT,
    "state" TEXT NOT NULL,
    "cadastralRef" TEXT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "areaM2" INTEGER NOT NULL,
    "plotWidthCm" INTEGER NOT NULL,
    "plotDepthCm" INTEGER NOT NULL,
    "landValuePerM2Cents" INTEGER NOT NULL,
    "zoningPlan" TEXT NOT NULL,
    "grzBps" INTEGER NOT NULL,
    "gfzBps" INTEGER NOT NULL,
    "maxStoreys" INTEGER NOT NULL,
    "roofRules" TEXT NOT NULL,
    "buildingLineNotes" TEXT,
    "soilType" TEXT NOT NULL,
    "soilClass" TEXT NOT NULL,
    "bearingCapacityKnM2" INTEGER,
    "groundwaterDepthCm" INTEGER,
    "contaminationNotes" TEXT,
    "slopeNotes" TEXT,
    "orientation" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LandParcel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UtilityConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "landId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "distanceM" INTEGER,
    "provider" TEXT,
    "notes" TEXT,
    CONSTRAINT "UtilityConnection_landId_fkey" FOREIGN KEY ("landId") REFERENCES "LandParcel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArchitecturePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "architectOrgId" TEXT,
    "style" TEXT NOT NULL,
    "storeys" INTEGER NOT NULL,
    "roofType" TEXT NOT NULL,
    "roofPitchDeg" INTEGER NOT NULL,
    "energyStandard" TEXT NOT NULL,
    "heatingSystem" TEXT NOT NULL,
    "occupants" INTEGER NOT NULL DEFAULT 4,
    "footprintWidthCm" INTEGER NOT NULL,
    "footprintDepthCm" INTEGER NOT NULL,
    "siteOffsetXcm" INTEGER NOT NULL,
    "siteOffsetYcm" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArchitecturePlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "xCm" INTEGER NOT NULL,
    "yCm" INTEGER NOT NULL,
    "wCm" INTEGER NOT NULL,
    "hCm" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Room_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ArchitecturePlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BoqComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "houseSection" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qtyMilli" INTEGER NOT NULL,
    "materialSection" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BoqComponent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ArchitecturePlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "costItemId" TEXT NOT NULL,
    "batchId" TEXT,
    "deliveryNoteNo" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "qtyMilli" INTEGER NOT NULL,
    "invoiceCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Delivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Delivery_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Delivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "okRows" INTEGER NOT NULL,
    "failedRows" INTEGER NOT NULL,
    "errorsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_projectId_category_section_key" ON "BudgetLine"("projectId", "category", "section");

-- CreateIndex
CREATE INDEX "CostItem_budgetLineId_idx" ON "CostItem"("budgetLineId");

-- CreateIndex
CREATE UNIQUE INDEX "CostItem_projectId_code_key" ON "CostItem"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LandParcel_projectId_key" ON "LandParcel"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "UtilityConnection_landId_type_key" ON "UtilityConnection"("landId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ArchitecturePlan_projectId_key" ON "ArchitecturePlan"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_planId_code_key" ON "Room"("planId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "BoqComponent_planId_code_key" ON "BoqComponent"("planId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_costItemId_deliveryNoteNo_key" ON "Delivery"("costItemId", "deliveryNoteNo");
