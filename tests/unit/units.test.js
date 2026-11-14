import { describe, expect, it } from 'vitest';
import { validateProfile } from '../../src/services/auth.js';
import { formatUnitAddress, validateUnit } from '../../src/services/units.js';

const unit = {
  building: ' Avida Towers Prime Taft ',
  tower: 'Tower 1',
  floor: '12',
  unit_number: '12B',
  street: 'Taft Ave',
  city: 'Pasay City',
};

describe('validateUnit (U02)', () => {
  it('trims a new unit and needs building and unit number', () => {
    expect(validateUnit(unit).value).toEqual({ ...unit, building: 'Avida Towers Prime Taft' });
    expect(Object.keys(validateUnit({}).fields).sort()).toEqual(['building', 'unit_number']);
    expect(validateUnit({ ...unit, unit_number: '  ' }).fields).toHaveProperty('unit_number');
  });
  it('limits lengths and types', () => {
    expect(validateUnit({ ...unit, notes: 'x'.repeat(201) }).fields).toHaveProperty('notes');
    expect(validateUnit({ ...unit, tower: 7 }).fields).toHaveProperty('tower');
    expect(validateUnit({ ...unit, is_default: 'yes' }).fields).toHaveProperty('is_default');
  });
  it('takes only the sent fields on an edit, and at least one', () => {
    expect(validateUnit({ notes: 'Gate 2', is_default: true }, { partial: true }).value).toEqual({
      notes: 'Gate 2',
      is_default: true,
    });
    expect(validateUnit({}, { partial: true }).fields).toBeDefined();
    expect(validateUnit({ building: '' }, { partial: true }).fields).toHaveProperty('building');
  });
});

describe('formatUnitAddress', () => {
  it('reads as one line and skips empty parts', () => {
    expect(formatUnitAddress(validateUnit(unit).value)).toBe(
      'Unit 12B, Floor 12, Tower 1, Avida Towers Prime Taft, Taft Ave, Pasay City',
    );
    expect(formatUnitAddress({ unit_number: '6', building: 'Avida' })).toBe('Unit 6, Avida');
  });
});

describe('validateProfile (U02)', () => {
  it('normalizes the fields sent', () => {
    expect(
      validateProfile({ email: ' Juan@Example.com ', mobile_number: '0917 123 4567' }),
    ).toEqual({ value: { email: 'juan@example.com', mobile_number: '+639171234567' } });
  });
  it('rejects bad values and an empty body', () => {
    expect(
      Object.keys(validateProfile({ full_name: '', email: 'x', mobile_number: '123' }).fields),
    ).toHaveLength(3);
    expect(validateProfile({}).fields).toBeDefined();
    expect(validateProfile(null).fields).toBeDefined();
  });
});
