/** Static channel notes for the 8 MARKETING sections (CONTRACTS §4), figures from GERMANY-DATA §6 (net, 2025–2026). */
export interface ChannelInfo {
  blurb: string;
  benchmarks: string[];
}

export const CHANNELS: Record<string, ChannelInfo> = {
  listings: {
    blurb:
      'Listings on ImmoScout24 and Immowelt are where most German buyers start looking for a new-build house.',
    benchmarks: [
      'Project packages: ~€400 per month for both portals',
      'Run for 3–4 months, from the shell stage until sale',
    ],
  },
  'paid-search': {
    blurb:
      'Google Ads on local intent keywords such as "Haus bauen Leipzig" or "Neubau Taucha".',
    benchmarks: [
      'CPC for real estate: €2–6',
      'Typical budget: €30 per day for ~90 days',
    ],
  },
  social: {
    blurb:
      'Meta and Instagram lead ads that target young families within a 30 km radius.',
    benchmarks: ['~€1,000 per month for 3 months', 'Cost per lead: €15–60'],
  },
  'website-seo': {
    blurb:
      'A project landing page with floor plans, plus local SEO and directory listings.',
    benchmarks: [
      'Landing page: ~€2,500 one-off',
      'SEO and local listings: ~€400 per month',
    ],
  },
  visuals: {
    blurb:
      'Exterior renders and a 360° virtual tour sell the house before it exists.',
    benchmarks: ['2–3 exterior renders plus a 360° tour: ~€2,500'],
  },
  'print-signage': {
    blurb:
      'A site sign (Bauschild) on the plot, plus brochures and flyers for the neighbourhood.',
    benchmarks: [
      'Site sign 3 × 2 m: ~€2,000',
      '250 brochures: ~€900 · flyers: ~€200',
    ],
  },
  events: {
    blurb:
      'Open days on site. A show-home park is not worth it for a single house.',
    benchmarks: ['~€1,500 per open day', 'Typically 2 open days'],
  },
  'sales-commission': {
    blurb: 'A broker (Makler) commission, if the house is not sold directly.',
    benchmarks: [
      '3.57 % gross per side (§ 656c BGB, split between buyer and seller)',
      'Demo project: sold directly, €0',
    ],
  },
};

/** Typical total marketing spend for one house (GERMANY-DATA §6). */
export const MARKETING_BENCHMARK_NOTE =
  'Typical marketing spend: ~3 % of the contract price (~€20,000 for one house).';
