const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('./core.js');

test('quoted fields, line breaks, and German amounts stay intact', () => {
  const parsed = core.parseCsv('Datum;Brutto;Beschreibung\r\n01.09.2026;1.234,50;"Tisch 1; Fenster"\r\n02.09.2026;-7,20;"Zwei\r\nZeilen"\r\n');
  assert.equal(parsed.rows[0][2], 'Tisch 1; Fenster');
  assert.equal(parsed.rows[1][2], 'Zwei\nZeilen');
  assert.equal(core.parseAmount(parsed.rows[0][1]), 123450);
  assert.equal(core.parseAmount(parsed.rows[1][1]), -720);
});

test('invalid dates and amounts are excluded; duplicates are flagged but counted', () => {
  const parsed = core.parseCsv('Datum;Brutto;Art\n01.09.2026;12,00;Umsatz\n01.09.2026;12,00;Umsatz\n31.09.2026;9,00;Umsatz\n02.09.2026;9,999;Umsatz');
  const result = core.analyze(parsed, { date: 0, amount: 1, type: 2 });
  assert.equal(result.valid.length, 2);
  assert.equal(result.totals[0].cents, 2400);
  assert.equal(result.issues.length, 3);
  assert.equal(result.issues[0].kind, 'Prüfen');
  assert.equal(result.issues[1].kind, 'Ausgeschlossen');
});

test('export prevents formula execution from source text', () => {
  const parsed = core.parseCsv('Date;Amount;Description\n2026-09-01;2.00;"=HYPERLINK(""bad"")"');
  const result = core.analyze(parsed, { date: 0, amount: 1, description: 2, defaultType: 'Umsatz' });
  const files = core.exportsFor(result);
  assert.match(files.rows, /'=HYPERLINK/);
  assert.match(files.rows, /2,00/);
  assert.ok(files.rows.startsWith('\uFEFF'));
  assert.match(files.summary, /2026-09;Umsatz/);
});

test('comma, tab, and BOM inputs are accepted', () => {
  assert.deepEqual(core.parseCsv('\uFEFFdate,amount\n2026-09-01,10.00').headers, ['date', 'amount']);
  assert.deepEqual(core.parseCsv('date\tamount\n2026-09-01\t10.00').headers, ['date', 'amount']);
  assert.equal(core.parseDate('29.02.2024'), '2024-02-29');
  assert.equal(core.parseDate('29.02.2025'), null);
});

test('issue list points to physical source lines after blanks and quoted line breaks', () => {
  const parsed = core.parseCsv('Datum;Brutto;Text\n\n01.09.2026;5,00;"erste\nzweite"\n31.09.2026;9,00;bad');
  const result = core.analyze(parsed, { date: 0, amount: 1, description: 2 });
  assert.deepEqual(parsed.rowNumbers, [3, 5]);
  assert.equal(result.issues[0].row, 5);
  assert.match(core.exportsFor(result).issues, /\r\n5;Ausgeschlossen;/);
});
