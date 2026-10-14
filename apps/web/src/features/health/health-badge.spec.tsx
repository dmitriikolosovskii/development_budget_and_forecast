import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HealthBadge } from './health-badge';

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HealthBadge />
    </QueryClientProvider>,
  );
}

describe('HealthBadge', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should show api and db state when the api answers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', db: 'up' }), { status: 200 }),
    );

    renderWithClient();

    expect(await screen.findByText('API: ok, DB: up')).toBeTruthy();
  });

  it('should show unavailable when the api fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));

    renderWithClient();

    expect(await screen.findByText('API: unavailable')).toBeTruthy();
  });
});
