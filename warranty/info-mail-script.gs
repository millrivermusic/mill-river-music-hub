/**
 * Mill River Music — info@ mail bridge (runs as info@millrivermusic.com)
 * v2 (11/5/2026): adds the Returns desk.
 * v3 (11/6/2026): when a new reply comes in from Martin, Taylor or a returns customer, puts a task on the
 *   assigned person's Google Tasks list (Jon's list if nobody is assigned). Needs the Google Tasks service:
 *   in the editor, Services (+) → Google Tasks API → Add.
 *
 * What it does
 *  1. Sends warranty emails for the Warranty Desk app (only when a person presses Send in the app).
 *  2. Every 10 minutes, copies emails to/from Martin and Taylor (SV Network) into the
 *     Airtable "Warranty Emails" table and links each one to its warranty case.
 *  3. Sends Returns desk emails to customers (only to the email on that return, only when a person presses Send).
 *  4. Every 10 minutes, copies customer replies for open returns into the Airtable "Customer Emails" table.
 *
 * Setup (one time) — see the instructions in the chat / README:
 *  - Project Settings → Script Properties: AIRTABLE_TOKEN (Airtable key), APP_SECRET (any long random text).
 *  - Run setup() once and approve. Then Deploy → New deployment → Web app
 *    (Execute as: Me, Who has access: Anyone). Paste the Web app URL + APP_SECRET into the Warranty Desk.
 *  - Optional: run backfill() a few times to import past threads (it picks up where it left off).
 */

const BASE = 'appZD2jJGbSlvofcV';
const EMAILS = { table: 'tblEJMNYQqquKdAH7', subject: 'flduAb86xDHLDvkIe', dir: 'fld7plUKF9f1xgiYD', from: 'fldDaqVri7Z30q1TL', to: 'fldAFxzFUgJDiuHqt',
  date: 'fldJ1w3ENP13tJX3o', body: 'fld6qJaeu8GQZL6PM', files: 'fldrMT3eleu7YNEeP', taylor: 'fldPnLunZaz9e7BO1', martin: 'fldAXS96YZBtMEI9T',
  msgId: 'fldYEO5Tw1ecbfyks', threadId: 'fldUx2qKKilnwo1Ju', seen: 'fldHBUTfVZsjaGoIM', sentBy: 'fldmbeyV3R2n3lMcF', match: 'fld0SaCvatYliLDdD',
  sendStatus: 'fldiVh08toIicpJ25', sendError: 'fldGNwSArBAg46HOG' };
const CASES = {
  taylor: { tech: 'fldyjazpXcJlkRKTp', table: 'tblUR6Y7rfCLBSllO', serial: 'fld2McIGsJW9un93M', num: 'fldYVUlLDkE8qnrop', cust: 'fld9Iym9sy5E7sQIS', threads: 'fldDCyt7LVfPNeVvi', appr: 'fldx9f5sQ0KZcwE0w', status: 'fldAgQWqOARycTlWc' },
  martin: { tech: 'fld4DAdNsuU9KQ3o4', table: 'tblqbwCvWxNz1REQt', serial: 'fldy6Cm4X17XUmsyr', num: 'fld6WsAofFOzjA1b4', cust: 'fldF2Y0xXQgsxr9dx', threads: 'fldwOwSVtR7rER66N', appr: 'fld6kJ1tCgP9Tmbhi', status: 'fld6AgAOjS2mCSErR' },
};
const CUSTOMERS = { table: 'tblGJnacXCV52gZdS', last: 'fldQCocWmypjXyXWp', name: 'fldyOzHd6uRNuaTHa' };
/* Returns desk */
const CEM = { table: 'tbl35TzF46dljMoYg', subject: 'fldNF4HRskYDlcxVy', dir: 'fldezFcFYYik6PLLx', from: 'fld8ugiNMI7quwMcT', to: 'fldxlxeSnXmvgDu8K',
  date: 'fld0BHXUB0dcqPwTu', body: 'fldHBGw8JbAMgpY4T', files: 'fldlweWx0rUq2DNtA', ret: 'fldPMQfxoSoqIT1wY', msgId: 'fld5bCjoRE9JQu9Z2',
  threadId: 'fldKHvJzRqxql7Z7J', seen: 'fldJiFwLXjV86FgcW', sentBy: 'fldNYqUUr8YYYw4pv', match: 'fldnjkVF4d2xQEwJW', sendStatus: 'fld3Kq4ATTQuhDYoo', sendError: 'fldBOUCcMteGh12pA' };
const RETURNS = { assignee: 'fldpZxZ3SRaW6ehDr', table: 'tblkWYK4EudB8tW7G', name: 'fldVim5LDQ89b8qAd', email: 'fldswFlQaMB62aWE6', status: 'fldUrDMkm0nO96hXc', threads: 'fldQZtjN6wj23Ofno' };
const FACTORY = ['martinguitar.com', 'taylorguitars.com'];
/* Google Tasks lists on info@, by staff record (Employees table). Julia is left out on purpose:
   nothing goes on her list without an OK from Jon, Sam or Nina. Unassigned goes to Jon. */
const TASK_LISTS = {
  rechZIpGZAIOuGaYJ: 'dUJrbGEzNC1YOTZlVE5EZg', // Jon
  recLmkipyjft62jRL: 'MTczMTQzMTk4MjE4ODIyNTkzMDU6OTYxMjM2MTAwMDExNjc4OTow', // Jeff
  recEoekxSRq7EsQkO: 'QmEyNjlyLTNCMEt1d0NGTg', // Chris
  recbvNLEkdm4HNu3J: 'V2FGSVV0WXdLcHhIUWFqMQ', // Sturgis
  rec0u7Ikoxfo5kJCX: 'QkRwb1FRemZwZGVGV3c5bQ', // Sam
  recNaeY3xVY0sKxhH: 'V0o1eHZXdVJNYmx4SEJYLQ', // Andy
  recQpdH2QkplH8Sl0: 'N1hheS16UFJ5eXpPSXhoWg', // Nina
  recriRN9RxxEa2PyC: 'X3R0b0M5TC1tY1hZZmhHZg', // Ben
  recroDei0NGN6CA1R: 'd3pJTFJVejNVZVFQNVlPTg', // Allie
  rect9RExJhI14zXfS: 'Z0NCUHNMWU5aeXlsOUlPRw', // Ethan
};
const TASK_LISTS_BY_NAME = { jon: 'dUJrbGEzNC1YOTZlVE5EZg', jeff: TASK_LISTS.recLmkipyjft62jRL, chris: TASK_LISTS.recEoekxSRq7EsQkO, sturgis: TASK_LISTS.recbvNLEkdm4HNu3J,
  sam: TASK_LISTS.rec0u7Ikoxfo5kJCX, andy: TASK_LISTS.recNaeY3xVY0sKxhH, nina: TASK_LISTS.recQpdH2QkplH8Sl0, ben: TASK_LISTS.recriRN9RxxEa2PyC, allie: TASK_LISTS.recroDei0NGN6CA1R, ethan: TASK_LISTS.rect9RExJhI14zXfS };
const JON_LIST = 'dUJrbGEzNC1YOTZlVE5EZg';
const HUB = 'https://millrivermusic.github.io/mill-river-music-hub/';
function addTask(listId, title, notes) {
  try { Tasks.Tasks.insert({ title: title.slice(0, 250), notes: notes.slice(0, 8000) }, listId || JON_LIST); return true; }
  catch (e) { Logger.log('Task not added (is the Google Tasks service turned on?): ' + e); return false; }
}
const SHOP_NAME = 'Mill River Music and Guitars';
const QUERY = '(from:martinguitar.com OR from:taylorguitars.com OR to:martinguitar.com OR to:taylorguitars.com)';

/* ---------------- web app (called by the Warranty Desk) ---------------- */
function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents || '{}'); } catch (err) { return out({ ok: false, error: 'Bad request' }); }
  // Airtable calls this when the Warranty Desk queues an email. No secret needed: it only sends emails that are
  // already queued in Airtable, to Martin/Taylor addresses, so a stray call can't send anything new.
  if (req.action === 'sendQueued' && req.table === 'customer') { try { return out(processCustQueue(req.id)); } catch (err) { return out({ ok: false, error: String(err && err.message || err) }); } }
  if (req.action === 'sendQueued') { try { return out(processQueue(req.id)); } catch (err) { return out({ ok: false, error: String(err && err.message || err) }); } }
  if (!req.secret || req.secret !== prop('APP_SECRET')) return out({ ok: false, error: 'Not allowed (secret does not match).' });
  try {
    if (req.action === 'ping') return out({ ok: true, account: Session.getEffectiveUser().getEmail() });
    if (req.action === 'send') return out(sendForCase(req));
    if (req.action === 'sync') { const n = syncInbox(); return out({ ok: true, added: n }); }
    return out({ ok: false, error: 'Unknown action' });
  } catch (err) { return out({ ok: false, error: String(err && err.message || err) }); }
}
function doGet() { return out({ ok: true, hello: 'MRM warranty mail bridge' }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function prop(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function sendForCase(r) {
  const brand = r.brand === 'taylor' ? 'taylor' : 'martin';
  if (!r.caseId || !r.to || !r.subject || !r.body) throw new Error('Missing case, recipient, subject or text.');
  if (!FACTORY.some(d => String(r.to).toLowerCase().endsWith('@' + d))) throw new Error('This bridge only sends to Martin or Taylor addresses.');
  const blobs = (r.attachments || []).slice(0, 10).map(a => UrlFetchApp.fetch(a.url).getBlob().setName(a.filename || 'attachment'));
  const opts = { name: SHOP_NAME, attachments: blobs };
  if (r.cc) opts.cc = r.cc;
  let thread = null;
  if (r.replyThreadId) {
    try { thread = GmailApp.getThreadById(r.replyThreadId); } catch (e) { thread = null; }
  }
  const me = Session.getEffectiveUser().getEmail().toLowerCase();
  let replied = false;
  if (thread) {
    const msgs = thread.getMessages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].getFrom().toLowerCase().indexOf(me) === -1) { msgs[i].reply(r.body, opts); replied = true; break; }
    }
  }
  if (!replied) GmailApp.sendEmail(r.to, r.subject, r.body, opts);
  Utilities.sleep(2500);
  const found = GmailApp.search('in:sent to:' + r.to + ' newer_than:1d', 0, 5);
  let msg = null;
  for (const t of found) { const ms = t.getMessages(); const m = ms[ms.length - 1]; if (!msg || m.getDate() > msg.getDate()) msg = m; }
  const threadId = msg ? msg.getThread().getId() : (thread ? thread.getId() : '');
  const msgId = msg ? msg.getId() : '';
  if (r.logId) {
    at('PATCH', EMAILS.table, '', { records: [{ id: r.logId, fields: { [EMAILS.dir]: 'Sent', [EMAILS.from]: me, [EMAILS.date]: new Date().toISOString(),
      [EMAILS.msgId]: msgId, [EMAILS.threadId]: threadId, [EMAILS.seen]: true, [EMAILS.sendStatus]: 'Sent', [EMAILS.match]: 'sent from app' } }], typecast: true });
  } else {
    const fields = {
      [EMAILS.subject]: r.subject, [EMAILS.dir]: 'Sent', [EMAILS.from]: me, [EMAILS.to]: r.to, [EMAILS.date]: new Date().toISOString(),
      [EMAILS.body]: String(r.body).slice(0, 90000), [EMAILS.msgId]: msgId, [EMAILS.threadId]: threadId, [EMAILS.seen]: true,
      [EMAILS.sentBy]: r.sentBy || '', [EMAILS.match]: 'sent from app', [EMAILS.sendStatus]: 'Sent', [brand === 'taylor' ? EMAILS.taylor : EMAILS.martin]: [r.caseId],
    };
    if ((r.attachments || []).length) fields[EMAILS.files] = r.attachments.map(a => ({ url: a.url, filename: a.filename }));
    at('POST', EMAILS.table, '', { records: [{ fields }], typecast: true });
  }
  if (threadId) addThreadToCase(brand, r.caseId, threadId);
  return { ok: true, threadId, messageId: msgId };
}

/* ---------------- inbox sync (every 10 minutes) ---------------- */
function syncInbox() {
  try { processQueue(); } catch (e) { Logger.log('Queue: ' + e); }
  try { processCustQueue(); } catch (e) { Logger.log('Customer queue: ' + e); }
  let n = 0; try { n += importThreads(QUERY + ' newer_than:3d', 0, 60, true).added; } catch (e) { Logger.log('Warranty import: ' + e); }
  try { n += importReturnMail(); } catch (e) { Logger.log('Returns import: ' + e); }
  return n;
}

/* ---------------- Returns desk: send to the customer on the return ---------------- */
function processCustQueue(onlyId) {
  const f = "AND({Send Status}='Queued',{Direction}='Outbox')";
  const j = at('GET', CEM.table, '?pageSize=20&returnFieldsByFieldId=true&filterByFormula=' + encodeURIComponent(f));
  let sent = 0, failed = 0;
  for (const r of (j.records || [])) {
    if (onlyId && r.id !== onlyId) continue;
    const F = r.fields || {};
    at('PATCH', CEM.table, '', { records: [{ id: r.id, fields: { [CEM.sendStatus]: 'Sending' } }], typecast: true });
    try {
      sendForReturn({ id: r.id, retId: (F[CEM.ret] || [])[0], to: F[CEM.to], subject: F[CEM.subject], body: F[CEM.body],
        attachments: (F[CEM.files] || []).map(a => ({ url: a.url, filename: a.filename })), replyThreadId: F[CEM.threadId] || '' });
      sent++;
    } catch (err) {
      failed++;
      at('PATCH', CEM.table, '', { records: [{ id: r.id, fields: { [CEM.sendStatus]: 'Failed', [CEM.sendError]: String(err && err.message || err).slice(0, 2000) } }], typecast: true });
    }
  }
  return { ok: true, sent, failed };
}
function sendForReturn(r) {
  if (!r.retId || !r.to || !r.subject || !r.body) throw new Error('Missing return, recipient, subject or text.');
  const ret = at('GET', RETURNS.table, '/' + r.retId + '?returnFieldsByFieldId=true').fields || {};
  const allowed = String(ret[RETURNS.email] || '').trim().toLowerCase();
  const to = String(r.to).trim().toLowerCase();
  // Safety: only ever sends to the customer email saved on that return.
  if (!allowed || to !== allowed) throw new Error('Only sends to the email saved on the return (' + (allowed || 'none saved') + ').');
  const blobs = (r.attachments || []).slice(0, 10).map(a => UrlFetchApp.fetch(a.url).getBlob().setName(a.filename || 'attachment'));
  const opts = { name: SHOP_NAME, attachments: blobs };
  const me = Session.getEffectiveUser().getEmail().toLowerCase();
  let thread = null, replied = false;
  if (r.replyThreadId) { try { thread = GmailApp.getThreadById(r.replyThreadId); } catch (e) { thread = null; } }
  if (thread) {
    const msgs = thread.getMessages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      const fromMe = msgs[i].getFrom().toLowerCase().indexOf(me) !== -1;
      if (!fromMe && msgs[i].getFrom().toLowerCase().indexOf(to) !== -1) { msgs[i].reply(r.body, opts); replied = true; break; }
      if (fromMe && (msgs[i].getTo() + ' ' + msgs[i].getCc()).toLowerCase().indexOf(to) !== -1) { msgs[i].replyAll(r.body, opts); replied = true; break; }
    }
  }
  if (!replied) GmailApp.sendEmail(r.to, r.subject, r.body, opts);
  Utilities.sleep(2500);
  const found = GmailApp.search('in:sent to:' + to + ' newer_than:1d', 0, 5);
  let msg = null;
  for (const t of found) { const ms = t.getMessages(); const m = ms[ms.length - 1]; if (!msg || m.getDate() > msg.getDate()) msg = m; }
  const threadId = msg ? msg.getThread().getId() : (thread ? thread.getId() : '');
  at('PATCH', CEM.table, '', { records: [{ id: r.id, fields: { [CEM.dir]: 'Sent', [CEM.from]: me, [CEM.date]: new Date().toISOString(),
    [CEM.msgId]: msg ? msg.getId() : '', [CEM.threadId]: threadId, [CEM.seen]: true, [CEM.sendStatus]: 'Sent', [CEM.match]: 'sent from Returns desk' } }], typecast: true });
  if (threadId) addThreadToReturn(r.retId, threadId);
  return { ok: true, threadId };
}
function returnTask(x) {
  const r = at('GET', RETURNS.table, '/' + x.id + '?returnFieldsByFieldId=true').fields || {};
  const who = r[RETURNS.assignee] || null; // Airtable collaborator: match on first name
  const first = who && who.name ? String(who.name).trim().split(/\s+/)[0].toLowerCase() : '';
  const list = TASK_LISTS_BY_NAME[first] || JON_LIST;
  const title = 'New customer email on return: ' + String(r[RETURNS.name] || 'a return') + (x.n > 1 ? ' (' + x.n + ' new)' : '') + (TASK_LISTS_BY_NAME[first] ? '' : ' (no one assigned)');
  addTask(list, title, 'From: ' + x.from + '\nSubject: ' + x.subject + '\n\nOpen it in Returns: ' + HUB + 'returns/');
}

function addThreadToReturn(retId, tid) {
  const rec = at('GET', RETURNS.table, '/' + retId + '?returnFieldsByFieldId=true');
  const cur = String((rec.fields || {})[RETURNS.threads] || '');
  if (cur.split(',').map(s => s.trim()).indexOf(tid) !== -1) return;
  at('PATCH', RETURNS.table, '', { records: [{ id: retId, fields: { [RETURNS.threads]: cur ? cur + ',' + tid : tid } }] });
}

/* ---------------- Returns desk: copy customer replies for open returns ---------------- */
function importReturnMail() {
  const t0 = Date.now();
  const f = "AND(NOT(OR({Status}='Closed',{Status}='Done')),{Customer Email}!='')";
  let rets = [], off = '';
  do {
    const j = at('GET', RETURNS.table, '?pageSize=100&returnFieldsByFieldId=true&fields%5B%5D=' + RETURNS.email + '&fields%5B%5D=' + RETURNS.threads + '&filterByFormula=' + encodeURIComponent(f) + (off ? '&offset=' + encodeURIComponent(off) : ''));
    rets = rets.concat((j.records || []).map(r => ({ id: r.id, email: String(r.fields[RETURNS.email] || '').trim().toLowerCase(), threads: String(r.fields[RETURNS.threads] || '') })));
    off = j.offset || '';
  } while (off);
  rets = rets.filter(r => /@/.test(r.email));
  if (!rets.length) return 0;
  const threads = {}, addrs = [...new Set(rets.map(r => r.email))];
  for (let i = 0; i < addrs.length; i += 15) {
    const q = '(' + addrs.slice(i, i + 15).map(a => 'from:' + a + ' OR to:' + a).join(' OR ') + ') newer_than:3d';
    GmailApp.search(q, 0, 50).forEach(th => threads[th.getId()] = th);
  }
  rets.forEach(r => r.threads.split(',').map(s => s.trim()).filter(Boolean).forEach(tid => { if (!threads[tid]) { try { const th = GmailApp.getThreadById(tid); if (th && (Date.now() - th.getLastMessageDate().getTime()) < 3 * 864e5) threads[tid] = th; } catch (e) {} } }));
  const list = Object.keys(threads).map(k => threads[k]);
  if (!list.length) return 0;
  // nothing new since last run: no Airtable calls
  let cache = []; try { cache = JSON.parse(prop('SEEN_CUST') || '[]'); } catch (e) {}
  const cacheSet = {}; cache.forEach(id => cacheSet[id] = true);
  const fresh = []; list.forEach(th => th.getMessages().forEach(m => { if (!cacheSet[m.getId()]) fresh.push(m.getId()); }));
  if (!fresh.length) return 0;
  const known = {}; off = '';
  do {
    const j = at('GET', CEM.table, '?pageSize=100&returnFieldsByFieldId=true&fields%5B%5D=' + CEM.msgId + (off ? '&offset=' + encodeURIComponent(off) : ''));
    (j.records || []).forEach(r => { const id = (r.fields || {})[CEM.msgId]; if (id) known[id] = true; });
    off = j.offset || '';
  } while (off);
  const me = Session.getEffectiveUser().getEmail().toLowerCase();
  let added = 0; const notices = {};
  for (const th of list) {
    if (Date.now() - t0 > 240000) break;
    const tid = th.getId();
    for (const m of th.getMessages()) {
      const mid = m.getId();
      if (!cacheSet[mid]) { cache.push(mid); cacheSet[mid] = true; }
      if (known[mid]) continue;
      const people = (m.getFrom() + ' ' + m.getTo() + ' ' + m.getCc()).toLowerCase();
      // which open return is this about? its thread first, then the customer's email
      const ret = rets.find(r => r.threads.indexOf(tid) !== -1) || rets.find(r => people.indexOf(r.email) !== -1);
      if (!ret || people.indexOf(ret.email) === -1) continue;
      const sent = m.getFrom().toLowerCase().indexOf(me) !== -1;
      const fields = { [CEM.subject]: m.getSubject() || '(no subject)', [CEM.dir]: sent ? 'Sent' : 'Received', [CEM.from]: m.getFrom(), [CEM.to]: m.getTo(),
        [CEM.date]: m.getDate().toISOString(), [CEM.body]: trimQuoted(m.getPlainBody() || '').slice(0, 90000), [CEM.msgId]: mid, [CEM.threadId]: tid,
        [CEM.seen]: sent, [CEM.ret]: [ret.id], [CEM.match]: ret.threads.indexOf(tid) !== -1 ? 'thread' : 'customer email' };
      const rec = at('POST', CEM.table, '', { records: [{ fields }], typecast: true }).records[0];
      known[mid] = true; added++;
      if (!sent) { const n0 = notices[ret.id] || { id: ret.id, n: 0 }; n0.n++; n0.subject = m.getSubject() || '(no subject)'; n0.from = m.getFrom(); notices[ret.id] = n0; }
      m.getAttachments({ includeInlineImages: false }).filter(a => !(/^image\d*\.(png|jpe?g|gif)$/i.test(a.getName()) && a.getSize() < 60000) && a.getSize() < 5 * 1024 * 1024)
        .forEach(a => uploadAttachment(rec.id, CEM.files, a, CEM.table));
      if (ret.threads.indexOf(tid) === -1) { addThreadToReturn(ret.id, tid); ret.threads += (ret.threads ? ',' : '') + tid; }
    }
  }
  PropertiesService.getScriptProperties().setProperty('SEEN_CUST', JSON.stringify(cache.slice(-1500)));
  Object.keys(notices).forEach(k => { try { returnTask(notices[k]); } catch (e) { Logger.log('Return task: ' + e); } });
  return added;
}

/* ---------------- outbox: emails queued in Airtable by the Warranty Desk ---------------- */
function processQueue(onlyId) {
  const f = "AND({Send Status}='Queued',{Direction}='Outbox')";
  const j = at('GET', EMAILS.table, '?pageSize=20&returnFieldsByFieldId=true&filterByFormula=' + encodeURIComponent(f));
  let sent = 0, failed = 0;
  for (const r of (j.records || [])) {
    if (onlyId && r.id !== onlyId) continue;
    const F = r.fields || {};
    // claim it so a second run doesn't send it twice
    at('PATCH', EMAILS.table, '', { records: [{ id: r.id, fields: { [EMAILS.sendStatus]: 'Sending' } }], typecast: true });
    try {
      const brand = (F[EMAILS.taylor] || []).length ? 'taylor' : 'martin';
      const caseId = (F[EMAILS.taylor] || F[EMAILS.martin] || [])[0];
      const res = sendForCase({ brand, caseId, to: F[EMAILS.to], subject: F[EMAILS.subject], body: F[EMAILS.body],
        attachments: (F[EMAILS.files] || []).map(a => ({ url: a.url, filename: a.filename })), replyThreadId: F[EMAILS.threadId] || '',
        sentBy: F[EMAILS.sentBy] || '', logId: r.id });
      sent++;
    } catch (err) {
      failed++;
      at('PATCH', EMAILS.table, '', { records: [{ id: r.id, fields: { [EMAILS.sendStatus]: 'Failed', [EMAILS.sendError]: String(err && err.message || err).slice(0, 2000) } }], typecast: true });
    }
  }
  return { ok: true, sent, failed };
}

/* Remembers which recent Gmail messages are already in Airtable, so a quiet run makes zero Airtable calls. */
function seenCache() { try { return JSON.parse(prop('SEEN_IDS') || '[]'); } catch (e) { return []; } }
function saveSeen(ids) { PropertiesService.getScriptProperties().setProperty('SEEN_IDS', JSON.stringify(ids.slice(-1500))); }

/** Imports past threads in batches. Run it several times until it says it is done. */
function backfill() {
  const p = PropertiesService.getScriptProperties();
  const start = Number(p.getProperty('BACKFILL_AT') || 0);
  const r = importThreads(QUERY + ' newer_than:600d', start, 40);
  p.setProperty('BACKFILL_AT', String(start + r.threads));
  Logger.log('Backfill: looked at ' + r.threads + ' threads, added ' + r.added + ' emails.' + (r.threads < 40 ? ' DONE.' : ' Run backfill() again to continue.'));
}

function importThreads(query, start, max, quick) {
  const t0 = Date.now();
  const threads = GmailApp.search(query, start, max);
  if (!threads.length) return { threads: 0, added: 0 };
  const cache = seenCache(), cacheSet = {};
  cache.forEach(id => cacheSet[id] = true);
  if (quick) {
    const fresh = [];
    threads.forEach(th => th.getMessages().forEach(m => { if (!cacheSet[m.getId()]) fresh.push(m.getId()); }));
    if (!fresh.length) return { threads: threads.length, added: 0 }; // nothing new: no Airtable calls at all
  }
  const known = knownMessageIds();
  Object.keys(known).forEach(id => { if (!cacheSet[id]) { cache.push(id); cacheSet[id] = true; } });
  const cases = loadCases();
  const me = Session.getEffectiveUser().getEmail().toLowerCase();
  let added = 0; const notices = {};
  for (const th of threads) {
    if (Date.now() - t0 > 300000) break; // stay under Google's 6-minute limit
    const tid = th.getId();
    const allMsgs = th.getMessages();
    const threadText = allMsgs.map(m => (m.getSubject() || '') + '\n' + trimQuoted(m.getPlainBody() || '') + '\n' +
      m.getAttachments({ includeInlineImages: false }).map(a => a.getName()).join(' ')).join('\n');
    const threadHit = matchCase(cases, tid, threadText);
    if (threadHit) cases.forEach(c => { if (c.id === threadHit.id && c.threads.indexOf(tid) === -1) c.threads += (c.threads ? ',' : '') + tid; });
    for (const m of allMsgs) {
      const mid = m.getId();
      if (known[mid]) continue;
      if (!cacheSet[mid]) { cache.push(mid); cacheSet[mid] = true; }
      const from = m.getFrom(), to = m.getTo();
      const lower = (from + ' ' + to + ' ' + m.getCc()).toLowerCase();
      if (!FACTORY.some(d => lower.indexOf(d) !== -1)) continue;
      const sent = from.toLowerCase().indexOf(me) !== -1;
      const subject = m.getSubject() || '(no subject)';
      const body = trimQuoted(m.getPlainBody() || '');
      const hit = threadHit;
      const fields = {
        [EMAILS.subject]: subject, [EMAILS.dir]: sent ? 'Sent' : 'Received', [EMAILS.from]: from, [EMAILS.to]: to,
        [EMAILS.date]: m.getDate().toISOString(), [EMAILS.body]: body.slice(0, 90000), [EMAILS.msgId]: mid, [EMAILS.threadId]: tid,
        [EMAILS.seen]: sent, [EMAILS.match]: hit ? hit.how : 'unmatched',
      };
      if (hit) fields[hit.brand === 'taylor' ? EMAILS.taylor : EMAILS.martin] = [hit.id];
      const rec = at('POST', EMAILS.table, '', { records: [{ fields }], typecast: true }).records[0];
      known[mid] = true; added++;
      const atts = m.getAttachments({ includeInlineImages: false }).filter(a => !(/^image\d*\.(png|jpe?g|gif)$/i.test(a.getName()) && a.getSize() < 60000) && a.getSize() < 5 * 1024 * 1024);
      for (const a of atts) uploadAttachment(rec.id, EMAILS.files, a);
      if (hit) {
        addThreadToCase(hit.brand, hit.id, tid);
        if (!sent) learnFromReply(hit, subject + '\n' + body, atts);
      }
      if (quick && !sent) { const k = hit ? hit.id : 'unmatched'; const n0 = notices[k] || { hit: hit, n: 0 }; n0.n++; n0.subject = subject; n0.from = from; notices[k] = n0; }
    }
  }
  saveSeen(cache);
  Object.keys(notices).forEach(k => { try { warrantyTask(notices[k]); } catch (e) { Logger.log('Warranty task: ' + e); } });
  return { threads: threads.length, added };
}

function warrantyTask(x) {
  const brand = x.hit ? (x.hit.brand === 'taylor' ? 'Taylor' : 'Martin') : 'Martin/Taylor';
  let list = JON_LIST, who = '', label = '';
  if (x.hit) {
    const c = at('GET', CASES[x.hit.brand].table, '/' + x.hit.id + '?returnFieldsByFieldId=true').fields || {};
    const name = String(c[x.hit.brand === 'taylor' ? 'fld4VdeNgfAlAYIEa' : 'fldAfDSbLxL90X19P'] || '').trim(); // case name
    const tech = c[CASES[x.hit.brand].tech] || [];
    if (tech.length && TASK_LISTS[tech[0]]) list = TASK_LISTS[tech[0]]; else who = ' (no tech assigned)';
    label = name ? ': ' + name : '';
  }
  const title = (x.hit ? 'New ' + brand + ' warranty email' + label : 'Unmatched Martin/Taylor email') + (x.n > 1 ? ' (' + x.n + ' new)' : '') + who;
  const notes = 'From: ' + x.from + '\nSubject: ' + x.subject + '\n\n' + (x.hit ? 'Open it in the Warranty Desk: ' : 'It isn\'t linked to a case yet. Match it in the Warranty Desk: ') + HUB + 'warranty/';
  addTask(list, title, notes);
}

function matchCase(cases, tid, text) {
  for (const c of cases) if (c.threads.indexOf(tid) !== -1) return { brand: c.brand, id: c.id, how: 'thread' };
  const T = ' ' + text.replace(/[^0-9A-Za-z]+/g, ' ') + ' ';
  const found = [];
  for (const c of cases) {
    if (c.serial && c.serial.length >= 5 && T.indexOf(' ' + c.serial + ' ') !== -1) found.push({ c, how: 'serial ' + c.serial });
    else if (c.num && c.num.length >= 5 && T.indexOf(' ' + c.num + ' ') !== -1) found.push({ c, how: (c.brand === 'martin' ? 'auth ' : 'ticket ') + c.num });
  }
  if (found.length === 1 || (found.length > 1 && found.every(f => f.c.id === found[0].c.id))) return { brand: found[0].c.brand, id: found[0].c.id, how: found[0].how };
  const low = T.toLowerCase();
  const NOT_NAMES = ['taylor', 'martin', 'guitar', 'guitars', 'music', 'river', 'mill', 'white', 'smith'];
  const byName = cases.filter(c => c.last && c.last.length >= 4 && NOT_NAMES.indexOf(c.last.toLowerCase()) === -1 && low.indexOf(' ' + c.last.toLowerCase() + ' ') !== -1);
  if (byName.length === 1) return { brand: byName[0].brand, id: byName[0].id, how: 'name ' + byName[0].last };
  return null;
}

/** Fills in an auth # / ticket # and files Martin's auth PDF in "Approved Form" when the case doesn't have them yet. */
function learnFromReply(hit, text, atts) {
  const C = CASES[hit.brand];
  const rec = at('GET', C.table, '/' + hit.id + '?returnFieldsByFieldId=true');
  const f = rec.fields || {};
  const upd = {};
  if (!f[C.num]) {
    const m = hit.brand === 'martin' ? (text.match(/auth(?:orization)?\s*#?\s*(\d{5})\b/i) || atts.map(a => a.getName().match(/auth\D{0,3}(\d{5})/i)).filter(Boolean)[0])
                                     : text.match(/ticket\s*(?:number|no\.?|#)?\s*:?\s*#?\s*(\d{6})\b/i);
    if (m) upd[C.num] = m[1];
  }
  if (Object.keys(upd).length) at('PATCH', C.table, '', { records: [{ id: hit.id, fields: upd }] });
  if (hit.brand === 'martin') for (const a of atts) if (/warranty\s*auth/i.test(a.getName())) uploadAttachment(hit.id, C.appr, a, C.table);
}

function loadCases() {
  const list = [];
  const custIds = {};
  for (const brand of ['taylor', 'martin']) {
    const C = CASES[brand];
    let off = '';
    do {
      const j = at('GET', C.table, '?pageSize=100&returnFieldsByFieldId=true&fields%5B%5D=' + [C.serial, C.num, C.cust, C.threads].join('&fields%5B%5D=') + (off ? '&offset=' + encodeURIComponent(off) : ''));
      (j.records || []).forEach(r => {
        const f = r.fields || {};
        const cust = (f[C.cust] || [])[0] || '';
        if (cust) custIds[cust] = true;
        list.push({ brand, id: r.id, serial: String(f[C.serial] || '').replace(/\D/g, ''), num: String(f[C.num] || '').replace(/\D/g, ''), cust, threads: String(f[C.threads] || ''), last: '' });
      });
      off = j.offset || '';
    } while (off);
  }
  const ids = Object.keys(custIds), last = {};
  for (let i = 0; i < ids.length; i += 40) {
    const f = 'OR(' + ids.slice(i, i + 40).map(x => "RECORD_ID()='" + x + "'").join(',') + ')';
    const j = at('GET', CUSTOMERS.table, '?pageSize=100&returnFieldsByFieldId=true&fields%5B%5D=' + CUSTOMERS.last + '&filterByFormula=' + encodeURIComponent(f));
    (j.records || []).forEach(r => { last[r.id] = String((r.fields || {})[CUSTOMERS.last] || '').trim(); });
  }
  list.forEach(c => { c.last = last[c.cust] || ''; });
  return list;
}

function knownMessageIds() {
  const known = {};
  let off = '';
  do {
    const j = at('GET', EMAILS.table, '?pageSize=100&returnFieldsByFieldId=true&fields%5B%5D=' + EMAILS.msgId + (off ? '&offset=' + encodeURIComponent(off) : ''));
    (j.records || []).forEach(r => { const id = (r.fields || {})[EMAILS.msgId]; if (id) known[id] = true; });
    off = j.offset || '';
  } while (off);
  return known;
}

function addThreadToCase(brand, caseId, tid) {
  const C = CASES[brand];
  const rec = at('GET', C.table, '/' + caseId + '?returnFieldsByFieldId=true');
  const cur = String((rec.fields || {})[C.threads] || '');
  if (cur.split(',').map(s => s.trim()).indexOf(tid) !== -1) return;
  at('PATCH', C.table, '', { records: [{ id: caseId, fields: { [C.threads]: cur ? cur + ',' + tid : tid } }] });
}

function trimQuoted(t) {
  const lines = t.replace(/\r/g, '').split('\n');
  const outL = [];
  for (const l of lines) {
    if (/^On .+wrote:\s*$/.test(l) || /^-{2,}\s*Original Message/i.test(l) || /^From:\s.+/.test(l) || /^\*{10,}/.test(l)) break;
    if (/^>/.test(l)) continue;
    outL.push(l);
  }
  return outL.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------------- Airtable helpers ---------------- */
function at(method, table, path, body) {
  const o = { method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + prop('AIRTABLE_TOKEN') }, contentType: 'application/json' };
  if (body) o.payload = JSON.stringify(body);
  for (let i = 0; i < 4; i++) {
    const r = UrlFetchApp.fetch('https://api.airtable.com/v0/' + BASE + '/' + table + (path || ''), o);
    if (r.getResponseCode() === 429) { Utilities.sleep(1500); continue; }
    const j = JSON.parse(r.getContentText() || '{}');
    if (r.getResponseCode() >= 300) throw new Error('Airtable ' + r.getResponseCode() + ': ' + (j.error && (j.error.message || j.error.type) || ''));
    Utilities.sleep(220); // stay under 5 requests/second
    return j;
  }
  throw new Error('Airtable kept saying slow down.');
}
function uploadAttachment(recordId, fieldId, blob, table) {
  const r = UrlFetchApp.fetch('https://content.airtable.com/v0/' + BASE + '/' + recordId + '/' + fieldId + '/uploadAttachment', {
    method: 'post', muteHttpExceptions: true, contentType: 'application/json', headers: { Authorization: 'Bearer ' + prop('AIRTABLE_TOKEN') },
    payload: JSON.stringify({ contentType: blob.getContentType() || 'application/octet-stream', filename: blob.getName(), file: Utilities.base64Encode(blob.getBytes()) }) });
  Utilities.sleep(220);
  return r.getResponseCode() < 300;
}

/* ---------------- one-time setup ---------------- */
function setup() {
  if (!prop('AIRTABLE_TOKEN') || !prop('APP_SECRET')) throw new Error('Add AIRTABLE_TOKEN and APP_SECRET in Project Settings → Script Properties first.');
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncInbox').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncInbox').timeBased().everyMinutes(10).create();
  at('GET', EMAILS.table, '?maxRecords=1');
  Logger.log('All set. Running as ' + Session.getEffectiveUser().getEmail() + '. Inbox sync runs every 10 minutes. Now Deploy → New deployment → Web app.');
}
