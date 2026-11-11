import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('2 + 2 debe ser 4', () => {
    expect(2 + 2).toBe(4);
  });

  it('el proyecto tiene un nombre', () => {
    expect('script28').toBe('script28');
  });
});
