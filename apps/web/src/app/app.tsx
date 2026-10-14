import { AppShell } from './layout/app-shell';
import { AppRoutes } from './routes';

export function App() {
  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}

export default App;
