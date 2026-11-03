/**
 * Mill River Music — Warranty Desk mail bridge (runs as info@millrivermusic.com)
 *
 * What it does
 *  1. Sends warranty emails for the Warranty Desk app (only when a person presses Send in the app).
 *  2. Every 10 minutes, copies emails to/from Martin and Taylor (SV Network) into the
 *     Airtable "Warranty Emails" table and links each one to its warranty case.
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
  msgId: 'fldYEO5Tw1ecbfyks', threadId: 'fldUx2qKKilnwo1Ju', seen: 'fldHBUTfVZsjaGoIM', sentBy: 'fldmbeyV3R2n3lMcF', match: 'fld0SaCvatYliLDdD' };
const CASES = {
  taylor: { table: 'tblUR6Y7rfCLBSllO', serial: 'fld2McIGsJW9un93M', num: 'fldYVUlLDkE8qnrop', cust: 'fld9Iym9sy5E7sQIS', threads: 'fldDCyt7LVfPNeVvi', appr: 'fldx9f5sQ0KZcwE0w', status: 'fldAgQWqOARycTlWc' },
  martin: { table: 'tblqbwCvWxNz1REQt', serial: 'fldy6Cm4X17XUmsyr', num: 'fld6WsAofFOzjA1b4', cust: 'fldF2Y0xXQgsxr9dx', threads: 'fldwOwSVtR7rER66N', appr: 'fld6kJ1tCgP9Tmbhi', status: 'fld6AgAOjS2mCSErR' },
};
const CUSTOMERS = { table: 'tblGJnacXCV52gZdS', last: 'fldQCocWmypjXyXWp', name: 'fldyOzHd6uRNuaTHa' };
const FACTORY = ['martinguitar.com', 'taylorguitars.com'];
const SHOP_NAME = 'Mill River Music and Guitars';
const QUERY = '(from:martinguitar.com OR from:taylorguitars.com OR to:martinguitar.com OR to:taylorguitars.com)';

/* ---------------- web app (called by the Warranty Desk) ---------------- */
function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents || '{}'); } catch (err) { return out({ ok: false, error: 'Bad request' }); }
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
  const fields = {
    [EMAILS.subject]: r.subject, [EMAILS.dir]: 'Sent', [EMAILS.from]: me, [EMAILS.to]: r.to, [EMAILS.date]: new Date().toISOString(),
    [EMAILS.body]: String(r.body).slice(0, 90000), [EMAILS.msgId]: msgId, [EMAILS.threadId]: threadId, [EMAILS.seen]: true,
    [EMAILS.sentBy]: r.sentBy || '', [EMAILS.match]: 'sent from app', [CASES[brand] === CASES.taylor ? EMAILS.taylor : EMAILS.martin]: [r.caseId],
  };
  if ((r.attachments || []).length) fields[EMAILS.files] = r.attachments.map(a => ({ url: a.url, filename: a.filename }));
  at('POST', EMAILS.table, '', { records: [{ fields }], typecast: true });
  if (threadId) addThreadToCase(brand, r.caseId, threadId);
  return { ok: true, threadId, messageId: msgId };
}

/* ---------------- inbox sync (every 10 minutes) ---------------- */
function syncInbox() { return importThreads(QUERY + ' newer_than:3d', 0, 60, true).added; }

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
  let added = 0;
  for (const th of threads) {
    if (Date.now() - t0 > 300000) break; // stay under Google's 6-minute limit
    const tid = th.getId();
    for (const m of th.getMessages()) {
      const mid = m.getId();
      if (known[mid]) continue;
      if (!cacheSet[mid]) { cache.push(mid); cacheSet[mid] = true; }
      const from = m.getFrom(), to = m.getTo();
      const lower = (from + ' ' + to + ' ' + m.getCc()).toLowerCase();
      if (!FACTORY.some(d => lower.indexOf(d) !== -1)) continue;
      const sent = from.toLowerCase().indexOf(me) !== -1;
      const subject = m.getSubject() || '(no subject)';
      const body = trimQuoted(m.getPlainBody() || '');
      const hit = matchCase(cases, tid, subject + '\n' + body + '\n' + m.getAttachments({ includeInlineImages: false }).map(a => a.getName()).join(' '));
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
    }
  }
  saveSeen(cache);
  return { threads: threads.length, added };
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
  const byName = cases.filter(c => c.last && c.last.length >= 4 && low.indexOf(' ' + c.last.toLowerCase() + ' ') !== -1);
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
