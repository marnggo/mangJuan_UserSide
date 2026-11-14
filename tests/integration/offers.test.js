// Offers, the job after acceptance, and the debug sign-in, against the in-memory store.
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { BOOKING_STATES as S } from '../../src/utils/contract.js';
import { memoryStore } from '../helpers/memoryStore.js';

const SECRET = 'integration-test-secret-integration-1234';
const juan = {
  email: 'juan@example.com',
  mobile_number: '0917 123 4567',
  password: 'Secret#123',
  full_name: 'Juan Dela Cruz',
};
const request1 = {
  category: 'plumbing',
  service_type: 'STANDARD',
  booking_type: 'on-demand',
  address: 'Unit 12B, Tower 1',
  problem: 'Kitchen sink leaks',
  price_offer: 500,
  payment_method: 'gcash',
};

let store, app, token, id, hal, arthur;
const as = () => ({ Authorization: `Bearer ${token}` });
const aide = (path, body, method = 'post') =>
  request(app)[method](`/api/mock-aide/bookings/${id}${path}`).send(body);
const detail = async () => (await request(app).get(`/api/bookings/${id}`).set(as())).body;

beforeEach(async () => {
  store = memoryStore();
  app = createApp({ store, secret: () => SECRET, authLimit: 1000, mockAide: true });
  token = (await request(app).post('/api/auth/register').send(juan)).body.token;
  id = (await request(app).post('/api/bookings').set(as()).send(request1)).body.booking.id;
  [hal, arthur] = store.aides.map((a) => a.id);
});

describe('offers (one round per Manong)', () => {
  it('lets each Manong take the price or counter once, and the resident pick one', async () => {
    const take = await aide('/offers', { aide_id: hal });
    expect(take.body.offer).toMatchObject({ price: 500, kind: 'accept', status: 'open' });
    const counter = await aide('/offers', { aide_id: arthur, price: 525 });
    expect(counter.body.offer).toMatchObject({ price: 525, kind: 'counter' });
    expect((await aide('/offers', { aide_id: arthur, price: 600 })).body.error.code).toBe(
      'CANNOT_OFFER',
    );

    const d = await detail();
    expect(d.offers.map((o) => [o.aide.full_name, o.price, o.kind])).toEqual([
      ['Hal Jordan', 500, 'accept'],
      ['Arthur Curry', 525, 'counter'],
    ]);
    const res = await request(app)
      .post(`/api/bookings/${id}/offers/${counter.body.offer.id}/accept`)
      .set(as());
    expect(res.body.booking).toMatchObject({
      status: S.ACCEPTED,
      aide_id: arthur,
      agreed_price: 525,
    });
    expect(store.offers.map((o) => o.status)).toEqual(['expired', 'accepted']);
    // Closed to new offers and to a second accept.
    expect((await aide('/offers', { aide_id: hal })).status).toBe(409);
    const again = await request(app)
      .post(`/api/bookings/${id}/offers/${take.body.offer.id}/accept`)
      .set(as());
    expect(again.body.error.code).toBe('OFFER_CLOSED');
  });
  it('declines an offer and raises the request price, only upward and only while open', async () => {
    const { offer } = (await aide('/offers', { aide_id: hal, price: 700 })).body;
    expect(
      (await request(app).post(`/api/bookings/${id}/offers/${offer.id}/decline`).set(as())).status,
    ).toBe(204);
    const raise = (price_offer) =>
      request(app).patch(`/api/bookings/${id}/offer`).set(as()).send({ price_offer });
    expect((await raise(450)).body.error.fields).toHaveProperty('price_offer');
    expect((await raise(560)).body.booking.price_offer).toBe(560);
    // Arthur now takes the new price.
    expect((await aide('/offers', { aide_id: arthur })).body.offer.price).toBe(560);
  });
  it("keeps one resident out of another's booking", async () => {
    const other = (
      await request(app)
        .post('/api/auth/register')
        .send({
          ...juan,
          email: 'm@example.com',
          mobile_number: '0918 765 4321',
        })
    ).body.token;
    const { offer } = (await aide('/offers', { aide_id: hal })).body;
    const r = await request(app)
      .post(`/api/bookings/${id}/offers/${offer.id}/accept`)
      .set({ Authorization: `Bearer ${other}` });
    expect(r.status).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/bookings/${id}`)
          .set({ Authorization: `Bearer ${other}` })
      ).status,
    ).toBe(404);
    expect((await request(app).get('/api/bookings/nope').set(as())).status).toBe(404);
  });
});

describe('after a Manong is booked', () => {
  beforeEach(async () => {
    const { offer } = (await aide('/offers', { aide_id: hal })).body;
    await request(app).post(`/api/bookings/${id}/offers/${offer.id}/accept`).set(as());
  });
  it('runs on the way, arrived, chat, charges, done and the rating', async () => {
    expect(
      (await aide('/progress', { aide_id: arthur, aide_status: 'arrived' }, 'patch')).status,
    ).toBe(409);
    const way = await aide(
      '/progress',
      { aide_id: hal, aide_status: 'on_the_way', eta_minutes: 12 },
      'patch',
    );
    expect(way.body.booking).toMatchObject({ aide_status: 'on_the_way', eta_minutes: 12 });
    await aide('/progress', { aide_id: hal, aide_status: 'arrived' }, 'patch');

    await request(app)
      .post(`/api/bookings/${id}/messages`)
      .set(as())
      .send({ body: 'At the lobby' });
    await aide('/messages', { aide_id: hal, body: 'Papunta na po' });
    expect((await aide('/messages', { aide_id: arthur, body: 'Hi' })).status).toBe(409);

    expect(
      (await aide('/status', { aide_id: hal, status: S.IN_PROGRESS }, 'patch')).body.booking.status,
    ).toBe(S.IN_PROGRESS);
    const part = (await aide('/charges', { aide_id: hal, label: 'P-trap', amount: 180 })).body
      .charge;
    const tape = (await aide('/charges', { aide_id: hal, label: 'Tape', amount: 35 })).body.charge;
    const decide = (c, approved) =>
      request(app).patch(`/api/bookings/${id}/charges/${c.id}`).set(as()).send({ approved });
    expect((await decide(part, true)).body.charge.status).toBe('approved');
    await decide(tape, false);
    expect((await decide(tape, true)).status).toBe(404);

    // Can't rate before the Manong marks the job done.
    const review = { rating: 5, praise: ['On time'], tip: 50, payment_method: 'cash' };
    expect(
      (await request(app).post(`/api/bookings/${id}/review`).set(as()).send(review)).status,
    ).toBe(409);
    expect(
      (await aide('/status', { aide_id: hal, status: S.COMPLETED }, 'patch')).body.booking.status,
    ).toBe(S.COMPLETED);

    let d = await detail();
    expect(d.messages.map((m) => m.sender)).toEqual(['resident', 'aide']);
    expect(d.total).toBe(500 + 180);
    const done = await request(app).post(`/api/bookings/${id}/review`).set(as()).send(review);
    expect(done.body.booking).toMatchObject({ rating: 5, tip: 50, payment_method: 'cash' });
    expect(done.body.booking.reviewed_at).toBeTruthy();
    d = await detail();
    expect(d.total).toBe(500 + 180 + 50);
    expect(
      (await request(app).post(`/api/bookings/${id}/review`).set(as()).send(review)).status,
    ).toBe(409);
    const list = (await request(app).get('/api/bookings').set(as())).body.bookings;
    expect(list[0]).toMatchObject({ charges_total: 180, aide: { full_name: 'Hal Jordan' } });
  });
  it('lets the Manong back out before starting, reopening the request', async () => {
    const { offer } = (await aide('/offers', { aide_id: arthur })).body ?? {};
    expect(offer).toBeUndefined(); // closed while Hal is booked
    const out = await aide('/withdraw', { aide_id: hal });
    expect(out.body.booking).toMatchObject({
      status: S.REQUESTED,
      aide_id: null,
      agreed_price: null,
    });
    expect(store.offers[0].status).toBe('withdrawn');
    expect((await aide('/offers', { aide_id: arthur, price: 520 })).status).toBe(201);
    expect((await aide('/withdraw', { aide_id: hal })).status).toBe(409);
  });
  it('validates aide input', async () => {
    expect(
      (await aide('/charges', { aide_id: hal, label: '', amount: 0 })).body.error.fields,
    ).toEqual({
      label: expect.any(String),
      amount: expect.any(String),
    });
    expect(
      (await aide('/progress', { aide_id: 'nope', aide_status: 'arrived' }, 'patch')).body.error
        .fields,
    ).toHaveProperty('aide_id');
    expect((await request(app).get('/api/mock-aide/aides')).body.aides).toHaveLength(2);
  });
});

describe('DELETE /api/mock-aide/bookings (clean sweep)', () => {
  it('needs the typed confirmation, then deletes every booking with its offers', async () => {
    await aide('/offers', { aide_id: hal });
    const sweep = (body) => request(app).delete('/api/mock-aide/bookings').send(body);
    expect((await sweep({})).body.error.fields).toHaveProperty('confirm');
    expect(store.bookings).toHaveLength(1);
    expect((await sweep({ confirm: 'DELETE' })).body).toEqual({ deleted: 1 });
    expect([store.bookings.length, store.offers.length]).toEqual([0, 0]);
    // Residents keep their accounts; the deleted booking just reads as missing.
    expect((await request(app).get(`/api/bookings/${id}`).set(as())).status).toBe(404);
    expect((await request(app).get('/api/me').set(as())).status).toBe(200);
    const off = createApp({ store, secret: () => SECRET });
    expect(
      (await request(off).delete('/api/mock-aide/bookings').send({ confirm: 'DELETE' })).status,
    ).toBe(404);
  });
});

describe('POST /api/auth/google-debug', () => {
  it('signs in as the demo resident Enzo Santos, or says the account is missing', async () => {
    expect((await request(app).post('/api/auth/google-debug')).status).toBe(404);
    await request(app)
      .post('/api/auth/register')
      .send({
        ...juan,
        email: 'enzo.demo@example.com',
        mobile_number: '0917 555 0142',
        full_name: 'Enzo Santos',
      });
    const res = await request(app).post('/api/auth/google-debug');
    expect(res.body.resident.full_name).toBe('Enzo Santos');
    const me = await request(app)
      .get('/api/me')
      .set({ Authorization: `Bearer ${res.body.token}` });
    expect(me.body.resident.email).toBe('enzo.demo@example.com');
  });
});
