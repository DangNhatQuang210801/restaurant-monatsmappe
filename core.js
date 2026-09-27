(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Monatsmappe = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function detectDelimiter(text) {
    const counts = { ';': 0, ',': 0, '\t': 0 };
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && (char === '\n' || char === '\r')) break;
      else if (!quoted && char in counts) counts[char]++;
    }
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  }

  function parseCsv(text, delimiter = detectDelimiter(text)) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Die CSV-Datei ist leer.');
    if (![';', ',', '\t'].includes(delimiter)) throw new Error('Trennzeichen nicht unterstützt.');
    const records = [], recordLines = [];
    let row = [], field = '', quoted = false, line = 1, rowStart = 1;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { field += '"'; i++; }
        else if (quoted || field === '') quoted = !quoted;
        else throw new Error('Ungültiges Anführungszeichen in der CSV-Datei.');
      } else if (char === delimiter && !quoted) {
        row.push(field); field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        row.push(field); field = '';
        if (row.some(value => value !== '')) { records.push(row); recordLines.push(rowStart); }
        row = [];
        if (char === '\r' && text[i + 1] === '\n') i++;
        line++;
        rowStart = line;
      } else if ((char === '\r' || char === '\n') && quoted) {
        field += '\n';
        if (char === '\r' && text[i + 1] === '\n') i++;
        line++;
      } else field += char;
    }
    if (quoted) throw new Error('Ein Textfeld wurde nicht geschlossen.');
    row.push(field);
    if (row.some(value => value !== '')) { records.push(row); recordLines.push(rowStart); }
    if (!records.length || !records[0].some(Boolean)) throw new Error('Keine Spaltenüberschriften gefunden.');
    const headers = records.shift().map(value => value.trim());
    recordLines.shift();
    return { headers, rows: records, rowNumbers: recordLines, delimiter };
  }

  function parseDate(value) {
    const text = String(value ?? '').trim();
    let year, month, day;
    let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
    if (match) [, year, month, day] = match;
    else {
      match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text);
      if (!match) return null;
      [, day, month, year] = match;
    }
    year = Number(year); month = Number(month); day = Number(day);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    return `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function parseAmount(value) {
    let text = String(value ?? '').trim().replace(/[\s\u00A0€]/g, '');
    if (/^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
    else if (/^[+-]?\d+(?:,\d{1,2})?$/.test(text)) text = text.replace(',', '.');
    else if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(text)) return null;
    const [euros, cents = ''] = text.replace(/^\+/, '').split('.');
    const sign = euros.startsWith('-') ? -1 : 1;
    const amount = sign * (Number(euros.replace('-', '')) * 100 + Number(cents.padEnd(2, '0')));
    return Number.isSafeInteger(amount) ? amount : null;
  }

  function formatAmount(cents) {
    const sign = cents < 0 ? '-' : '';
    const absolute = Math.abs(cents);
    return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
  }

  function analyze(parsed, mapping) {
    for (const key of ['date', 'amount']) {
      if (!Number.isInteger(mapping[key]) || mapping[key] < 0 || mapping[key] >= parsed.headers.length) {
        throw new Error(`Bitte eine Spalte für ${key === 'date' ? 'Datum' : 'Bruttobetrag'} wählen.`);
      }
    }
    if (mapping.date === mapping.amount) throw new Error('Datum und Betrag müssen unterschiedliche Spalten sein.');
    const value = (row, key) => Number.isInteger(mapping[key]) && mapping[key] >= 0 ? String(row[mapping[key]] ?? '').trim() : '';
    const valid = [], issues = [], seen = new Map();
    parsed.rows.forEach((source, index) => {
      const rowNumber = parsed.rowNumbers?.[index] ?? index + 2;
      const date = parseDate(value(source, 'date'));
      const cents = parseAmount(value(source, 'amount'));
      if (!date) issues.push({ row: rowNumber, kind: 'Ausgeschlossen', message: 'Datum fehlt oder ist ungültig.' });
      if (cents === null) issues.push({ row: rowNumber, kind: 'Ausgeschlossen', message: 'Bruttobetrag fehlt oder ist ungültig.' });
      if (!date || cents === null) return;
      const fingerprint = JSON.stringify(source);
      if (seen.has(fingerprint)) issues.push({ row: rowNumber, kind: 'Prüfen', message: `Gleiche Quelldaten wie Zeile ${seen.get(fingerprint)}. In Summen enthalten.` });
      else seen.set(fingerprint, rowNumber);
      valid.push({
        row: rowNumber, date, month: date.slice(0, 7), cents,
        type: value(source, 'type') || mapping.defaultType || 'Nicht angegeben',
        tax: value(source, 'tax'), payment: value(source, 'payment'),
        receipt: value(source, 'receipt'), description: value(source, 'description')
      });
    });
    const totals = new Map();
    for (const row of valid) {
      const key = JSON.stringify([row.month, row.type, row.tax, row.payment]);
      const total = totals.get(key) || { month: row.month, type: row.type, tax: row.tax, payment: row.payment, count: 0, cents: 0 };
      total.count++;
      total.cents += row.cents;
      totals.set(key, total);
    }
    return { sourceCount: parsed.rows.length, valid, issues, totals: [...totals.values()].sort((a, b) => a.month.localeCompare(b.month) || a.type.localeCompare(b.type)) };
  }

  function encodeCsv(records, numericColumns = []) {
    const numeric = new Set(numericColumns);
    return '\uFEFF' + records.map(row => row.map((raw, index) => {
      let value = String(raw ?? '');
      // Spreadsheet programs may execute imported text beginning with formula characters.
      if (!numeric.has(index) && /^[\s\u0000-\u001F]*[=+\-@]/.test(value)) value = "'" + value;
      return /[;"\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
    }).join(';')).join('\r\n') + '\r\n';
  }

  function exportsFor(result) {
    return {
      summary: encodeCsv([
        ['Monat', 'Typ (Quelle)', 'Steuerangabe (Quelle)', 'Zahlungsart', 'Anzahl', 'Brutto EUR'],
        ...result.totals.map(item => [item.month, item.type, item.tax, item.payment, item.count, formatAmount(item.cents)])
      ], [4, 5]),
      rows: encodeCsv([
        ['Quellzeile', 'Datum', 'Monat', 'Typ (Quelle)', 'Brutto EUR', 'Steuerangabe (Quelle)', 'Zahlungsart', 'Belegnummer', 'Beschreibung'],
        ...result.valid.map(row => [row.row, row.date, row.month, row.type, formatAmount(row.cents), row.tax, row.payment, row.receipt, row.description])
      ], [0, 4]),
      issues: encodeCsv([
        ['Quellzeile', 'Status', 'Hinweis'],
        ...result.issues.map(issue => [issue.row, issue.kind, issue.message])
      ], [0])
    };
  }

  return { detectDelimiter, parseCsv, parseDate, parseAmount, formatAmount, analyze, encodeCsv, exportsFor };
});
