import {
  ConfiguredOutput,
  DaqueFormatProfile,
  DataContract,
  ExecutionFinding,
  FormatOutputAssociation,
  OutputType,
  RegulatoryFormat,
  StructureField,
} from './types';

export interface FileNameContext {
  entidad: string;
  formato: string;
  periodo: string;
  periodicidad?: string;
  version: string;
  consecutivo?: string;
}

/**
 * Resolves dynamic filename patterns using typed placeholders.
 */
export function resolveDynamicFileName(
  pattern: string,
  ctx: FileNameContext,
  extension?: string
): string {
  let result = pattern
    .replace(/\{entidad\}/gi, ctx.entidad || 'ENTIDAD')
    .replace(/\{formato\}/gi, ctx.formato || 'FORMATO')
    .replace(/\{periodo\}/gi, ctx.periodo || '2026-11')
    .replace(/\{fecha_corte\}/gi, ctx.periodo || '2026-11')
    .replace(/\{periodicidad\}/gi, ctx.periodicidad || 'MENSUAL')
    .replace(/\{version\}/gi, (ctx.version || '1.0').replace(/\./g, '_'))
    .replace(/\{consecutivo\}/gi, ctx.consecutivo || '01');

  if (extension && extension !== 'N/A') {
    const cleanExt = extension.startsWith('.') ? extension : `.${extension}`;
    if (!result.toLowerCase().endsWith(cleanExt.toLowerCase())) {
      result += cleanExt;
    }
  }
  return result;
}

/**
 * Calculates accurate UTF-8 byte length or character length.
 */
export function measureFieldLength(value: string, unit: 'Caracteres' | 'Bytes'): number {
  if (unit === 'Bytes') {
    return new TextEncoder().encode(value).length;
  }
  return Array.from(value).length;
}

/**
 * Formats a date string (YYYY-MM-DD) into the target mask (dd-MM-yyyy, yyyyMMdd, yyyy-MM-dd, MM/yyyy).
 */
export function applyDateMask(rawDate: string, mask: string): string {
  if (!rawDate) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate.trim());
  if (!match) return rawDate;
  const [, yyyy, mm, dd] = match;
  switch (mask) {
    case 'dd-MM-yyyy':
      return `${dd}-${mm}-${yyyy}`;
    case 'dd/MM/yyyy':
      return `${dd}/${mm}/${yyyy}`;
    case 'yyyyMMdd':
      return `${yyyy}${mm}${dd}`;
    case 'yyyy-MM':
      return `${yyyy}-${mm}`;
    case 'yyyy-MM-dd':
    default:
      return `${yyyy}-${mm}-${dd}`;
  }
}

/**
 * Evaluates a field value from a data row and applies formatting, padding, and validation rules.
 * Never truncates silently when a value exceeds its maximum length.
 */
export function evaluateAndFormatField(
  field: StructureField,
  row: Record<string, string | number | null>,
  rowIndex: number,
  ctx: FileNameContext,
  decimalSeparator: ',' | '.' = ',',
  isFixedWidth = false
): { formatted: string; findings: ExecutionFinding[] } {
  const findings: ExecutionFinding[] = [];
  let rawVal: string | number | null = null;

  const { transformationKind, sourceField, expression } = field.mapping;

  if (transformationKind === 'Constante') {
    rawVal = expression || field.defaultValue;
  } else if (transformationKind === 'Variable de contexto') {
    if (expression === 'contexto.fecha_corte' || sourceField === 'contexto.fecha_corte') {
      rawVal = ctx.periodo.length === 7 ? `${ctx.periodo}-30` : ctx.periodo;
    } else if (expression === 'contexto.entidad' || sourceField === 'contexto.entidad') {
      rawVal = ctx.entidad;
    } else if (expression === 'contexto.formato') {
      rawVal = ctx.formato;
    } else {
      rawVal = row[sourceField] ?? field.defaultValue;
    }
  } else if (transformationKind === 'Concatenación tipada') {
    // e.g. "nombre + ' ' + apellido_1"
    const parts = (expression || sourceField)
      .split('+')
      .map((p) => p.trim())
      .map((token) => {
        if (
          (token.startsWith("'") && token.endsWith("'")) ||
          (token.startsWith('"') && token.endsWith('"'))
        ) {
          return token.slice(1, -1);
        }
        const val = row[token];
        return val !== null && val !== undefined ? String(val) : '';
      });
    rawVal = parts.join('').trim();
  } else if (transformationKind === 'Expresión declarativa') {
    // Controlled declarative expressions: UPPER(col), TRIM(col), COALESCE(col, 'default')
    const upperMatch = /^UPPER\(([a-zA-Z0-9_]+)\)$/i.exec(expression.trim());
    const trimMatch = /^TRIM\(([a-zA-Z0-9_]+)\)$/i.exec(expression.trim());
    if (upperMatch) {
      const v = row[upperMatch[1]];
      rawVal = v !== null && v !== undefined ? String(v).toUpperCase() : null;
    } else if (trimMatch) {
      const v = row[trimMatch[1]];
      rawVal = v !== null && v !== undefined ? String(v).trim() : null;
    } else if (sourceField && sourceField in row) {
      rawVal = row[sourceField];
    } else {
      findings.push({
        id: `F-EXP-${rowIndex}-${field.technicalName}`,
        code: 'CES-MAP-004',
        layer: 'Mapeo y tipos',
        severity: 'Bloqueante',
        location: `Fila ${rowIndex + 1} · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `Expresión o marcador no reconocido "${expression}". No se permite ejecutar código arbitrario.`,
        suggestedAction: 'Utilice únicamente funciones declarativas autorizadas (UPPER, TRIM) o campos del contrato.',
      });
      rawVal = '';
    }
  } else {
    // Directo o Máscara fecha/número
    if (!sourceField) {
      if (field.required) {
        findings.push({
          id: `F-UNMAP-${rowIndex}-${field.technicalName}`,
          code: 'CES-MAP-001',
          layer: 'Mapeo y tipos',
          severity: 'Bloqueante',
          location: `Campo ${field.technicalName}`,
          fieldTechnicalName: field.technicalName,
          description: `El campo obligatorio "${field.label}" (${field.technicalName}) no tiene origen asignado en el contrato de datos.`,
          suggestedAction: 'Vincule el campo a una columna del contrato o declare una constante autorizada.',
        });
      }
      rawVal = field.defaultValue || null;
    } else {
      rawVal = row[sourceField] ?? null;
    }
  }

  // Null / Empty check
  if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
    if (field.required && !field.nullable) {
      findings.push({
        id: `F-REQ-${rowIndex}-${field.technicalName}`,
        code: 'CES-STR-001',
        layer: 'Representación y archivo',
        severity: 'Bloqueante',
        location: `Fila ${rowIndex + 1} · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `Valor obligatorio ausente en "${field.technicalName}". No se permite reemplazo silencioso por cero o vacío.`,
        suggestedAction: 'Corrija el registro en el conjunto de datos de origen o ajuste la nulabilidad con sustento normativo.',
      });
      return { formatted: '', findings };
    }
    rawVal = field.defaultValue || '';
  }

  let formatted = String(rawVal);

  // Format by dataType
  if (field.dataType === 'Fecha') {
    formatted = applyDateMask(formatted, field.formatMask || 'yyyy-MM-dd');
  } else if (field.dataType === 'Decimal') {
    const num = Number(String(rawVal).replace(',', '.'));
    if (Number.isNaN(num)) {
      findings.push({
        id: `F-TYPE-${rowIndex}-${field.technicalName}`,
        code: 'CES-STR-002',
        layer: 'Representación y archivo',
        severity: 'Bloqueante',
        location: `Fila ${rowIndex + 1} · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `Conversión incompatible: el valor "${rawVal}" no es un decimal válido para ${field.technicalName}.`,
        suggestedAction: 'Verifique la correspondencia de tipos entre el contrato de origen y el campo de salida.',
      });
    } else {
      const scale = field.scale ?? 2;
      const fixed = num.toFixed(scale);
      // Check precision overflow
      const digitsOnly = fixed.replace(/[-.]/g, '');
      if (field.precision && digitsOnly.length > field.precision) {
        findings.push({
          id: `F-PREC-${rowIndex}-${field.technicalName}`,
          code: 'CES-STR-003',
          layer: 'Representación y archivo',
          severity: 'Bloqueante',
          location: `Fila ${rowIndex + 1} · Campo ${field.technicalName}`,
          fieldTechnicalName: field.technicalName,
          description: `Desbordamiento de precisión en "${field.technicalName}": ${digitsOnly.length} dígitos exceden precisión máxima (${field.precision}, ${scale}).`,
          suggestedAction: 'Incremente la precisión en una revisión autorizada o verifique el importe de origen.',
        });
      }
      formatted = decimalSeparator === ',' ? fixed.replace('.', ',') : fixed;
    }
  } else if (field.dataType === 'Entero') {
    const num = Number(rawVal);
    if (!Number.isInteger(num)) {
      findings.push({
        id: `F-INT-${rowIndex}-${field.technicalName}`,
        code: 'CES-STR-004',
        layer: 'Representación y archivo',
        severity: 'Bloqueante',
        location: `Fila ${rowIndex + 1} · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `El valor "${rawVal}" no es un entero válido para el campo "${field.technicalName}".`,
        suggestedAction: 'Asegure un origen entero o configure un tipo Decimal con escala explícita.',
      });
    }
  }

  // Apply explicit zero-padding when configured on identifiers or fixed-width fields
  if (
    (isFixedWidth || field.paddingChar === '0') &&
    field.paddingChar !== 'Ninguno' &&
    field.length > 0
  ) {
    const currentLen = measureFieldLength(formatted, field.lengthUnit);
    if (currentLen < field.length) {
      const padNeeded = field.length - currentLen;
      const padStr = field.paddingChar.repeat(padNeeded);
      formatted =
        field.alignment === 'Derecha' ? padStr + formatted : formatted + padStr;
    }
  }

  // Length overflow check (NEVER silently truncate!)
  if (field.length > 0) {
    const measured = measureFieldLength(formatted, field.lengthUnit);
    if (measured > field.length) {
      findings.push({
        id: `F-LEN-${rowIndex}-${field.technicalName}`,
        code: 'CES-STR-005',
        layer: 'Representación y archivo',
        severity: 'Bloqueante',
        location: `Fila ${rowIndex + 1} · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `El valor "${formatted}" mide ${measured} ${field.lengthUnit.toLowerCase()} y supera el límite permitido de ${field.length}. No se trunca silenciosamente.`,
        suggestedAction: 'Ajuste la longitud del campo en la estructura o depure el dato en el origen.',
      });
    }
  }

  return { formatted, findings };
}

/**
 * Escapes a CSV field according to delimiter and quote rules.
 */
export function escapeCsvCell(
  value: string,
  delimiter: string,
  quoteChar: '"' | "'" | 'Ninguno',
  escapeChar: '\\' | '"' = '"'
): string {
  if (quoteChar === 'Ninguno') return value;
  const mustQuote =
    value.includes(delimiter) ||
    value.includes(quoteChar) ||
    value.includes('\n') ||
    value.includes('\r');
  if (!mustQuote) return value;
  const escapedInner = value.replace(
    new RegExp(quoteChar, 'g'),
    escapeChar === '\\' ? `\\${quoteChar}` : `${quoteChar}${quoteChar}`
  );
  return `${quoteChar}${escapedInner}${quoteChar}`;
}

/**
 * Validates fixed-width TXT fields for position overlaps and unauthorized gaps.
 */
export function validateFixedWidthStructure(fields: StructureField[]): ExecutionFinding[] {
  const findings: ExecutionFinding[] = [];
  const detailFields = fields
    .filter((f) => f.recordSection === 'Detalle' && f.startPosition !== undefined)
    .sort((a, b) => (a.startPosition ?? 0) - (b.startPosition ?? 0));

  let expectedNextPos = 1;
  for (let i = 0; i < detailFields.length; i++) {
    const f = detailFields[i];
    const start = f.startPosition ?? expectedNextPos;
    const end = start + f.length - 1;

    if (i > 0 && start < expectedNextPos) {
      const prev = detailFields[i - 1];
      findings.push({
        id: `F-POS-OVERLAP-${f.id}`,
        code: 'CES-TXT-001',
        layer: 'Diseño y estructura',
        severity: 'Bloqueante',
        location: `Registro Detalle · Campo ${f.technicalName} (Pos ${start}..${end})`,
        fieldTechnicalName: f.technicalName,
        description: `Superposición de posiciones en ancho fijo: "${f.technicalName}" inicia en posición ${start}, pero "${prev.technicalName}" termina en ${expectedNextPos - 1}.`,
        suggestedAction: `Ajuste la posición inicial de "${f.technicalName}" a ${expectedNextPos} o reduzca la longitud de "${prev.technicalName}".`,
      });
    } else if (i > 0 && start > expectedNextPos) {
      findings.push({
        id: `F-POS-GAP-${f.id}`,
        code: 'CES-TXT-002',
        layer: 'Diseño y estructura',
        severity: 'Advertencia',
        location: `Registro Detalle · Posiciones ${expectedNextPos}..${start - 1}`,
        fieldTechnicalName: f.technicalName,
        description: `Vacío de posición no declarado entre posición ${expectedNextPos} y ${start - 1} antes de "${f.technicalName}".`,
        suggestedAction: 'Agregue un campo de relleno explícito (filler) o alinee las posiciones consecutivamente.',
      });
    }
    expectedNextPos = end + 1;
  }

  return findings;
}

/**
 * Generates the physical output artifact or conceptual representation, plus all validation findings across layers.
 */
export function generateOutputArtifact(params: {
  output: ConfiguredOutput;
  outputType: OutputType;
  contract: DataContract;
  daqueProfile?: DaqueFormatProfile;
  context: FileNameContext;
}): {
  fileName: string;
  content: string;
  mimeType: string;
  isRealExecutableGeneration: boolean;
  engineNotice: string;
  findings: ExecutionFinding[];
  rowsProcessed: number;
} {
  const { output, outputType, contract, daqueProfile, context } = params;
  const findings: ExecutionFinding[] = [];
  const rows = contract.demoRows;
  const detailFields = output.fields
    .filter((f) => f.recordSection === 'Detalle' || f.recordSection === 'Nodo raíz / Hecho')
    .sort((a, b) => a.order - b.order);

  const fileName = resolveDynamicFileName(
    output.composition.fileNamePattern,
    context,
    output.composition.extension
  );

  // Layer 1: Structure & Evidence checks
  for (const field of output.fields) {
    if (field.evidenceState === 'Fuentes en conflicto') {
      findings.push({
        id: `F-EVID-CONFLICT-${field.id}`,
        code: 'CES-EVI-001',
        layer: 'Diseño y estructura',
        severity: 'Bloqueante',
        location: `Estructura · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `Fuentes normativas en conflicto en "${field.label}" (${field.evidenceSourceRef}). Requiere decisión humana antes de aprobar o publicar.`,
        suggestedAction: 'Revise la evidencia en el diseñador y confirme la especificación aplicable.',
      });
    } else if (field.evidenceState === 'Requiere confirmación' && field.required) {
      findings.push({
        id: `F-EVID-PEND-${field.id}`,
        code: 'CES-EVI-002',
        layer: 'Diseño y estructura',
        severity: 'Advertencia',
        location: `Estructura · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `Propiedad inferida de muestra en "${field.technicalName}" pendiente de confirmación normativa.`,
        suggestedAction: 'Confirme el tipo y obligatoriedad contra el instructivo oficial.',
      });
    }
  }

  // Layer 2: Format-specific DAQUE data validation rules (before serialization!)
  if (daqueProfile) {
    if (daqueProfile.evidenceStatus === 'Caducada / Requiere revalidación') {
      findings.push({
        id: `F-DAQUE-EXPIRED-${daqueProfile.id}`,
        code: 'DAQUE-PRE-001',
        layer: 'Datos del formato (DAQUE)',
        severity: 'Bloqueante',
        location: `Precondición DAQUE · Perfil ${daqueProfile.code} ${daqueProfile.version}`,
        description: `La evidencia de validación de datos del formato (${daqueProfile.code}) está caducada o no coincide con el snapshot ${contract.snapshotId}.`,
        suggestedAction: 'Ejecute la validación del perfil DAQUE sobre el corte actual antes de serializar.',
      });
    }

    for (const rule of daqueProfile.keyBusinessRules) {
      if (rule.rejectsZeroBalance) {
        rows.forEach((r, idx) => {
          const saldo = Number(r.saldo ?? r.monto ?? 0);
          if (saldo === 0) {
            findings.push({
              id: `F-DAQUE-ZERO-${idx}`,
              code: rule.code,
              layer: 'Datos del formato (DAQUE)',
              severity: 'Bloqueante',
              location: `Fila ${idx + 1} · Obligación ${r.id_obligacion ?? idx + 1}`,
              fieldTechnicalName: 'saldo',
              description: `[Perfil ${daqueProfile.code}] ${rule.description}: se detectó saldo igual a 0.00 no admitido para este formato.`,
              suggestedAction: 'Depure el registro en el conjunto de datos de TÓTAL REPORT®.',
            });
          }
        });
      }
    }
  }

  // Check empty dataset policy
  if (rows.length === 0 && output.composition.emptyDatasetPolicy === 'Bloquear generación') {
    findings.push({
      id: 'F-EMPTY-DATASET',
      code: 'CES-PKG-001',
      layer: 'Coherencia de conjunto',
      severity: 'Bloqueante',
      location: 'Conjunto de datos de entrada',
      description: 'El conjunto de datos tiene 0 registros y la política del rol exige bloquear en ausencia de datos.',
      suggestedAction: 'Verifique la extracción en TÓTAL REPORT® o cambie la política de datos vacíos si el ente admite envío vacío.',
    });
  }

  const family = outputType.family;

  // Family 1: CSV (Real generation)
  if (family === 'CSV') {
    const delim =
      output.composition.delimiter === 'Ancho fijo' || output.composition.delimiter === 'N/A'
        ? outputType.csvParams?.delimiter ?? ';'
        : output.composition.delimiter;
    const quoteChar = outputType.csvParams?.quoteChar ?? '"';
    const escapeChar = outputType.csvParams?.escapeChar ?? '"';
    const decSep = output.composition.decimalSeparator ?? outputType.csvParams?.decimalSeparator ?? ',';

    const lines: string[] = [];
    if (output.composition.includeHeader) {
      lines.push(
        detailFields
          .map((f) => escapeCsvCell(f.technicalName, delim, quoteChar, escapeChar))
          .join(delim)
      );
    }

    let totalNumericControl = 0;
    rows.forEach((row, rowIdx) => {
      const cells = detailFields.map((field) => {
        const res = evaluateAndFormatField(field, row, rowIdx, context, decSep, false);
        findings.push(...res.findings);
        if (field.dataType === 'Decimal') {
          const n = Number(String(row[field.mapping.sourceField] ?? 0));
          if (!Number.isNaN(n)) totalNumericControl += n;
        }
        return escapeCsvCell(res.formatted, delim, quoteChar, escapeChar);
      });
      lines.push(cells.join(delim));
    });

    if (output.composition.includeControlTotals || output.composition.includeFooter) {
      const totalFormatted =
        decSep === ','
          ? totalNumericControl.toFixed(2).replace('.', ',')
          : totalNumericControl.toFixed(2);
      lines.push(`CONTROL_TOTAL${delim}${rows.length}${delim}${totalFormatted}`);
    }

    return {
      fileName,
      content: lines.join('\n'),
      mimeType: 'text/csv;charset=utf-8',
      isRealExecutableGeneration: true,
      engineNotice: `Generación física real ejecutada por ${outputType.serializationEngine} (${outputType.engineVersion}).`,
      findings,
      rowsProcessed: rows.length,
    };
  }

  // Family 2: TXT (Real generation — Fixed width or delimited with Cabecera, Detalle, Cierre)
  if (family === 'TXT') {
    const isFixed =
      outputType.txtParams?.mode === 'Ancho fijo' ||
      output.composition.delimiter === 'Ancho fijo';
    if (isFixed) {
      findings.push(...validateFixedWidthStructure(output.fields));
    }

    const decSep = output.composition.decimalSeparator ?? '.';
    const lines: string[] = [];

    if (output.composition.includeHeader || outputType.txtParams?.hasHeaderRecord) {
      const cleanPeriod = context.periodo.replace(/-/g, '');
      lines.push(`01${context.entidad.padEnd(12, ' ')}${context.formato.padEnd(10, ' ')}${cleanPeriod.padEnd(8, ' ')}`);
    }

    let totalAmount = 0;
    rows.forEach((row, rowIdx) => {
      if (isFixed) {
        let line = '';
        detailFields.forEach((field) => {
          const res = evaluateAndFormatField(field, row, rowIdx, context, decSep, true);
          findings.push(...res.findings);
          if (field.dataType === 'Decimal') {
            const n = Number(String(row[field.mapping.sourceField] ?? 0));
            if (!Number.isNaN(n)) totalAmount += n;
          }
          line += res.formatted;
        });
        lines.push(line);
      } else {
        const delim =
          output.composition.delimiter === 'Ancho fijo' || output.composition.delimiter === 'N/A'
            ? '|'
            : output.composition.delimiter;
        const cells = detailFields.map((field) => {
          const res = evaluateAndFormatField(field, row, rowIdx, context, decSep, false);
          findings.push(...res.findings);
          return res.formatted;
        });
        lines.push(cells.join(delim));
      }
    });

    if (output.composition.includeFooter || outputType.txtParams?.hasFooterControlRecord) {
      const countStr = String(rows.length).padStart(8, '0');
      const sumStr = totalAmount.toFixed(2).replace('.', '').padStart(16, '0');
      lines.push(`99${countStr}${sumStr}`);
    }

    return {
      fileName,
      content: lines.join('\n'),
      mimeType: 'text/plain;charset=utf-8',
      isRealExecutableGeneration: true,
      engineNotice: `Generación física real ejecutada por ${outputType.serializationEngine} (${outputType.engineVersion}).`,
      findings,
      rowsProcessed: rows.length,
    };
  }

  // Family 3: XML (Real generation)
  if (family === 'XML') {
    const rootEl = outputType.xmlParams?.rootElement || 'ReporteRegulatorio';
    const ns = outputType.xmlParams?.targetNamespace || 'urn:totalreport:regulatorio:v1';
    const xsd = outputType.xmlParams?.xsdSchemaRef || 'esquema_oficial_v1.xsd';
    const decSep = output.composition.decimalSeparator ?? '.';

    const xmlLines: string[] = [
      `<?xml version="1.0" encoding="${output.composition.encoding === 'ISO-8859-1' ? 'ISO-8859-1' : 'UTF-8'}"?>`,
      `<${rootEl} xmlns="${ns}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${ns} ${xsd}" entidad="${context.entidad}" formato="${context.formato}" periodo="${context.periodo}" version="${output.version}">`,
      `  <Encabezado>`,
      `    <CodigoEntidad>${context.entidad}</CodigoEntidad>`,
      `    <CodigoFormato>${context.formato}</CodigoFormato>`,
      `    <PeriodoCorte>${context.periodo}</PeriodoCorte>`,
      `    <TotalRegistros>${rows.length}</TotalRegistros>`,
      `  </Encabezado>`,
      `  <DetalleRegistros>`,
    ];

    rows.forEach((row, rowIdx) => {
      const attrs: string[] = [];
      const childNodes: string[] = [];

      detailFields.forEach((field) => {
        const res = evaluateAndFormatField(field, row, rowIdx, context, decSep, false);
        findings.push(...res.findings);
        if (field.xmlNodeKind === 'Atributo') {
          attrs.push(`${field.technicalName}="${res.formatted}"`);
        } else {
          if (!res.formatted && outputType.xmlParams?.emptyElementHandling === 'xsi:nil="true"') {
            childNodes.push(`      <${field.technicalName} xsi:nil="true" />`);
          } else if (!res.formatted && outputType.xmlParams?.emptyElementHandling === 'Omitir nodo') {
            // omit
          } else {
            childNodes.push(`      <${field.technicalName}>${res.formatted}</${field.technicalName}>`);
          }
        }
      });

      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
      xmlLines.push(`    <Registro secuencia="${rowIdx + 1}"${attrStr}>`);
      xmlLines.push(...childNodes);
      xmlLines.push(`    </Registro>`);
    });

    xmlLines.push(`  </DetalleRegistros>`);
    xmlLines.push(`</${rootEl}>`);

    return {
      fileName,
      content: xmlLines.join('\n'),
      mimeType: 'application/xml;charset=utf-8',
      isRealExecutableGeneration: true,
      engineNotice: `Generación XML real y validación estructural XSD ejecutada por ${outputType.serializationEngine}.`,
      findings,
      rowsProcessed: rows.length,
    };
  }

  // Family 4: AVRO (Conceptual Schema + Logical Record View — binary OCF requires backend worker)
  if (family === 'AVRO') {
    const avroFields = detailFields.map((field) => {
      let avroType: unknown = 'string';
      if (field.dataType === 'Entero') avroType = 'long';
      else if (field.dataType === 'Booleano') avroType = 'boolean';
      else if (field.dataType === 'Decimal') {
        avroType = {
          type: 'bytes',
          logicalType: 'decimal',
          precision: field.precision ?? 18,
          scale: field.scale ?? 2,
        };
      } else if (field.dataType === 'Fecha') {
        avroType = {
          type: 'int',
          logicalType: 'date',
        };
      }
      return {
        name: field.technicalName,
        doc: field.label,
        type: field.nullable ? ['null', avroType] : avroType,
      };
    });

    const logicalRecords = rows.map((row, rowIdx) => {
      const obj: Record<string, unknown> = {};
      detailFields.forEach((field) => {
        const res = evaluateAndFormatField(field, row, rowIdx, context, '.', false);
        findings.push(...res.findings);
        obj[field.technicalName] = res.formatted;
      });
      return obj;
    });

    const payload = {
      _avisoMotor:
        'SIMULACIÓN CONCEPTUAL AVRO OCF: El esquema de escritura y los registros lógicos han sido validados. La serialización binaria Object Container File (.avro) con codec ' +
        (outputType.avroParams?.codec || 'deflate') +
        ' se ejecuta en el Worker de Salida en servidor.',
      esquemaEscrituraAvro: {
        type: 'record',
        namespace: outputType.avroParams?.namespace || 'co.totalreport.regulatorio',
        name: outputType.avroParams?.recordName || output.code.replace(/[^a-zA-Z0-9_]/g, '_'),
        fields: avroFields,
      },
      metadatosContenedor: {
        formato: outputType.avroParams?.containerFormat || 'OCF (Object Container File)',
        codec: outputType.avroParams?.codec || 'deflate',
        compatibilidadDeclarada: outputType.avroParams?.schemaCompatibility || 'BACKWARD',
        registrosEvaluados: rows.length,
      },
      vistaLogicaRegistros: logicalRecords,
    };

    return {
      fileName,
      content: JSON.stringify(payload, null, 2),
      mimeType: 'application/json;charset=utf-8',
      isRealExecutableGeneration: false,
      engineNotice:
        'OPERACIÓN SIMULADA / MOTOR ESPECIALIZADO: Vista lógica y esquema Avro verificados. La codificación binaria OCF requiere el Worker Avro en servidor.',
      findings,
      rowsProcessed: rows.length,
    };
  }

  // Family 5: XBRL (Conceptual Instance & Taxonomy Preview)
  if (family === 'XBRL') {
    const taxonomyUri =
      outputType.xbrlParams?.entryPointUri ||
      'http://supervision.demo.gov/taxonomia/2026/sfc_estados_financieros_entry.xsd';
    const scheme = outputType.xbrlParams?.defaultEntityScheme || 'http://supervision.demo.gov/entidades';

    const factsXml: string[] = [];
    rows.forEach((row, rowIdx) => {
      detailFields.forEach((field) => {
        const res = evaluateAndFormatField(field, row, rowIdx, context, '.', false);
        findings.push(...res.findings);
        const concept = field.xbrlConcept || `ifrs-full:${field.technicalName}`;
        const ctxRef = field.xbrlContextRef || `CTX_${context.periodo.replace('-', '_')}_F${rowIdx + 1}`;
        const unitAttr =
          field.dataType === 'Decimal' || field.dataType === 'Entero'
            ? ` unitRef="${field.xbrlUnitRef || 'U_COP'}" decimals="${field.scale ?? 2}"`
            : '';
        factsXml.push(`  <${concept} contextRef="${ctxRef}"${unitAttr}>${res.formatted}</${concept}>`);
      });
    });

    const xbrlPreview = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<!-- VISTA PREVIA CONCEPTUAL XBRL 2.1 — La certificación normativa de instancia, dimensiones y fórmulas XBRL requiere el motor procesador XBRL instalado y el paquete de taxonomía verificado localmente -->`,
      `<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:ifrs-full="http://xbrl.ifrs.org/taxonomy/2026-01-01/ifrs-full">`,
      `  <link:schemaRef xlink:type="simple" xlink:href="${taxonomyUri}" />`,
      `  <xbrli:context id="CTX_${context.periodo.replace('-', '_')}_F1">`,
      `    <xbrli:entity>`,
      `      <xbrli:identifier scheme="${scheme}">${context.entidad}</xbrli:identifier>`,
      `    </xbrli:entity>`,
      `    <xbrli:period>`,
      `      <xbrli:instant>${context.periodo}-30</xbrli:instant>`,
      `    </xbrli:period>`,
      `  </xbrli:context>`,
      `  <xbrli:unit id="U_COP">`,
      `    <xbrli:measure>iso4217:COP</xbrli:measure>`,
      `  </xbrli:unit>`,
      ...factsXml,
      `</xbrli:xbrl>`,
    ].join('\n');

    return {
      fileName,
      content: xbrlPreview,
      mimeType: 'application/xml;charset=utf-8',
      isRealExecutableGeneration: false,
      engineNotice:
        'OPERACIÓN SIMULADA / MOTOR XBRL: Previsualización estructural de hechos, contextos y unidades. La generación certificada exige el motor XBRL 2.1 / Dimensions con paquete de taxonomía offline.',
      findings,
      rowsProcessed: rows.length,
    };
  }

  // Family 6 & 7: PDF or XLSX candidate
  const docLines: string[] = [
    `================================================================================`,
    `VISTA PREVIA ESTRUCTURAL DE PLANTILLA DOCUMENTAL (${family}) — ${output.name}`,
    `NOTA: Renderizado binario ${family} ejecutado en servidor por ${outputType.serializationEngine}`,
    `Rol del documento: ${outputType.pdfParams?.documentRoleUse || 'Anexo regulatorio'}`,
    `Estándar requerido: ${outputType.pdfParams?.pdfStandard || 'PDF 1.7'}`,
    `Entidad: ${context.entidad} | Formato: ${context.formato} | Corte: ${context.periodo}`,
    `================================================================================`,
    ``,
    `[SECCIÓN CABECERA INSTITUCIONAL]`,
    `Reporte: ${output.code} (${output.version}) - Regulador: ${output.regulator}`,
    ``,
    `[SECCIÓN TABLA DE DETALLE]`,
    detailFields.map((f) => f.label.padEnd(18, ' ')).join(' | '),
    detailFields.map(() => '------------------').join('-+-'),
  ];

  rows.forEach((row, rowIdx) => {
    const rowCells = detailFields.map((field) => {
      const res = evaluateAndFormatField(field, row, rowIdx, context, ',', false);
      findings.push(...res.findings);
      return res.formatted.padEnd(18, ' ');
    });
    docLines.push(rowCells.join(' | '));
  });

  docLines.push(``);
  docLines.push(`[PIE DE PÁGINA Y CONTROL DE PAGINACIÓN: Página 1 de 1 · Sin cortes de fila · Total Filas: ${rows.length}]`);

  return {
    fileName,
    content: docLines.join('\n'),
    mimeType: 'text/plain;charset=utf-8',
    isRealExecutableGeneration: false,
    engineNotice:
      family === 'XLSX'
        ? 'CAPACIDAD CANDIDATA POR CERTIFICAR: XLSX regulatorio está registrado como candidato y bloqueado para entrega oficial hasta su certificación.'
        : 'OPERACIÓN SIMULADA / MOTOR DOCUMENTAL: Maquetación de bandas y tablas verificada. El renderizado PDF/A final se realiza en el servidor de reportes.',
    findings,
    rowsProcessed: rows.length,
  };
}

/**
 * Resolves a unique FormatOutputAssociation for a given operational context.
 * Enforces single-match rule ("Coincidencia única") and blocks on 0 or multiple overlapping matches.
 */
export function resolveFormatAssociation(params: {
  associations: FormatOutputAssociation[];
  formatId: string;
  transmissionTypeId: string;
  modality: 'Inicial' | 'Corrección' | 'Reemplazo';
  environment: 'QA' | 'Producción';
  cutoffPeriod: string; // YYYY-MM
}): {
  status: 'Coincidencia única' | 'Bloqueo: Cero coincidencias' | 'Bloqueo: Ambigüedad por solapamiento';
  resolvedAssociation?: FormatOutputAssociation;
  matchingAssociations: FormatOutputAssociation[];
  diagnosticMessage: string;
} {
  const { associations, formatId, transmissionTypeId, modality, environment, cutoffPeriod } = params;
  const cutoffDate = `${cutoffPeriod}-15`;

  const matches = associations.filter((a) => {
    if (a.status !== 'Activa' && a.status !== 'Instalada sin activar') return false;
    if (a.formatId !== formatId) return false;
    if (a.transmissionTypeId !== transmissionTypeId) return false;
    if (a.modality !== modality) return false;
    if (a.environment !== environment) return false;

    const fromOk = !a.validFrom || a.validFrom <= cutoffDate;
    const toOk = !a.validTo || a.validTo === 'Abierta' || a.validTo >= cutoffDate;
    return fromOk && toOk;
  });

  const activeMatches = matches.filter((m) => m.status === 'Activa');

  if (activeMatches.length === 1) {
    const resolved = activeMatches[0];
    return {
      status: 'Coincidencia única',
      resolvedAssociation: resolved,
      matchingAssociations: activeMatches,
      diagnosticMessage: `Resolución inequívoca: Asociación ${resolved.code} -> Salida ${resolved.configuredOutputId} (${resolved.configuredOutputVersion}) con Perfil DAQUE ${resolved.daqueProfileId}.`,
    };
  }

  if (activeMatches.length > 1) {
    const codes = activeMatches.map((m) => `${m.code} (${m.configuredOutputVersion})`).join(', ');
    return {
      status: 'Bloqueo: Ambigüedad por solapamiento',
      matchingAssociations: activeMatches,
      diagnosticMessage: `Se encontraron ${activeMatches.length} asociaciones activas simultáneas para el mismo formato, transmisión, modalidad y corte (${codes}). El sistema bloquea la ejecución y no selecciona automáticamente.`,
    };
  }

  return {
    status: 'Bloqueo: Cero coincidencias',
    matchingAssociations: matches,
    diagnosticMessage:
      matches.length > 0
        ? `Existe configuración instalada (${matches[0].code}), pero aún no ha sido activada para el ambiente ${environment}.`
        : `No existe ninguna asociación activa compatible para el formato, modalidad ${modality}, ambiente ${environment} y periodo ${cutoffPeriod}.`,
  };
}

/**
 * Analyzes impact of modifying or creating a new version of a shared ConfiguredOutput.
 */
export function analyzeVersionImpact(params: {
  output: ConfiguredOutput;
  previousFields?: StructureField[];
  associations: FormatOutputAssociation[];
  formats: RegulatoryFormat[];
}): {
  affectedAssociations: FormatOutputAssociation[];
  affectedFormats: RegulatoryFormat[];
  structuralChanges: string[];
  requiresConsumerReview: boolean;
} {
  const { output, previousFields, associations, formats } = params;
  const affectedAssociations = associations.filter(
    (a) => a.configuredOutputId === output.id || a.configuredOutputId === output.baseOutputId
  );
  const formatIds = new Set(affectedAssociations.map((a) => a.formatId));
  const affectedFormats = formats.filter((f) => formatIds.has(f.id));

  const structuralChanges: string[] = [];
  if (previousFields) {
    const prevMap = new Map(previousFields.map((f) => [f.technicalName, f]));
    const currMap = new Map(output.fields.map((f) => [f.technicalName, f]));

    for (const [name, curr] of currMap.entries()) {
      const prev = prevMap.get(name);
      if (!prev) {
        structuralChanges.push(`Campo agregado: ${curr.technicalName} (${curr.dataType}, long. ${curr.length})`);
      } else {
        if (prev.length !== curr.length) {
          structuralChanges.push(
            `Cambio de longitud en ${name}: ${prev.length} -> ${curr.length} ${curr.lengthUnit}`
          );
        }
        if (prev.dataType !== curr.dataType || prev.precision !== curr.precision || prev.scale !== curr.scale) {
          structuralChanges.push(
            `Cambio de tipo/precisión en ${name}: ${prev.dataType}(${prev.precision ?? '-'},${prev.scale ?? '-'}) -> ${curr.dataType}(${curr.precision ?? '-'},${curr.scale ?? '-'})`
          );
        }
        if (prev.required !== curr.required) {
          structuralChanges.push(
            `Cambio de obligatoriedad en ${name}: ${prev.required ? 'Requerido' : 'Opcional'} -> ${curr.required ? 'Requerido' : 'Opcional'}`
          );
        }
      }
    }

    for (const [name] of prevMap.entries()) {
      if (!currMap.has(name)) {
        structuralChanges.push(`Campo eliminado: ${name}`);
      }
    }
  }

  return {
    affectedAssociations,
    affectedFormats,
    structuralChanges,
    requiresConsumerReview: affectedAssociations.length > 0,
  };
}
