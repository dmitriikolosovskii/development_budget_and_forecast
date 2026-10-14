import {
  SEARCH_RESULT_TYPES,
  type SearchResult,
  type SearchResultType,
} from '@default-project/types';

export const SEARCH_TYPE_LABEL: Record<SearchResultType, string> = {
  project: 'Projects',
  item: 'Cost items',
  organization: 'Organizations',
  line: 'Budget lines',
};

export function isSearchResultType(
  value: string | null,
): value is SearchResultType {
  return (
    value !== null && (SEARCH_RESULT_TYPES as readonly string[]).includes(value)
  );
}

export interface SearchGroup {
  type: SearchResultType;
  results: SearchResult[];
}

/** Groups in the fixed type order, keeping the server's relevance order inside each group. */
export function groupResults(results: SearchResult[]): SearchGroup[] {
  return SEARCH_RESULT_TYPES.map((type) => ({
    type,
    results: results.filter((r) => r.type === type),
  })).filter((g) => g.results.length > 0);
}
