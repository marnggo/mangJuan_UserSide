// In-memory stand-in for src/server/store.js, so API tests never touch the shared database
// (CI plan §3.3). It keeps the same rules the SQL enforces: unique email and mobile, one default unit,
// units and bookings scoped to their resident, and a status change that only happens from an allowed state.
import { randomUUID } from 'node:crypto';

const OPEN = ['Requested', 'Pending Confirmation'];
const ASSIGNED = ['Accepted', 'Confirmed'];
const p = (category, service_type, base_price, price_is_minimum = false) => ({
  category,
  service_type,
  base_price,
  price_is_minimum,
});

export function memoryStore() {
  const residents = [];
  const bookings = [];
  const units = [];
  // A small slice of migration 003's seed, plus an inactive category.
  const categories = [
    { key: 'plumbing', name: 'Plumbing', description: 'Leaks', is_active: true },
    { key: 'cleaning', name: 'Cleaning', description: 'Unit cleaning', is_active: true },
    { key: 'retired', name: 'Retired', description: '', is_active: false },
  ];
  const prices = [
    p('plumbing', 'CHECKUP', 250),
    p('plumbing', 'STANDARD', 450),
    p('plumbing', 'MAJOR', 800, true),
    p('cleaning', 'STANDARD', 1200),
    p('retired', 'CHECKUP', 100),
  ];
  // Two of the Manongs (migration 004, renamed by 005).
  const aides = [
    { id: randomUUID(), key: 'hal', full_name: 'Hal Jordan', categories: ['plumbing'] },
    { id: randomUUID(), key: 'arthur', full_name: 'Arthur Curry', categories: ['plumbing'] },
  ];
  const aideById = (id) => aides.find((a) => a.id === id) ?? null;
  const offers = [];
  const charges = [];
  const messages = [];
  const without = (key) => (row) =>
    Object.fromEntries(Object.entries(row).filter(([k]) => k !== key));
  const pub = without('password_hash');
  const own = without('resident_id');
  const now = () => new Date().toISOString();
  const mine = (resident_id) => units.filter((u) => u.resident_id === resident_id);
  const taken = (r, id) => {
    for (const k of ['email', 'mobile_number'])
      if (r[k] !== undefined && residents.some((x) => x.id !== id && x[k] === r[k]))
        throw Object.assign(new Error('duplicate'), { taken: k });
  };
  return {
    residents,
    bookings,
    units,
    categories,
    aides,
    offers,
    charges,
    async ping() {},
    async createResident(r) {
      taken(r);
      const row = { id: randomUUID(), is_verified_email: false, is_verified_number: false, ...r };
      residents.push(row);
      return pub(row);
    },
    async findResidentForLogin({ email, mobile_number }) {
      return (
        residents.find((r) => (email ? r.email === email : r.mobile_number === mobile_number)) ??
        null
      );
    },
    async findResident(id) {
      const r = residents.find((x) => x.id === id);
      return r ? pub(r) : null;
    },
    async updateResident(id, fields) {
      const r = residents.find((x) => x.id === id);
      if (!r) return null;
      taken(fields, id);
      Object.assign(r, fields);
      return pub(r);
    },

    async listUnits(resident_id) {
      return mine(resident_id)
        .sort((a, b) => b.is_default - a.is_default)
        .map(own);
    },
    async findUnit(resident_id, id) {
      const u = mine(resident_id).find((x) => x.id === id);
      return u ? own(u) : null;
    },
    async createUnit(resident_id, u, max) {
      const list = mine(resident_id);
      if (list.length >= max) return null;
      const is_default = !list.length || u.is_default === true;
      if (is_default) list.forEach((x) => (x.is_default = false));
      const row = {
        id: randomUUID(),
        resident_id,
        ...Object.fromEntries(
          ['building', 'tower', 'floor', 'unit_number', 'street', 'city', 'notes'].map((k) => [
            k,
            u[k] ?? '',
          ]),
        ),
        is_default,
        created_at: now(),
        updated_at: now(),
      };
      units.push(row);
      return own(row);
    },
    async updateUnit(resident_id, id, u) {
      const row = mine(resident_id).find((x) => x.id === id);
      if (!row) return null;
      if (u.is_default === true) mine(resident_id).forEach((x) => (x.is_default = false));
      Object.assign(row, u, { updated_at: now() });
      return own(row);
    },
    async deleteUnit(resident_id, id) {
      const i = units.findIndex((x) => x.id === id && x.resident_id === resident_id);
      if (i < 0) return false;
      units.splice(i, 1);
      bookings.forEach((b) => b.unit_id === id && (b.unit_id = null));
      return true;
    },

    async listCatalog() {
      return {
        categories: categories.filter((c) => c.is_active).map(without('is_active')),
        prices,
      };
    },
    async findPrice(category, service_type) {
      const active = categories.some((c) => c.key === category && c.is_active);
      const hit = prices.find((x) => x.category === category && x.service_type === service_type);
      return active && hit
        ? { base_price: hit.base_price, price_is_minimum: hit.price_is_minimum }
        : null;
    },

    async createBooking(resident_id, b) {
      const row = {
        id: randomUUID(),
        resident_id,
        aide_id: null,
        agreed_price: null,
        aide_status: null,
        eta_minutes: null,
        reviewed_at: null,
        tip: null,
        ...b,
        created_at: now(),
        updated_at: now(),
      };
      bookings.unshift(row);
      return own(row);
    },
    async listBookings(resident_id) {
      return bookings
        .filter((b) => b.resident_id === resident_id)
        .map((b) => ({
          ...own(b),
          aide: aideById(b.aide_id),
          charges_total: charges
            .filter((c) => c.booking_id === b.id && c.status === 'approved')
            .reduce((a, c) => a + c.amount, 0),
        }));
    },
    async bookingDetail(resident_id, id) {
      const b = bookings.find((x) => x.id === id && x.resident_id === resident_id);
      if (!b) return null;
      return {
        booking: own(b),
        aide: aideById(b.aide_id),
        offers: offers
          .filter((o) => o.booking_id === id)
          .map((o) => ({ ...o, aide: aideById(o.aide_id) })),
        charges: charges.filter((c) => c.booking_id === id),
        messages: messages.filter((m) => m.booking_id === id && m.aide_id === b.aide_id),
      };
    },
    async raiseOffer(resident_id, id, price) {
      const b = bookings.find((x) => x.id === id && x.resident_id === resident_id);
      if (!b || b.aide_id || !OPEN.includes(b.status) || (b.price_offer ?? -1) >= price)
        return null;
      b.price_offer = price;
      return own(b);
    },
    async acceptOffer(resident_id, bookingId, offerId) {
      const b = bookings.find((x) => x.id === bookingId && x.resident_id === resident_id);
      const o = b && offers.find((x) => x.id === offerId && x.booking_id === bookingId);
      if (!o) return { error: 'NOT_FOUND' };
      if (b.aide_id || !OPEN.includes(b.status) || o.status !== 'open') return { error: 'CLOSED' };
      offers
        .filter((x) => x.booking_id === bookingId && x.status === 'open')
        .forEach((x) => (x.status = x.id === offerId ? 'accepted' : 'expired'));
      Object.assign(b, {
        aide_id: o.aide_id,
        agreed_price: o.price,
        status: b.booking_type === 'scheduled' ? 'Confirmed' : 'Accepted',
      });
      return { booking: own(b) };
    },
    async declineOffer(resident_id, bookingId, offerId) {
      const b = bookings.find((x) => x.id === bookingId && x.resident_id === resident_id);
      const o = b && offers.find((x) => x.id === offerId && x.booking_id === bookingId);
      if (!o || o.status !== 'open') return false;
      o.status = 'declined';
      return true;
    },
    async decideCharge(resident_id, bookingId, chargeId, approved) {
      const b = bookings.find((x) => x.id === bookingId && x.resident_id === resident_id);
      const c = b && charges.find((x) => x.id === chargeId && x.booking_id === bookingId);
      if (!c || c.status !== 'pending') return null;
      c.status = approved ? 'approved' : 'declined';
      return c;
    },
    async addMessage(m) {
      const row = { id: randomUUID(), ...m, created_at: now() };
      messages.push(row);
      return row;
    },
    async saveReview(resident_id, id, r) {
      const b = bookings.find((x) => x.id === id && x.resident_id === resident_id);
      if (!b || b.status !== 'Completed' || b.reviewed_at) return null;
      Object.assign(b, r, {
        payment_method: r.payment_method ?? b.payment_method,
        reviewed_at: now(),
      });
      return own(b);
    },
    async findBooking(resident_id, id) {
      const b = bookings.find((x) => x.id === id && x.resident_id === resident_id);
      return b ? own(b) : null;
    },
    async setBookingStatus(resident_id, id, from, to) {
      const b = bookings.find(
        (x) => x.id === id && x.resident_id === resident_id && from.includes(x.status),
      );
      if (!b) return null;
      b.status = to;
      return own(b);
    },

    async aideList() {
      return aides;
    },
    async findAide(id) {
      return aideById(id);
    },
    async aideListBookings() {
      return bookings.map((b) => {
        const r = residents.find((x) => x.id === b.resident_id);
        const of = (rows) => rows.filter((x) => x.booking_id === b.id);
        return {
          ...own(b),
          resident_name: r.full_name,
          resident_mobile: r.mobile_number,
          unit_notes: units.find((u) => u.id === b.unit_id)?.notes ?? null,
          aide: aideById(b.aide_id),
          offers: of(offers),
          charges: of(charges),
          messages: of(messages),
        };
      });
    },
    async aideDeleteAllBookings() {
      const n = bookings.length;
      for (const rows of [bookings, offers, charges, messages]) rows.splice(0);
      return n;
    },
    async aideMakeOffer(booking_id, aide_id, price, kind) {
      const b = bookings.find((x) => x.id === booking_id);
      if (!b || b.aide_id || !OPEN.includes(b.status)) return null;
      if (offers.some((o) => o.booking_id === booking_id && o.aide_id === aide_id)) return null;
      const row = { id: randomUUID(), booking_id, aide_id, price, kind, status: 'open' };
      offers.push(row);
      return row;
    },
    async aideSetProgress(id, aide_id, { aide_status, eta_minutes }) {
      const b = bookings.find((x) => x.id === id && x.aide_id === aide_id);
      if (!b || !ASSIGNED.includes(b.status)) return null;
      Object.assign(b, { aide_status, eta_minutes });
      return own(b);
    },
    async aideWithdraw(id, aide_id) {
      const b = bookings.find((x) => x.id === id && x.aide_id === aide_id);
      if (!b || !ASSIGNED.includes(b.status)) return null;
      Object.assign(b, {
        aide_id: null,
        agreed_price: null,
        aide_status: null,
        eta_minutes: null,
        status: b.booking_type === 'scheduled' ? 'Pending Confirmation' : 'Requested',
      });
      for (const o of offers.filter((x) => x.booking_id === id)) {
        if (o.aide_id === aide_id) o.status = 'withdrawn';
        else if (o.status === 'expired') o.status = 'open';
      }
      charges
        .filter((c) => c.booking_id === id && c.aide_id === aide_id && c.status === 'pending')
        .forEach((c) => (c.status = 'declined'));
      return own(b);
    },
    async aideAddCharge(id, aide_id, { label, amount }) {
      const b = bookings.find((x) => x.id === id && x.aide_id === aide_id);
      if (!b || ![...ASSIGNED, 'In Progress'].includes(b.status)) return null;
      const row = { id: randomUUID(), booking_id: id, aide_id, label, amount, status: 'pending' };
      charges.push(row);
      return row;
    },
    async aideFindBooking(id) {
      const b = bookings.find((x) => x.id === id);
      return b ? own(b) : null;
    },
    async aideSetStatus(id, from, to) {
      const b = bookings.find((x) => x.id === id && x.status === from);
      if (!b) return null;
      b.status = to;
      return own(b);
    },
  };
}
