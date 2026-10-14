import { Navigate, Route, Routes } from 'react-router-dom';
import { ProjectsListPage } from '../features/projects-list/projects-list-page';
import { ProjectWizardPage } from '../features/project-wizard/project-wizard-page';
import { ProjectPage } from '../features/project/project-page';
import { LandPage } from '../features/land/land-page';
import { ArchitecturePage } from '../features/architecture/architecture-page';
import { MaterialsPage } from '../features/materials/materials-page';
import { ConstructionPage } from '../features/construction/construction-page';
import { MarketingPage } from '../features/marketing/marketing-page';
import { ProfitabilityPage } from '../features/profitability/profitability-page';
import { DeliveryTrackingPage } from '../features/delivery-tracking/delivery-tracking-page';
import { AnalyticsPage } from '../features/analytics/analytics-page';
import { SearchPage } from '../features/search/search-page';
import { EmptyState } from '../ui/states';

/** Route ↔ component table from CONTRACTS §7 (frozen after w0-frozen). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsListPage />} />
      <Route path="/projects/new" element={<ProjectWizardPage />} />
      <Route path="/projects/:projectId" element={<ProjectPage />}>
        <Route index element={<Navigate to="land" replace />} />
        <Route path="land" element={<LandPage />} />
        <Route path="architecture" element={<ArchitecturePage />} />
        <Route path="materials/:section?" element={<MaterialsPage />} />
        <Route path="construction/:section?" element={<ConstructionPage />} />
        <Route path="marketing/:section?" element={<MarketingPage />} />
        <Route path="profitability" element={<ProfitabilityPage />} />
      </Route>
      <Route path="/deliveries" element={<DeliveryTrackingPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="*" element={<EmptyState title="Page not found" />} />
    </Routes>
  );
}
