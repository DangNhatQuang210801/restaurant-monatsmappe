(() => {
  'use strict';
  const core = window.Monatsmappe;
  const demo = 'Datum;Brutto;Art;Steuerangabe;Zahlungsart;Beleg;Beschreibung\n' +
    '02.09.2026;42,50;Umsatz;laut Kasse;Karte;B-1001;Mittagsgeschäft\n' +
    '02.09.2026;18,00;Umsatz;laut Kasse;Bar;B-1002;Kaffee und Kuchen\n' +
    '03.09.2026;-7,50;Umsatz;laut Kasse;Karte;B-1003;Erstattung\n' +
    '04.09.2026;23,90;Ausgabe;;Karte;E-41;Reinigungsmittel\n' +
    '04.09.2026;23,90;Ausgabe;;Karte;E-41;Reinigungsmittel\n' +
    '31.09.2026;12,00;Umsatz;;Bar;B-1004;Datum prüfen\n';
  const names = {
    date: ['datum', 'date', 'buchungstag', 'tag'], amount: ['brutto', 'betrag', 'amount', 'total', 'summe', 'gesamt'],
    type: ['art', 'typ', 'type', 'vorgang'], tax: ['steuer', 'tax', 'ust', 'mwst'],
    payment: ['zahlungsart', 'payment', 'zahlart', 'bezahlart'], receipt: ['beleg', 'receipt', 'bon'],
    description: ['beschreibung', 'description', 'text', 'notiz']
  };
  const $ = selector => document.querySelector(selector);
  const elements = {
    file: $('#file-input'), demo: $('#demo-button'), mapping: $('#mapping-panel'), source: $('#source-label'),
    results: $('#results'), empty: $('#empty-state'), message: $('#message'), clear: $('#clear-button'),
    defaultType: $('#default-type'), summary: $('#summary-body'), issues: $('#issues-list'), preview: $('#preview-body')
  };
  let parsed = null, analysis = null, demoMode = false, fileName = '';

  function showMessage(text) { elements.message.textContent = text; }
  function makeCell(tag, text, className) {
    const cell = document.createElement(tag);
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }
  function appendRow(body, values, numeric = []) {
    const row = document.createElement('tr');
    values.forEach((value, index) => row.append(makeCell('td', value, numeric.includes(index) ? 'num' : '')));
    body.append(row);
  }
  function suggest(headers, key) {
    const normalized = headers.map(value => value.toLocaleLowerCase('de').replace(/[^a-zäöüß]/g, ''));
    return normalized.findIndex(value => names[key].some(name => value.includes(name)));
  }
  function updateOptions() {
    document.querySelectorAll('[data-map]').forEach(select => {
      const key = select.dataset.map;
      select.replaceChildren();
      const none = new Option('Nicht zugeordnet', '-1');
      select.add(none);
      parsed.headers.forEach((header, index) => select.add(new Option(header || `Spalte ${index + 1}`, String(index))));
      select.value = String(suggest(parsed.headers, key));
    });
  }
  function currentMapping() {
    const mapping = { defaultType: elements.defaultType.value };
    document.querySelectorAll('[data-map]').forEach(select => { mapping[select.dataset.map] = Number(select.value); });
    return mapping;
  }
  function render() {
    if (!parsed) return;
    try { analysis = core.analyze(parsed, currentMapping()); }
    catch (error) { analysis = null; elements.results.hidden = true; elements.empty.hidden = false; showMessage(error.message); return; }
    showMessage('');
    elements.results.hidden = false;
    elements.empty.hidden = true;
    const badge = $('#data-badge');
    badge.textContent = demoMode ? 'BEISPIELDATEN' : fileName;
    badge.classList.toggle('demo', demoMode);
    $('#result-count').textContent = `${analysis.valid.length} von ${analysis.sourceCount} Zeilen in Summen`;
    $('#issue-count').textContent = `${analysis.issues.length} Hinweise`;
    $('#excluded-note').textContent = `${analysis.sourceCount - analysis.valid.length} Zeilen ausgeschlossen`;
    elements.summary.replaceChildren();
    analysis.totals.forEach(total => appendRow(elements.summary, [total.month, total.type, total.tax || '—', total.payment || '—', total.count, `${core.formatAmount(total.cents)} €`], [4, 5]));
    if (!analysis.totals.length) appendRow(elements.summary, ['Keine gültigen Zeilen', '', '', '', '', '']);
    elements.issues.replaceChildren();
    if (!analysis.issues.length) elements.issues.append(makeCell('p', 'Keine Auffälligkeiten nach den einfachen Datei-Prüfungen.', 'no-issues'));
    analysis.issues.forEach(issue => {
      const row = document.createElement('div');
      row.className = 'issue' + (issue.kind === 'Ausgeschlossen' ? ' warn' : '');
      row.append(makeCell('span', `Zeile ${issue.row}`), makeCell('b', issue.kind), makeCell('span', issue.message));
      elements.issues.append(row);
    });
    elements.preview.replaceChildren();
    analysis.valid.slice(0, 12).forEach(row => appendRow(elements.preview, [row.row, row.date, row.type, row.description || '—', `${core.formatAmount(row.cents)} €`], [4]));
    if (!analysis.valid.length) appendRow(elements.preview, ['Keine gültigen Zeilen', '', '', '', '']);
  }
  function load(text, label, isDemo) {
    try { parsed = core.parseCsv(text); }
    catch (error) { showMessage(error.message); return; }
    demoMode = isDemo;
    fileName = label;
    elements.source.textContent = `${label} · ${parsed.rows.length} Datenzeilen · Trennzeichen ${parsed.delimiter === '\t' ? 'Tab' : parsed.delimiter}`;
    elements.mapping.hidden = false;
    elements.clear.hidden = false;
    updateOptions();
    render();
  }
  async function loadFile(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { showMessage('Datei über 20 MB. Bitte einen kürzeren Zeitraum exportieren.'); return; }
    try {
      const bytes = await file.arrayBuffer();
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { text = new TextDecoder('windows-1252').decode(bytes); }
      load(text, file.name, false);
    } catch { showMessage('Datei konnte nicht gelesen werden. Bitte erneut wählen.'); }
  }
  function download(kind) {
    if (!analysis) return;
    const labels = { summary: 'summen', rows: 'gepruefte-zeilen', issues: 'pruefliste' };
    const blob = new Blob([core.exportsFor(analysis)[kind]], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monatsmappe-${labels[kind]}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  elements.file.addEventListener('change', event => loadFile(event.target.files[0]));
  elements.demo.addEventListener('click', () => load(demo, 'synthetisches-beispiel.csv', true));
  elements.defaultType.addEventListener('change', render);
  document.querySelectorAll('[data-map]').forEach(select => select.addEventListener('change', render));
  document.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => download(button.dataset.export)));
  elements.clear.addEventListener('click', () => {
    parsed = analysis = null;
    fileName = '';
    elements.file.value = '';
    elements.mapping.hidden = elements.results.hidden = elements.clear.hidden = true;
    elements.empty.hidden = false;
    showMessage('');
  });
})();
