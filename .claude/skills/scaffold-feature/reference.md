# scaffold-feature templates

## Prisma model (apps/api/prisma/schema.prisma)
```prisma
model Item {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Shared schema (libs/shared/types/src/lib/item.ts)
```ts
import { z } from 'zod';

export const itemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export const createItemSchema = itemSchema.pick({ name: true });

export type Item = z.infer<typeof itemSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
```

## DTOs (apps/api/src/items/dto/)
```ts
// create-item.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

// update-item.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateItemDto } from './create-item.dto';

export class UpdateItemDto extends PartialType(CreateItemDto) {}
```

## Service (apps/api/src/items/items.service.ts)
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.item.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return item;
  }

  create(dto: CreateItemDto) {
    return this.prisma.item.create({ data: dto });
  }

  async update(id: string, dto: UpdateItemDto) {
    await this.findOne(id);
    return this.prisma.item.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.item.delete({ where: { id } });
  }
}
```

## Controller (apps/api/src/items/items.controller.ts)
```ts
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get() findAll() { return this.items.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.items.findOne(id); }
  @Post() create(@Body() dto: CreateItemDto) { return this.items.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateItemDto) { return this.items.update(id, dto); }
  @Delete(':id') @HttpCode(204) remove(@Param('id') id: string) { return this.items.remove(id); }
}
```

## Module (apps/api/src/items/items.module.ts)
```ts
import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

@Module({ controllers: [ItemsController], providers: [ItemsService] })
export class ItemsModule {}
```

## Service test (apps/api/src/items/items.service.spec.ts)
```ts
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ItemsService } from './items.service';

describe('ItemsService', () => {
  const prisma = { item: { findUnique: jest.fn(), create: jest.fn() } };
  let service: ItemsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ItemsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ItemsService);
  });

  it('should throw NotFoundException when the item does not exist', async () => {
    prisma.item.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should create an item with the given name', async () => {
    prisma.item.create.mockResolvedValue({ id: '1', name: 'A' });
    await expect(service.create({ name: 'A' })).resolves.toEqual({ id: '1', name: 'A' });
    expect(prisma.item.create).toHaveBeenCalledWith({ data: { name: 'A' } });
  });
});
```

## Query hooks (apps/web/src/features/items/use-items.ts)
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemSchema, type CreateItemInput, type Item } from '@default-project/types';

const itemsKey = ['items'] as const;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${url} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export function useItems() {
  return useQuery({
    queryKey: itemsKey,
    queryFn: async (): Promise<Item[]> => itemSchema.array().parse(await request('/api/items')),
  });
}

export function useCreateItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) => request<Item>('/api/items', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => client.invalidateQueries({ queryKey: itemsKey }),
  });
}
```

## Page (apps/web/src/features/items/items-page.tsx)
```tsx
import { useState, type FormEvent } from 'react';
import { useCreateItem, useItems } from './use-items';

export function ItemsPage() {
  const { data, isPending, isError } = useItems();
  const createItem = useCreateItem();
  const [name, setName] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    createItem.mutate({ name }, { onSuccess: () => setName('') });
  }

  if (isPending) return <p role="status">Loading…</p>;
  if (isError) return <p role="alert">Could not load items</p>;

  return (
    <section>
      <form onSubmit={onSubmit}>
        <label>
          Name <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={!name || createItem.isPending}>Add</button>
      </form>
      <ul>
        {data.map((item) => <li key={item.id}>{item.name}</li>)}
      </ul>
    </section>
  );
}
```

## Page test (apps/web/src/features/items/items-page.spec.tsx)
```tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ItemsPage } from './items-page';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ItemsPage /></QueryClientProvider>);
}

describe('ItemsPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should list items returned by the api', async () => {
    const now = new Date().toISOString();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ id: '1', name: 'First', createdAt: now, updatedAt: now }]), { status: 200 }),
    );
    renderPage();
    expect(await screen.findByText('First')).toBeTruthy();
  });

  it('should show an error when the api fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    renderPage();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
```

## Route (apps/web/src/app/app.tsx)
```tsx
<Route path="/items" element={<ItemsPage />} />
```
