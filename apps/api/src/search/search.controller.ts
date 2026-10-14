import { Controller, Get, Query } from '@nestjs/common';
import type { SearchResult } from '@default-project/types';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() query: SearchQueryDto): Promise<SearchResult[]> {
    return this.searchService.search(query.q);
  }
}
