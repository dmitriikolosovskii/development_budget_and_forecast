import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SearchQueryDto } from './search-query.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true });
const validate = (query: Record<string, unknown>) =>
  pipe.transform(query, {
    type: 'query',
    metatype: SearchQueryDto,
  }) as Promise<SearchQueryDto>;

describe('SearchQueryDto', () => {
  it('should reject q when it is 1 character after trimming [AC-13.1]', async () => {
    await expect(validate({ q: ' a ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(validate({ q: ' ab ' })).resolves.toEqual({ q: 'ab' });
  });

  it('should trim q when it has surrounding spaces [AC-13.1]', async () => {
    const dto = await validate({ q: '  AROTHERM ' });

    expect(dto.q).toBe('AROTHERM');
  });

  it('should reject q when it is longer than 64 characters or missing [AC-13.9]', async () => {
    await expect(validate({ q: 'x'.repeat(65) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(validate({})).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate({ q: ['ab', 'cd'] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(validate({ q: 'x'.repeat(64) })).resolves.toEqual({
      q: 'x'.repeat(64),
    });
  });
});
