// SQL for residents, units, the service catalogue and bookings. Every query is parameterised. The app
// talks to this object only, so tests can swap in an in-memory store with the same methods
// (tests/helpers/memoryStore.js).
import { BOOKING_STATES, BOOKING_TYPES } from '../utils/contract.js';

const RESIDENT = 'id, email, mobile_number, full_name, is_verified_email, is_verified_number';
const BOOKING_COLS = [
  'id',
  'category',
  'service_type',
  'booking_type',
  'status',
  'scheduled_for',
  'address',
  'problem',
  'price_offer',
  'unit_id',
  'symptoms',
  'base_price',
  'payment_method',
  'aide_id',
  'agreed_price',
  'aide_status',
  'eta_minutes',
  'rating',
  'praise',
  'review',
  'tip',
  'reviewed_at',
  'created_at',
  'updated_at',
];
const BOOKING = BOOKING_COLS.join(', ');
const B = BOOKING_COLS.map((c) => `b.${c}`).join(', ');
// NUMERIC comes back from pg as a string; the cast keeps rating a number.
const AIDE =
  'id, key, full_name, skills, categories, rating::float AS rating, jobs_count, photo, vehicle';
const aideJson = (a) =>
  `CASE WHEN ${a}.id IS NULL THEN NULL ELSE json_build_object('id', ${a}.id, 'key', ${a}.key,
     'full_name', ${a}.full_name, 'skills', ${a}.skills, 'rating', ${a}.rating::float,
     'jobs_count', ${a}.jobs_count, 'photo', ${a}.photo, 'vehicle', ${a}.vehicle) END`;
const OFFER = 'id, booking_id, aide_id, price, kind, status, created_at';
const CHARGE = 'id, booking_id, aide_id, label, amount, status, created_at';
const MESSAGE = 'id, booking_id, aide_id, sender, body, created_at';
const OPEN = [BOOKING_STATES.REQUESTED, BOOKING_STATES.PENDING_CONFIRMATION];
const ASSIGNED = [BOOKING_STATES.ACCEPTED, BOOKING_STATES.CONFIRMED];
const UNIT_COLS = ['building', 'tower', 'floor', 'unit_number', 'street', 'city', 'notes'];
const UNIT = `id, ${UNIT_COLS.join(', ')}, is_default, created_at, updated_at`;
const duplicate = (e) =>
  Object.assign(new Error('duplicate resident'), {
    taken: /mobile|username/.test(String(e.constraint)) ? 'mobile_number' : 'email',
  });

export function pgStore(getDb) {
  const q = async (text, params) => (await getDb().query(text, params)).rows;
  // Runs fn(query) inside one transaction on one connection.
  async function tx(fn) {
    const c = await getDb().connect();
    try {
      await c.query('BEGIN');
      const out = await fn(async (text, params) => (await c.query(text, params)).rows);
      await c.query('COMMIT');
      return out;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  const one = async (text, params) => (await q(text, params))[0] ?? null;

  return {
    ping: () => q('SELECT 1'),
    // Throws { taken: 'email' | 'mobile_number' } when the unique check fails.
    // The live table has a required, unique `username` column that the U01 spec doesn't have (ICM open
    // item 33). Nothing collects a username yet, so it is filled with the mobile number.
    async createResident({
      email,
      mobile_number,
      password_hash,
      full_name,
      is_verified_email = false,
      is_verified_number = false,
    }) {
      try {
        const rows = await q(
          `INSERT INTO residents (email, mobile_number, password_hash, full_name, username, is_verified_email, is_verified_number)
           VALUES ($1, $2::text, $3, $4, $2::text, $5, $6) RETURNING ${RESIDENT}`,
          [email, mobile_number, password_hash, full_name, is_verified_email, is_verified_number],
        );
        return rows[0];
      } catch (e) {
        if (e.code === '23505') throw duplicate(e);
        throw e;
      }
    },
    // The only method that returns password_hash. It never leaves the server.
    findResidentForLogin({ email, mobile_number }) {
      return email
        ? one(`SELECT ${RESIDENT}, password_hash FROM residents WHERE email = $1`, [email])
        : one(`SELECT ${RESIDENT}, password_hash FROM residents WHERE mobile_number = $1`, [
            mobile_number,
          ]);
    },
    findResident(id) {
      return one(`SELECT ${RESIDENT} FROM residents WHERE id = $1`, [id]);
    },
    // U02. Throws { taken } like createResident. username follows the mobile number (open item 33),
    // or the old number would stay taken for the next person who registers it.
    async updateResident(id, { full_name, email, mobile_number }) {
      try {
        return await one(
          `UPDATE residents SET full_name = COALESCE($2, full_name), email = COALESCE($3, email),
             mobile_number = COALESCE($4::text, mobile_number), username = COALESCE($4::text, username),
             updated_at = now()
           WHERE id = $1 RETURNING ${RESIDENT}`,
          [id, full_name ?? null, email ?? null, mobile_number ?? null],
        );
      } catch (e) {
        if (e.code === '23505') throw duplicate(e);
        throw e;
      }
    },

    // U02 saved units. The default comes first.
    listUnits(residentId) {
      return q(
        `SELECT ${UNIT} FROM resident_units WHERE resident_id = $1 ORDER BY is_default DESC, created_at`,
        [residentId],
      );
    },
    findUnit(residentId, id) {
      return one(`SELECT ${UNIT} FROM resident_units WHERE id = $1 AND resident_id = $2`, [
        id,
        residentId,
      ]);
    },
    // Returns null when the resident already has `max` units. The first unit becomes the default.
    createUnit(residentId, u, max) {
      return tx(async (t) => {
        // Locks the resident row so two requests at once can't both pass the count.
        const [{ n }] = await t(
          `SELECT (SELECT count(*) FROM resident_units WHERE resident_id = $1)::int AS n
           FROM residents WHERE id = $1 FOR UPDATE`,
          [residentId],
        );
        if (n >= max) return null;
        const isDefault = n === 0 || u.is_default === true;
        if (isDefault)
          await t(`UPDATE resident_units SET is_default = false WHERE resident_id = $1`, [
            residentId,
          ]);
        const rows = await t(
          `INSERT INTO resident_units (resident_id, ${UNIT_COLS.join(', ')}, is_default)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${UNIT}`,
          [residentId, ...UNIT_COLS.map((k) => u[k] ?? ''), isDefault],
        );
        return rows[0];
      });
    },
    // Returns null when the unit isn't the resident's (and then changes nothing).
    updateUnit(residentId, id, u) {
      const cols = [...UNIT_COLS, 'is_default'].filter((k) => u[k] !== undefined);
      return tx(async (t) => {
        if (u.is_default === true)
          await t(
            `UPDATE resident_units SET is_default = false WHERE resident_id = $1 AND id <> $2`,
            [residentId, id],
          );
        const rows = await t(
          `UPDATE resident_units SET ${cols.map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = now()
           WHERE id = $1 AND resident_id = $2 RETURNING ${UNIT}`,
          [id, residentId, ...cols.map((k) => u[k])],
        );
        // Not theirs: throwing rolls back the cleared default too.
        if (!rows[0]) throw Object.assign(new Error('no unit'), { notFound: true });
        return rows[0];
      }).catch((e) => {
        if (e.notFound) return null;
        throw e;
      });
    },
    // Old bookings keep their address text; their unit_id becomes NULL.
    async deleteUnit(residentId, id) {
      const rows = await q(
        `DELETE FROM resident_units WHERE id = $1 AND resident_id = $2 RETURNING id`,
        [id, residentId],
      );
      return rows.length > 0;
    },

    // U03, U06. Inactive categories are hidden from the catalogue and can't be booked.
    async listCatalog() {
      const [categories, prices] = await Promise.all([
        q(
          `SELECT key, name, description FROM service_categories WHERE is_active ORDER BY sort_order, name`,
        ),
        q(`SELECT category, service_type, base_price, price_is_minimum FROM service_prices`),
      ]);
      return { categories, prices };
    },
    findPrice(category, service_type) {
      return one(
        `SELECT p.base_price, p.price_is_minimum FROM service_prices p
         JOIN service_categories c ON c.key = p.category AND c.is_active
         WHERE p.category = $1 AND p.service_type = $2`,
        [category, service_type],
      );
    },

    async createBooking(residentId, b) {
      const rows = await q(
        `INSERT INTO bookings (resident_id, category, service_type, booking_type, status, scheduled_for, address, problem, price_offer, unit_id, symptoms, base_price, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING ${BOOKING}`,
        [
          residentId,
          b.category,
          b.service_type,
          b.booking_type,
          b.status,
          b.scheduled_for,
          b.address,
          b.problem,
          b.price_offer,
          b.unit_id,
          b.symptoms,
          b.base_price,
          b.payment_method ?? null,
        ],
      );
      return rows[0];
    },
    // U18. Each with its Manong and the approved extra charges, for history and receipts.
    listBookings(residentId) {
      return q(
        `SELECT ${B}, ${aideJson('a')} AS aide,
           (SELECT COALESCE(sum(c.amount), 0) FROM booking_charges c
            WHERE c.booking_id = b.id AND c.status = 'approved')::int AS charges_total
         FROM bookings b LEFT JOIN aides a ON a.id = b.aide_id
         WHERE b.resident_id = $1 ORDER BY b.created_at DESC LIMIT 100`,
        [residentId],
      );
    },
    // Everything the resident app polls for one booking. Chat shows only the current Manong's thread.
    async bookingDetail(residentId, id) {
      const booking = await one(
        `SELECT ${BOOKING} FROM bookings WHERE id = $1 AND resident_id = $2`,
        [id, residentId],
      );
      if (!booking) return null;
      const [aide, offers, charges, messages] = await Promise.all([
        booking.aide_id ? one(`SELECT ${AIDE} FROM aides WHERE id = $1`, [booking.aide_id]) : null,
        q(
          `SELECT o.id, o.price, o.kind, o.status, o.created_at, ${aideJson('a')} AS aide
           FROM booking_offers o JOIN aides a ON a.id = o.aide_id
           WHERE o.booking_id = $1 ORDER BY o.created_at`,
          [id],
        ),
        q(`SELECT ${CHARGE} FROM booking_charges WHERE booking_id = $1 ORDER BY created_at`, [id]),
        booking.aide_id
          ? q(
              `SELECT ${MESSAGE} FROM booking_messages WHERE booking_id = $1 AND aide_id = $2
               ORDER BY created_at LIMIT 200`,
              [id, booking.aide_id],
            )
          : [],
      ]);
      return { booking, aide, offers, charges, messages };
    },
    // "Need faster arrival?": only while nobody is assigned, and only upward.
    raiseOffer(residentId, id, price) {
      return one(
        `UPDATE bookings SET price_offer = $3, updated_at = now()
         WHERE id = $1 AND resident_id = $2 AND aide_id IS NULL AND status = ANY($4)
           AND (price_offer IS NULL OR price_offer < $3) RETURNING ${BOOKING}`,
        [id, residentId, price, OPEN],
      );
    },
    // Takes one Manong's offer: he is assigned at his price, the other open offers expire.
    // Returns { booking } or { error: 'NOT_FOUND' | 'CLOSED' }.
    acceptOffer(residentId, bookingId, offerId) {
      return tx(async (t) => {
        const [b] = await t(
          `SELECT booking_type, status, aide_id FROM bookings WHERE id = $1 AND resident_id = $2 FOR UPDATE`,
          [bookingId, residentId],
        );
        const [o] = b
          ? await t(
              `SELECT aide_id, price, status FROM booking_offers WHERE id = $1 AND booking_id = $2`,
              [offerId, bookingId],
            )
          : [];
        if (!o) return { error: 'NOT_FOUND' };
        if (b.aide_id || !OPEN.includes(b.status) || o.status !== 'open')
          return { error: 'CLOSED' };
        const to =
          b.booking_type === BOOKING_TYPES.SCHEDULED
            ? BOOKING_STATES.CONFIRMED
            : BOOKING_STATES.ACCEPTED;
        await t(
          `UPDATE booking_offers SET status = CASE WHEN id = $2 THEN 'accepted' ELSE 'expired' END, updated_at = now()
           WHERE booking_id = $1 AND (id = $2 OR status = 'open')`,
          [bookingId, offerId],
        );
        const [booking] = await t(
          `UPDATE bookings SET aide_id = $2, agreed_price = $3, status = $4, updated_at = now()
           WHERE id = $1 RETURNING ${BOOKING}`,
          [bookingId, o.aide_id, o.price, to],
        );
        return { booking };
      });
    },
    async declineOffer(residentId, bookingId, offerId) {
      const rows = await q(
        `UPDATE booking_offers o SET status = 'declined', updated_at = now() FROM bookings b
         WHERE o.id = $1 AND o.booking_id = $2 AND b.id = o.booking_id AND b.resident_id = $3 AND o.status = 'open'
         RETURNING o.id`,
        [offerId, bookingId, residentId],
      );
      return rows.length > 0;
    },
    // U14: the resident approves or declines a pending extra charge.
    decideCharge(residentId, bookingId, chargeId, approved) {
      return one(
        `UPDATE booking_charges c SET status = $4, updated_at = now() FROM bookings b
         WHERE c.id = $1 AND c.booking_id = $2 AND b.id = c.booking_id AND b.resident_id = $3 AND c.status = 'pending'
         RETURNING ${CHARGE.split(', ')
           .map((k) => `c.${k}`)
           .join(', ')}`,
        [chargeId, bookingId, residentId, approved ? 'approved' : 'declined'],
      );
    },
    addMessage({ booking_id, aide_id, sender, body }) {
      return one(
        `INSERT INTO booking_messages (booking_id, aide_id, sender, body) VALUES ($1, $2, $3, $4) RETURNING ${MESSAGE}`,
        [booking_id, aide_id, sender, body],
      );
    },
    // U16, U17: closes a completed booking with the rating, tip and payment method. Once only.
    saveReview(residentId, id, r) {
      return one(
        `UPDATE bookings SET rating = $3, praise = $4, review = $5, tip = $6,
           payment_method = COALESCE($7, payment_method), reviewed_at = now(), updated_at = now()
         WHERE id = $1 AND resident_id = $2 AND status = $8 AND reviewed_at IS NULL RETURNING ${BOOKING}`,
        [
          id,
          residentId,
          r.rating,
          r.praise,
          r.review,
          r.tip,
          r.payment_method,
          BOOKING_STATES.COMPLETED,
        ],
      );
    },
    findBooking(residentId, id) {
      return one(`SELECT ${BOOKING} FROM bookings WHERE id = $1 AND resident_id = $2`, [
        id,
        residentId,
      ]);
    },
    // Changes the status only if it is still one of `from`, so two requests can't both win.
    setBookingStatus(residentId, id, from, to) {
      return one(
        `UPDATE bookings SET status = $4, updated_at = now() WHERE id = $1 AND resident_id = $2 AND status = ANY($3) RETURNING ${BOOKING}`,
        [id, residentId, from, to],
      );
    },

    // ---------- mock aide side (npm run mock-aide) ----------
    aideList() {
      return q(`SELECT ${AIDE} FROM aides WHERE is_active ORDER BY full_name`);
    },
    findAide(id) {
      return one(`SELECT ${AIDE} FROM aides WHERE id = $1 AND is_active`, [id]);
    },
    // Every resident's recent bookings with who, where, and each one's offers, charges and chat.
    async aideListBookings() {
      const bookings = await q(
        `SELECT ${B}, r.full_name AS resident_name, r.mobile_number AS resident_mobile,
           u.notes AS unit_notes, ${aideJson('a')} AS aide
         FROM bookings b JOIN residents r ON r.id = b.resident_id
         LEFT JOIN resident_units u ON u.id = b.unit_id LEFT JOIN aides a ON a.id = b.aide_id
         ORDER BY b.created_at DESC LIMIT 50`,
      );
      const ids = bookings.map((b) => b.id);
      const [offers, charges, messages] = await Promise.all([
        q(`SELECT ${OFFER} FROM booking_offers WHERE booking_id = ANY($1) ORDER BY created_at`, [
          ids,
        ]),
        q(`SELECT ${CHARGE} FROM booking_charges WHERE booking_id = ANY($1) ORDER BY created_at`, [
          ids,
        ]),
        q(
          `SELECT ${MESSAGE} FROM booking_messages WHERE booking_id = ANY($1) ORDER BY created_at`,
          [ids],
        ),
      ]);
      const of = (rows, id) => rows.filter((r) => r.booking_id === id);
      return bookings.map((b) => ({
        ...b,
        offers: of(offers, b.id),
        charges: of(charges, b.id),
        messages: of(messages, b.id),
      }));
    },
    // Clean sweep: deletes every booking of every resident; offers, chat and charges go with them
    // (ON DELETE CASCADE). Residents, units, aides and the catalogue stay. Returns how many.
    async aideDeleteAllBookings() {
      const [{ n }] = await q(
        `WITH d AS (DELETE FROM bookings RETURNING 1) SELECT count(*)::int AS n FROM d`,
      );
      return n;
    },
    aideFindBooking(id) {
      return one(`SELECT ${BOOKING} FROM bookings WHERE id = $1`, [id]);
    },
    // One answer per Manong per open request. Returns null if he already answered or it closed.
    aideMakeOffer(bookingId, aideId, price, kind) {
      return one(
        `INSERT INTO booking_offers (booking_id, aide_id, price, kind)
         SELECT id, $2, $3, $4 FROM bookings WHERE id = $1 AND aide_id IS NULL AND status = ANY($5)
         ON CONFLICT (booking_id, aide_id) DO NOTHING RETURNING ${OFFER}`,
        [bookingId, aideId, price, kind, OPEN],
      );
    },
    // On the way (with ETA) or arrived. Only the assigned Manong, before the job starts.
    aideSetProgress(id, aideId, { aide_status, eta_minutes }) {
      return one(
        `UPDATE bookings SET aide_status = $3, eta_minutes = $4, updated_at = now()
         WHERE id = $1 AND aide_id = $2 AND status = ANY($5) RETURNING ${BOOKING}`,
        [id, aideId, aide_status, eta_minutes, ASSIGNED],
      );
    },
    // The assigned Manong backs out before starting: the request opens again, with the other
    // Manongs' offers back in play.
    aideWithdraw(id, aideId) {
      return tx(async (t) => {
        const [booking] = await t(
          `UPDATE bookings SET aide_id = NULL, agreed_price = NULL, aide_status = NULL, eta_minutes = NULL,
             status = CASE booking_type WHEN $3 THEN $4 ELSE $5 END, updated_at = now()
           WHERE id = $1 AND aide_id = $2 AND status = ANY($6) RETURNING ${BOOKING}`,
          [
            id,
            aideId,
            BOOKING_TYPES.SCHEDULED,
            BOOKING_STATES.PENDING_CONFIRMATION,
            BOOKING_STATES.REQUESTED,
            ASSIGNED,
          ],
        );
        if (!booking) return null;
        await t(
          `UPDATE booking_offers SET status = CASE WHEN aide_id = $2 THEN 'withdrawn' ELSE 'open' END, updated_at = now()
           WHERE booking_id = $1 AND (aide_id = $2 OR status = 'expired')`,
          [id, aideId],
        );
        await t(
          `UPDATE booking_charges SET status = 'declined', updated_at = now()
           WHERE booking_id = $1 AND aide_id = $2 AND status = 'pending'`,
          [id, aideId],
        );
        return booking;
      });
    },
    aideAddCharge(id, aideId, { label, amount }) {
      return one(
        `INSERT INTO booking_charges (booking_id, aide_id, label, amount)
         SELECT id, aide_id, $3, $4 FROM bookings WHERE id = $1 AND aide_id = $2 AND status = ANY($5)
         RETURNING ${CHARGE}`,
        [id, aideId, label, amount, [...ASSIGNED, BOOKING_STATES.IN_PROGRESS]],
      );
    },
    // Only from the status the aide saw, so a resident's cancel in between wins.
    aideSetStatus(id, from, to) {
      return one(
        `UPDATE bookings SET status = $3, updated_at = now() WHERE id = $1 AND status = $2 RETURNING ${BOOKING}`,
        [id, from, to],
      );
    },
  };
}
