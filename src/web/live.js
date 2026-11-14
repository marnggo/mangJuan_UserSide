/* ==========================================================
   LIVE · the app on the database
   The app at / (Flow 5) runs on src/server/app.js only: catalogue and prices, saved units, bookings,
   Manong offers, tracking, chat, extra charges and the rating. Nothing here is simulated; the aide side
   (Team 2, or npm run mock-aide) moves a booking along and this file follows it by polling.
   "Continue with Google" is a debug sign-in that opens the demo resident Enzo Santos.
   The ?lab prototype picker keeps its sample data. reference/mang-juan-frontend.html is a frozen copy of
   the whole prototype from before this file existed.
   ========================================================== */
if (APP5) {
  const TIER_OF = { CHECKUP: 'quick', STANDARD: 'standard', MAJOR: 'major' };
  const TYPE_OF = { quick: 'CHECKUP', standard: 'STANDARD', major: 'MAJOR' };
  const OPEN_ST = ['Requested', 'Pending Confirmation'];
  const ACTIVE_ST = [...OPEN_ST, 'Accepted', 'Confirmed', 'In Progress'];
  const BOOKING_SCREENS = ['a-finding', 'a-found', 'a-pending', 'a-declined', 'a-summary'];
  const WATCH_SCREENS = [...BOOKING_SCREENS, 'a-home', 'a-history', 'a-account', 'a-messages', 'a-notifs'];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const NO_UNIT = { id: null, t: 'Add your condo unit', s: 'Tap to add where Manong should go', short: 'No unit yet' };
  const SOMEONE = { key: 'none', name: 'Your Manong', first: 'Manong', ini: 'MJ', img: '', skills: '', rating: '–', jobs: 0, vehicle: '' };
  const DEMO_OFF = { nF: [], past: [], chat: [], voucher: false, photosA: [], symptomsA: [], live: null, units: [], paid5: 0 };

  // ---------- state with no sample data ----------
  const freshLive = fresh;
  fresh = (v) => (v === 'f5' ? Object.assign(freshLive(v), DEMO_OFF) : freshLive(v));
  if (st.variant === 'f5') Object.assign(st, DEMO_OFF);

  // ---------- small helpers ----------
  const ref5 = (id) => 'MJ-' + String(id || '').slice(0, 6).toUpperCase();
  const first5 = (name) => String(name || '').split(' ')[0];
  const err5 = (e) => {
    if (e && e.code === 'UNAUTHENTICATED') return; // api5 already sent them to Log in
    toast(e && e.offline ? "Can't reach the server right now. Please try again in a moment." : (e && e.fields && Object.values(e.fields)[0]) || (e && e.message) || 'Something went wrong');
  };
  const isLive5 = (b) => ACTIVE_ST.includes(b.status) || (b.status === 'Completed' && b.aide_id && !b.reviewed_at);
  const approved5 = () => (st.live ? st.live.charges.filter((c) => c.status === 'approved') : []);
  const agreed5 = () => {
    const b = st.live && st.live.booking;
    return b ? (b.agreed_price ?? b.price_offer ?? b.base_price ?? 0) : priceA();
  };
  const total5 = () => agreed5() + approved5().reduce((a, c) => a + c.amount, 0) + (+st.tip || 0);
  const openOffers5 = () => (st.live ? st.live.offers.filter((o) => o.status === 'open') : []);

  // A Manong row from the database, in the shape the prototype's screens draw.
  function manong5(a) {
    if (!a) return null;
    const m = { key: a.id, name: a.full_name, first: first5(a.full_name), ini: a.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
      img: '', skills: a.skills, /* initials only, no profile photos */ rating: Number(a.rating).toFixed(1), jobs: a.jobs_count, vehicle: a.vehicle };
    MANONGS[m.key] = m;
    return m;
  }
  // The screens ask aideF() who the Manong is; it picks st.pickManong from the category roster.
  function pin5(m, cat) {
    const r = ROSTER3[cat] || (ROSTER3[cat] = []);
    const i = r.findIndex((a) => a.m.key === m.key);
    if (i >= 0) r.splice(i, 1);
    r.unshift({ m, km: 0, now: true, busy: [] });
    st.pickManong = m.key;
  }

  // ---------- real dates ----------
  // The prototype's calendar keys days 20, 21, ... from "today, Oct 20". Key 20 is now the real today.
  const today0 = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const dateOfKey = (n) => {
    const d = today0();
    d.setDate(d.getDate() + (n - 20));
    return d;
  };
  for (let n = 20; n <= 80; n++) DAY_LONG[n] = WD[dateOfKey(n).getDay()];
  DAYS_F.forEach((x, i) => (x[0] = i === 0 ? 'Today' : WD[dateOfKey(x[1]).getDay()]));
  const keyOfDate = (iso) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return 20 + Math.round((d - today0()) / 86400000);
  };
  const fixText5 = (s) => s.replace(/Oct (\d{1,2})\b/g, (m, n) => (+n >= 20 && +n <= 80 ? `${MON[dateOfKey(+n).getMonth()]} ${dateOfKey(+n).getDate()}` : m))
    .replace(/About null mins away/g, 'Getting ready to head over');
  const fmtWhen5 = (iso) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  function fixScreen5() {
    const w = document.createTreeWalker(phone, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) if (/Oct \d|null mins/.test(n.nodeValue)) n.nodeValue = fixText5(n.nodeValue);
    phone.querySelectorAll('.f4date b').forEach((b) => {
      const k = +b.textContent;
      if (k >= 20) b.textContent = dateOfKey(k).getDate();
    });
    phone.querySelectorAll('.f4mon').forEach((el) => (el.textContent = today0().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })));
    // The prototype marks one sample slot as fully booked; real availability isn't known yet.
    phone.querySelectorAll('.f4time[disabled]').forEach((b) => {
      b.disabled = false;
      b.dataset.act = 'time';
      b.dataset.arg = b.textContent;
    });
  }
  const renderLive = render;
  render = (c) => {
    renderLive(c);
    fixScreen5();
  };
  const toastLive = toast;
  toast = (m) => toastLive(fixText5(String(m)));
  // Re-render after a poll without losing a half-typed chat message.
  function rerender5() {
    const inp = phone.querySelector('.chatbar input, .f3-chatbar input');
    const v = inp && inp.value, focused = inp && document.activeElement === inp;
    render();
    const now = phone.querySelector('.chatbar input, .f3-chatbar input');
    if (now && v) now.value = v;
    if (now && focused) now.focus();
  }

  // ---------- catalogue, units and bookings from the server ----------
  function applyCatalog(categories) {
    const K = { CHECKUP: 'q', STANDARD: 's', MAJOR: 'm' };
    OLD_TILES.splice(0, OLD_TILES.length);
    for (const c of categories) {
      CATS[c.key] = CATS[c.key] || { who: 'Manong', name: c.name, icon: 'wrench', pro: `${c.name} Specialist`, tone: CATS.repairs.tone, symptoms: [], materials: [['Materials', 0]] };
      CATS[c.key].name = c.name;
      CAT3[c.key] = CAT3[c.key] || { q: 'How big is the job?', issue: 'Issue', crew: 'Manong', def: 's', note: '', chips: 'Add details', symptoms: [], ph: 'Tell Manong what you need', extra: [], part: ['Part', 0, ''],
        tiers: { q: T('Checkup', '', 0, 'Base charge'), s: T('Standard service', '', 0, 'Most booked', 1), m: T('Major repair', '', 0, 'Starting price') } };
      for (const s of c.services) {
        CAT3[c.key].tiers[K[s.service_type]].price = s.base_price;
        if (c.key === 'plumbing') TIERS_PLUMB5[TIER_OF[s.service_type]].price = s.base_price;
      }
      OLD_TILES.push([c.key, c.name, CATS[c.key].icon]);
      SVC4[c.key] = c.description;
    }
    if (!st.fb) setCat5(st.cat);
  }
  function applyUnits(units) {
    st.units = units;
    const rows = units.map((u) => ({ id: u.id, t: [u.building, u.tower].filter(Boolean).join(', '),
      s: [`Unit ${u.unit_number}`, u.floor && `Floor ${u.floor}`, u.tower, u.building, u.street, u.city].filter(Boolean).join(', '),
      short: [`Unit ${u.unit_number}`, u.tower].filter(Boolean).join(', '), notes: u.notes }));
    ADDRESSES.splice(0, ADDRESSES.length, ...(rows.length ? rows : [NO_UNIT]));
    const keep = ADDRESSES.findIndex((a) => a.id && a.id === st.unit5);
    st.addrA = keep >= 0 ? keep : Math.max(0, units.findIndex((u) => u.is_default));
    st.unit5 = addrA().id;
  }
  function applyBookings(list) {
    st.srv = list;
    st.past = list.filter((b) => b.status === 'Completed' && b.aide && b.reviewed_at).map((b) => ({
      id: ref5(b.id), cat: CATS[b.category] ? b.category : 'repairs', tier: TIER_OF[b.service_type],
      title: `${CATS[b.category] ? CATS[b.category].name : b.category} on ${MON[new Date(b.created_at).getMonth()]} ${new Date(b.created_at).getDate()}`,
      manong: manong5(b.aide), total: (b.agreed_price ?? b.price_offer ?? b.base_price ?? 0) + (b.charges_total || 0) + (b.tip || 0),
    }));
  }
  // Signed in: units, bookings and the open booking. flow5.js calls sync5 after log-in and on Bookings.
  sync5 = async () => {
    if (!st.user) return;
    try {
      const [{ units }, { bookings }] = await Promise.all([api5('GET', '/me/units'), api5('GET', '/bookings')]);
      applyUnits(units);
      applyBookings(bookings);
      if (!st.bid) {
        const a = bookings.find(isLive5);
        if (a) st.bid = a.id;
      }
      if (st.bid) await refresh5();
      else st.fb = null;
      if (WATCH_SCREENS.includes(st.screen) || st.screen === 'a-confirm') rerender5();
    } catch (e) {
      if (!e.offline) err5(e);
    }
  };

  // ---------- the open booking ----------
  const keyOf5 = (b) => (OPEN_ST.includes(b.status) ? 'finding' : b.status === 'Completed' ? 'done' : b.status === 'In Progress' || b.aide_status ? 'onway' : b.booking_type === 'scheduled' ? 'confirmed' : 'onway');
  function derive5(d) {
    const b = d.booking;
    if (b.category !== st.cat) setCat5(b.category);
    st.cat = b.category;
    st.tierA = TIER_OF[b.service_type];
    st.when = b.booking_type === 'scheduled' ? 'schedule' : 'now';
    if (b.agreed_price != null) TIERS_A[st.tierA] = { ...TIERS_A[st.tierA], price: b.agreed_price };
    st.offer = b.price_offer;
    if (b.payment_method) st.pay = b.payment_method;
    const u = ADDRESSES.findIndex((a) => a.id && a.id === b.unit_id);
    if (u >= 0) st.addrA = u;
    const m = manong5(d.aide);
    if (m) pin5(m, b.category);
    else st.pickManong = null;
    st.eta = b.eta_minutes;
    st.arrived = b.aide_status === 'arrived' || b.status === 'In Progress';
    st.chat = d.messages.map((x) => ({ me: x.sender === 'resident', t: x.body }));
    const sched = b.scheduled_for;
    st.fb = { status: keyOf5(b), mode: st.when, cat: b.category, tier: st.tierA, m: m || SOMEONE, bid: b.id,
      day: sched ? keyOfDate(sched) : 20, time: sched ? new Date(sched).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Now' };
  }
  function transitions5(prev, d) {
    const a = prev && prev.booking, b = d.booking;
    if (!a || a.id !== b.id) return;
    const m = manong5(d.aide) || SOMEONE, pm = manong5(prev.aide) || SOMEONE;
    const say = (t, to = 'a-home') => {
      pushN(t, to);
      toast(t);
    };
    if (a.aide_id && !b.aide_id && OPEN_ST.includes(b.status)) say(`${pm.first} cancelled. Choose another Manong's offer.`, 'a-history');
    if (b.aide_status !== a.aide_status && b.aide_status === 'on_the_way') say(`${m.first} is on the way${b.eta_minutes != null ? `, about ${b.eta_minutes} mins` : ''}`);
    else if (b.eta_minutes !== a.eta_minutes && b.aide_status === 'on_the_way') toast(`${m.first} is about ${b.eta_minutes} mins away`);
    if (b.aide_status !== a.aide_status && b.aide_status === 'arrived') say(`${m.first} has arrived`);
    if (b.status !== a.status) {
      if (b.status === 'In Progress') say(`${m.first} started the job`);
      if (b.status === 'Completed') say(`${m.first} marked the job done. Review and pay.`, 'a-history');
      if (b.status === 'Declined') say('No Manong could take your request. Nothing was charged.', 'a-history');
    }
    const newOffers = openOffers5().length; // st.live is already d here
    const oldOffers = prev.offers.filter((o) => o.status === 'open').length;
    if (newOffers > oldOffers && st.screen !== 'a-finding') say(`New offer for your ${CATS[b.category] ? CATS[b.category].name.toLowerCase() : ''} request`, 'a-history');
    const theirs = (x) => x.messages.filter((y) => y.sender === 'aide');
    if (theirs(d).length > theirs(prev).length && !(st.sheet && st.sheet.type === 'chat')) {
      const last = theirs(d)[theirs(d).length - 1];
      pushN(`${m.first}: ${last.body}`, 'a-messages');
      toast(`${m.first}: ${last.body}`);
    }
    const pending = d.charges.find((c) => c.status === 'pending' && !prev.charges.some((p) => p.id === c.id));
    if (pending && !st.sheet) st.sheet = { type: 'charge5', arg2: pending.id };
  }
  // Polls the open booking. Re-renders only when something changed.
  async function refresh5() {
    const id = st.bid;
    if (!id) return;
    let d;
    try {
      d = await api5('GET', `/bookings/${id}`);
    } catch (e) {
      if (e.code !== 'NOT_FOUND') throw e;
      // Deleted (the mock aide's clean sweep): forget it and go home.
      Object.assign(st, { bid: null, live: null, fb: null, pickManong: null });
      if (BOOKING_SCREENS.includes(st.screen)) go('a-home', { reset: true, replace: true });
      return sync5();
    }
    if (st.bid !== id) return;
    const prev = st.live;
    if (prev && JSON.stringify(prev) === JSON.stringify(d)) return;
    st.live = d;
    transitions5(prev, d);
    if (!isLive5(d.booking)) {
      Object.assign(st, { bid: null, live: null, fb: null, pickManong: null });
      if (BOOKING_SCREENS.includes(st.screen)) go('a-home', { reset: true, replace: true });
      return sync5();
    }
    derive5(d);
    const route = ROUTE_F[keyF(st.fb)];
    if (BOOKING_SCREENS.includes(st.screen) && route !== st.screen) {
      go(route, { replace: true });
      st.stack = ['a-home'];
    } else if (WATCH_SCREENS.includes(st.screen)) rerender5();
  }
  let polling = false;
  setInterval(async () => {
    if (polling || !st.user || !st.bid || document.hidden) return;
    polling = true;
    try {
      await refresh5();
    } catch {
      /* offline for a moment: the next poll tries again */
    } finally {
      polling = false;
    }
  }, 3000);

  // ---------- screens ----------
  // Home: the services come from the catalogue; the sample "recent jobs" are gone.
  const homeLive = S['a-home'];
  S['a-home'] = () => homeLive().replace(/<h2 class="f4h">Recent jobs in your building<\/h2><div class="f4jobs">[\s\S]*?<\/div>/, '');

  // Find your Manong: real offers. Each Manong answers once: takes your price or counters it.
  S['a-finding'] = () => {
    const o = offer5(), inc = st.inc;
    const list = openOffers5().map((x) => ({ m: manong5(x.aide), role: x.aide.skills, mins: 0, km: 0, price: x.price, counter: x.kind === 'counter' }));
    const pill = (v) => `<button class="${inc === v ? 'on' : ''}" data-act="inc5" data-arg="${v}" aria-pressed="${inc === v}">+ ${peso(v)}</button>`;
    const cards = list.map(offerCard5).join('').replace(/<span>•<\/span><img[^>]*ic-moto[^>]*><span class="eta">[^<]*<\/span>/g, '');
    return `${statusBar()}${canopy('Find Your Manong', 'Offers from Manongs nearby appear here live.', { backAct: 'home' })}
  <div class="scroll f5find">${map5('inflow')}
    <div class="f5card f5status"><i></i><b>Waiting for Manongs nearby...</b><span><small>Your Offer</small><b>${peso(o)}</b></span></div>
    <div class="f5oh"><h2>Incoming Offers</h2><span>${list.length ? `${list.length} Nearby` : 'Waiting'}</span></div>
    ${cards || '<p class="f5wait">Manongs nearby are reviewing your request. Offers show up here.</p>'}
    <section class="f5raise"><div class="hd">${i5('ic-trend')}<div><h4>Need faster arrival?</h4><p>Raise your price to attract more Manongs</p></div></div>
      <div class="pills">${pill(20)}${pill(50)}${pill(100)}<button data-act="sheet" data-arg="raise5" aria-label="Enter your own amount">${i5('ic-pen')}</button></div>
      <p class="new">${i5('ic-cash')}<span>New Offer:</span><b>${peso(o + inc)}</b><em>(+${peso(inc)} added)</em></p>
      <button class="upd" data-act="raise5">${i5('ic-broadcast')}<span>Update Offer</span><span>(${peso(o + inc)})</span></button></section>
    <button class="f5card f5warr" data-act="sheet" data-arg="warranty5"><span class="ic">${i5('ic-warranty')}</span><span class="grow"><b>Mang Juan Labor Warranty</b><small>Every booking covers 7-day labor back guarantee</small></span>${i5('ic-chev')}</button>
  </div>
  <div class="f5cta"><button class="f5stop" data-act="cancelFind5">${i5('ic-x-big')}<span>Cancel Request</span></button></div>${homeBar}`;
  };
  AFTER['a-finding'] = () => {}; // no sample offers on a timer; the poll brings real ones

  // Tracking: ETA and arrival come from the Manong. Only he can mark the job done.
  AFTER['a-found'] = () => {};
  Object.assign(LIVE, {
    etaA: () => (st.live && st.live.booking.status === 'In Progress' ? 'Working' : st.arrived ? 'Arrived' : st.eta != null ? `~ ${st.eta} mins` : 'Getting ready'),
    etaPct: () => (st.arrived ? 100 : st.eta != null ? Math.max(10, 100 - st.eta * 4) : 15) + '%',
    km: () => (st.arrived ? 'At your building' : st.eta != null ? `About ${st.eta} mins away` : 'Preparing to head over'),
    totalA: () => peso(total5()) + '.00',
  });
  const foundLive = S['a-found'];
  S['a-found'] = () => {
    const b = st.live && st.live.booking, ref = ref5(b && b.id);
    const pend = st.live ? st.live.charges.filter((c) => c.status === 'pending') : [];
    let h = foundLive().replace(/<button class="abtn center" data-act="jobDoneA"[\s\S]*?<\/button>/, '').replace(/MJ-8821/g, ref);
    if (b && b.status === 'In Progress') h = h.replace('Manong is at your door', 'Job in progress').replace('Manong Has Arrived', 'Job In Progress');
    if (pend.length) h = h.replace('<button class="agrey" data-act="sheet" data-arg="cancelReportA">', `<button class="abtn center" style="margin-bottom:10px" data-act="sheet" data-arg="charge5" data-arg2="${esc(pend[0].id)}">Review extra charge: ${esc(pend[0].label)} ${peso(pend[0].amount)}</button><button class="agrey" data-act="sheet" data-arg="cancelReportA">`);
    return h;
  };
  const qrLive = SHEETS.qr;
  SHEETS.qr = (s) => qrLive(s).replace(/MJ-8821/g, ref5(st.bid));

  // Scheduled and confirmed: real request time.
  const pendingLive = S['a-pending'];
  S['a-pending'] = () => {
    const b = st.live && st.live.booking;
    return pendingLive().replace(/Request sent Oct 20, 4:12 PM/, b ? `Request sent ${fmtWhen5(b.created_at)}` : 'Request sent').replace(/ confirmed at 4:15 PM/, ' confirmed');
  };

  // Order summary: agreed price, approved extra charges, tip.
  const sumLive = S['a-summary'];
  S['a-summary'] = () => {
    st.partOk = false;
    const rows = `<div><span>Agreed price</span><span>${peso(agreed5())}</span></div>${approved5().map((c) => `<div><span>${esc(c.label)}</span><span>${peso(c.amount)}</span></div>`).join('')}`;
    return sumLive().replace(/<div><span>Duration<\/span><span>35 mins<\/span><\/div>/, rows).replace(/#MJ-8821/g, '#' + ref5(st.bid));
  };
  const thanksLive = S['a-thanks'];
  S['a-thanks'] = () => thanksLive().replace(/(<span>Total paid<\/span><b>)[^<]*(<\/b>)/, `$1${peso(st.paid5)}$2`);

  // Messages: the chat with the booked Manong, or nothing yet.
  S['a-messages'] = () => {
    const m = st.live && st.live.aide ? aideF() : null, last = st.chat[st.chat.length - 1];
    return tabsF(`${statusBar()}<div class="ohome">${topF('Messages')}
  <div class="scroll" style="padding:16px"><div class="list">
    ${m ? `<button class="listrow" data-act="sheet" data-arg="chat">${avF(m, 48)}<div class="grow"><b>${esc(m.name)}</b><small>${esc(last ? last.t : `Say hi to ${m.first}`)}</small></div></button>` : '<p class="empty" style="margin:8px 4px 16px">Chat with your Manong opens here once you accept an offer.</p>'}
    <button class="listrow" data-act="toast" data-arg="Mang Juan support replies within 5 minutes"><img src="${A}svg/mang-juan-badge.svg" alt="" style="width:48px;height:48px;border-radius:50%" /><div class="grow"><b>Mang Juan Support</b><small>How can we help you today?</small></div></button></div></div>${oldTabs('a-messages')}</div>${homeBar}`);
  };

  // Bookings: the open booking is the strip/active row, so it isn't listed twice; finished jobs are receipts.
  const histLive = S['a-history'];
  S['a-history'] = () => {
    const keep = st.srv;
    st.srv = (st.srv || []).filter((b) => b.id !== st.bid && !(b.status === 'Completed' && b.reviewed_at));
    try {
      return histLive();
    } finally {
      st.srv = keep;
    }
  };

  // Account: real profile (me5 in flow5.js) with an Edit sheet; no sample promo.
  const acctLive = S['a-account'];
  S['a-account'] = () => acctLive().replace('data-act="toast" data-arg="Profile editing is not in this prototype"', 'data-act="profile5"').replace(/<button class="f4promo"[\s\S]*?<\/button>/, '')
    .replace(/(<b>Addresses<\/b><small>)\d+ saved/, `$1${st.units.length} saved`);

  // Cancelled: this booking's reference and time, not the sample ones.
  const cancelledLive = S['a-cancelled'];
  S['a-cancelled'] = () => {
    const c = st.cx5 || { ref: 'MJ-', at: new Date() };
    return cancelledLive().replace(/#MJ-8821/g, '#' + c.ref).replace(' • #GC-99412', '').replace('Today, 10:45 AM', fmtWhen5(c.at));
  };

  // ---------- sheets ----------
  SHEETS.addressA = () => `<h3>Service address</h3><p class="sub">Where should Manong go?</p>
  <div class="opts">${st.units.length ? ADDRESSES.map((a, i) => `<div class="opt ${st.addrA === i ? 'on' : ''}" style="cursor:default"><button style="display:flex;gap:12px;align-items:center;flex:1;text-align:left" data-act="pickAddrA" data-arg="${i}">${ic('building')}<span class="grow"><b>${esc(a.t)}</b><small>${esc(a.s)}</small></span>${st.addrA === i ? ic('check') : ''}</button><button class="link" data-act="rmUnit5" data-arg="${esc(a.id)}" aria-label="Remove ${esc(a.short)}">${ic('x')}</button></div>`).join('') : '<p class="sub">No saved units yet.</p>'}</div>
  <div class="stack"><button class="btn primary" data-act="sheet" data-arg="unit5">Add a unit</button><button class="btn secondary" data-act="closeSheet">Close</button></div>`;
  const field5 = (model, label, ph, max) => `<label class="sub" style="display:block;margin:10px 0 4px">${label}</label><input class="sheetin" data-model="${model}" value="${esc(st[model] || '')}" placeholder="${ph}" maxlength="${max}" aria-label="${label}" />`;
  SHEETS.unit5 = () => `<h3>Add your condo unit</h3><p class="sub">So Manong knows where to go.</p><div id="unitForm">
  ${field5('u5b', 'Condo or building', 'Avida Towers Prime Taft', 100)}${field5('u5n', 'Unit number', '12B', 20)}${field5('u5t', 'Tower (optional)', 'Tower 1', 40)}${field5('u5f', 'Floor (optional)', '12', 10)}
  ${field5('u5s', 'Street (optional)', 'Taft Ave', 150)}${field5('u5c', 'City (optional)', 'Pasay City', 60)}${field5('u5x', 'Notes for Manong (optional)', 'Gate 2, ask the guard', 200)}</div>
  <div class="stack" style="margin-top:14px"><button class="btn primary" data-act="saveUnit5" ${st.busy ? 'disabled' : ''}>Save unit</button><button class="btn secondary" data-act="closeSheet">Cancel</button></div>`;
  SHEETS.profile5 = () => `<h3>Edit profile</h3><div id="profileForm">${field5('p5n', 'Full name', 'Juan Dela Cruz', 100)}${field5('p5e', 'Email', 'name@email.com', 254)}${field5('p5m', 'Mobile number', '0917 123 4567', 20)}</div>
  <div class="stack" style="margin-top:14px"><button class="btn primary" data-act="saveProfile5" ${st.busy ? 'disabled' : ''}>Save</button><button class="btn secondary" data-act="closeSheet">Cancel</button></div>`;
  SHEETS.charge5 = (s) => {
    const c = st.live && st.live.charges.find((x) => x.id === s.arg2 && x.status === 'pending');
    if (!c) return '<h3>Nothing to approve</h3><button class="btn primary" data-act="closeSheet">Close</button>';
    return `<h3>${esc(aideF().first)} needs a part</h3><p class="sub">Approve it before it's added to your bill. Nothing changes unless you say yes.</p>
  <div class="greybox kv" style="margin-bottom:16px"><div><span>${esc(c.label)}</span><span>${peso(c.amount)}</span></div><div><span>Total with this part</span><span>${peso(total5() - (+st.tip || 0) + c.amount)}</span></div></div>
  <div class="stack"><button class="btn primary" data-act="charge5" data-arg="${esc(c.id)}" data-arg2="1">Approve ${peso(c.amount)}</button><button class="btn secondary" data-act="charge5" data-arg="${esc(c.id)}" data-arg2="0">Decline</button></div>`;
  };

  // ---------- actions ----------
  const ACT_LIVE = { confirmCancelA: ACT.confirmCancelA, cancelF: ACT.cancelF, find5: ACT.find5, startA: ACT.startA };
  const notCancellable5 = () => {
    if (!(st.live && st.live.booking.status === 'In Progress')) return false;
    st.sheet = null;
    render();
    toast("The job has started, so it can't be cancelled here. Talk to your Manong.");
    return true;
  };
  // New request: the server stores it, then Manongs answer with offers (polled).
  book5 = () => {
    const now = st.when === 'now';
    const problem = [st.descA.trim(), st.notesA.trim() && `Notes: ${st.notesA.trim()}`].filter(Boolean).join(' / ').slice(0, 300);
    api5('POST', '/bookings', {
      category: st.cat, service_type: TYPE_OF[st.tierA], booking_type: now ? 'on-demand' : 'scheduled', ...(now ? {} : { scheduled_for: realTime5() }),
      unit_id: addrA().id, problem, symptoms: st.symptomsA.slice(0, 10), price_offer: offer5(), payment_method: st.pay,
    }).then(({ booking }) => {
      st.bid = booking.id;
      st.live = null;
      return refresh5();
    }).catch((e) => {
      if (st.screen === 'a-finding') go('a-confirm', { replace: true });
      err5(e);
    });
  };
  unbook5 = () => {
    const id = st.bid;
    Object.assign(st, { bid: null, live: null, fb: null, pickManong: null });
    if (id) api5('PATCH', `/bookings/${id}/cancel`).catch(err5).finally(sync5);
  };
  Object.assign(ACT, {
    social(n) {
      if (n !== 'Google') return toast(`${n} sign-in isn't available yet. Log in with your mobile number.`);
      st.guest = false;
      api5('POST', '/auth/google-debug').then(({ token, resident }) => {
        saveToken5(token);
        Object.assign(st, { user: resident, api: true, busy: false });
        go('a-home', { reset: true, replace: true });
        toast(`Signed in as ${resident.full_name} (debug)`);
        sync5();
      }).catch(err5);
    },
    startA(k) {
      if (st.fb) return toast('You have an active booking. Open it from Bookings.');
      return ACT_LIVE.startA.call(ACT, k);
    },
    takePhoto() {
      const up = phone.querySelector('input[data-upload="A"]');
      if (up) up.click();
      else toast('You can add up to 3 photos');
    },
    find5() {
      if (!st.user) {
        toast('Log in to book a Manong');
        return go('a-login');
      }
      if (st.fb) return toast('You have an active booking. Open it from Bookings.');
      if (!addrA().id) {
        toast('Add your condo unit first');
        return sheet('unit5');
      }
      return ACT_LIVE.find5.call(ACT);
    },
    accept5(k) {
      const o = openOffers5().find((x) => x.aide.id === k);
      if (!o) return;
      api5('POST', `/bookings/${st.bid}/offers/${o.id}/accept`).then(() => refresh5()).then(() => {
        st.stack = ['a-home'];
        toast(`${first5(o.aide.full_name)} is booked at ${peso(o.price)}`);
      }).catch((e) => {
        err5(e);
        refresh5().catch(() => {});
      });
    },
    decline5(k) {
      const o = openOffers5().find((x) => x.aide.id === k);
      if (!o) return;
      api5('POST', `/bookings/${st.bid}/offers/${o.id}/decline`).then(() => {
        toast('Offer declined');
        return refresh5();
      }).catch(err5);
    },
    raise5() {
      const id = st.bid, p = offer5() + st.inc;
      if (!id) return;
      api5('PATCH', `/bookings/${id}/offer`, { price_offer: p }).then(() => {
        st.offer = p;
        toast(`Offer raised to ${peso(p)}. Manongs nearby can see it.`);
        return refresh5();
      }).catch(err5);
    },
    confirmCancelA() {
      if (notCancellable5()) return;
      st.cx5 = { ref: ref5(st.bid), at: new Date() };
      return ACT_LIVE.confirmCancelA.call(ACT);
    },
    cancelF() {
      if (notCancellable5()) return;
      st.cx5 = { ref: ref5(st.bid), at: new Date() };
      return ACT_LIVE.cancelF.call(ACT);
    },
    leaveFindF() {
      go('a-home', { reset: true, replace: true });
    },
    charge5(id, el) {
      const ok = el.dataset.arg2 === '1';
      st.sheet = null;
      render();
      api5('PATCH', `/bookings/${st.bid}/charges/${id}`, { approved: ok }).then(() => {
        toast(ok ? 'Approved and added to your bill' : 'Declined. Manong finishes without it.');
        return refresh5();
      }).catch(err5);
    },
    submitA() {
      const b = st.live && st.live.booking;
      if (!b) return go('a-home', { reset: true, replace: true });
      api5('POST', `/bookings/${b.id}/review`, { rating: st.stars, praise: st.praise.slice(0, 6), review: st.review, tip: +st.tip || 0, payment_method: st.pay }).then(() => {
        st.paid5 = total5();
        Object.assign(st, { bid: null, live: null, fb: null, review: '' });
        go('a-thanks', { replace: true });
        sync5();
      }).catch(err5);
    },
    receipt() {
      const b = st.live && st.live.booking, m = aideF();
      const lines = ['MANG JUAN E-RECEIPT', `Booking #${ref5(b && b.id)}`, `${tA().name}: ${peso(agreed5())}`, ...approved5().map((c) => `${c.label}: ${peso(c.amount)}`), `Tip: ${peso(+st.tip || 0)}`, `Total: ${peso(total5())}`, `Paid via ${st.pay === 'gcash' ? 'GCash' : 'Cash'}`, `Manong: ${m.name}`];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/plain' }));
      a.download = `mang-juan-receipt-${ref5(b && b.id)}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('E-receipt downloaded');
    },
    pickAddrA(i) {
      st.addrA = +i;
      st.unit5 = addrA().id;
      st.sheet = null;
      render();
    },
    rmUnit5(id) {
      api5('DELETE', `/me/units/${id}`).then(() => toast('Unit removed')).catch(err5).finally(() => sync5().then(() => st.sheet && render()));
    },
    saveUnit5() {
      const body = { building: st.u5b || '', unit_number: st.u5n || '', tower: st.u5t || '', floor: st.u5f || '', street: st.u5s || '', city: st.u5c || '', notes: st.u5x || '' };
      st.busy = true;
      render();
      api5('POST', '/me/units', body).then(({ unit }) => {
        Object.assign(st, { busy: false, sheet: null, unit5: unit.id, u5b: '', u5n: '', u5t: '', u5f: '', u5s: '', u5c: '', u5x: '' });
        toast('Unit saved');
        return sync5();
      }).catch((e) => {
        st.busy = false;
        render();
        shake('#unitForm');
        err5(e);
      });
    },
    profile5() {
      const u = st.user || {};
      Object.assign(st, { p5n: u.full_name || '', p5e: u.email || '', p5m: (u.mobile_number || '').replace(/^\+63/, '0') });
      sheet('profile5');
    },
    saveProfile5() {
      st.busy = true;
      render();
      api5('PATCH', '/me', { full_name: st.p5n, email: st.p5e, mobile_number: st.p5m }).then(({ resident }) => {
        Object.assign(st, { user: resident, busy: false, sheet: null });
        render();
        toast('Profile saved');
      }).catch((e) => {
        st.busy = false;
        render();
        shake('#profileForm');
        err5(e);
      });
    },
  });

  // Flow 3 (full.js layer()) owns sendChat as a getter-only property, so plain assignment can't replace it.
  Object.defineProperty(ACT, 'sendChat', {
    configurable: true,
    enumerable: true,
    writable: true,
    value(text) {
      const t = String(text || '').trim();
      if (!t || !st.bid) return;
      if (!(st.live && st.live.aide)) return toast('Chat opens once you accept an offer');
      st.chat.push({ me: true, t });
      render();
      api5('POST', `/bookings/${st.bid}/messages`, { body: t }).then(() => refresh5()).catch(err5);
    },
  });

  // No sample addresses before sign-in.
  applyUnits([]);
  // The catalogue is public, so guests see real services and prices too.
  api5('GET', '/categories').then(({ categories }) => {
    applyCatalog(categories);
    if (['a-home', 'a-service', 'a-welcome'].includes(st.screen)) render();
  }).catch(() => {});
}
