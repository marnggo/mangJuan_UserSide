/* ==========================================================
   FLOW 5 · Figma replica
   Source: Figma file "SOFIA Manong (Copy)", section "Var4: Final (Flow 4)" (node 3312:2662).
   Flow 5 runs on Flow 4's engine (isF() in full.js is true for it) and replaces only the screens the
   Figma file draws differently: welcome, log in, sign-up with OTP, choose service, details,
   confirm booking (price offer), find your Manong (offers), order summary and cancelled summary.
   Frames that Figma copied from Flow 4 (home, tabs, scheduled states, receipt) are Flow 4's screens.
   Screens marked "added" fill gaps in the file. They are listed in FLOW5_GAPS.md.
   ========================================================== */
VARIANTS.f5 = { flow: 'A', label: 'Figma replica', group: 'Flow 5', start: 'a-welcome' };
GROUP_DESC['Flow 5'] = 'The Figma file, screen for screen: name your price, pick from live Manong offers, track, rate and pay.';
const is5 = () => st.variant === 'f5';
// The page opens as the Flow 5 app: no side panel, no other flows, and the 375 x 812 frame scaled to fill
// the screen. Add ?lab to the address to get the prototype picker with Flows 1 to 5 and the Simulate buttons.
const APP5 = !new URLSearchParams(location.search).has('lab');
if (APP5) {
  let fitW = 0;
  const fit = () => {
    // The on-screen keyboard shrinks the height; keep the layout still while someone is typing.
    if (innerWidth === fitW && /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
    fitW = innerWidth;
    const phoneMode = innerWidth < 600, s = phoneMode ? innerWidth / 375 : Math.min(innerWidth / 375, innerHeight / 812);
    const h = phoneMode ? innerHeight / s : 812, css = document.documentElement.style;
    css.setProperty('--fit', s);
    css.setProperty('--h', h + 'px');
    css.setProperty('--k', Math.min(1, h / 812)); // sign-in screens are drawn at 812 tall: shrink them to fit
  };
  const onlyF5 = () => {
    if (!location.hash.startsWith('#f5/')) location.replace(location.pathname + location.search + '#f5/a-welcome');
  };
  document.documentElement.classList.add('app');
  document.title = 'Mang Juan';
  addEventListener('resize', fit);
  addEventListener('hashchange', onlyF5);
  fit();
  onlyF5();
}
const F5 = A + 'f5/';
const i5 = (n, cls = '') => `<img ${cls ? `class="${cls}" ` : ''}src="${F5}${n}.svg" alt="" />`;
const digits5 = (s) => String(s || '').replace(/\D/g, '');
const fmtPh5 = (s) => digits5(s).replace(/^(\d{3})(\d{0,3})(\d{0,4}).*$/, '$1 $2 $3').trim();

// ---------- every category books through the plumbing path ----------
// Figma only draws plumbing. The other services reuse its screens with their own tiers and symptoms from
// Flow 3's catalogue (CAT3). TIERS_A and SYMPTOMS_A are swapped in
// place so the Flow 1 screens and price helpers pick them up, and are put back by fresh().
const TIERS_PLUMB5 = JSON.parse(JSON.stringify(TIERS_A));
const SYM_PLUMB5 = [...SYMPTOMS_A];
const cap5 = (s) => s.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
function setCat5(c) {
  const d = c !== 'plumbing' && CAT3[c];
  const src = d && { quick: d.tiers.q, standard: d.tiers.s, major: d.tiers.m };
  for (const k of ['quick', 'standard', 'major']) {
    TIERS_A[k] = !d ? { ...TIERS_PLUMB5[k] } : {
      name: cap5(src[k].name), short: cap5(src[k].name).split(' ')[0], dur: dur3(c, k[0]), desc: cap5(src[k].desc.replace(/^e\.g\. /, '').slice(0, 1)) + src[k].desc.replace(/^e\.g\. /, '').slice(1),
      badge: { quick: 'CHEAPEST DEAL', standard: 'MOST POPULAR' }[k], price: src[k].price, plus: k === 'major',
      unit: k === 'major' ? 'Starting Price' : 'Fixed base', foot: k === 'major' ? 'Parts billed at official receipt' : '',
    };
  }
  SYMPTOMS_A.splice(0, SYMPTOMS_A.length, ...(d ? d.symptoms : SYM_PLUMB5));
}

// Sofio is the second Manong in the Figma offers list. He joins the plumbing roster only while Flow 5 is open.
const SOFIO = { key: 'sofio', name: 'Sofio Penaflorida', first: 'Sofio', ini: 'SP', img: F5 + 'sofio.png', skills: 'Master Plumber & Pipe Specialist', rating: '4.8', jobs: 128, vehicle: 'Black motorcycle, NAB 2214' };
MANONGS.sofio = SOFIO;
const fresh4 = fresh;
fresh = (v = 'main') => {
  setCat5('plumbing');
  const r = ROSTER3.plumbing, i = r.findIndex((a) => a.m === SOFIO);
  if (v === 'f5' && i < 0) r.push({ m: SOFIO, km: 1.2, now: true, busy: [] });
  if (v !== 'f5' && i >= 0) r.splice(i, 1);
  const s = fresh4(v);
  return v === 'f5' ? Object.assign(s, { offer: null, inc: 50, f5n: 0, f5t: 24, f5no: [], f5exp: 120, cancelled: null, guest: false, user: null, regName: '', regEmail: '', regPw: '', api: null, srv: null, bid: null, busy: false }) : s;
};
// Screen name on the phone element, so flow5.css can style one screen without touching the others.
const render4 = render;
render = (c) => {
  phone.dataset.s = st.screen;
  render4(c);
};

// ---------- welcome, log in, sign-up with OTP ----------
const welcome4 = S['a-welcome'], login4 = S['a-login'];
const heroCard5 = (cls, icon, title, sub) => `<div class="f5hc ${cls}"><span class="ic">${i5(icon)}</span><span><b>${title}</b><small>${sub}</small></span></div>`;
S['a-welcome'] = () => (!is5() ? welcome4() : `<div class="f5auth">${statusBar(true)}
  <img class="f5logo" style="top:-22px;left:27px" src="${F5}manong-logo.png" alt="manong" />
  <div class="f5head"><h2>Your trusted handyman,<br /><u>always on call.</u></h2>
    <p>Book certified Filipino technicians for aircon,<br />electrical, plumbing &amp; urgent home fixes in<br />minutes.</p></div>
  <i class="f5glow"></i>
  ${heroCard5('c1', 'ic-aircon', 'Aircon Cleaning', '<em class="g">Available in 30m</em>')}
  ${heroCard5('c2', 'ic-electrical', 'Electrical &amp; Wiring', 'From ₱350')}
  ${heroCard5('c3', 'ic-plumbing', 'Plumbing &amp; Leaks <i></i>', '<em class="a">★ 4.9 (12k+ reviews)</em>')}
  <span class="f5top">TOP RATED PROS</span>
  <span class="f5pill p1"><span>⚡</span>Vetted Kuya Pros</span><span class="f5pill p3">${i5('ic-clock')}Same-day Arrival</span><span class="f5pill p2"><span>🛡️</span>Upfront Rates</span>
  <p class="f5proof">${i5('ic-star')}Trusted by <b>50,000+ Pinoy households</b></p>
  <div class="f5wfoot"><button class="f5start" data-act="go" data-arg="a-phone"><span>Get Started</span><i>${i5('ic-arrow')}</i></button>
    <button class="f5have" data-act="go" data-arg="a-login">I already have an account</button>
    <button class="f5guest" data-act="guest5">Explore services as Guest</button>
    <p class="f5legal">By proceeding, you agree to Mang Juan's <button data-act="toast" data-arg="Terms of Service open in your browser">Terms of Service</button> &amp;<br /><button data-act="toast" data-arg="Privacy Policy opens in your browser">Privacy Policy</button>.</p></div></div>${homeBar}`);

S['a-login'] = () => (!is5() ? login4() : `<div class="f5auth">${statusBar(true)}
  <img class="f5logo" style="top:50px;left:28px" src="${F5}manong-logo.png" alt="manong" />
  <div class="f5form" id="loginForm">
    <label for="f5mob">Mobile Number</label>
    <div class="f5in"><button class="f5cc" data-act="toast" data-arg="Only Philippine (+63) numbers for now" aria-label="Country code +63">+63${i5('ic-caret')}</button>
      <input id="f5mob" data-model="loginId" inputmode="numeric" maxlength="12" value="${esc(st.loginId)}" placeholder="9xx xxx xxxx" autocomplete="tel-national" /></div>
    <label for="f5pw" style="margin-top:16px">Password</label>
    <div class="f5in pw"><input id="f5pw" data-model="loginPw" type="${st.showPw ? 'text' : 'password'}" value="${esc(st.loginPw)}" placeholder="Password" autocomplete="current-password" />
      <button data-act="togglePw" aria-label="${st.showPw ? 'Hide' : 'Show'} password">${st.showPw ? ic('eye') : i5('ic-eye-off')}</button></div>
    <div class="f5forgot"><button data-act="sheet" data-arg="forgot">Forgot password?</button></div>
    ${st.authErr ? `<p class="f5err2" role="alert">${esc(st.authErr)}</p>` : ''}
    <button class="f5login" data-act="loginA" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Logging in…' : 'Log in'}</button></div>
  <div class="f5alt"><div class="f5or"><span>or continue with</span></div>
    <div class="f5soc"><button data-act="social" data-arg="Google">${i5('ic-google')}Google</button><button data-act="social" data-arg="Facebook">${i5('ic-facebook')}Facebook</button></div>
    <button class="f5apple" data-act="social" data-arg="Apple">${i5('ic-apple')}Apple</button></div>
  <p class="f5new">New to manong? <button data-act="go" data-arg="a-phone">Sign up</button></p></div>${homeBar}`);

const otpHead5 = (title) => `<button class="f5bk" data-act="back" aria-label="Back">${i5('ic-back-square')}</button>${title ? `<h1 class="f5ttl0">${title}</h1>` : ''}`;
S['a-phone'] = () => {
  const n = digits5(st.phoneNum);
  return `<div class="f5auth f5otp">${statusBar(true)}${otpHead5('Let’s Get Started')}
  <p class="f5lab0">Phone Number</p>
  <div class="f5ccbox">${i5('cc-box', 'bg')}${i5('flag-ph', 'flag')}<span>+63</span></div>
  <div class="f5num" id="phoneField"><input id="f5ph" data-model="phoneNum" data-rerender type="tel" inputmode="numeric" maxlength="10" value="${esc(n)}" placeholder="910 123 4567" autocomplete="tel-national" aria-label="Phone number" />${n ? `<button data-act="clearPh5" aria-label="Clear number">${i5('ic-clear')}</button>` : ''}</div>
  ${st.authErr ? `<p class="f5err" role="alert">${esc(st.authErr)}</p>` : ''}
  <p class="f5sms">Send me a verification code through <b>SMS</b></p>
  <button class="f5next ${n ? '' : 'off'}" data-act="sendCode5">Next</button></div>${homeBar}`;
};
S['a-otp'] = () => `<div class="f5auth f5otp">${statusBar(true)}${otpHead5('')}
  <p class="f5sent">Enter the 6-digit code sent to +63 ${esc(digits5(st.phoneNum) || '9661234567')} by <b>SMS.</b></p>
  <div class="f5boxes" id="otpRow">${[0, 1, 2, 3, 4, 5].map((i) => `<span class="${i === st.otp.length ? 'cur' : ''}">${st.otp[i] || ''}</span>`).join('')}
    <input id="f5otp" data-model="otp" data-rerender inputmode="numeric" maxlength="6" value="${esc(st.otp)}" autocomplete="one-time-code" aria-label="6-digit code" /></div>
  ${st.authErr ? `<p class="f5err" style="top:310px" role="alert">${esc(st.authErr)}</p>` : ''}
  <p class="f5exp">Code expires in <span data-live="f5exp"></span>s.<br />Didn’t received any code? <button data-act="resend5">Resend</button></p>
</div>${homeBar}`;
// Added: Figma jumps from the code straight back to Log in, so nothing ever collects a name or password.
S['a-signup'] = () => `<div class="f5auth f5otp">${statusBar(true)}${otpHead5('Let’s Get Started')}
  <div class="f5reg" id="regForm">
    <label for="f5rn">Full Name</label><input id="f5rn" data-model="regName" value="${esc(st.regName)}" placeholder="Juan Dela Cruz" autocomplete="name" />
    <label for="f5re">Email</label><input id="f5re" data-model="regEmail" type="email" value="${esc(st.regEmail)}" placeholder="name@email.com" autocomplete="email" />
    <label for="f5rp">Password</label><input id="f5rp" data-model="regPw" type="password" value="${esc(st.regPw)}" placeholder="8+ characters, A-Z, 0-9, symbol" autocomplete="new-password" />
    ${st.authErr ? `<p class="f5err" style="position:static;margin:10px 0 0" role="alert">${esc(st.authErr)}</p>` : ''}</div>
  <p class="f5sms" style="top:428px">Mobile number <b>+63 ${fmtPh5(st.phoneNum)}</b> verified</p>
  <button class="f5next" data-act="register5" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Creating…' : 'Create account'}</button></div>${homeBar}`;

// ---------- booking ----------
const svc4 = S['a-service'], det4 = S['a-details'], find4 = S['a-finding'], found4 = S['a-found'], sum4 = S['a-summary'];
// Flow 1 cuts long tier text at 60 characters. The Figma card shows two lines.
const longDesc5 = (h) => Object.values(TIERS_A).reduce((x, t) => (t.desc.length > 60 ? x.replace(t.desc.slice(0, 60) + '….', t.desc.length > 80 ? t.desc.slice(0, 79) + '....' : t.desc) : x), h);
S['a-service'] = () => (!is5() ? svc4() : longDesc5(baseSvc()).replace(/<div class="afoot">[\s\S]*$/, `<div class="afoot f5foot"><button class="abtn center" data-act="go" data-arg="a-details">Add Details</button>
    <p class="small center">Need tools or ladder? Mang Juan arrives fully equipped .</p></div>${homeBar}`));
S['a-details'] = () => (!is5() ? det4() : baseDet()
  .replace('Tell Manong what happened', 'Tell Manong What Happened')
  .replace('e.g. kitchen pipe', st.cat === 'plumbing' ? 'e.g. kitchen pipe' : esc((CAT3[st.cat] || {}).ph || 'Tell us what you need'))
  .replace('Tap to add common symptoms:', st.cat === 'plumbing' ? 'Tap to add common symptoms:' : `${(CAT3[st.cat] || {}).chips || 'Tap to add details'}:`)
  .replace('to help the aide diagnose faster and bring spare couplings.', st.cat === 'plumbing' ? 'to help the aide diagnose faster and bring spare couplings.' : 'so your Manong knows what to bring.')
  .replace('<div class="afoot" style="background:transparent;box-shadow:none;padding-top:8px">', '<div class="afoot f5foot">')
  .replace(/<button class="abtn" data-act="confirmA">[\s\S]*?<\/button>/, '<button class="abtn center" data-act="toConfirm5">Choose Your Manong</button>')
  .replace('Mang Juan arrives fully equipped.', 'Mang Juan arrives fully equipped .'));

const place5 = () => addrA().t.split(',')[0].replace(' Prime', '');
const map5 = (cls = '') => `<div class="f5map ${cls}"><img class="m" src="${F5}map.png" alt="" />${i5('radar', 'r')}<i class="ring"></i>
  <span class="mpin"><span>${i5('ic-pin-person')}</span></span><span class="tag">${i5('ic-pin-red')}${esc(place5())}</span></div>`;
const when5 = () => (st.when === 'now' ? 'Now • Today, Oct 20' : `${DAY_LONG[st.day]}, Oct ${st.day} • ${st.time}`);
const scope5 = () => (st.cat === 'plumbing' && st.tierA === 'quick' ? 'Includes diagnostic inspection, pipe check<br />&amp; leak localization' : `Includes ${esc(tA().desc.charAt(0).toLowerCase() + tA().desc.slice(1))}`);
const offer5 = () => st.offer ?? priceA() + 50;
S['a-confirm'] = () => {
  const base = priceA(), o = offer5(), g = st.pay === 'gcash';
  const chip = (v) => `<button class="${o === v ? 'on' : ''}" data-act="offer5" data-arg="=${v}" aria-pressed="${o === v}">${peso(v)}</button>`;
  const pay = (k, t, s) => `<button class="${st.pay === k ? 'on' : ''}" data-act="pay5" data-arg="${k}" role="radio" aria-checked="${st.pay === k}"><i></i><span><b>${t}</b><small>${s}</small></span></button>`;
  return `${statusBar()}${canopy('Confirm Your Booking', 'Double check your details to ensure a seamless visit.')}${map5()}
  <div class="f5sheet"><div class="grab"></div><div class="scroll">
    <section class="f5card f5sum">
      <div class="row top"><span class="ic">${i5('ic-tools')}</span><div class="grow"><small>Service scope</small><b class="big">${tA().name} (${st.cat === 'plumbing' ? FD[st.tierA] : tA().dur})</b><p>${scope5()}</p></div>${i5('ic-verified', 'ver')}</div>
      <hr /><div class="row"><span class="ic">${i5('ic-calendar')}</span><div class="grow"><small>When</small><b>${when5()}</b></div><button class="ed" data-act="sheet" data-arg="when5" aria-label="Edit time">${i5('ic-pencil')}</button></div>
      <hr /><div class="row top"><span class="ic">${i5('ic-where')}</span><div class="grow"><small>Where</small><b>${esc(addrA().short)}</b><span class="gate">${i5('ic-shield')}Gate pass ready at lobby guard</span></div><button class="ed" data-act="sheet" data-arg="addressA" aria-label="Edit address details">${i5('ic-pencil')}</button></div>
    </section>
    <section class="f5card f5fare">
      <div class="hd"><div><small>Your price offer</small><p>Fixed base price: ${peso(base)}</p></div><span class="rate">${i5('ic-bolt')}${o <= base ? 'Cheapest Rate' : o < base + 100 ? 'Cheapest Rate' : 'Fast Match'}</span></div>
      <div class="step"><button data-act="offer5" data-arg="-10" aria-label="Decrease offer" ${o <= base ? 'disabled' : ''}>${i5('ic-minus')}</button>
        <div><b>${peso(o)}</b><small>${st.cat === 'plumbing' && st.tierA === 'quick' ? 'Inspection &amp; diagnostic only' : `${tA().unit}${tA().plus ? ' • parts quoted first' : ''}`}</small></div>
        <button data-act="offer5" data-arg="10" aria-label="Increase offer">${i5('ic-plus')}</button></div>
      <div class="chips">${chip(base)}${chip(base + 50)}${chip(base + 100)}</div>
    </section>
    <section class="f5card f5pay"><small>Payment method</small>
      <div class="opts2" role="radiogroup" aria-label="Payment method">${pay('gcash', 'GCash', 'Cashless &amp; Direct')}${pay('cash', 'Cash on Hand', 'Pay after service')}</div></section>
    <div class="f5note">${i5('ic-info')}<p>Verified technicians nearby will review your request. They may accept your offer immediately or propose a counter-offer.</p></div>
    <button class="f5go" data-act="find5">${i5('ic-search-person')}<span>Find Your Manong</span><b>${peso(o)}</b>${i5('ic-arrow-gold')}</button>
  </div></div>${homeBar}`;
};

// Offers: the first Manong takes your price, the second counters ₱25 higher. Placeholder rule (open items 5 and 6).
const allOffers5 = () => {
  const o = offer5();
  const list = st.cat === 'plumbing'
    ? [{ m: CLARISO, role: 'Plumbing & Electrical Master', mins: 3, km: 0.8 }, { m: SOFIO, role: 'Master Plumber & Pipe Specialist', mins: 5, km: 1.2 }]
    : poolF().slice(0, 2).map((a) => ({ m: a.m, role: a.m.skills, mins: Math.round(a.km * 3 + 1), km: a.km }));
  return list.map((x, i) => ({ ...x, price: i ? o + 25 : o, counter: !!i }));
};
const offers5 = () => allOffers5().filter((x) => !st.f5no.includes(x.m.key)).slice(0, st.f5n);
const offerCard5 = (x) => `<article class="f5card f5offer ${x.counter ? 'ctr' : ''}">
  ${x.counter ? '' : `<span class="match">${i5('ic-thumb')}Exact Match</span>`}
  <div class="who"><span class="ph">${avF(x.m, 56)}${i5('ic-verified-badge', 'vb')}</span>
    <div class="grow"><div class="nm"><h3>${x.m.name}</h3>${x.counter ? '<span class="tagc">Counter</span>' : ''}</div><small>${esc(x.role)}</small>
      <p>${i5('ic-star-dark')}<b>${x.m.rating}</b><span>(${x.m.jobs})</span><span>•</span>${i5('ic-moto')}<span class="eta">${x.mins} mins (${x.km} km)</span></p></div></div>
  <div class="oprice">${i5(x.counter ? 'ic-counter' : 'ic-check-circle')}<span>${x.counter ? "Kuya's Counter Offer" : 'Accepted your offer'}</span><b>${peso(x.price)}</b></div>
  <div class="acts">${x.counter ? '' : `<button class="no" data-act="decline5" data-arg="${x.m.key}" aria-label="Decline ${x.m.first}'s offer">${i5('ic-x')}</button>`}
    <button class="yes" data-act="accept5" data-arg="${x.m.key}">${x.counter ? `Accept Counter (${peso(x.price)})` : `Accept ${x.m.first} (${peso(x.price)})`}${i5('ic-arrow-brown')}</button></div></article>`;
S['a-finding'] = () => {
  if (!is5()) return find4();
  const o = offer5(), list = offers5(), inc = st.inc;
  const pill = (v) => `<button class="${inc === v ? 'on' : ''}" data-act="inc5" data-arg="${v}" aria-pressed="${inc === v}">+ ${peso(v)}</button>`;
  return `${statusBar()}${canopy('Find Your Manong', 'Nearby offers will appear here live.', { backAct: 'cancelFind5' })}
  <div class="scroll f5find">${map5('inflow')}
    <div class="f5card f5status"><i></i><b>Finding available Manongs nearby...</b><span><small>Your Offer</small><b>${peso(o)}</b></span></div>
    <div class="f5count"><div><span>${i5('ic-timer')}<span>Offers refresh in <span data-live="f5t"></span>s</span></span><em>${i5('ic-bolt-red')}High Demand</em></div><div class="bar"><i data-live-w="f5pct"></i></div></div>
    <div class="f5oh"><h2>Incoming Offers</h2><span>${list.length ? `${list.length} Nearby` : 'Waiting'}</span></div>
    ${list.map(offerCard5).join('') || '<p class="f5wait">Manongs nearby are reviewing your request. Offers show up here.</p>'}
    <section class="f5raise"><div class="hd">${i5('ic-trend')}<div><h4>Need faster arrival?</h4><p>Raise your price to attract more Manongs instantly</p></div></div>
      <div class="pills">${pill(20)}${pill(50)}${pill(100)}<button data-act="sheet" data-arg="raise5" aria-label="Enter your own amount">${i5('ic-pen')}</button></div>
      <p class="new">${i5('ic-cash')}<span>New Offer:</span><b>${peso(o + inc)}</b><em>(+${peso(inc)} added)</em></p>
      <button class="upd" data-act="raise5">${i5('ic-broadcast')}<span>Update Offer</span><span>(${peso(o + inc)})</span></button></section>
    <button class="f5card f5warr" data-act="sheet" data-arg="warranty5"><span class="ic">${i5('ic-warranty')}</span><span class="grow"><b>Mang Juan Labor Warranty</b><small>Every booking covers 7-day labor back guarantee</small></span>${i5('ic-chev')}</button>
  </div>
  <div class="f5cta"><button class="f5stop" data-act="cancelFind5">${i5('ic-x-big')}<span>Cancel Request</span></button></div>${homeBar}`;
};
// Live tracking is Flow 4's screen on the Figma map card.
S['a-found'] = () => (!is5() ? found4() : found4().replace(mapPins('found'), map5()));

// Order summary keeps the Figma order (rate, praise, tip, then the bill) with the two buttons pinned below.
S['a-summary'] = () => {
  if (!is5()) return sum4();
  const [pn, pp] = CATS[st.cat].materials[0];
  return asAide(baseSum()).replace('#MN-82049', '#MJ-8821')
    .replace(/<div><span>Base price<\/span>[\s\S]*?<\/div>/, st.partOk ? `<div><span>${pn}</span><span>${peso(pp)}</span></div>` : '')
    .replace(/<div><span>Voucher MANONG50<\/span>[\s\S]*?<\/div>/, '').replace(/<div><span>Tip<\/span>[\s\S]*?<\/div>/, '')
    .replace(/<button class="abtn center" data-act="submitA">[\s\S]*<\/div><\/div>/, `</div></div>
  <div class="afoot f5foot f5sub"><button class="abtn center" data-act="submitA">Submit Rating &amp; Done</button><button class="f4txt" data-act="home">Skip for now</button></div>`);
};
S['a-cancelled'] = () => {
  const c = st.cancelled || { m: aideF(), tier: tA().name, cat: cat().name, total: offer5(), pay: st.pay, voucher: st.voucher, reason: 'Customer requested cancellation before technician dispatch' };
  const amt = peso(c.total) + '.00', g = c.pay === 'gcash';
  return `${statusBar()}<header class="ahead2"><button data-act="home" aria-label="Close">${ic('arrowL')}</button><div class="grow"><h1>${ic('receipt')}Order Summary</h1><p>Service Canceled • Refund &amp; Details</p></div></header>
  <div class="scroll"><div class="body f5cx">
    <div class="status-pill">${i5('ic-x-status')}SERVICE CANCELED • ${g ? 'FULL REFUND' : 'NO CHARGE'}</div>
    <section class="f5rc"><div class="top"><span class="ic">${i5('ic-refund')}</span><div class="grow"><b>Payment &amp; Refund</b><small>Booking ID: #MJ-8821</small></div><div class="amt"><b>₱0.00</b><span>${g ? 'REFUNDED' : 'NOT CHARGED'}</span></div></div>
      <dl><div><dt>Service Requested</dt><dd class="s">${esc(c.tier)} (${esc(c.cat)})</dd></div><div><dt>Original Total</dt><dd>${amt}</dd></div>
        <div><dt>Cancellation Fee</dt><dd><span class="waived">₱0.00 (Waived)</span></dd></div><div><dt>Refund Amount</dt><dd class="b">${g ? amt : '₱0.00'}</dd></div>
        <div><dt>Refund Method</dt><dd class="blue">${g ? 'GCash (Instant • #GC-99412)' : 'Cash, nothing collected'}</dd></div><div><dt>Cancelled At</dt><dd>Today, 10:45 AM</dd></div>
        <div class="why"><dt>Cancellation Reason</dt><dd>${esc(c.reason)}</dd></div></dl>
      <button class="dl" data-act="notice5">${i5('ic-download')}Download Cancellation Notice / E-Receipt</button></section>
    <section class="f5rc mid"><span class="av">${avF(c.m, 52)}<i>${i5('ic-x-white')}</i></span><b class="nm">${c.m.name}</b>
      <p class="meta">${CATS[st.cat].pro} <span>•</span> <span class="rt">${i5('ic-star-amber')}${c.m.rating} (${c.m.jobs} jobs)</span></p>
      <div class="wallet">${i5('ic-wallet-ok')}<p><b>Wallet Protection:</b> No cancellation penalty was charged.${c.voucher ? ' Your applied voucher <mark>MANONG50</mark> has been restored to your voucher pouch.' : ''}</p></div>
      <p class="help">Need help with this cancellation?</p><button class="sup" data-act="toast" data-arg="Mang Juan support replies within 5 minutes">Contact Customer Support 24/7${i5('ic-chev-blue')}</button></section>
  </div></div>
  <div class="f5cfoot"><button class="again" data-act="again5">${i5('ic-rebook')}Make Another Booking</button><button class="hm" data-act="home">Back to Home</button></div>${homeBar}`;
};

// ---------- sheets ----------
SHEETS.when5 = () => {
  const now = st.when === 'now', sl = slotsF(st.day);
  const slot = (t) => `<button class="f4time ${st.time === t ? 'on' : ''}" ${t === FULL_TIME ? 'disabled' : `data-act="time" data-arg="${t}" aria-pressed="${st.time === t}"`}>${t}</button>`;
  return `<h3>When do you need Manong?</h3><div class="tips" style="margin:12px 0 0"><button class="${now ? 'on' : ''}" data-act="when" data-arg="now">Now</button><button class="${now ? '' : 'on'}" data-act="when" data-arg="schedule">Schedule</button></div>
  ${now ? '<p class="sub" style="margin-top:12px">Fastest option. The closest free Manong heads over once you accept his offer.</p>'
    : `<div class="f4mon">October 2026</div><div class="f4dates">${DAYS_F.map(([d, n]) => `<button class="f4date ${st.day === n ? 'on' : ''}" data-act="dayF" data-arg="${n}" aria-pressed="${st.day === n}"><small>${d.toUpperCase()}</small><b>${n}</b></button>`).join('')}</div>
      <div class="f4times" style="margin-top:12px">${sl.map(slot).join('')}</div><p class="f4sum">${DAY_LONG[st.day]}, Oct ${st.day} at <b>${st.time}</b></p>`}
  <button class="btn primary" style="margin-top:14px" data-act="closeSheet">Done</button>`;
};
SHEETS.raise5 = () => `<h3>Raise your offer</h3><p class="sub">Add any amount on top of ${peso(offer5())}.</p>
  <div class="stack"><input class="sheetin" type="number" min="10" max="2000" step="10" inputmode="numeric" data-model="incCustom" value="${st.inc}" aria-label="Amount to add in pesos" />
  <button class="btn primary" data-act="incCustom5">Use this amount</button><button class="btn secondary" data-act="closeSheet">Cancel</button></div>`;
SHEETS.warranty5 = () => `<h3>Mang Juan Labor Warranty</h3><p class="sub">If the same problem comes back within 7 days, your Manong returns and redoes the labor for free. Parts are covered by their own receipt.</p>
  <button class="btn primary" data-act="closeSheet">Got it</button>`;

// ---------- actions ----------
const act4 = { submitA: ACT.submitA, startA: ACT.startA, loginA: ACT.loginA, confirmCancelA: ACT.confirmCancelA, cancelF: ACT.cancelF, retryF: ACT.retryF, social: ACT.social, logout: ACT.logout };
function cancel5() {
  const b = st.fb, r = st.sheet && st.sheet.reason;
  clearTimers();
  st.cancelled = { m: b ? b.m : aideF(), tier: tA().name, cat: cat().name, total: priceA(), pay: st.pay, voucher: st.voucher,
    reason: r >= 0 && r != null ? ['Plans changed', 'Fixed it myself', 'Booked the wrong time', 'Other'][r] : `Customer requested cancellation before ${b && b.status === 'pending' ? 'Manong confirmed' : 'technician dispatch'}` };
  st.fb = null;
  unbook5();
  pushN('Booking cancelled. Nothing was charged.', 'a-history');
  go('a-cancelled', { reset: true });
  st.stack = ['a-home'];
}
Object.assign(ACT, {
  submitA() {
    if (is5()) st.bid = null;
    return act4.submitA.call(ACT);
  },
  guest5() {
    st.guest = true;
    go('a-home', { reset: true, replace: true });
    toast('Browsing as guest. Log in to book.');
  },
  startA(k) {
    if (is5() && st.guest) {
      toast('Log in to book a Manong');
      return go('a-login');
    }
    if (is5() && !st.fb) {
      setCat5(k);
      Object.assign(st, { tierA: 'quick', symptomsA: [], photosA: [], descA: '', notesA: '', offer: null, inc: 50, f5no: [] });
    }
    return act4.startA.call(ACT, k);
  },
  loginA() {
    if (!is5()) return act4.loginA.call(ACT);
    const n = digits5(st.loginId).replace(/^(63|0)(?=9\d{9}$)/, '');
    st.authErr = !/^9\d{9}$/.test(n) ? 'Enter a 10-digit mobile number starting with 9.' : !st.loginPw ? 'Enter your password.' : '';
    if (st.authErr) {
      render();
      return shake('#loginForm');
    }
    st.guest = false;
    st.busy = true;
    render();
    api5('POST', '/auth/login', { mobile_number: '+63' + n, password: st.loginPw }).then(({ token, resident }) => {
      saveToken5(token);
      Object.assign(st, { user: resident, api: true, busy: false });
      go('a-home', { reset: true, replace: true });
      sync5();
    }).catch((e) => {
      st.busy = false;
      if (e.offline) return offline5(() => go('a-home', { reset: true, replace: true }));
      st.authErr = e.message || 'Could not log in. Please try again.';
      render();
      shake('#loginForm');
    });
  },
  social(n) {
    if (is5()) st.guest = false;
    return act4.social.call(ACT, n);
  },
  clearPh5() {
    st.phoneNum = st.authErr = '';
    render();
    phone.querySelector('#f5ph')?.focus();
  },
  sendCode5() {
    const n = digits5(st.phoneNum);
    st.authErr = !n ? 'Please fill this in.' : !/^9\d{9}$/.test(n) ? 'Enter a 10-digit mobile number starting with 9.' : '';
    if (st.authErr) {
      render();
      return shake('#phoneField');
    }
    st.otp = '';
    st.f5exp = 120;
    go('a-otp');
    toast('Code sent. Any 6 digits work in this prototype.');
  },
  resend5() {
    st.otp = '';
    st.f5exp = 120;
    render(true);
    toast('New code sent');
  },
  verify5() {
    if (st.f5exp <= 0) {
      st.authErr = 'That code expired. Tap Resend.';
      st.otp = '';
      return render();
    }
    go('a-signup', { replace: true });
  },
  register5() {
    const pw = st.regPw;
    st.authErr = st.regName.trim().length < 2 ? 'Enter your full name.' : !/^\S+@\S+\.\S+$/.test(st.regEmail.trim()) ? 'Enter a valid email address.'
      : pw.length < 8 || !/[A-Z]/.test(pw) || !/\d/.test(pw) || !/[^A-Za-z0-9]/.test(pw) ? 'Use at least 8 characters with an uppercase letter, a number and a special character.' : '';
    if (st.authErr) {
      render();
      return shake('#regForm');
    }
    const mob = digits5(st.phoneNum);
    const done = () => {
      st.stack = [];
      go('a-login', { replace: true });
      st.loginId = fmtPh5(mob);
      render();
      toast('Account created. Log in to continue.');
    };
    st.busy = true;
    render();
    api5('POST', '/auth/register', { full_name: st.regName, email: st.regEmail, mobile_number: '+63' + mob, password: pw }).then(() => {
      st.busy = false;
      done();
    }).catch((e) => {
      st.busy = false;
      if (e.offline) return offline5(done);
      st.authErr = (e.fields && Object.values(e.fields)[0]) || e.message || 'Could not create the account. Please try again.';
      render();
      shake('#regForm');
    });
  },
  toConfirm5() {
    if (!st.descA.trim() && !st.symptomsA.length) {
      toast('Add a description or tap a symptom');
      return shake('#descCard');
    }
    st.offer ??= priceA() + 50;
    go('a-confirm');
  },
  offer5(a) {
    const base = priceA();
    st.offer = Math.max(base, Math.min(base + 2000, a[0] === '=' ? +a.slice(1) : offer5() + +a));
    render();
  },
  pay5(k) {
    st.pay = k;
    render();
  },
  find5() {
    st.offer = offer5();
    Object.assign(st, { f5n: 0, f5t: 24, f5no: [], inc: 50 });
    go('a-finding');
    book5();
  },
  inc5(v) {
    st.inc = +v;
    render();
  },
  incCustom5() {
    st.inc = Math.max(10, Math.min(2000, Math.round(+st.incCustom || st.inc)));
    st.sheet = null;
    render();
  },
  raise5() {
    st.offer = offer5() + st.inc;
    Object.assign(st, { f5no: [], f5t: 30, f5n: Math.max(st.f5n, 1) });
    render();
    toast(`Offer raised to ${peso(st.offer)}. Manongs nearby were notified.`);
  },
  decline5(k) {
    st.f5no.push(k);
    render();
    toast('Offer declined');
  },
  accept5(k) {
    const x = allOffers5().find((o) => o.m.key === k);
    if (!x) return;
    clearTimers();
    st.pickManong = k;
    st.offer = x.price;
    // The agreed price becomes this booking's price, so the bill, receipt and history all show it.
    TIERS_A[st.tierA] = { ...TIERS_A[st.tierA], price: x.price + voucherOff() };
    const now = st.when === 'now';
    if (now) Object.assign(st, { arrived: false, eta: 10, km: 1.4 });
    st.fb = now ? { status: 'onway', mode: 'now', cat: st.cat, m: x.m, day: 20, time: 'Now', tier: st.tierA } : { status: 'pending', mode: 'schedule', cat: st.cat, m: x.m, day: st.day, time: st.time, tier: st.tierA };
    pushN(now ? `${x.m.first} accepted your request` : `Request sent to ${x.m.first}. We'll tell you when he confirms.`, now ? 'a-home' : 'a-history');
    go(now ? 'a-found' : 'a-pending', { reset: true });
    st.stack = ['a-home'];
    if (now) toast(`${x.m.first} is on the way`);
  },
  cancelFind5() {
    clearTimers();
    unbook5();
    go('a-confirm', { replace: true });
    toast('Request cancelled. Nothing was charged.');
  },
  confirmCancelA() {
    return is5() ? cancel5() : act4.confirmCancelA.call(ACT);
  },
  cancelF() {
    return is5() ? cancel5() : act4.cancelF.call(ACT);
  },
  retryF(w) {
    if (!is5()) return act4.retryF.call(ACT, w);
    const b = st.fb;
    st.fb = null;
    st.f5no = b ? [b.m.key] : [];
    if (b && b.cat) st.cat = b.cat;
    Object.assign(st, { f5n: 0, f5t: 24 });
    go(w === 'manong' ? 'a-finding' : 'a-confirm', { reset: true });
    st.stack = ['a-home'];
    if (w === 'time') sheet('when5');
  },
  cancelSrv5(id) {
    st.sheet = null;
    render();
    api5('PATCH', `/bookings/${encodeURIComponent(id)}/cancel`).then(() => toast('Request cancelled. Nothing was charged.')).catch((e) => toast(e.offline ? 'Server not reachable. Try again.' : e.message)).finally(sync5);
  },
  logout() {
    if (is5()) saveToken5(null);
    return act4.logout.call(ACT);
  },
  again5() {
    st.cancelled = null;
    go('a-home', { reset: true, replace: true });
  },
  notice5() {
    const c = st.cancelled;
    if (!c) return toast('Nothing to download');
    const t = ['MANG JUAN CANCELLATION NOTICE', 'Booking #MJ-8821', `${c.tier} (${c.cat})`, `Original total: ${peso(c.total)}.00`, 'Cancellation fee: ₱0.00 (waived)', `Reason: ${c.reason}`, `Manong: ${c.m.name}`].join('\n') + '\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' }));
    a.download = 'mang-juan-cancellation-MJ-8821.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Cancellation notice downloaded');
  },
});
// Phone and code fields use the device's own number keyboard. Capture phase: digits only, before app.js stores the value.
phone.addEventListener('input', (e) => {
  const t = e.target;
  if (!is5() || !['f5ph', 'f5otp'].includes(t.id)) return;
  t.value = digits5(t.value).slice(0, t.maxLength);
  st.authErr = '';
  if (t.id === 'f5otp' && t.value.length === 6) setTimeout(() => is5() && st.screen === 'a-otp' && st.otp.length === 6 && ACT.verify5(), 250);
}, true);
phone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'f5ph') ACT.sendCode5();
});

// ---------- back end (src/server/app.js) ----------
// Flow 5 talks to the API when the page is served by Express. If the API can't be reached (static
// host, server down, 5xx) every call falls back to the mock behaviour above, so the walkthrough still runs.
const TOKEN5 = 'mj_token';
const token5 = () => {
  try {
    return localStorage.getItem(TOKEN5);
  } catch {
    return null;
  }
};
const saveToken5 = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN5, t);
    else localStorage.removeItem(TOKEN5);
  } catch {
    /* private mode: the session just won't survive a reload */
  }
};
async function api5(method, path, body) {
  let r;
  try {
    r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token5() && { Authorization: 'Bearer ' + token5() }) }, body: body && JSON.stringify(body) });
  } catch {
    throw { offline: true };
  }
  const j = await r.json().catch(() => null);
  if (r.ok) return j || {}; // 204 No Content has no body
  // An expired or bad token on any signed-in call: drop it and send the resident to Log in.
  if (r.status === 401 && !path.startsWith('/auth')) {
    saveToken5(null);
    if (is5() && !['a-welcome', 'a-login'].includes(st.screen)) {
      go('a-login', { reset: true });
      toast('Please log in again');
    }
  }
  if (!j || !j.error || r.status >= 500) throw { offline: true };
  throw j.error;
}
// Sample data only in the ?lab prototype. In the real app a server failure must never look like a
// successful sign-up or booking.
function offline5(then) {
  if (APP5) {
    render(); // clears the busy state on the button
    return toast("Can't reach the server right now. Please try again in a moment.");
  }
  st.api = false;
  then();
  toast('Demo mode: server not reachable, using sample data');
}
const SVC_TYPE5 = { quick: 'CHECKUP', standard: 'STANDARD', major: 'MAJOR' };
const SVC_LABEL5 = { CHECKUP: 'Checkup / Quick Repair', STANDARD: 'Standard Service', MAJOR: 'Major Repair' }; // labels from src/utils/contract.js
// The prototype's calendar is a fixed week where "today" is Oct 20. Real bookings need a real date,
// so day 21 becomes tomorrow, day 22 the day after, and so on (Manila time).
function realTime5() {
  const [, h, m, ap] = /^(\d+):(\d+) (AM|PM)$/.exec(st.time) || [0, '10', '30', 'AM'];
  const d = new Date();
  d.setDate(d.getDate() + (st.day - 20));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p((+h % 12) + (ap === 'PM' ? 12 : 0))}:${m}:00+08:00`;
}
function book5() {
  if (!st.api) return;
  const now = st.when === 'now', a = addrA();
  api5('POST', '/bookings', {
    category: st.cat, service_type: SVC_TYPE5[st.tierA], booking_type: now ? 'on-demand' : 'scheduled', ...(now ? {} : { scheduled_for: realTime5() }),
    address: `${a.short}, ${a.t}`.slice(0, 200), problem: [...st.symptomsA, st.descA.trim()].filter(Boolean).join('; ').slice(0, 300), price_offer: offer5(),
  }).then(({ booking }) => {
    st.bid = booking.id;
    sync5();
  }).catch((e) => {
    if (e.code === 'UNAUTHENTICATED') return; // api5 already sent them to Log in
    if (st.screen === 'a-finding') {
      clearTimers();
      go('a-confirm', { replace: true });
    }
    toast((e.fields && Object.values(e.fields)[0]) || e.message || 'Could not send the request');
  });
}
function unbook5() {
  const id = st.bid;
  st.bid = null;
  if (st.api && id) api5('PATCH', `/bookings/${id}/cancel`).catch(() => {}).finally(sync5);
}
function sync5() {
  if (!st.api) return;
  api5('GET', '/bookings').then(({ bookings }) => {
    st.srv = bookings;
    if (is5() && st.screen === 'a-history' && !st.sheet) render();
  }).catch(() => {});
}
// Bookings tab: requests saved on the server, with their contract status. Statuses only move when the
// aide side (Team 2) updates them, so a request stays "Requested" here while the prototype simulates the visit.
const CHIP5 = { Requested: 'pending', 'Pending Confirmation': 'pending', Accepted: 'confirmed', Confirmed: 'confirmed', 'In Progress': 'onway', Completed: 'paid', Declined: 'declined', Cancelled: 'declined' };
const OPEN5 = ['Requested', 'Pending Confirmation', 'Accepted', 'Confirmed'];
const srvRow5 = (b) => {
  const c = Object.hasOwn(CATS, b.category) ? CATS[b.category] : null;
  const when = b.scheduled_for ? new Date(b.scheduled_for).toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'On-demand';
  return `<div class="listrow f5srow">${ic(c ? c.icon : 'wrench')}<div class="grow"><b>${esc(c ? c.name : b.category)}, ${esc(SVC_LABEL5[b.service_type] || b.service_type)}</b><small>${esc(when)}${b.price_offer != null ? ` • ${peso(b.price_offer)}` : ''}</small>
    <span style="display:block;margin-top:6px"><span class="f4chip ${CHIP5[b.status] || 'pending'}">${esc(b.status)}</span></span></div>
    ${OPEN5.includes(b.status) ? `<button class="f5cxl" data-act="sheet" data-arg="cancelSrv5" data-arg2="${esc(b.id)}">Cancel</button>` : ''}</div>`;
};
SHEETS.cancelSrv5 = () => `<h3>Cancel this request?</h3><p class="sub">It's free until your Manong starts the job.</p>
  <div class="stack"><button class="btn danger" data-act="cancelSrv5" data-arg="${esc(st.sheet.arg2)}">Cancel request</button><button class="btn secondary" data-act="closeSheet">Keep it</button></div>`;
const hist5 = S['a-history'], acct5 = S['a-account'], thanks5 = S['a-thanks'];
S['a-history'] = () => {
  const h = hist5();
  if (!is5() || !st.srv || !st.srv.length) return h;
  const up = st.bkTabF === 'up', rows = st.srv.filter((b) => OPEN5.includes(b.status) === up);
  if (!rows.length) return h;
  return h.replace('<div class="scroll" style="padding:8px 16px 20px">', `<div class="scroll" style="padding:8px 16px 20px"><div class="f5srv"><h3 class="f4cap" style="margin:6px 4px 8px">${up ? 'Your requests' : 'Closed requests'}</h3><div class="list">${rows.map(srvRow5).join('')}</div></div>`);
};
// The signed-in resident's details replace the sample profile.
const me5 = (h) => {
  const u = is5() && st.user;
  if (!u) return h;
  const first = esc(u.full_name.split(' ')[0]), ini = esc(u.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase());
  return h.replace('<span class="f4av">ES</span>', `<span class="f4av">${ini}</span>`).replace('<h1>Enzo Santos</h1>', `<h1>${esc(u.full_name)}</h1>`)
    .replace('0917 555 0142 · enzo@email.com', `${esc(u.mobile_number)} · ${esc(u.email)}`).replace('Salamat, Enzo', `Salamat, ${first}`).replace('enzo@email.com', esc(u.email));
};
S['a-account'] = () => me5(acct5());
S['a-thanks'] = () => me5(thanks5());
const afterHist5 = AFTER['a-history'];
AFTER['a-history'] = () => {
  if (afterHist5) afterHist5();
  if (is5()) sync5();
};

// ---------- timers and live text ----------
Object.assign(LIVE, { f5t: () => st.f5t, f5pct: () => Math.round((st.f5t / 30) * 100) + '%', f5exp: () => st.f5exp });
const afterFind4 = AFTER['a-finding'];
AFTER['a-finding'] = () => {
  if (!is5()) return afterFind4();
  every(1000, () => {
    st.f5t = st.f5t <= 1 ? 30 : st.f5t - 1;
    const max = allOffers5().length;
    if (st.f5n < max && st.f5t % 2 === 0) {
      st.f5n++;
      return render();
    }
    live();
  });
};
// Scheduled bookings no longer move on by themselves: the aide side moves them (live.js).
// A saved session goes straight to Home.
if (APP5) addEventListener('DOMContentLoaded', () => {
  if (!token5() || !is5()) return;
  api5('GET', '/me').then(({ resident }) => {
    if (!is5() || !['a-welcome', 'a-login'].includes(st.screen)) return;
    Object.assign(st, { user: resident, api: true });
    go('a-home', { reset: true, replace: true });
    sync5();
  }).catch((e) => {
    if (!e.offline) saveToken5(null);
  });
});
AFTER['a-phone'] = () => is5() && phone.querySelector('#f5ph')?.focus();
AFTER['a-otp'] = () => {
  if (!is5()) return;
  phone.querySelector('#f5otp')?.focus();
  every(1000, () => {
    st.f5exp = Math.max(0, st.f5exp - 1);
    live();
  });
};

// ---------- panel: frame names and jump list ----------
for (const [k, label] of [
  ['a-welcome', 'FIRST PAGE'], ['a-login', 'LOG IN PAGE WITH LOGO'], ['a-phone', 'USING MOBILE WITH CODE (phone number)'], ['a-otp', 'USING MOBILE WITH CODE (6-digit code)'],
  ['a-signup', 'Create account (added)'], ['a-home', 'V4 · Home'], ['a-service', 'BOOKING'], ['a-details', 'SERVICE DETAILS'], ['a-confirm', 'DETAIL CONFIRMATION (Confirm Your Booking)'],
  ['a-finding', 'DETAIL CONFIRMATION (Find Your Manong)'], ['a-found', 'LIVE TRACKING'], ['a-pending', 'SCHEDULED SERVICE'], ['a-declined', 'SCHEDULED SERVICE: NOT AVAILABLE'],
  ['a-summary', 'ORDER SUMMARY PT1 + PT2'], ['a-cancelled', 'ORDER SUMMARY ALT'], ['a-thanks', 'RECEIPT'], ['a-history', 'BOOKING HISTORY'], ['a-account', 'ACCOUNT'], ['a-messages', 'MESSAGES'], ['a-notifs', 'NOTIFICATIONS'],
]) {
  FRAMES[k] = { ...(typeof FRAMES[k] === 'object' ? FRAMES[k] : FRAMES[k] ? { main: FRAMES[k] } : {}), f5: label };
}
JUMP.f5 = ['a-welcome', 'a-login', 'a-phone', 'a-otp', 'a-signup', 'a-home', 'a-service', 'a-details', 'a-confirm', 'a-finding', 'a-found', 'a-pending', 'a-declined', 'a-summary', 'a-cancelled', 'a-thanks', 'a-history', 'a-account', 'a-messages', 'a-notifs'];
const jump4 = jumpTo;
jumpTo = (s) => {
  if (!is5()) return jump4(s);
  if (['a-confirm', 'a-finding'].includes(s)) st.offer ??= priceA() + 50;
  if (['a-otp', 'a-signup'].includes(s) && !st.phoneNum) st.phoneNum = '9661234567';
  if (s === 'a-otp') Object.assign(st, { otp: '1', f5exp: 120 });
  if (s === 'a-finding') {
    Object.assign(st, { fb: null, sheet: null, call: null, f5n: 2, f5t: 24, f5no: [] });
    return baseJump4(s);
  }
  return jump4(s);
};

// Moved here from an inline <script> so the CSP can stay script-src 'self'.
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
