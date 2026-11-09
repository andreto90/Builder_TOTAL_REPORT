import * as XLSX from 'xlsx';
import {
  CatalogSourceFormatEntry,
  ConfiguredOutput,
  DataContract,
  DataContractField,
  FormatOutputAssociation,
  TechnicalFamily,
} from './types';

export interface ParsedWorkbookSheet {
  sheetName: string;
  name: string;
  matrix: string[][];
  rows: string[][];
  totalRows: number;
  totalCols: number;
  suggestedHeaderRowIndex: number; // 1-indexed
  hasLeadingTitleRow: boolean;
  titleRowText?: string;
}

export interface ParsedFileInspection {
  fileName: string;
  fileType: 'XLSX' | 'CSV' | 'TXT' | 'JSON';
  fileKind?: 'XLSX' | 'CSV' | 'TXT' | 'JSON';
  byteSize: number;
  fileSize: number;
  sheets: ParsedWorkbookSheet[];
  selectedSheet: string;
  detectedHeaderRowIndex: number;
  headerRowIndex: number;
  rawText: string;
  detectedDelimiter: ';' | ',' | '|' | '\t';
  delimiter: ';' | ',' | '|' | '\t';
}

export type RawFileInspectionResult = ParsedFileInspection;

/**
 * Suggests the 1-indexed header row in a 2D cell matrix.
 * Specifically handles Excel files where row 1 is a report title (e.g. "LISTADO DE FORMATOS")
 * and row 2 contains the actual column headers.
 */
export function detectHeaderRowIndex(matrix: string[][]): {
  headerRowIndex: number;
  hasLeadingTitleRow: boolean;
  titleRowText?: string;
} {
  if (matrix.length === 0) {
    return { headerRowIndex: 1, hasLeadingTitleRow: false };
  }

  const nonEmptyCount = (row: string[]) =>
    (row || []).filter((c) => String(c ?? '').trim().length > 0).length;

  const row1 = matrix[0] || [];
  const row2 = matrix[1] || [];
  const row3 = matrix[2] || [];

  const c1 = nonEmptyCount(row1);
  const c2 = nonEmptyCount(row2);
  const c3 = nonEmptyCount(row3);

  const row2Joined = row2.map((c) => String(c ?? '').toLowerCase()).join(' ');
  const looksLikeCatalogHeader =
    row2Joined.includes('entidad') ||
    row2Joined.includes('organismo') ||
    row2Joined.includes('codigo') ||
    row2Joined.includes('código') ||
    row2Joined.includes('periodicidad') ||
    row2Joined.includes('nombre_campo') ||
    row2Joined.includes('nro interno');

  if ((c1 <= 2 && c2 >= 3) || (looksLikeCatalogHeader && c1 < c2)) {
    return {
      headerRowIndex: 2,
      hasLeadingTitleRow: true,
      titleRowText: row1.filter((c) => String(c ?? '').trim().length > 0).join(' — '),
    };
  }

  if (c1 <= 1 && c2 <= 1 && c3 >= 3) {
    return {
      headerRowIndex: 3,
      hasLeadingTitleRow: true,
      titleRowText: [...row1, ...row2].filter((c) => String(c ?? '').trim().length > 0).join(' — '),
    };
  }

  return { headerRowIndex: 1, hasLeadingTitleRow: false };
}

/**
 * Returns 0-indexed header row index for a catalog matrix (e.g. 1 when row 0 is title and row 1 is headers).
 */
export function detectCatalogHeaderRowIndex(matrix: string[][]): number {
  const det = detectHeaderRowIndex(matrix);
  return Math.max(0, det.headerRowIndex - 1);
}

/**
 * Parses delimited text into a 2D string matrix.
 */
export function parseDelimitedMatrix(
  rawText: string,
  delimiter: ';' | ',' | '|' | '\t' | 'Auto' = 'Auto'
): string[][] {
  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  let effectiveDelimiter: ';' | ',' | '|' | '\t' = ';';
  if (delimiter !== 'Auto') {
    effectiveDelimiter = delimiter;
  } else if (lines.length > 0) {
    const sampleLine =
      lines.length > 1 && lines[1].length > lines[0].length ? lines[1] : lines[0];
    const candidates: Array<';' | ',' | '|' | '\t'> = [';', '|', ',', '\t'];
    let bestCount = -1;
    for (const cand of candidates) {
      const count = sampleLine.split(cand).length - 1;
      if (count > bestCount) {
        bestCount = count;
        effectiveDelimiter = cand;
      }
    }
  }

  return lines.map((line) =>
    line.split(effectiveDelimiter).map((cell) => cell.replace(/^['"]|['"]$/g, '').trim())
  );
}

/**
 * Parses an ArrayBuffer from a real .xlsx / .xls file into sheets of formatted string matrices.
 * Uses `raw: false` when available so formatted strings (including leading zeros in text/custom cells) are preserved.
 */
export function parseExcelArrayBuffer(
  buffer: ArrayBuffer,
  fileName = 'libro.xlsx',
  byteSize?: number
): ParsedFileInspection {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellText: true,
    cellDates: false,
  });

  const sheets: ParsedWorkbookSheet[] = workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    const matrix: string[][] = rawRows.map((r) =>
      (Array.isArray(r) ? r : []).map((cell) => String(cell ?? '').trim())
    );
    const maxCols = matrix.reduce((acc, r) => Math.max(acc, r.length), 0);
    const headerDetection = detectHeaderRowIndex(matrix);

    return {
      sheetName,
      name: sheetName,
      matrix,
      rows: matrix,
      totalRows: matrix.length,
      totalCols: maxCols,
      suggestedHeaderRowIndex: headerDetection.headerRowIndex,
      hasLeadingTitleRow: headerDetection.hasLeadingTitleRow,
      titleRowText: headerDetection.titleRowText,
    };
  });

  const firstSheet = sheets[0];
  const detHdr0 = firstSheet ? Math.max(0, firstSheet.suggestedHeaderRowIndex - 1) : 0;
  const size = byteSize ?? buffer.byteLength;

  return {
    fileName,
    fileType: 'XLSX',
    byteSize: size,
    fileSize: size,
    sheets,
    selectedSheet: firstSheet?.sheetName || '',
    detectedHeaderRowIndex: detHdr0,
    headerRowIndex: detHdr0,
    rawText: firstSheet ? firstSheet.matrix.map((r) => r.join(';')).join('\n') : '',
    detectedDelimiter: ';',
    delimiter: ';',
  };
}

/**
 * Parses delimited text (.csv / .txt) into a ParsedFileInspection with automatic or explicit delimiter.
 */
export function parseDelimitedTextToInspection(
  paramsOrText:
    | {
        rawText: string;
        fileName: string;
        delimiter?: ';' | ',' | '|' | '\t' | 'Auto';
      }
    | string,
  fileNameArg = 'archivo.csv',
  byteSizeArg?: number,
  _encodingArg?: string,
  delimiterArg: ';' | ',' | '|' | '\t' | 'Auto' = 'Auto'
): ParsedFileInspection {
  const rawText = typeof paramsOrText === 'string' ? paramsOrText : paramsOrText.rawText;
  const fileName = typeof paramsOrText === 'string' ? fileNameArg : paramsOrText.fileName;
  const delimiter =
    typeof paramsOrText === 'string' ? delimiterArg : paramsOrText.delimiter || 'Auto';

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  let effectiveDelimiter: ';' | ',' | '|' | '\t' = ';';
  if (delimiter !== 'Auto') {
    effectiveDelimiter = delimiter;
  } else if (lines.length > 0) {
    const sampleLine =
      lines.length > 1 && lines[1].length > lines[0].length ? lines[1] : lines[0];
    const candidates: Array<';' | ',' | '|' | '\t'> = [';', '|', ',', '\t'];
    let bestCount = -1;
    for (const cand of candidates) {
      const count = sampleLine.split(cand).length - 1;
      if (count > bestCount) {
        bestCount = count;
        effectiveDelimiter = cand;
      }
    }
  }

  const matrix: string[][] = lines.map((line) =>
    line.split(effectiveDelimiter).map((cell) => cell.replace(/^['"]|['"]$/g, '').trim())
  );

  const maxCols = matrix.reduce((acc, r) => Math.max(acc, r.length), 0);
  const headerDetection = detectHeaderRowIndex(matrix);
  const detHdr0 = Math.max(0, headerDetection.headerRowIndex - 1);
  const size = byteSizeArg ?? new TextEncoder().encode(rawText).length;

  return {
    fileName,
    fileType: fileName.toLowerCase().endsWith('.txt') ? 'TXT' : 'CSV',
    byteSize: size,
    fileSize: size,
    rawText,
    detectedDelimiter: effectiveDelimiter,
    delimiter: effectiveDelimiter,
    selectedSheet: 'Datos_Texto',
    detectedHeaderRowIndex: detHdr0,
    headerRowIndex: detHdr0,
    sheets: [
      {
        sheetName: 'Datos_Texto',
        name: 'Datos_Texto',
        matrix,
        rows: matrix,
        totalRows: matrix.length,
        totalCols: maxCols,
        suggestedHeaderRowIndex: headerDetection.headerRowIndex,
        hasLeadingTitleRow: headerDetection.hasLeadingTitleRow,
        titleRowText: headerDetection.titleRowText,
      },
    ],
  };
}

export interface CatalogImportRowResult {
  rowNumber: number; // 1-indexed in the sheet
  status: 'Aceptado' | 'Aceptado con observaciones' | 'Rechazado';
  entry?: CatalogSourceFormatEntry;
  anomalies: string[];
  rejectionReason?: string;
}

export interface CatalogImportSummary {
  fileName: string;
  sheetName: string;
  headerRowIndex: number;
  country: 'Colombia' | 'Perú';
  totalRowsRead: number;
  acceptedCount: number;
  withAnomaliesCount: number;
  rejectedCount: number;
  entries: CatalogSourceFormatEntry[];
  rowResults: CatalogImportRowResult[];
  rejectedRows: Array<{ rowNumber: number; reason: string }>;
  anomalies: string[];
}

/**
 * Operation 1: Parses a 2D sheet matrix into CatalogSourceFormatEntry items.
 * Supports both object and positional invocation.
 */
export function parseCatalogMatrix(
  paramsOrMatrix:
    | {
        matrix: string[][];
        headerRowIndex: number; // 1-indexed when passed in object
        fileName: string;
        sheetName: string;
        defaultCountry?: 'Colombia' | 'Perú';
      }
    | string[][],
  headerRowIndex0BasedArg = 1,
  defaultCountryArg: 'Colombia' | 'Perú' = 'Colombia',
  fileNameArg = 'Listado_de_Formatos.xlsx'
): CatalogImportSummary {
  const matrix = Array.isArray(paramsOrMatrix) ? paramsOrMatrix : paramsOrMatrix.matrix;
  const hIdx = Array.isArray(paramsOrMatrix)
    ? Math.max(0, headerRowIndex0BasedArg)
    : Math.max(0, paramsOrMatrix.headerRowIndex - 1);
  const fileName = Array.isArray(paramsOrMatrix) ? fileNameArg : paramsOrMatrix.fileName;
  const sheetName = Array.isArray(paramsOrMatrix) ? 'Formatos' : paramsOrMatrix.sheetName;
  const defaultCountry = Array.isArray(paramsOrMatrix)
    ? defaultCountryArg
    : paramsOrMatrix.defaultCountry || 'Colombia';

  const headers = (matrix[hIdx] || []).map((h) =>
    String(h ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  );

  const findCol = (keywords: string[], fallback: number): number => {
    const found = headers.findIndex((h) => keywords.some((k) => h.includes(k)));
    return found >= 0 ? found : fallback;
  };

  const isPeruHeader =
    headers.some((h) => h.includes('nro interno') || h.includes('nombre informe')) ||
    defaultCountry === 'Perú';

  const organismoCol = findCol(['entidad', 'organismo', 'regulador'], 0);
  const codigoCol = findCol(
    ['codigo', 'nro interno', 'numero interno', 'cod'],
    isPeruHeader ? 0 : 1
  );
  const nombreCol = findCol(
    ['nombre informe', 'nombre', 'formato', 'reporte'],
    isPeruHeader ? 1 : 2
  );
  const informePeruCol = findCol(['informe', 'anexo', 'forma'], 2);
  const periodicidadCol = findCol(['periodicidad', 'frecuencia'], 3);
  const fuentesCol = findCol(['descripcion', 'fuente'], 4);
  const areaCol = findCol(['area'], 5);
  const responsableCol = findCol(['responsable'], 6);

  const dataRows = matrix.slice(hIdx + 1);
  const rowResults: CatalogImportRowResult[] = [];
  const entries: CatalogSourceFormatEntry[] = [];
  const allAnomalies: string[] = [];

  dataRows.forEach((row, idx) => {
    const excelRowNumber = hIdx + 2 + idx;
    const nonEmptyCells = row.filter((c) => String(c ?? '').trim().length > 0);
    if (nonEmptyCells.length === 0) {
      return;
    }

    if (isPeruHeader) {
      const rawNro = String(row[codigoCol] ?? '').trim();
      const rawNombre = String(row[nombreCol] ?? '').trim();
      const rawInforme = String(row[informePeruCol] ?? '').trim();
      const rawPer = String(row[periodicidadCol] ?? '').trim();

      if (!rawNombre && !rawNro && !rawInforme) {
        rowResults.push({
          rowNumber: excelRowNumber,
          status: 'Rechazado',
          anomalies: [],
          rejectionReason: `Fila ${excelRowNumber} sin Nro Interno, Nombre Informe ni Informe.`,
        });
        return;
      }

      const anomalies: string[] = [];
      if (!rawNro) {
        anomalies.push(`Fila ${excelRowNumber}: Nro Interno vacío en catálogo de Perú.`);
      }
      if (!rawPer) {
        anomalies.push(`Fila ${excelRowNumber}: Periodicidad vacía; requiere confirmación.`);
      }
      allAnomalies.push(...anomalies);

      const entry: CatalogSourceFormatEntry = {
        id: `CAT-IMP-PE-F${excelRowNumber}-${rawNro || 'SINNRO'}`,
        country: 'Perú',
        regulatorOrOrganism: 'SBS Perú',
        formatCode: rawNro,
        internalNumberPeru: rawNro,
        reportName: rawNombre || '(Sin nombre en fila)',
        annexOrFormLabelPeru: rawInforme || 'Por confirmar',
        periodicity: rawPer || 'Por confirmar',
        suggestedTechnicalFamily: 'TXT',
        catalogStatus:
          anomalies.length > 0
            ? 'Con observaciones de catálogo por revisar'
            : 'Formato registrado; estructura pendiente',
        catalogAnomalies: anomalies,
        originEvidenceNote: `Importado desde ${fileName} · Hoja "${sheetName}" · Fila ${excelRowNumber}. No incluye estructura interna de campos.`,
        provenanceKind: 'Importado desde archivo real en sesión',
        provenanceRef: {
          fileName,
          sheetName,
          rowNumber: excelRowNumber,
        },
        rawOriginalValues: {
          nroInterno: rawNro,
          nombre: rawNombre,
          informe: rawInforme,
          periodicidad: rawPer,
        },
      };

      entries.push(entry);
      rowResults.push({
        rowNumber: excelRowNumber,
        status: anomalies.length > 0 ? 'Aceptado con observaciones' : 'Aceptado',
        entry,
        anomalies,
      });
      return;
    }

    // Colombia Catalog Row
    const rawOrganismo = String(row[organismoCol] ?? '').trim();
    const rawCodigo = String(row[codigoCol] ?? '').trim();
    const rawNombre = String(row[nombreCol] ?? '').trim();
    const rawPeriodicidad = String(row[periodicidadCol] ?? '').trim();
    const rawFuentes = String(row[fuentesCol] ?? '').trim();
    const rawArea = String(row[areaCol] ?? '').trim();
    const rawResponsable = String(row[responsableCol] ?? '').trim();

    if (!rawOrganismo && !rawNombre && !rawCodigo) {
      rowResults.push({
        rowNumber: excelRowNumber,
        status: 'Rechazado',
        anomalies: [],
        rejectionReason: `Fila ${excelRowNumber} sin Entidad/Organismo, Código ni Nombre.`,
      });
      return;
    }

    const anomalies: string[] = [];
    if (!rawCodigo) {
      anomalies.push(
        `Fila ${excelRowNumber} (${rawOrganismo || 'Sin entidad'} — ${rawNombre}): Código vacío en el archivo original. Se conserva vacío para revisión sin inventar código.`
      );
    } else if (/^(MENSUAL|TRIMESTRAL|ANUAL|SEMANAL|BIMESTRAL|DIARIA|SEMESTRAL)$/i.test(rawCodigo)) {
      anomalies.push(
        `Fila ${excelRowNumber} (${rawOrganismo}): Valor de periodicidad ("${rawCodigo}") registrado dentro de la columna Código. Se conserva el valor original para revisión.`
      );
    }

    if (!rawPeriodicidad) {
      anomalies.push(
        `Fila ${excelRowNumber} (${rawOrganismo} · ${rawCodigo || 'Sin código'}): Periodicidad vacía en el archivo original.`
      );
    } else if (
      !/^(MENSUAL|TRIMESTRAL|SEMESTRAL|ANUAL|DIARIA|SEMANAL|BIMESTRAL|EVENTUAL)$/i.test(
        rawPeriodicidad
      )
    ) {
      anomalies.push(
        `Fila ${excelRowNumber} (${rawOrganismo} · ${rawCodigo || 'Sin código'}): Valor atípico "${rawPeriodicidad}" en columna Periodicidad. Se conserva el valor original sin suponer periodicidad.`
      );
    }
    allAnomalies.push(...anomalies);

    let suggestedFamily: TechnicalFamily = 'TXT';
    const upperOrg = rawOrganismo.toUpperCase();
    const upperNom = rawNombre.toUpperCase();
    if (upperOrg.includes('DIAN') || upperNom.includes('EXOGENA') || upperNom.includes('EXÓGENA')) {
      suggestedFamily = 'XML';
    } else if (upperNom.includes('XBRL') || upperNom.includes('ESTADOS FINANCIEROS')) {
      suggestedFamily = 'XBRL';
    } else if (upperOrg.includes('SUPERSOLIDARIA') || upperOrg.includes('ALCALD')) {
      suggestedFamily = 'CSV';
    }

    const entry: CatalogSourceFormatEntry = {
      id: `CAT-IMP-CO-F${excelRowNumber}-${(rawOrganismo || 'ORG').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}-${(rawCodigo || 'VACIO').replace(/[^a-zA-Z0-9]/g, '')}`,
      country: 'Colombia',
      regulatorOrOrganism: rawOrganismo || 'Por confirmar',
      formatCode: rawCodigo,
      reportName: rawNombre || '(Sin nombre en fila)',
      periodicity: rawPeriodicidad || 'Por confirmar',
      sourceDescriptionColombia: rawFuentes,
      areaColombia: rawArea,
      responsibleColombia: rawResponsable,
      suggestedTechnicalFamily: suggestedFamily,
      catalogStatus:
        anomalies.length > 0
          ? 'Con observaciones de catálogo por revisar'
          : 'Formato registrado; estructura pendiente',
      catalogAnomalies: anomalies,
      originEvidenceNote: `Importado desde ${fileName} · Hoja "${sheetName}" · Fila ${excelRowNumber}. En Colombia, "Entidad" identifica al organismo receptor (${rawOrganismo}), no a la entidad cliente.`,
      provenanceKind: 'Importado desde archivo real en sesión',
      provenanceRef: {
        fileName,
        sheetName,
        rowNumber: excelRowNumber,
      },
      rawOriginalValues: {
        organismo: rawOrganismo,
        codigo: rawCodigo,
        nombre: rawNombre,
        periodicidad: rawPeriodicidad,
        descripcionFuentes: rawFuentes,
        area: rawArea,
        responsable: rawResponsable,
      },
    };

    entries.push(entry);
    rowResults.push({
      rowNumber: excelRowNumber,
      status: anomalies.length > 0 ? 'Aceptado con observaciones' : 'Aceptado',
      entry,
      anomalies,
    });
  });

  // Check duplicate codes within the imported batch to add informational notes without merging
  const codeCounts = new Map<string, number>();
  entries.forEach((e) => {
    const c = e.formatCode.trim();
    if (c) codeCounts.set(c, (codeCounts.get(c) || 0) + 1);
  });
  entries.forEach((e) => {
    const c = e.formatCode.trim();
    if (c && (codeCounts.get(c) || 0) > 1) {
      const rowNum = typeof e.provenanceRef === 'object' ? e.provenanceRef?.rowNumber : '';
      const msg = `Código "${c}" repetido en ${codeCounts.get(c)} filas del archivo; se conserva cada fila con su propia identidad (Fila ${rowNum}) sin fusionar registros.`;
      if (!e.catalogAnomalies.includes(msg)) {
        e.catalogAnomalies.push(msg);
      }
    }
  });

  const rejectedRows = rowResults
    .filter((r) => r.status === 'Rechazado')
    .map((r) => ({ rowNumber: r.rowNumber, reason: r.rejectionReason || 'Fila rechazada' }));

  return {
    fileName,
    sheetName,
    headerRowIndex: hIdx + 1,
    country: isPeruHeader ? 'Perú' : 'Colombia',
    totalRowsRead: dataRows.filter((r) => r.some((c) => String(c ?? '').trim().length > 0)).length,
    acceptedCount: rowResults.filter((r) => r.status === 'Aceptado').length,
    withAnomaliesCount: rowResults.filter((r) => r.status === 'Aceptado con observaciones').length,
    rejectedCount: rejectedRows.length,
    entries,
    rowResults,
    rejectedRows,
    anomalies: allAnomalies,
  };
}

/**
 * Evaluates the impact of applying catalog changes/imports on existing sources, outputs, and associations.
 * Supports both object and positional invocation.
 */
export function evaluateCatalogImportImpact(
  paramsOrExisting:
    | {
        incomingEntries: CatalogSourceFormatEntry[];
        existingEntries: CatalogSourceFormatEntry[];
        configuredOutputs?: ConfiguredOutput[];
        associations?: FormatOutputAssociation[];
      }
    | CatalogSourceFormatEntry[],
  incomingEntriesArg?: CatalogSourceFormatEntry[]
): {
  newRecordsCount: number;
  matchingByOrganismAndNameCount: number;
  newEntries: CatalogSourceFormatEntry[];
  updatedEntries: CatalogSourceFormatEntry[];
  unchangedEntries: CatalogSourceFormatEntry[];
  mergedCatalog: CatalogSourceFormatEntry[];
  sharedCodeConflicts: Array<{
    code: string;
    incomingReport: string;
    existingReport: string;
    impactedOutputs: string[];
  }>;
  protectedOutputsWarning: string[];
} {
  const existingEntries = Array.isArray(paramsOrExisting)
    ? paramsOrExisting
    : paramsOrExisting.existingEntries;
  const incomingEntries = Array.isArray(paramsOrExisting)
    ? incomingEntriesArg || []
    : paramsOrExisting.incomingEntries;
  const configuredOutputs = Array.isArray(paramsOrExisting)
    ? []
    : paramsOrExisting.configuredOutputs || [];

  const newEntries: CatalogSourceFormatEntry[] = [];
  const updatedEntries: CatalogSourceFormatEntry[] = [];
  const unchangedEntries: CatalogSourceFormatEntry[] = [];
  const mergedMap = new Map<string, CatalogSourceFormatEntry>();
  existingEntries.forEach((ex) => mergedMap.set(ex.id, ex));

  const sharedCodeConflicts: Array<{
    code: string;
    incomingReport: string;
    existingReport: string;
    impactedOutputs: string[];
  }> = [];
  const protectedOutputsWarning: string[] = [];

  for (const inc of incomingEntries) {
    const exactMatch = existingEntries.find(
      (ex) =>
        ex.country === inc.country &&
        ex.regulatorOrOrganism.toLowerCase() === inc.regulatorOrOrganism.toLowerCase() &&
        ex.formatCode === inc.formatCode &&
        ex.reportName.toLowerCase() === inc.reportName.toLowerCase()
    );
    if (exactMatch) {
      const mergedEntry: CatalogSourceFormatEntry = {
        ...exactMatch,
        ...inc,
        id: exactMatch.id,
        linkedDataContractId: exactMatch.linkedDataContractId || inc.linkedDataContractId,
        catalogStatus: exactMatch.linkedDataContractId
          ? exactMatch.catalogStatus
          : inc.catalogStatus,
      };
      mergedMap.set(exactMatch.id, mergedEntry);
      if (
        exactMatch.periodicity !== inc.periodicity ||
        exactMatch.areaColombia !== inc.areaColombia ||
        exactMatch.responsibleColombia !== inc.responsibleColombia
      ) {
        updatedEntries.push(mergedEntry);
      } else {
        unchangedEntries.push(mergedEntry);
      }
    } else {
      newEntries.push(inc);
      mergedMap.set(inc.id, inc);
    }

    if (inc.formatCode.trim()) {
      const sameCodeDiffReport = existingEntries.filter(
        (ex) =>
          ex.formatCode.trim() === inc.formatCode.trim() &&
          (ex.country !== inc.country ||
            ex.regulatorOrOrganism.toLowerCase() !== inc.regulatorOrOrganism.toLowerCase() ||
            ex.reportName.toLowerCase() !== inc.reportName.toLowerCase())
      );
      for (const conflict of sameCodeDiffReport) {
        const linkedOutputs = configuredOutputs
          .filter(
            (o) =>
              o.sourceCatalogEntryId === conflict.id ||
              (conflict.linkedDataContractId && o.dataContractId === conflict.linkedDataContractId)
          )
          .map((o) => `${o.code} v${o.version} (${o.status})`);

        sharedCodeConflicts.push({
          code: inc.formatCode,
          incomingReport: `${inc.country} · ${inc.regulatorOrOrganism} · ${inc.reportName}`,
          existingReport: `${conflict.country} · ${conflict.regulatorOrOrganism} · ${conflict.reportName}`,
          impactedOutputs: linkedOutputs,
        });

        if (linkedOutputs.some((s) => s.includes('Publicada') || s.includes('Aprobada'))) {
          protectedOutputsWarning.push(
            `El código "${inc.formatCode}" coincide con un informe vinculado a salidas publicadas (${linkedOutputs.join(', ')}). No se reasignará ninguna salida publicada al nuevo informe.`
          );
        }
      }
    }
  }

  return {
    newRecordsCount: newEntries.length,
    matchingByOrganismAndNameCount: updatedEntries.length + unchangedEntries.length,
    newEntries,
    updatedEntries,
    unchangedEntries,
    mergedCatalog: Array.from(mergedMap.values()),
    sharedCodeConflicts: sharedCodeConflicts.slice(0, 15),
    protectedOutputsWarning,
  };
}

/**
 * Generates an in-memory 152-row .xlsx ArrayBuffer (with Row 1 title and Row 2 headers) for catalog import verification.
 */
export function generateSample152RowsCatalogExcelBuffer(
  existingCatalog: CatalogSourceFormatEntry[]
): ArrayBuffer {
  const rows: (string | number)[][] = [
    ['LISTADO DE FORMATOS REGULATORIOS TÓTAL REPORT® — MATRIZ DE CONCILIACIÓN (152 FORMATOS)'],
    [
      'Entidad de Control',
      'Código',
      'Nombre del Formato',
      'Periodicidad',
      'Descripción Fuentes',
      'Área',
      'Responsable',
    ],
  ];

  const colEntries = existingCatalog.filter((e) => e.country === 'Colombia');
  colEntries.forEach((e) => {
    rows.push([
      e.regulatorOrOrganism,
      e.formatCode,
      e.reportName,
      e.periodicity,
      e.sourceDescriptionColombia || 'TÓTAL REPORT®',
      e.areaColombia || 'Regulatorio',
      e.responsibleColombia || 'Analista Regulatorio',
    ]);
  });

  const regulators = ['Superfinanciera', 'Supersolidaria', 'DIAN', 'SHD Bogotá', 'BanRep', 'FOGAFIN'];
  const periodicities = ['MENSUAL', 'TRIMESTRAL', 'SEMANAL', 'BIMESTRAL', 'SEMESTRAL', 'ANUAL', 'DIARIA'];
  for (let i = colEntries.length + 1; i <= 152; i++) {
    const reg = regulators[i % regulators.length];
    const per = periodicities[i % periodicities.length];
    const code = i === 140 ? 'F45-B' : String(200 + i);
    rows.push([
      reg,
      code,
      `FORMATO REGULATORIO CONCILIADO #${i} (${reg})`,
      per,
      'Módulo Regulatorio TÓTAL REPORT®',
      'Cumplimiento Normativo',
      'Analista Regulatorio',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Formatos');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

/**
 * Operation 2: Parses a structure definition matrix (from .xlsx or .csv) into declared DataContractField[] items.
 * Never creates fictitious data rows. Reports read, accepted, and rejected rows with locations and causes.
 */
export function parseStructureDefinitionMatrix(
  paramsOrMatrix:
    | {
        matrix?: string[][];
        rows?: string[][];
        headerRowIndex?: number; // 1-indexed
        headerRowIndex1Based?: number;
        defaultSection?: string;
        fileName?: string;
      }
    | string[][],
  headerRowIndex0BasedArg = 0,
  defaultSectionArg = 'Detalle'
): {
  fields: DataContractField[];
  totalRowsRead: number;
  acceptedRows: number;
  rejectedRows: { rowNumber: number; reason: string }[];
  rejections: Array<{ rowNumber: number; reason: string }>;
  report: {
    fileName: string;
    totalRowsRead: number;
    acceptedRows: number;
    rejectedRows: number;
    rejections: Array<{ rowNumber: number; reason: string }>;
  };
} {
  const matrix = Array.isArray(paramsOrMatrix)
    ? paramsOrMatrix
    : paramsOrMatrix.matrix || paramsOrMatrix.rows || [];
  const hIdx = Array.isArray(paramsOrMatrix)
    ? Math.max(0, headerRowIndex0BasedArg)
    : Math.max(
        0,
        (paramsOrMatrix.headerRowIndex1Based ?? paramsOrMatrix.headerRowIndex ?? 1) - 1
      );
  const defaultSection = Array.isArray(paramsOrMatrix)
    ? defaultSectionArg
    : paramsOrMatrix.defaultSection || 'Detalle';
  const fileName = Array.isArray(paramsOrMatrix)
    ? 'plantilla_estructura.csv'
    : paramsOrMatrix.fileName || 'plantilla_estructura.csv';

  const headers = (matrix[hIdx] || []).map((h) =>
    String(h ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  );

  const findCol = (keywords: string[], fallback: number): number => {
    const idx = headers.findIndex((h) => keywords.some((k) => h.includes(k)));
    return idx >= 0 ? idx : fallback;
  };

  const nameCol = findCol(['nombre_campo', 'campo', 'technical', 'name', 'codigo'], 0);
  const labelCol = findCol(['etiqueta', 'descripcion_corta', 'label', 'titulo'], 1);
  const typeCol = findCol(['tipo_dato', 'tipo', 'type'], 2);
  const lenCol = findCol(['longitud', 'largo', 'length'], 3);
  const reqCol = findCol(['obligatorio', 'requerido', 'nulo', 'required'], 4);
  const secCol = findCol(['seccion', 'tabla', 'registro'], 5);
  const precCol = findCol(['precision', 'enteros'], 6);
  const scaleCol = findCol(['escala', 'decimales'], 7);
  const maskCol = findCol(['mascara', 'formato', 'mask'], 8);

  const dataRows = matrix.slice(hIdx + 1);
  const fields: DataContractField[] = [];
  const rejections: Array<{ rowNumber: number; reason: string }> = [];
  const seenNames = new Set<string>();
  let totalRowsRead = 0;

  dataRows.forEach((row, idx) => {
    const rowNumber = hIdx + 2 + idx;
    if (row.every((c) => String(c ?? '').trim() === '')) return;
    totalRowsRead++;

    const rawName = String(row[nameCol] ?? '')
      .trim()
      .replace(/\s+/g, '_');
    const rawLabel = String(row[labelCol] ?? '').trim() || rawName;
    const rawType = String(row[typeCol] ?? '').trim().toLowerCase();
    const rawLen = String(row[lenCol] ?? '').trim();
    const rawReq = String(row[reqCol] ?? '').trim().toUpperCase();
    const rawSec = String(row[secCol] ?? '').trim() || defaultSection;
    const rawPrec = String(row[precCol] ?? '').trim();
    const rawScale = String(row[scaleCol] ?? '').trim();
    const rawMask = String(row[maskCol] ?? '').trim();

    if (!rawName) {
      rejections.push({
        rowNumber,
        reason: `Fila ${rowNumber}: El nombre técnico del campo está vacío.`,
      });
      return;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rawName)) {
      rejections.push({
        rowNumber,
        reason: `Fila ${rowNumber}: Nombre de campo inválido "${rawName}" (use letras, números y guion bajo).`,
      });
      return;
    }

    if (seenNames.has(rawName.toLowerCase())) {
      rejections.push({
        rowNumber,
        reason: `Fila ${rowNumber}: Nombre de campo duplicado "${rawName}" en la misma estructura.`,
      });
      return;
    }

    let mappedType: DataContractField['dataType'] | null = null;
    if (!rawType || rawType.includes('tex') || rawType.includes('str') || rawType.includes('alf')) {
      mappedType = 'Texto';
    } else if (rawType.includes('dec') || rawType.includes('num') || rawType.includes('imp') || rawType.includes('mon')) {
      mappedType = 'Decimal';
    } else if (rawType.includes('ent') || rawType.includes('int')) {
      mappedType = 'Entero';
    } else if (rawType.includes('fec') || rawType.includes('dat')) {
      mappedType = 'Fecha';
    } else if (rawType.includes('bool') || rawType.includes('log')) {
      mappedType = 'Booleano';
    } else if (rawType.includes('cat') || rawType.includes('cod') || rawType.includes('dom')) {
      mappedType = 'Catálogo';
    }

    if (!mappedType) {
      rejections.push({
        rowNumber,
        reason: `Fila ${rowNumber} (${rawName}): Tipo de dato "${row[typeCol]}" no reconocido. Use Texto, Entero, Decimal, Fecha, Booleano o Catálogo.`,
      });
      return;
    }

    const parsedLen = rawLen ? Number(rawLen) : 20;
    if (Number.isNaN(parsedLen) || parsedLen <= 0) {
      rejections.push({
        rowNumber,
        reason: `Fila ${rowNumber} (${rawName}): Longitud inválida "${rawLen}" (debe ser un entero mayor a 0).`,
      });
      return;
    }

    seenNames.add(rawName.toLowerCase());
    const isRequired =
      rawReq === 'SI' ||
      rawReq === 'SÍ' ||
      rawReq === 'TRUE' ||
      rawReq === '1' ||
      rawReq === 'OBLIGATORIO';

    fields.push({
      name: rawName,
      label: rawLabel,
      dataType: mappedType,
      length: parsedLen,
      precision: mappedType === 'Decimal' ? Number(rawPrec) || 18 : undefined,
      scale: mappedType === 'Decimal' ? (rawScale !== '' ? Number(rawScale) : 2) : undefined,
      formatMask: mappedType === 'Fecha' ? rawMask || 'yyyy-MM-dd' : undefined,
      nullable: !isRequired,
      lineage: `${fileName.toUpperCase()}.${rawSec.toUpperCase()}.${rawName.toUpperCase()}`,
      sampleValues: [],
      sectionName: rawSec,
      propertyOrigin: 'Declarada oficialmente',
    });
  });

  const report = {
    fileName,
    totalRowsRead,
    acceptedRows: fields.length,
    rejectedRows: rejections.length,
    rejections,
  };

  return {
    fields,
    totalRowsRead,
    acceptedRows: fields.length,
    rejectedRows: rejections,
    rejections,
    report,
  };
}

/**
 * Operation 4: Parses and validates a data batch matrix against a registered DataContract or field list.
 * - Preserves leading zeros on Texto/Catálogo fields ("000123").
 * - Flags or rejects rows with invalid numbers/dates or missing required values.
 * - Avoids precision loss on financial amounts.
 */
export function parseAndValidateDataBatchMatrix(
  paramsOrMatrix:
    | {
        matrix?: string[][];
        rows?: string[][];
        headerRowIndex?: number; // 1-indexed
        headerRowIndex1Based?: number;
        contract: DataContract;
        fileName?: string;
        dateFormatPolicy?: 'yyyy-MM-dd' | 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'dd-MM-yyyy';
        decimalSeparatorPolicy?: '.' | ',';
      }
    | string[][],
  headerRowIndex0BasedArg = 0,
  fieldsOrContractArg?: DataContractField[] | DataContract,
  defaultCutoffDateArg?: string
): {
  rows: Record<string, string | number | null>[];
  acceptedRows: Record<string, string | number | null>[];
  totalRowsRead: number;
  rejectedRows: Array<{ rowNumber: number; reason: string }>;
  rejections: Array<{ rowNumber: number; reason: string }>;
  ambiguityAlerts: string[];
  report: {
    fileName: string;
    totalRowsRead: number;
    acceptedRows: number;
    rejectedRows: number;
    rejections: Array<{ rowNumber: number; reason: string }>;
  };
} {
  const matrix = Array.isArray(paramsOrMatrix)
    ? paramsOrMatrix
    : paramsOrMatrix.matrix || paramsOrMatrix.rows || [];
  const hIdx = Array.isArray(paramsOrMatrix)
    ? Math.max(0, headerRowIndex0BasedArg)
    : Math.max(
        0,
        (paramsOrMatrix.headerRowIndex1Based ?? paramsOrMatrix.headerRowIndex ?? 1) - 1
      );
  const targetFields: DataContractField[] = Array.isArray(paramsOrMatrix)
    ? Array.isArray(fieldsOrContractArg)
      ? fieldsOrContractArg
      : fieldsOrContractArg?.fields || []
    : paramsOrMatrix.contract.fields;
  const fileName = Array.isArray(paramsOrMatrix)
    ? 'lote_datos.csv'
    : paramsOrMatrix.fileName || 'lote_datos.csv';
  const dateFormatPolicy = Array.isArray(paramsOrMatrix)
    ? 'yyyy-MM-dd'
    : paramsOrMatrix.dateFormatPolicy || 'yyyy-MM-dd';

  const rawHeaders = (matrix[hIdx] || []).map((h) => String(h ?? '').trim());
  const dataLines = matrix.slice(hIdx + 1);

  const acceptedRowsList: Record<string, string | number | null>[] = [];
  const rejections: Array<{ rowNumber: number; reason: string }> = [];
  const ambiguityAlerts: string[] = [];
  let totalRowsRead = 0;

  const contractFieldMap = new Map<string, DataContractField>(
    targetFields.map((f) => [f.name.toLowerCase(), f])
  );

  dataLines.forEach((cells, idx) => {
    const rowNumber = hIdx + 2 + idx;
    if (cells.every((c) => String(c ?? '').trim() === '')) return;
    totalRowsRead++;

    const rowObj: Record<string, string | number | null> = {};
    if (defaultCutoffDateArg) {
      rowObj.fecha_corte = defaultCutoffDateArg;
    }
    let rowError: string | null = null;

    rawHeaders.forEach((headerName, colIdx) => {
      if (!headerName || rowError) return;
      const rawCell = String(cells[colIdx] ?? '').trim();
      const fieldDef = contractFieldMap.get(headerName.toLowerCase());
      const targetKey = fieldDef ? fieldDef.name : headerName;

      if (rawCell === '') {
        if (fieldDef && !fieldDef.nullable) {
          rowError = `Fila ${rowNumber}, columna "${targetKey}": Valor obligatorio ausente.`;
          return;
        }
        rowObj[targetKey] = null;
        return;
      }

      if (!fieldDef || fieldDef.dataType === 'Texto' || fieldDef.dataType === 'Catálogo') {
        rowObj[targetKey] = rawCell;
        return;
      }

      if (fieldDef.dataType === 'Fecha') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawCell)) {
          rowObj[targetKey] = rawCell;
          return;
        }
        const slashMatch = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(rawCell);
        if (slashMatch) {
          const [, p1, p2, yyyy] = slashMatch;
          const mm = dateFormatPolicy === 'MM/dd/yyyy' ? p1 : p2;
          const dd = dateFormatPolicy === 'MM/dd/yyyy' ? p2 : p1;
          if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) {
            rowError = `Fila ${rowNumber}, columna "${targetKey}": Fecha inválida "${rawCell}".`;
            return;
          }
          rowObj[targetKey] = `${yyyy}-${mm}-${dd}`;
          return;
        }
        rowError = `Fila ${rowNumber}, columna "${targetKey}": Formato de fecha no válido "${rawCell}".`;
        return;
      }

      if (fieldDef.dataType === 'Decimal' || fieldDef.dataType === 'Entero') {
        let normalizedNumStr = rawCell;
        if (rawCell.includes(',') && !rawCell.includes('.')) {
          normalizedNumStr = rawCell.replace(',', '.');
        } else if (rawCell.includes('.') && rawCell.includes(',')) {
          normalizedNumStr = rawCell.replace(/\./g, '').replace(',', '.');
        }
        if (!/^-?\d+(\.\d+)?$/.test(normalizedNumStr)) {
          rowError = `Fila ${rowNumber}, columna "${targetKey}": Valor numérico inválido "${rawCell}".`;
          return;
        }
        if (fieldDef.dataType === 'Entero' && normalizedNumStr.includes('.')) {
          rowError = `Fila ${rowNumber}, columna "${targetKey}": Se esperaba un entero pero se recibió "${rawCell}".`;
          return;
        }
        const digitsOnly = normalizedNumStr.replace(/[-.]/g, '');
        if (digitsOnly.length > 15) {
          rowObj[targetKey] = normalizedNumStr;
        } else {
          rowObj[targetKey] = Number(normalizedNumStr);
        }
        return;
      }

      rowObj[targetKey] = rawCell;
    });

    if (rowError) {
      rejections.push({ rowNumber, reason: rowError });
    } else {
      acceptedRowsList.push(rowObj);
    }
  });

  const report = {
    fileName,
    totalRowsRead,
    acceptedRows: acceptedRowsList.length,
    rejectedRows: rejections.length,
    rejections,
  };

  return {
    rows: acceptedRowsList,
    acceptedRows: acceptedRowsList,
    totalRowsRead,
    rejectedRows: rejections,
    rejections,
    ambiguityAlerts,
    report,
  };
}

/**
 * Generates a downloadable .xlsx binary ArrayBuffer for a structure definition template.
 */
export function buildStructureTemplateWorkbookBuffer(): ArrayBuffer {
  const aoa = [
    [
      'nombre_campo',
      'etiqueta_funcional',
      'tipo_dato',
      'longitud',
      'obligatorio',
      'seccion',
      'precision',
      'escala',
      'mascara_fecha',
    ],
    ['fecha_corte', 'Fecha de Corte', 'Fecha', '10', 'SI', 'Detalle', '', '', 'yyyy-MM-dd'],
    [
      'id_obligacion',
      'Número de Obligación (Con ceros iniciales)',
      'Texto',
      '12',
      'SI',
      'Detalle',
      '',
      '',
      '',
    ],
    ['nit_deudor', 'NIT o Identificación', 'Texto', '15', 'SI', 'Detalle', '', '', ''],
    ['saldo_capital', 'Saldo Capital al Corte', 'Decimal', '18', 'SI', 'Detalle', '18', '2', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Estructura');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

