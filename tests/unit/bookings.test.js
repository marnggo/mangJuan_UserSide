import { describe, expect, it } from 'vitest';
import {
  buildCatalog,
  CANCELLABLE,
  canCancel,
  validateBooking,
} from '../../src/services/bookings.js';
import { BOOKING_STATES as S } from '../../src/utils/contract.js';

const now = new Date('2026-11-12T08:00:00Z');
const onDemand = {
  category: 'Plumbing',
  service_type: 'CHECKUP',
  booking_type: 'on-demand',
  address: ' Unit 6, Tower 1 ',
  problem: 'Dripping water',
  price_offer: 250,
};

describe('validateBooking', () => {
  it('starts an on-demand booking as Requested', () => {
    expect(validateBooking(onDemand, now).value).toEqual({
      category: 'plumbing',
      service_type: 'CHECKUP',
      booking_type: 'on-demand',
      status: S.REQUESTED,
      scheduled_for: null,
      address: 'Unit 6, Tower 1',
      problem: 'Dripping water',
      price_offer: 250,
      unit_id: null,
      symptoms: [],
      payment_method: null,
    });
  });
  it('takes a saved unit instead of an address, and a short symptom list (U02, U04)', () => {
    const unit_id = '0b7c6f2e-5d1a-4c3b-9e8f-1a2b3c4d5e6f';
    const v = validateBooking(
      { ...onDemand, address: undefined, unit_id, symptoms: [' Leak ', 'No water'] },
      now,
    ).value;
    expect(v).toMatchObject({ unit_id, address: '', symptoms: ['Leak', 'No water'] });
    for (const bad of ['nope', 7, ''])
      expect(validateBooking({ ...onDemand, unit_id: bad }, now).fields).toHaveProperty('unit_id');
    for (const symptoms of ['Leak', [''], [7], Array(11).fill('x'), ['x'.repeat(41)]])
      expect(validateBooking({ ...onDemand, symptoms }, now).fields).toHaveProperty('symptoms');
  });
  it('starts a scheduled booking as Pending Confirmation', () => {
    const v = validateBooking(
      { ...onDemand, booking_type: 'scheduled', scheduled_for: '2026-11-13T02:30:00Z' },
      now,
    ).value;
    expect(v.status).toBe(S.PENDING_CONFIRMATION);
    expect(v.scheduled_for).toBe('2026-11-13T02:30:00.000Z');
  });
  it('needs a future time for scheduled and none for on-demand', () => {
    const sched = { ...onDemand, booking_type: 'scheduled' };
    for (const scheduled_for of [undefined, 'tomorrow', '2026-11-12T07:59:00Z', 1794000000000])
      expect(validateBooking({ ...sched, scheduled_for }, now).fields).toHaveProperty(
        'scheduled_for',
      );
    expect(
      validateBooking({ ...onDemand, scheduled_for: '2026-11-13T02:30:00Z' }, now).fields,
    ).toHaveProperty('scheduled_for');
  });
  it('names every bad field', () => {
    expect(Object.keys(validateBooking({}, now).fields).sort()).toEqual([
      'address',
      'booking_type',
      'category',
      'service_type',
    ]);
    expect(validateBooking(null, now).fields).toBeDefined();
  });
  it('rejects service types outside the contract, including inherited keys', () => {
    for (const service_type of ['QUICK', 'checkup', 'toString', '__proto__', 7])
      expect(validateBooking({ ...onDemand, service_type }, now).fields).toHaveProperty(
        'service_type',
      );
  });
  it('limits the text fields and the price', () => {
    expect(validateBooking({ ...onDemand, problem: 'x'.repeat(301) }, now).fields).toHaveProperty(
      'problem',
    );
    expect(validateBooking({ ...onDemand, address: 'x'.repeat(201) }, now).fields).toHaveProperty(
      'address',
    );
    expect(validateBooking({ ...onDemand, category: '<script>' }, now).fields).toHaveProperty(
      'category',
    );
    for (const price_offer of [-1, 12.5, '250', 1e7])
      expect(validateBooking({ ...onDemand, price_offer }, now).fields).toHaveProperty(
        'price_offer',
      );
    expect(
      validateBooking({ ...onDemand, price_offer: undefined, problem: undefined }, now).value,
    ).toMatchObject({ price_offer: null, problem: '' });
  });
});

describe('buildCatalog', () => {
  it('joins contract durations with DB prices and drops unpriced types (U03, U06)', () => {
    const cats = [
      { key: 'plumbing', name: 'Plumbing', description: 'Leaks' },
      { key: 'empty', name: 'Empty', description: '' },
    ];
    const prices = [
      { category: 'plumbing', service_type: 'MAJOR', base_price: 800, price_is_minimum: true },
      { category: 'plumbing', service_type: 'CHECKUP', base_price: 250, price_is_minimum: false },
    ];
    const [plumbing, empty] = buildCatalog(cats, prices);
    expect(plumbing.services).toEqual([
      {
        service_type: 'CHECKUP',
        label: 'Checkup / Quick Repair',
        min_minutes: 15,
        max_minutes: 15,
        base_price: 250,
        price_is_minimum: false,
      },
      {
        service_type: 'MAJOR',
        label: 'Major Repair',
        min_minutes: 60,
        max_minutes: null,
        base_price: 800,
        price_is_minimum: true,
      },
    ]);
    expect(empty.services).toEqual([]);
  });
});

describe('canCancel', () => {
  it('allows cancelling only before In Progress (U13)', () => {
    expect(CANCELLABLE).toEqual([S.REQUESTED, S.PENDING_CONFIRMATION, S.ACCEPTED, S.CONFIRMED]);
    for (const s of [S.IN_PROGRESS, S.COMPLETED, S.DECLINED, S.CANCELLED])
      expect(canCancel(s)).toBe(false);
    expect(canCancel(S.CONFIRMED)).toBe(true);
  });
});
