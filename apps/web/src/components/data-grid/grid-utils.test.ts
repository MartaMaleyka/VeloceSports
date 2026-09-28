import { describe, expect, it } from 'vitest';
import {
  applyMatrix,
  coerceCellValue,
  detectDelimiter,
  emptyRow,
  isRowEmpty,
  mapCsvToRows,
  parseClipboard,
  parseDateInput,
  parseDateTimeInput,
  parseDelimited,
  type GridColumn,
} from './grid-utils.js';

const columns: GridColumn[] = [
  { key: 'firstName', header: 'Nombre', type: 'text' },
  { key: 'jerseyNumber', header: 'Dorsal', type: 'number' },
  {
    key: 'categoryId',
    header: 'Categoría',
    type: 'select',
    options: [
      { value: '7', label: 'Sub-10' },
      { value: '9', label: 'Sub-12 Élite' },
    ],
  },
  { key: 'dateOfBirth', header: 'Fecha de nacimiento', type: 'date' },
];

describe('parseDelimited', () => {
  it('respeta comillas, comillas escapadas y saltos de línea entre comillas', () => {
    expect(parseDelimited('a,"b,c","d ""x"""\n"línea\nnueva",2\n', ',')).toEqual([
      ['a', 'b,c', 'd "x"'],
      ['línea\nnueva', '2'],
    ]);
  });

  it('normaliza CRLF e ignora la línea vacía final', () => {
    expect(parseDelimited('a\tb\r\nc\td\r\n', '\t')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('parseClipboard / detectDelimiter', () => {
  it('un texto suelto es una sola celda', () => {
    expect(parseClipboard('Hola, mundo')).toEqual([['Hola, mundo']]);
  });

  it('un bloque copiado de una hoja se divide por tabuladores', () => {
    expect(parseClipboard('Ana\t7\nLuis\t9\n')).toEqual([
      ['Ana', '7'],
      ['Luis', '9'],
    ]);
  });

  it('detecta punto y coma (Excel en español), coma y tabulador', () => {
    expect(detectDelimiter('Nombre;Dorsal\nAna;7')).toBe(';');
    expect(detectDelimiter('Nombre,Dorsal')).toBe(',');
    expect(detectDelimiter('Nombre\tDorsal')).toBe('\t');
  });
});

describe('conversión de celdas', () => {
  it('fechas en formatos habituales', () => {
    expect(parseDateInput('2014-3-2')).toBe('2014-03-02');
    expect(parseDateInput('02/03/2014')).toBe('2014-03-02');
    expect(parseDateInput('2-3-2014')).toBe('2014-03-02');
    expect(parseDateInput('ayer')).toBeNull();
    expect(parseDateTimeInput('05/10/2026 9:30')).toBe('2026-10-05T09:30');
    expect(parseDateTimeInput('2026-10-05T18:00:00')).toBe('2026-10-05T18:00');
  });

  it('un select acepta etiqueta o valor sin distinguir mayúsculas ni tildes', () => {
    const category = columns[2]!;
    expect(coerceCellValue(category, 'sub-12 elite')).toBe('9');
    expect(coerceCellValue(category, '7')).toBe('7');
    expect(coerceCellValue(category, 'Sub-99')).toBe('Sub-99');
  });

  it('números con coma decimal y correos en minúsculas', () => {
    expect(coerceCellValue({ key: 'n', header: 'n', type: 'number' }, '7,5')).toBe('7.5');
    expect(coerceCellValue({ key: 'e', header: 'e', type: 'email' }, ' Ana@Test.COM ')).toBe(
      'ana@test.com',
    );
  });
});

describe('applyMatrix', () => {
  it('pega hacia la derecha y abajo, convierte valores y añade filas', () => {
    const rows = [emptyRow(columns)];
    const next = applyMatrix(rows, columns, 0, 0, [
      ['Ana', '7', 'Sub-10', '02/03/2014'],
      ['Luis', '9', 'sub-12 élite', ''],
      ['Mía', '3', 'Sub-10', '', 'columna extra ignorada'],
    ]);
    expect(next).toHaveLength(3);
    expect(next[0]!.values).toEqual({
      firstName: 'Ana',
      jerseyNumber: '7',
      categoryId: '7',
      dateOfBirth: '2014-03-02',
    });
    expect(next[1]!.values.categoryId).toBe('9');
    expect(rows[0]!.values.firstName).toBe('');
  });

  it('pegar desde una columna intermedia no toca las anteriores', () => {
    const rows = [emptyRow(columns)];
    rows[0]!.values.firstName = 'Ana';
    const next = applyMatrix(rows, columns, 0, 1, [['10', 'Sub-10']]);
    expect(next[0]!.values).toMatchObject({ firstName: 'Ana', jerseyNumber: '10', categoryId: '7' });
  });
});

describe('mapCsvToRows', () => {
  it('usa los encabezados aunque vengan en otro orden, y descarta filas vacías', () => {
    const rows = mapCsvToRows(
      [
        ['Dorsal', 'nombre', 'CATEGORIA'],
        ['7', 'Ana', 'Sub-10'],
        ['', '', ''],
      ],
      columns,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.values).toMatchObject({ firstName: 'Ana', jerseyNumber: '7', categoryId: '7' });
  });

  it('sin encabezados reconocibles usa el orden de las columnas', () => {
    const rows = mapCsvToRows([['Ana', '7']], columns);
    expect(rows[0]!.values).toMatchObject({ firstName: 'Ana', jerseyNumber: '7' });
  });
});

describe('isRowEmpty', () => {
  it('una fila con solo valores por defecto cuenta como vacía', () => {
    const row = emptyRow(columns, { categoryId: '7' });
    expect(isRowEmpty(row, { categoryId: '7' })).toBe(true);
    row.values.firstName = 'Ana';
    expect(isRowEmpty(row, { categoryId: '7' })).toBe(false);
  });
});
