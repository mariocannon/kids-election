import express from 'express';
import os from 'node:os';
import * as db from './lib/db.js';
import { writeBallots } from './lib/pdf.js';

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
const BASE_URL = (process.env.BASE_URL || `http://${lanAddress()}:${PORT}`).replace(/\/$/, '');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.static(new URL('./public', import.meta.url).pathname));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lanAddress() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return 'localhost';
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const MENU = [
  { key: 'signup', href: '/', label: 'Sign up', icon: '✋' },
  { key: 'parties', href: '/parties', label: 'Parties', icon: '🎉' },
  { key: 'results', href: '/results', label: 'Results', icon: '📊' },
  { key: 'admin', href: '/admin', label: 'Teacher', icon: '🔐' },
];

function menu(active) {
  return `<nav class="menu">
    <a class="menu-brand" href="/">🗳️ <span>Kids Election</span></a>
    <div class="menu-links">${MENU.map((m) => `
      <a href="${m.href}" class="${m.key === active ? 'active' : ''}"><span class="mi">${m.icon}</span> ${m.label}</a>`).join('')}
    </div>
  </nav>`;
}

function page(title, body, { refresh, active } = {}) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ''}
<title>${esc(title)}</title>
<link rel="stylesheet" href="/style.css">
</head><body>${menu(active)}${body}</body></html>`;
}

function isAdmin(req) {
  const cookie = req.headers.cookie ?? '';
  return cookie.split(';').some((c) => c.trim() === `admin=${encodeURIComponent(ADMIN_PIN)}`);
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.redirect('/admin/login');
}

function partyCard(p) {
  return `<div class="party" style="--c:${p.color}">
    <div class="logo">${esc(p.initials)}</div>
    <div>
      <h3>${esc(p.name)}</h3>
      <p class="leader">Led by ${esc(p.leader)}</p>
      <p class="slogan">“${esc(p.slogan)}”</p>
      <ul>${p.promises.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>
  </div>`;
}

function resultsBars(election, tally) {
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  return election.parties.map((p) => {
    const v = tally[p.id] ?? 0;
    const pct = total ? Math.round((v / total) * 100) : 0;
    return `<div class="bar-row">
      <span class="bar-label">${esc(p.name)}</span>
      <div class="bar"><div style="width:${pct}%;background:${p.color}"></div></div>
      <span class="bar-num">${v} <small>(${pct}%)</small></span>
    </div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Kid-facing pages
// ---------------------------------------------------------------------------

app.get('/', (req, res) => {
  const e = db.getElection();
  res.send(page(e.title, `
    <main class="narrow">
      <div class="hero">
        <div class="ballot-box">🗳️</div>
        <h1>${esc(e.title)}</h1>
        <p>Every voice counts! Sign up to get your very own ballot.</p>
      </div>
      <form method="post" action="/signup" class="card">
        <label>Your first name<input name="name" required maxlength="40" autocomplete="off" placeholder="e.g. Sam"></label>
        <label>Your class <span class="opt">(optional)</span><input name="class_name" maxlength="30" autocomplete="off" placeholder="e.g. 3B"></label>
        <button class="big">Register to vote! ✋</button>
      </form>
      <p class="center"><a class="button" href="/parties">🎉 Meet the parties</a></p>
    </main>`, { active: 'signup' }));
});

app.get('/parties', (req, res) => {
  const e = db.getElection();
  res.send(page(`${e.title} – Parties`, `
    <main>
      <h1 class="center">Meet the parties</h1>
      <p class="center">Read what each party promises, then pick the one you like best on voting day!</p>
      <div class="parties">${e.parties.map(partyCard).join('')}</div>
      <p class="center"><a class="button" href="/">✋ Register to vote</a></p>
    </main>`, { active: 'parties' }));
});

app.post('/signup', (req, res) => {
  const name = String(req.body.name ?? '').trim().slice(0, 40);
  const className = String(req.body.class_name ?? '').trim().slice(0, 30);
  if (!name) return res.redirect('/');
  const v = db.addVoter(name, className);
  res.redirect(`/registered/${v.token}`);
});

app.get('/registered/:token', (req, res) => {
  const v = db.getVoterByToken(req.params.token);
  if (!v) return res.status(404).send(page('Not found', '<main class="narrow"><h1>Hmm, we can’t find that voter.</h1></main>'));
  res.send(page('You’re registered!', `
    <main class="narrow center">
      <div class="voter-card">
        <div class="vc-top">VOTER CARD</div>
        <div class="vc-name">${esc(v.name)}</div>
        ${v.class_name ? `<div class="vc-class">Class ${esc(v.class_name)}</div>` : ''}
        <div class="vc-num">Voter #${String(v.id).padStart(3, '0')}</div>
      </div>
      <h1>You’re registered, ${esc(v.name)}! 🎉</h1>
      <p>Your ballot will be ready on voting day. When you vote, colour in one circle,
      hand your <b>voter stub</b> to the poll worker, and put your ballot in the box.</p>
      <p><a class="button" href="/">Register someone else</a></p>
    </main>`));
});

// Scanned from the QR code on the ballot stub.
app.get('/checkin/:token', (req, res) => {
  const v = db.getVoterByToken(req.params.token);
  if (!v) {
    return res.status(404).send(page('Unknown ballot', `
      <main class="narrow center status bad"><div class="emoji">❓</div>
      <h1>We don’t know this ballot</h1><p>Ask a grown-up to check the voter list.</p></main>`));
  }
  const fresh = db.checkIn(v);
  const voter = db.getVoter(v.id);
  res.send(page(fresh ? 'Thanks for voting!' : 'Already voted', fresh ? `
    <main class="narrow center status good">
      <div class="emoji">🎉</div>
      <h1>Thanks for voting, ${esc(voter.name)}!</h1>
      <p>You are checked in. Don’t forget your “I Voted” sticker!</p>
      <div class="sticker">I VOTED</div>
    </main>` : `
    <main class="narrow center status warn">
      <div class="emoji">✋</div>
      <h1>${esc(voter.name)} already voted</h1>
      <p>Checked in at ${esc(voter.voted_at.slice(11, 16))}. In an election, everyone gets just <b>one</b> vote!</p>
    </main>`));
});

app.get('/results', (req, res) => {
  const e = db.getElection();
  const voters = db.listVoters();
  const voted = voters.filter((v) => v.voted_at).length;
  const pct = voters.length ? Math.round((voted / voters.length) * 100) : 0;
  res.send(page(`${e.title} – Results`, `
    <main>
      <h1 class="center">${esc(e.title)}</h1>
      <section class="card">
        <h2>Turnout</h2>
        <p class="turnout"><b>${voted}</b> of <b>${voters.length}</b> registered voters have voted (${pct}%)</p>
        <div class="bar"><div style="width:${pct}%;background:#2a9d4b"></div></div>
      </section>
      <section class="card">
        <h2>Votes counted</h2>
        ${resultsBars(e, db.getTally())}
      </section>
      <p class="center muted">This page updates by itself every 5 seconds.</p>
    </main>`, { refresh: 5, active: 'results' }));
});

// ---------------------------------------------------------------------------
// Teacher / election officer pages
// ---------------------------------------------------------------------------

app.get('/admin/login', (req, res) => {
  res.send(page('Election office', `
    <main class="narrow">
      <h1>🔐 Election office</h1>
      <form method="post" action="/admin/login" class="card">
        ${req.query.bad ? '<p class="error">That PIN isn’t right.</p>' : ''}
        <label>Teacher PIN<input name="pin" type="password" inputmode="numeric" autofocus></label>
        <button class="big">Enter</button>
      </form>
    </main>`, { active: 'admin' }));
});

app.post('/admin/login', (req, res) => {
  if (req.body.pin !== ADMIN_PIN) return res.redirect('/admin/login?bad=1');
  res.setHeader('Set-Cookie', `admin=${encodeURIComponent(ADMIN_PIN)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  res.redirect('/admin');
});

app.get('/admin', requireAdmin, (req, res) => {
  const e = db.getElection();
  const voters = db.listVoters();
  const tally = db.getTally();
  const voted = voters.filter((v) => v.voted_at).length;
  const counted = Object.values(tally).reduce((a, b) => a + b, 0);

  res.send(page('Election office', `
    <main>
      <h1>🏛️ Election office</h1>

      <div class="stats">
        <div><b>${voters.length}</b><span>registered</span></div>
        <div><b>${voted}</b><span>checked in</span></div>
        <div><b>${counted}</b><span>ballots counted</span></div>
      </div>

      <section class="card">
        <h2>1. Set up the election</h2>
        <form method="post" action="/admin/election" class="row">
          <label>Election name<input name="title" value="${esc(e.title)}" maxlength="60"></label>
          <label>Voting day<input name="date" type="date" value="${esc(e.date)}"></label>
          <button>Save</button>
        </form>
        <form method="post" action="/admin/parties" class="row"
              onsubmit="return confirm('Make brand new parties? Ballots you already printed will be out of date, and the vote count resets.')">
          <label>Number of parties<input name="count" type="number" min="2" max="8" value="${e.parties.length}"></label>
          <button>🎲 Make new random parties</button>
        </form>
        <div class="parties">${e.parties.map(partyCard).join('')}</div>
      </section>

      <section class="card">
        <h2>2. Voters</h2>
        <form method="post" action="/admin/voters" class="row">
          <label>Add a voter<input name="name" required maxlength="40" placeholder="Name"></label>
          <label>Class<input name="class_name" maxlength="30"></label>
          <button>Add</button>
        </form>
        ${voters.length ? `
          <p><a class="button" href="/admin/ballots.pdf" target="_blank">🖨️ Print all ${voters.length} ballots (PDF)</a></p>
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Class</th><th>Status</th><th></th></tr></thead>
            <tbody>${voters.map((v) => `
              <tr class="${v.voted_at ? 'voted' : ''}">
                <td>${String(v.id).padStart(3, '0')}</td>
                <td>${esc(v.name)}</td>
                <td>${esc(v.class_name)}</td>
                <td>${v.voted_at ? `✅ voted ${esc(v.voted_at.slice(11, 16))}` : '⏳ not yet'}</td>
                <td class="actions">
                  <a href="/admin/ballots.pdf?id=${v.id}" target="_blank">Ballot</a>
                  ${v.voted_at ? `<form method="post" action="/admin/voters/${v.id}/undo"><button class="link">Undo check-in</button></form>` : ''}
                  <form method="post" action="/admin/voters/${v.id}/delete" onsubmit="return confirm('Remove this voter?')"><button class="link danger">Remove</button></form>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>` : '<p class="muted">No one has signed up yet. Share the sign-up link below!</p>'}
        <p class="muted">Sign-up link for kids: <code>${esc(BASE_URL)}/</code></p>
      </section>

      <section class="card" id="count">
        <h2>3. Count the votes</h2>
        <p class="muted">Open the ballot box and tap + for each ballot.</p>
        ${e.parties.map((p) => `
          <div class="count-row" style="--c:${p.color}">
            <span class="dot"></span><span class="count-name">${esc(p.name)}</span>
            <form method="post" action="/admin/tally/${p.id}/-1"><button class="round">−</button></form>
            <b class="count">${tally[p.id] ?? 0}</b>
            <form method="post" action="/admin/tally/${p.id}/1"><button class="round plus">+</button></form>
          </div>`).join('')}
        <h3>Results so far</h3>
        ${resultsBars(e, tally)}
      </section>

      <section class="card danger-zone">
        <h2>Start over</h2>
        <form method="post" action="/admin/reset" onsubmit="return confirm('Delete ALL voters, votes and parties? This cannot be undone.')">
          <button class="danger">Reset the whole election</button>
        </form>
      </section>
    </main>`, { active: 'admin' }));
});

app.post('/admin/election', requireAdmin, (req, res) => {
  db.updateElection({ title: String(req.body.title ?? '').trim().slice(0, 60), date: req.body.date });
  res.redirect('/admin');
});

app.post('/admin/parties', requireAdmin, (req, res) => {
  db.newParties(Number(req.body.count) || 4);
  res.redirect('/admin');
});

app.post('/admin/voters', requireAdmin, (req, res) => {
  const name = String(req.body.name ?? '').trim().slice(0, 40);
  if (name) db.addVoter(name, String(req.body.class_name ?? '').trim().slice(0, 30));
  res.redirect('/admin');
});

app.post('/admin/voters/:id/undo', requireAdmin, (req, res) => {
  db.undoCheckIn(Number(req.params.id));
  res.redirect('/admin');
});

app.post('/admin/voters/:id/delete', requireAdmin, (req, res) => {
  db.deleteVoter(Number(req.params.id));
  res.redirect('/admin');
});

app.post('/admin/tally/:partyId/:delta', requireAdmin, (req, res) => {
  const delta = Number(req.params.delta) > 0 ? 1 : -1;
  db.changeTally(Number(req.params.partyId), delta);
  res.redirect('/admin#count');
});

app.post('/admin/reset', requireAdmin, (req, res) => {
  db.resetEverything();
  res.redirect('/admin');
});

app.get('/admin/ballots.pdf', requireAdmin, async (req, res) => {
  const voters = req.query.id ? [db.getVoter(Number(req.query.id))].filter(Boolean) : db.listVoters();
  if (!voters.length) return res.status(404).send('No voters to print.');
  const name = voters.length === 1 ? `ballot-${voters[0].id}.pdf` : 'ballots.pdf';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${name}"`);
  await writeBallots(res, db.getElection(), voters, BASE_URL);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🗳️  Kids Election is running!`);
  console.log(`   Kids sign up at:   ${BASE_URL}/`);
  console.log(`   Teacher office:    ${BASE_URL}/admin   (PIN: ${ADMIN_PIN})`);
  console.log(`   Results board:     ${BASE_URL}/results\n`);
});
