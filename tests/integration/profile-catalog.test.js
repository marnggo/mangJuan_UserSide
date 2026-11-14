// U02 to U06 and the mock aide API, against the in-memory store (see api.test.js for why).
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { BOOKING_STATES as S } from '../../src/utils/contract.js';
import { memoryStore } from '../helpers/memoryStore.js';

const SECRET = 'integration-test-secret-integration-1234';
const KEY = 'mock-aide-test-key';
const juan = {
  email: 'juan@example.com',
  mobile_number: '0917 123 4567',
  password: 'Secret#123',
  full_name: 'Juan Dela Cruz',
};
const maria = { ...juan, email: 'maria@example.com', mobile_number: '0918 765 4321' };
const unit = { building: 'Avida Towers Prime Taft', tower: 'Tower 1', unit_number: '12B' };
const booking = {
  category: 'plumbing',
  service_type: 'STANDARD',
  booking_type: 'on-demand',
  problem: 'Kitchen sink leaks',
  symptoms: ['Leak'],
};

let store, app;
beforeEach(() => {
  store = memoryStore();
  app = createApp({
    store,
    secret: () => SECRET,
    authLimit: 1000,
    mockAide: true,
    mockAideKey: KEY,
  });
});
const as = (token) => ({ Authorization: `Bearer ${token}` });
const tokenFor = async (who) =>
  (await request(app).post('/api/auth/register').send(who)).body.token;

describe('PATCH /api/me (U02)', () => {
  it('updates the name, email and number', async () => {
    const token = await tokenFor(juan);
    const res = await request(app)
      .patch('/api/me')
      .set(as(token))
      .send({ full_name: 'Juan D. Cruz', mobile_number: '0999 000 1111' });
    expect(res.status).toBe(200);
    expect(res.body.resident).toMatchObject({
      full_name: 'Juan D. Cruz',
      mobile_number: '+639990001111',
      email: 'juan@example.com',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/);
  });
  it("refuses another resident's email or number, and bad input", async () => {
    const token = await tokenFor(juan);
    await tokenFor(maria);
    const email = await request(app)
      .patch('/api/me')
      .set(as(token))
      .send({ email: 'MARIA@example.com' });
    expect([email.status, email.body.error.code]).toEqual([409, 'EMAIL_TAKEN']);
    const mobile = await request(app)
      .patch('/api/me')
      .set(as(token))
      .send({ mobile_number: '+639187654321' });
    expect(mobile.body.error.code).toBe('MOBILE_TAKEN');
    expect((await request(app).patch('/api/me').set(as(token)).send({})).status).toBe(400);
    expect((await request(app).patch('/api/me').send({ full_name: 'X' })).status).toBe(401);
  });
});

describe('/api/me/units (U02)', () => {
  it('adds units, makes the first the default, and moves the default', async () => {
    const token = await tokenFor(juan);
    const first = (await request(app).post('/api/me/units').set(as(token)).send(unit)).body.unit;
    expect(first).toMatchObject({ ...unit, is_default: true, floor: '', notes: '' });
    const second = await request(app)
      .post('/api/me/units')
      .set(as(token))
      .send({ ...unit, unit_number: '21C', is_default: true });
    expect(second.status).toBe(201);
    const list = (await request(app).get('/api/me/units').set(as(token))).body.units;
    expect(list.map((u) => [u.unit_number, u.is_default])).toEqual([
      ['21C', true],
      ['12B', false],
    ]);
    const edit = await request(app)
      .patch(`/api/me/units/${first.id}`)
      .set(as(token))
      .send({ is_default: true, notes: 'Gate 2' });
    expect(edit.body.unit).toMatchObject({ is_default: true, notes: 'Gate 2' });
    expect(store.units.filter((u) => u.is_default)).toHaveLength(1);
  });
  it('keeps units private, validates them and caps the count', async () => {
    const [juanT, mariaT] = [await tokenFor(juan), await tokenFor(maria)];
    const { id } = (await request(app).post('/api/me/units').set(as(juanT)).send(unit)).body.unit;
    expect((await request(app).get('/api/me/units').set(as(mariaT))).body.units).toEqual([]);
    expect(
      (await request(app).patch(`/api/me/units/${id}`).set(as(mariaT)).send({ notes: 'x' })).status,
    ).toBe(404);
    expect((await request(app).delete(`/api/me/units/${id}`).set(as(mariaT))).status).toBe(404);
    expect((await request(app).delete('/api/me/units/nope').set(as(juanT))).status).toBe(404);
    const bad = await request(app).post('/api/me/units').set(as(juanT)).send({ tower: 'T1' });
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['building', 'unit_number']);
    for (let i = 1; i < 10; i++)
      await request(app)
        .post('/api/me/units')
        .set(as(juanT))
        .send({ ...unit, unit_number: String(i) });
    const full = await request(app).post('/api/me/units').set(as(juanT)).send(unit);
    expect([full.status, full.body.error.code]).toEqual([409, 'TOO_MANY_UNITS']);
    expect((await request(app).delete(`/api/me/units/${id}`).set(as(juanT))).status).toBe(204);
  });
});

describe('GET /api/categories (U03, U05, U06)', () => {
  it('lists active categories with durations and base prices, without logging in', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories.map((c) => c.key)).toEqual(['plumbing', 'cleaning']);
    expect(res.body.categories[0].services.map((s) => [s.service_type, s.base_price])).toEqual([
      ['CHECKUP', 250],
      ['STANDARD', 450],
      ['MAJOR', 800],
    ]);
    expect(res.body.categories[1].services).toHaveLength(1);
  });
});

describe('POST /api/bookings with U02 to U06 data', () => {
  it('copies the unit address and the base price onto the booking', async () => {
    const token = await tokenFor(juan);
    const u = (await request(app).post('/api/me/units').set(as(token)).send(unit)).body.unit;
    const res = await request(app)
      .post('/api/bookings')
      .set(as(token))
      .send({ ...booking, unit_id: u.id });
    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({
      unit_id: u.id,
      address: 'Unit 12B, Tower 1, Avida Towers Prime Taft',
      symptoms: ['Leak'],
      base_price: 450,
      status: S.REQUESTED,
    });
  });
  it("refuses another resident's unit and services that aren't offered", async () => {
    const [juanT, mariaT] = [await tokenFor(juan), await tokenFor(maria)];
    const u = (await request(app).post('/api/me/units').set(as(juanT)).send(unit)).body.unit;
    const theirs = await request(app)
      .post('/api/bookings')
      .set(as(mariaT))
      .send({ ...booking, unit_id: u.id });
    expect(Object.keys(theirs.body.error.fields)).toEqual(['unit_id']);
    for (const bad of [
      { category: 'retired', service_type: 'CHECKUP' },
      { category: 'cleaning', service_type: 'CHECKUP' },
      { category: 'unknown' },
    ]) {
      const res = await request(app)
        .post('/api/bookings')
        .set(as(juanT))
        .send({ ...booking, address: 'Unit 1', ...bad });
      expect([res.status, Object.keys(res.body.error.fields)]).toEqual([400, ['category']]);
    }
  });
});

describe('mock aide API', () => {
  it('lists bookings with who and where, and only offers can assign a Manong', async () => {
    const token = await tokenFor(juan);
    await request(app)
      .post('/api/me/units')
      .set(as(token))
      .send({ ...unit, notes: 'Gate 2' });
    const unitId = store.units[0].id;
    const { id } = (
      await request(app)
        .post('/api/bookings')
        .set(as(token))
        .send({ ...booking, unit_id: unitId })
    ).body.booking;
    const list = (await request(app).get('/api/mock-aide/bookings').set({ 'X-Mock-Aide-Key': KEY }))
      .body.bookings;
    expect(list[0]).toMatchObject({
      resident_name: 'Juan Dela Cruz',
      unit_notes: 'Gate 2',
      offers: [],
    });
    const move = (status) =>
      request(app)
        .patch(`/api/mock-aide/bookings/${id}/status`)
        .set({ 'X-Mock-Aide-Key': KEY })
        .send({ status });
    for (const s of [S.ACCEPTED, S.COMPLETED, S.CANCELLED])
      expect((await move(s)).body.error.code).toBe('BAD_TRANSITION');
    // Nobody can take it: declining needs no Manong.
    expect((await move(S.DECLINED)).body.booking.status).toBe(S.DECLINED);
    expect((await request(app).get('/api/bookings').set(as(token))).body.bookings[0].status).toBe(
      S.DECLINED,
    );
  });
  it('is off unless asked for', async () => {
    const off = createApp({ store, secret: () => SECRET });
    expect((await request(off).get('/api/mock-aide/bookings')).status).toBe(404);
    expect((await request(off).get('/mock-aide/')).status).not.toBe(200);
    expect((await request(app).get('/mock-aide/')).text).toContain('mock-aide.js');
  });
});
