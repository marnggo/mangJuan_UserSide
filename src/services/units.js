// Saved condo units (U02). Pure functions: no database, no Express.
export const MAX_UNITS = 10;

// [field, max length, required]
const UNIT_FIELDS = [
  ['building', 100, true],
  ['tower', 40, false],
  ['floor', 10, false],
  ['unit_number', 20, true],
  ['street', 150, false],
  ['city', 60, false],
  ['notes', 200, false],
];
const LABELS = {
  building: 'Enter the condo or building name.',
  unit_number: 'Enter the unit number.',
};

// New unit: building and unit_number required. `partial` (an edit): only the fields sent, at least one.
// Returns { value } or { fields }.
export function validateUnit(body, { partial = false } = {}) {
  const b = body ?? {};
  const fields = {};
  const value = {};
  for (const [k, max, required] of UNIT_FIELDS) {
    if (b[k] === undefined && (partial || !required)) continue;
    const v = typeof b[k] === 'string' ? b[k].trim() : null;
    if (v === null || v.length > max || (required && !v))
      fields[k] = LABELS[k] ?? `Use text of at most ${max} characters.`;
    else value[k] = v;
  }
  if (b.is_default !== undefined) {
    if (typeof b.is_default !== 'boolean') fields.is_default = 'Use true or false.';
    else value.is_default = b.is_default;
  }
  if (partial && !Object.keys(fields).length && !Object.keys(value).length)
    fields.building = 'Send at least one field to change.';
  return Object.keys(fields).length ? { fields } : { value };
}

// The one-line address an aide reads, also copied onto a booking so later edits don't rewrite it.
export function formatUnitAddress(u) {
  return [
    `Unit ${u.unit_number}`,
    u.floor && `Floor ${u.floor}`,
    u.tower,
    u.building,
    u.street,
    u.city,
  ]
    .filter(Boolean)
    .join(', ')
    .slice(0, 200);
}
