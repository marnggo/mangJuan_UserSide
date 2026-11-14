// Booking rules (U05 to U13). Pure functions: no database, no Express.
import { BOOKING_STATES, BOOKING_TYPES, INITIAL_STATE, SERVICE_TYPES } from '../utils/contract.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const S = BOOKING_STATES;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Residents can cancel only before In Progress (booking-states.md, U13). contract.js TRANSITIONS
// lists two of these four; the other two are the ones its comment says U13 implies.
export const CANCELLABLE = [S.REQUESTED, S.PENDING_CONFIRMATION, S.ACCEPTED, S.CONFIRMED];
export const canCancel = (status) => CANCELLABLE.includes(status);

// Returns { value } ready to store, or { fields } naming each bad field.
export function validateBooking(body, now = new Date()) {
  const b = body ?? {};
  const fields = {};
  const category = str(b.category).toLowerCase();
  const address = str(b.address);
  const problem = str(b.problem);
  const booking_type = b.booking_type;
  const price_offer = b.price_offer ?? null;
  const unit_id = b.unit_id ?? null;
  const symptoms = Array.isArray(b.symptoms) ? b.symptoms.map(str) : b.symptoms == null ? [] : null;
  let scheduled_for = null;

  if (!/^[a-z][a-z -]{1,29}$/.test(category)) fields.category = 'Choose a service.';
  if (typeof b.service_type !== 'string' || !Object.hasOwn(SERVICE_TYPES, b.service_type))
    fields.service_type = `Choose one of: ${Object.keys(SERVICE_TYPES).join(', ')}.`;
  if (!Object.values(BOOKING_TYPES).includes(booking_type)) {
    fields.booking_type = `Choose one of: ${Object.values(BOOKING_TYPES).join(', ')}.`;
  } else if (booking_type === BOOKING_TYPES.SCHEDULED) {
    const t = typeof b.scheduled_for === 'string' ? new Date(b.scheduled_for) : null;
    if (!t || Number.isNaN(t.getTime()) || t <= now)
      fields.scheduled_for = 'Pick a date and time in the future.';
    else scheduled_for = t.toISOString();
  } else if (b.scheduled_for != null) {
    fields.scheduled_for = 'On-demand bookings have no scheduled time.';
  }
  // A saved unit (U02) gives the address, so address is needed only without one.
  if (unit_id !== null && !(typeof unit_id === 'string' && UUID.test(unit_id)))
    fields.unit_id = 'Choose one of your saved units.';
  else if (unit_id === null ? !address || address.length > 200 : address.length > 200)
    fields.address = 'Enter the service address.';
  if (!symptoms || symptoms.length > 10 || symptoms.some((x) => !x || x.length > 40))
    fields.symptoms = 'Pick up to 10 symptoms.';
  if (problem.length > 300) fields.problem = 'Keep the description under 300 characters.';
  if (
    price_offer !== null &&
    !(Number.isInteger(price_offer) && price_offer >= 0 && price_offer <= 1e6)
  )
    fields.price_offer = 'Enter a whole peso amount.';
  const payment_method = b.payment_method ?? null;
  if (payment_method !== null && !['gcash', 'cash'].includes(payment_method))
    fields.payment_method = 'Choose GCash or cash.';

  if (Object.keys(fields).length) return { fields };
  const status = INITIAL_STATE[booking_type];
  return {
    value: {
      category,
      service_type: b.service_type,
      booking_type,
      status,
      scheduled_for,
      address,
      problem,
      price_offer,
      unit_id,
      symptoms,
      payment_method,
    },
  };
}

// U03, U05, U06: categories with each service type's duration (contract) and base price (DB).
// A category shows only the service types that have a price.
export function buildCatalog(categories, prices) {
  return categories.map((c) => ({
    key: c.key,
    name: c.name,
    description: c.description,
    services: Object.entries(SERVICE_TYPES)
      .map(([type, t]) => {
        const p = prices.find((x) => x.category === c.key && x.service_type === type);
        return (
          p && {
            service_type: type,
            label: t.label,
            min_minutes: t.minMinutes,
            max_minutes: t.maxMinutes,
            base_price: p.base_price,
            price_is_minimum: p.price_is_minimum,
          }
        );
      })
      .filter(Boolean),
  }));
}
