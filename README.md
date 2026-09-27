# Monatsmappe

Monatsmappe prüft einen CSV-Export aus einem bestehenden Kassensystem. Die Datei bleibt auf dem eigenen Gerät. Das Werkzeug zeigt Monatssummen und auffällige Zeilen und erstellt drei CSV-Dateien, die sich in Excel öffnen lassen: Summen, verarbeitete Zeilen und Prüfliste. Der Originalexport wird weder verändert noch hochgeladen.

`index.html` im Browser öffnen. Eine CSV-Datei wählen oder **Mit Beispieldaten testen** anklicken. Die Beispieldaten sind erfunden. Danach die Spalten für Datum und Bruttobetrag prüfen, die Ergebnisse ansehen und die benötigten Dateien herunterladen. Es ist kein Konto und keine Installation nötig.

Unterstützt werden CSV-Dateien mit Semikolon, Komma oder Tab als Trennzeichen in UTF-8 oder Windows-1252. Datumsformate: `DD.MM.YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`. Beträge: deutsches Komma oder Dezimalpunkt. Dateien über 20 MB werden abgewiesen. Zeilen mit ungültigem Datum oder Betrag fehlen in den Summen und stehen in der Prüfliste. Gleiche Quellzeilen bleiben in den Summen, werden aber markiert. Nach dem Schließen der Seite werden keine Daten gespeichert.

Das Werkzeug erstellt keine Steuererklärung und keine DATEV-Importdatei. Es ergänzt weder Steuersätze noch Konten. Der Steuerberater sollte die Ergebnisse mit dem Originalexport abgleichen und ein benötigtes DATEV-Format vorgeben. Die [GoBD-Hinweise des Bundesfinanzministeriums](https://ao.bundesfinanzministerium.de/ao/2025/Anhaenge/BMF-Schreiben-und-gleichlautende-Laendererlasse/Anhang-33/inhalt.html) behandeln die Aufbewahrung von Ausgangsdaten; Monatsmappe ersetzt diese Pflicht nicht. Der [DATEV-Format-Header](https://developer.datev.de/de/file-format/details/datev-format/format-description/header) zeigt, warum eine einfache Summen-CSV keine DATEV-Datei ist.

Die eingebauten Prüfungen laufen mit `node --test test-core.cjs`.
