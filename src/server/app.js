import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  hashPassword,
  signToken,
  validateLogin,
  validateProfile,
  validateRegister,
  verifyPassword,
  verifyToken,
} from '../services/auth.js';
import { buildCatalog, CANCELLABLE, validateBooking } from '../services/bookings.js';
import {
  billTotal,
  validateCharge,
  validateMessage,
  validateOffer,
  validateProgress,
  validateRaise,
  validateReview,
} from '../services/offers.js';
import { formatUnitAddress, MAX_UNITS, validateUnit } from '../services/units.js';
import { BOOKING_STATES, canTransition } from '../utils/contract.js';
import { getDb } from './db.js';
import { pgStore } from './store.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROTOTYPE_DIR = fileURLToPath(new URL('../web', import.meta.url));
const MOCK_AIDE_DIR = fileURLToPath(new URL('../mock-aide', import.meta.url));
// Compared against when the account doesn't exist, so a wrong number takes as long as a wrong password.
const DUMMY_HASH = hashPassword('no such resident');
const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';
// The demo resident "Continue with Google" signs in as (Enzo Santos, db/seed.js).
const DEBUG_RESIDENT_MOBILE = '+639175550142';

const fail = (res, status, code, message, fields) =>
  res.status(status).json({ error: { code, message, ...(fields && { fields }) } });
const publicResident = (r) => ({
  id: r.id,
  email: r.email,
  mobile_number: r.mobile_number,
  full_name: r.full_name,
  is_verified_email: Boolean(r.is_verified_email),
  is_verified_number: Boolean(r.is_verified_number),
});
function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters');
  return s;
}

// Fixed-window counter per key (open item 18). Used per IP for the sign-in routes, and per account
// for wrong passwords, so guessing one account's password is slow even from many addresses.
// shortcut: counts in memory, so it resets on restart and isn't shared between instances. Move it to
// the database or the host's limiter when the app runs on more than one instance.
function counter(max, windowMs) {
  const hits = new Map();
  return {
    // Seconds left in the window once `max` is reached, else 0.
    wait(key) {
      const h = hits.get(key),
        now = Date.now();
      return h && h.reset > now && h.n >= max ? Math.ceil((h.reset - now) / 1000) : 0;
    },
    add(key) {
      const now = Date.now();
      if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      const h = hits.get(key);
      if (!h || h.reset <= now) hits.set(key, { n: 1, reset: now + windowMs });
      else h.n++;
    },
    clear: (key) => hits.delete(key),
  };
}
const tooMany = (res, seconds) => {
  res.set('Retry-After', String(seconds));
  return fail(res, 429, 'TOO_MANY_REQUESTS', TOO_MANY);
};

// `store` and `secret` can be replaced in tests. The default store reaches the database lazily, so
// routes that don't need it (health, the static prototype) work without DATABASE_URL.
export function createApp({
  store = pgStore(getDb),
  secret = jwtSecret,
  authLimit = 30,
  loginFailLimit = 5,
  // Dev-only stand-in for Team 2's aide app. It sees every booking, so it must stay off anywhere real
  // residents' data lives. Its API needs mockAideKey in the X-Mock-Aide-Key header.
  mockAide = process.env.MOCK_AIDE === '1',
  mockAideKey = process.env.MOCK_AIDE_KEY,
} = {}) {
  const app = express();
  app.set('trust proxy', 1); // one proxy in front on the host, so req.ip is the client's address
  app.disable('x-powered-by');
  // The login token sits in localStorage, so the CSP is what stops an injected script from reading it.
  // 'unsafe-inline' for styles only: the prototype renders style="" attributes.
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; " +
        "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; " +
        "manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    });
    next();
  });
  app.use(express.json({ limit: '20kb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  // Says whether the database answers. On failure it gives the driver's error code only (for example
  // ENETUNREACH or 28P01), never the message, which can hold the host name.
  app.get('/api/health/db', async (req, res) => {
    try {
      await store.ping();
      res.json({ status: 'ok' });
    } catch (e) {
      res
        .status(503)
        .json({ status: 'down', code: String(e.code ?? e.name ?? 'UNKNOWN').slice(0, 40) });
    }
  });

  const auth = express.Router();
  const perIp = counter(authLimit, 10 * 60 * 1000);
  // 5 wrong passwords for one email or number lock it for 15 minutes. Unknown accounts count the same
  // way, so the lock doesn't reveal which accounts exist.
  const perAccount = counter(loginFailLimit, 15 * 60 * 1000);
  auth.use((req, res, next) => {
    const wait = perIp.wait(req.ip);
    if (wait) return tooMany(res, wait);
    perIp.add(req.ip);
    next();
  });
  auth.post('/register', async (req, res) => {
    const { value, fields } = validateRegister(req.body);
    if (fields)
      return fail(res, 400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', fields);
    const { password, ...rest } = value;
    try {
      // shortcut: no email or SMS service yet (open items 15, 24), so new accounts are marked verified
      // on both. Set these to false once the verification links and codes are sent.
      const resident = await store.createResident({
        ...rest,
        password_hash: await hashPassword(password),
        is_verified_email: true,
        is_verified_number: true,
      });
      res
        .status(201)
        .json({ token: signToken(resident.id, secret()), resident: publicResident(resident) });
    } catch (e) {
      if (e.taken === 'email')
        return fail(res, 409, 'EMAIL_TAKEN', 'An account with this email address already exists.');
      if (e.taken === 'mobile_number')
        return fail(res, 409, 'MOBILE_TAKEN', 'An account with this mobile number already exists.');
      throw e;
    }
  });
  auth.post('/login', async (req, res) => {
    const { value, fields } = validateLogin(req.body);
    if (fields)
      return fail(res, 400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', fields);
    const account = value.email ?? value.mobile_number;
    const wait = perAccount.wait(account);
    if (wait) return tooMany(res, wait);
    const resident = await store.findResidentForLogin(value);
    const ok = await verifyPassword(
      value.password,
      resident ? resident.password_hash : await DUMMY_HASH,
    );
    if (ok) perAccount.clear(account);
    else perAccount.add(account);
    if (!resident || !ok)
      return fail(
        res,
        401,
        'INVALID_CREDENTIALS',
        `Incorrect ${value.email ? 'email' : 'mobile number'} or password. Please try again.`,
      );
    res.json({ token: signToken(resident.id, secret()), resident: publicResident(resident) });
  });
  // Debug sign-in: "Continue with Google" logs in as Enzo Santos with no password, and the app then
  // works on his real database rows. shortcut: on everywhere at marn's request (2026-11-14), so anyone
  // can open Enzo's account. Replace with real Google sign-in before real residents use the app (open item 40).
  auth.post('/google-debug', async (req, res) => {
    const resident = await store.findResidentForLogin({ mobile_number: DEBUG_RESIDENT_MOBILE });
    if (!resident)
      return fail(res, 404, 'NOT_FOUND', 'The debug account is missing. Run npm run seed.');
    res.json({ token: signToken(resident.id, secret()), resident: publicResident(resident) });
  });
  app.use('/api/auth', auth);

  // U03, U05, U06: categories, each with its service types, durations and base prices. Public, so the
  // app can show them before log-in (guest browsing, open item 27).
  app.get('/api/categories', async (req, res) => {
    const { categories, prices } = await store.listCatalog();
    res.json({ categories: buildCatalog(categories, prices) });
  });

  // Everything below needs a valid access token.
  const requireResident = (req, res, next) => {
    const [scheme, token] = String(req.get('authorization') ?? '').split(' ');
    const payload = scheme === 'Bearer' && token ? verifyToken(token, secret()) : null;
    if (!payload) return fail(res, 401, 'UNAUTHENTICATED', 'Please log in again.');
    req.residentId = payload.sub;
    next();
  };

  app.get('/api/me', requireResident, async (req, res) => {
    const resident = await store.findResident(req.residentId);
    if (!resident) return fail(res, 401, 'UNAUTHENTICATED', 'Please log in again.');
    res.json({ resident: publicResident(resident) });
  });
  const badFields = (res, fields) =>
    fail(res, 400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', fields);

  // U02 profile. shortcut: a changed email or number stays verified, like a new sign-up (open items
  // 15, 24). Reset the flags here once verification messages are sent.
  app.patch('/api/me', requireResident, async (req, res) => {
    const { value, fields } = validateProfile(req.body);
    if (fields) return badFields(res, fields);
    try {
      const resident = await store.updateResident(req.residentId, value);
      if (!resident) return fail(res, 401, 'UNAUTHENTICATED', 'Please log in again.');
      res.json({ resident: publicResident(resident) });
    } catch (e) {
      if (e.taken === 'email')
        return fail(res, 409, 'EMAIL_TAKEN', 'An account with this email address already exists.');
      if (e.taken === 'mobile_number')
        return fail(res, 409, 'MOBILE_TAKEN', 'An account with this mobile number already exists.');
      throw e;
    }
  });

  // U02 saved condo units. Someone else's unit answers the same as a missing one.
  const unitNotFound = (res) => fail(res, 404, 'NOT_FOUND', 'Unit not found.');
  app.get('/api/me/units', requireResident, async (req, res) => {
    res.json({ units: await store.listUnits(req.residentId) });
  });
  app.post('/api/me/units', requireResident, async (req, res) => {
    const { value, fields } = validateUnit(req.body);
    if (fields) return badFields(res, fields);
    const unit = await store.createUnit(req.residentId, value, MAX_UNITS);
    if (!unit) return fail(res, 409, 'TOO_MANY_UNITS', `You can save up to ${MAX_UNITS} units.`);
    res.status(201).json({ unit });
  });
  app.patch('/api/me/units/:id', requireResident, async (req, res) => {
    if (!UUID.test(req.params.id)) return unitNotFound(res);
    const { value, fields } = validateUnit(req.body, { partial: true });
    if (fields) return badFields(res, fields);
    const unit = await store.updateUnit(req.residentId, req.params.id, value);
    if (!unit) return unitNotFound(res);
    res.json({ unit });
  });
  app.delete('/api/me/units/:id', requireResident, async (req, res) => {
    if (!UUID.test(req.params.id) || !(await store.deleteUnit(req.residentId, req.params.id)))
      return unitNotFound(res);
    res.status(204).end();
  });

  // U04 to U06: the booking keeps the problem, symptoms and the base price shown at booking time.
  app.post('/api/bookings', requireResident, async (req, res) => {
    const { value, fields } = validateBooking(req.body);
    if (fields) return badFields(res, fields);
    const price = await store.findPrice(value.category, value.service_type);
    if (!price) return badFields(res, { category: 'This service is not available.' });
    if (value.unit_id) {
      const unit = await store.findUnit(req.residentId, value.unit_id);
      if (!unit) return badFields(res, { unit_id: 'Choose one of your saved units.' });
      value.address = formatUnitAddress(unit);
    }
    const booking = await store.createBooking(req.residentId, {
      ...value,
      base_price: price.base_price,
    });
    res.status(201).json({ booking });
  });
  app.get('/api/bookings', requireResident, async (req, res) => {
    res.json({ bookings: await store.listBookings(req.residentId) });
  });
  app.patch('/api/bookings/:id/cancel', requireResident, async (req, res) => {
    const { id } = req.params;
    const notFound = () => fail(res, 404, 'NOT_FOUND', 'Booking not found.');
    if (!UUID.test(id)) return notFound();
    const booking = await store.setBookingStatus(
      req.residentId,
      id,
      CANCELLABLE,
      BOOKING_STATES.CANCELLED,
    );
    if (booking) return res.json({ booking });
    // Someone else's booking looks the same as a missing one.
    if (!(await store.findBooking(req.residentId, id))) return notFound();
    fail(res, 409, 'CANNOT_CANCEL', 'This booking can no longer be cancelled.');
  });

  // After the request: offers, chat, extra charges and the rating. Every :id must be the caller's.
  const bookingNotFound = (res) => fail(res, 404, 'NOT_FOUND', 'Booking not found.');
  const validIds = (req, res) => {
    const ok = Object.values(req.params).every((v) => UUID.test(v));
    if (!ok) bookingNotFound(res);
    return ok;
  };
  // Polled by the app while a booking is open (U12): status, Manong, offers, charges, chat, total.
  app.get('/api/bookings/:id', requireResident, async (req, res) => {
    if (!validIds(req, res)) return;
    const d = await store.bookingDetail(req.residentId, req.params.id);
    if (!d) return bookingNotFound(res);
    res.json({ ...d, total: billTotal(d.booking, d.charges) });
  });
  app.patch('/api/bookings/:id/offer', requireResident, async (req, res) => {
    if (!validIds(req, res)) return;
    const current = await store.findBooking(req.residentId, req.params.id);
    if (!current) return bookingNotFound(res);
    const { value, fields } = validateRaise(req.body, current.price_offer);
    if (fields) return badFields(res, fields);
    const booking = await store.raiseOffer(req.residentId, req.params.id, value.price_offer);
    if (!booking)
      return fail(res, 409, 'CANNOT_RAISE', 'A Manong is already booked for this request.');
    res.json({ booking });
  });
  app.post('/api/bookings/:id/offers/:offerId/accept', requireResident, async (req, res) => {
    if (!validIds(req, res)) return;
    const r = await store.acceptOffer(req.residentId, req.params.id, req.params.offerId);
    if (r.error === 'NOT_FOUND') return fail(res, 404, 'NOT_FOUND', 'Offer not found.');
    if (r.error) return fail(res, 409, 'OFFER_CLOSED', 'This offer is no longer available.');
    res.json({ booking: r.booking });
  });
  app.post('/api/bookings/:id/offers/:offerId/decline', requireResident, async (req, res) => {
    if (!validIds(req, res)) return;
    if (!(await store.declineOffer(req.residentId, req.params.id, req.params.offerId)))
      return fail(res, 404, 'NOT_FOUND', 'Offer not found.');
    res.status(204).end();
  });
  app.post('/api/bookings/:id/messages', requireResident, async (req, res) => {
    if (!validIds(req, res)) return;
    const booking = await store.findBooking(req.residentId, req.params.id);
    if (!booking) return bookingNotFound(res);
    if (!booking.aide_id) return fail(res, 409, 'NO_MANONG', 'Chat opens once a Manong is booked.');
    const { value, fields } = validateMessage(req.body);
    if (fields) return badFields(res, fields);
    const message = await store.addMessage({
      booking_id: booking.id,
      aide_id: booking.aide_id,
      sender: 'resident',
      body: value.body,
    });
    res.status(201).json({ message });
  });
  // U14: approve or decline a part the Manong added.
  app.patch('/api/bookings/:id/charges/:chargeId', requireResident, async (req, res) => {
    if (!validIds(req, res)) return;
    if (typeof req.body?.approved !== 'boolean')
      return badFields(res, { approved: 'Use true or false.' });
    const { id, chargeId } = req.params;
    const charge = await store.decideCharge(req.residentId, id, chargeId, req.body.approved);
    if (!charge) return fail(res, 404, 'NOT_FOUND', 'No pending charge with that id.');
    res.json({ charge });
  });
  // U16, U17: rate, tip and close a completed job.
  app.post('/api/bookings/:id/review', requireResident, async (req, res) => {
    if (!validIds(req, res)) return;
    const { value, fields } = validateReview(req.body);
    if (fields) return badFields(res, fields);
    const booking = await store.saveReview(req.residentId, req.params.id, value);
    if (booking) return res.json({ booking });
    if (!(await store.findBooking(req.residentId, req.params.id))) return bookingNotFound(res);
    fail(res, 409, 'CANNOT_REVIEW', 'You can rate a job once, after it is completed.');
  });

  // Mock Mang Juan aide side, for testing the resident flow without Team 2's app. One shared key
  // (MOCK_AIDE_KEY) instead of a login; the page says which Manong it acts as in each request (aide_id).
  if (mockAide) {
    const S = BOOKING_STATES;
    const hash = (v) => createHash('sha256').update(String(v)).digest();
    const keyFails = counter(10, 15 * 60 * 1000);
    // The page itself holds no data, so only the API is locked. No key set means locked, never open.
    app.use('/api/mock-aide', (req, res, next) => {
      if (!mockAideKey)
        return fail(res, 503, 'MOCK_AIDE_KEY_MISSING', 'Set MOCK_AIDE_KEY on the server first.');
      const wait = keyFails.wait(req.ip);
      if (wait) return tooMany(res, wait);
      if (!timingSafeEqual(hash(req.get('x-mock-aide-key') ?? ''), hash(mockAideKey))) {
        keyFails.add(req.ip);
        return fail(res, 401, 'BAD_MOCK_AIDE_KEY', 'Wrong mock aide password.');
      }
      next();
    });
    const aideOf = async (req, res) => {
      const id = req.body?.aide_id;
      const aide = typeof id === 'string' && UUID.test(id) ? await store.findAide(id) : null;
      if (!aide) badFields(res, { aide_id: 'Choose which Manong you are.' });
      return aide;
    };
    const aideBooking = async (req, res) => {
      const b = UUID.test(req.params.id) ? await store.aideFindBooking(req.params.id) : null;
      if (!b) bookingNotFound(res);
      return b;
    };
    const notYours = (res) =>
      fail(res, 409, 'NOT_YOUR_JOB', 'Only the Manong booked for this job can do that.');

    app.get('/api/mock-aide/aides', async (req, res) => {
      res.json({ aides: await store.aideList() });
    });
    app.get('/api/mock-aide/bookings', async (req, res) => {
      res.json({ bookings: await store.aideListBookings() });
    });
    // Clean sweep so the free database doesn't fill up with test bookings. Irreversible, so the body
    // must say { confirm: 'DELETE' }.
    app.delete('/api/mock-aide/bookings', async (req, res) => {
      if (req.body?.confirm !== 'DELETE')
        return badFields(res, { confirm: 'Send confirm: "DELETE" to delete every booking.' });
      res.json({ deleted: await store.aideDeleteAllBookings() });
    });
    // Take the resident's price (no price, or the same price) or counter it. One answer per Manong.
    app.post('/api/mock-aide/bookings/:id/offers', async (req, res) => {
      const { value, fields } = validateOffer(req.body);
      if (fields) return badFields(res, fields);
      const aide = await aideOf(req, res);
      if (!aide) return;
      const booking = await aideBooking(req, res);
      if (!booking) return;
      const asked = booking.price_offer ?? booking.base_price;
      const price = value.price ?? asked;
      if (price == null) return badFields(res, { price: 'Name your price.' });
      const kind = price === asked ? 'accept' : 'counter';
      const offer = await store.aideMakeOffer(booking.id, aide.id, price, kind);
      if (!offer)
        return fail(res, 409, 'CANNOT_OFFER', 'You already answered, or the request is closed.');
      res.status(201).json({ offer });
    });
    // Start, finish (the Manong confirms the job is done), or decline a request nobody can take.
    app.patch('/api/mock-aide/bookings/:id/status', async (req, res) => {
      const to = req.body?.status;
      const booking = await aideBooking(req, res);
      if (!booking) return;
      if (
        ![S.IN_PROGRESS, S.COMPLETED, S.DECLINED].includes(to) ||
        !canTransition(booking.booking_type, booking.status, to)
      )
        return fail(
          res,
          409,
          'BAD_TRANSITION',
          `A ${booking.booking_type} booking can't go from ${booking.status} to ${to}.`,
        );
      if (to === S.DECLINED) {
        if (booking.aide_id) return notYours(res);
      } else {
        const aide = await aideOf(req, res);
        if (!aide) return;
        if (booking.aide_id !== aide.id) return notYours(res);
      }
      const moved = await store.aideSetStatus(booking.id, booking.status, to);
      if (!moved) return fail(res, 409, 'STALE', 'The booking changed. Refresh and try again.');
      res.json({ booking: moved });
    });
    app.patch('/api/mock-aide/bookings/:id/progress', async (req, res) => {
      const { value, fields } = validateProgress(req.body);
      if (fields) return badFields(res, fields);
      const aide = await aideOf(req, res);
      if (!aide) return;
      const booking = await aideBooking(req, res);
      if (!booking) return;
      const moved = await store.aideSetProgress(booking.id, aide.id, value);
      if (!moved) return notYours(res);
      res.json({ booking: moved });
    });
    // The booked Manong cancels before starting; the request goes back to waiting for offers.
    app.post('/api/mock-aide/bookings/:id/withdraw', async (req, res) => {
      const aide = await aideOf(req, res);
      if (!aide) return;
      const booking = await aideBooking(req, res);
      if (!booking) return;
      const moved = await store.aideWithdraw(booking.id, aide.id);
      if (!moved) return notYours(res);
      res.json({ booking: moved });
    });
    app.post('/api/mock-aide/bookings/:id/charges', async (req, res) => {
      const { value, fields } = validateCharge(req.body);
      if (fields) return badFields(res, fields);
      const aide = await aideOf(req, res);
      if (!aide) return;
      const booking = await aideBooking(req, res);
      if (!booking) return;
      const charge = await store.aideAddCharge(booking.id, aide.id, value);
      if (!charge) return notYours(res);
      res.status(201).json({ charge });
    });
    app.post('/api/mock-aide/bookings/:id/messages', async (req, res) => {
      const { value, fields } = validateMessage(req.body);
      if (fields) return badFields(res, fields);
      const aide = await aideOf(req, res);
      if (!aide) return;
      const booking = await aideBooking(req, res);
      if (!booking) return;
      if (booking.aide_id !== aide.id) return notYours(res);
      const message = await store.addMessage({
        booking_id: booking.id,
        aide_id: aide.id,
        sender: 'aide',
        body: value.body,
      });
      res.status(201).json({ message });
    });
  }

  app.use('/api', (req, res) => fail(res, 404, 'NOT_FOUND', 'No such endpoint.'));

  if (mockAide)
    app.use(
      '/mock-aide',
      express.static(MOCK_AIDE_DIR, { setHeaders: (res) => res.set('Cache-Control', 'no-cache') }),
    );

  // The prototype is the front end for now. Same origin as the API, so no CORS and no second host.
  app.use(
    express.static(PROTOTYPE_DIR, { setHeaders: (res) => res.set('Cache-Control', 'no-cache') }),
  );

  // Express 5 sends rejected async handlers here.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')
      return fail(res, 400, 'VALIDATION_ERROR', 'The request body is not valid JSON.');
    console.error(`${req.method} ${req.path}:`, err.message);
    fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  });
  return app;
}

// Exported without listen() so Supertest and the Vite dev server can mount it.
export const app = createApp();
