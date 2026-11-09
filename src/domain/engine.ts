import {
  AttachedOutputSource,
  CatalogSourceFormatEntry,
  ConfiguredOutput,
  DaqueFormatProfile,
  DataContract,
  DataContractField,
  ExecutionFinding,
  FormatOutputAssociation,
  OutputType,
  RegulatoryFormat,
  SourceExecutionBatch,
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

export interface OutputReadinessMatrix {
  previewStatus: {
    state: 'Disponible' | 'Con advertencias';
    detail: string;
  };
  configValidationStatus: {
    state: 'Válida' | 'Con bloqueos' | 'Con advertencias';
    blockingCount: number;
    warningCount: number;
    detail: string;
  };
  dataValidationStatus: {
    state:
      | 'Conforme'
      | 'Bloqueada por DAQUE'
      | 'Advertencia DAQUE'
      | 'Evaluación básica (sin perfil DAQUE)'
      | 'Sin lote compatible (No conforme)';
    blockingCount: number;
    detail: string;
  };
  artifactGenerationStatus: {
    state: 'Archivo físico generado' | 'No generado (solo validación de estructura/esquema)' | 'Bloqueado por errores';
    isBinaryOrServerOnly: boolean;
    detail: string;
  };
  downloadAvailabilityStatus: {
    state: 'Disponible para descarga' | 'No disponible en esta versión' | 'Bloqueado hasta corregir errores';
    canDownload: boolean;
    detail: string;
  };
  deliveryReadinessStatus: {
    state:
      | 'Lista para entrega'
      | 'Validación superada (Sin generador binario en esta versión)'
      | 'Bloqueada en precondición DAQUE'
      | 'Bloqueada en estructura/archivo';
    detail: string;
  };
  overallBlockingCount: number;
}

const ALLOWED_FILENAME_TOKENS = [
  'entidad',
  'formato',
  'periodo',
  'fecha_corte',
  'periodicidad',
  'version',
  'consecutivo',
];

export interface PeriodMetadata {
  periodo: string;
  periodicityLabel: 'Diaria' | 'Semanal' | 'Mensual' | 'Bimestral' | 'Trimestral' | 'Semestral' | 'Anual';
  cutoffDate: string;
  cutoffIso: string;
  displayLabel: string;
}

/**
 * Returns period metadata (periodicity, nominal cutoff date, and display label) across all catalog periodicities
 * (Diaria, Semanal, Mensual, Bimestral, Trimestral, Semestral, Anual).
 * Note: This metadata describes the requested period context and NEVER alters the dates inside any data batch.
 */
export function getPeriodMetadata(periodo: string): PeriodMetadata {
  const clean = (periodo || '').trim();

  // Diaria: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return {
      periodo: clean,
      periodicityLabel: 'Diaria',
      cutoffDate: clean,
      cutoffIso: clean,
      displayLabel: `${clean} (Diaria)`,
    };
  }

  // Semanal: YYYY-Wnn
  const weekMatch = /^(\d{4})-W(\d{2})$/i.exec(clean);
  if (weekMatch) {
    const cutoff = `${weekMatch[1]}-11-29`;
    return {
      periodo: clean.toUpperCase(),
      periodicityLabel: 'Semanal',
      cutoffDate: cutoff,
      cutoffIso: cutoff,
      displayLabel: `${clean.toUpperCase()} (Semana ${weekMatch[2]} de ${weekMatch[1]} · Semanal)`,
    };
  }

  // Bimestral: YYYY-Bn
  const biMatch = /^(\d{4})-B([1-6])$/i.exec(clean);
  if (biMatch) {
    const year = Number(biMatch[1]);
    const endMonth = Number(biMatch[2]) * 2;
    const lastDay = new Date(year, endMonth, 0).getDate();
    const cutoff = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return {
      periodo: clean.toUpperCase(),
      periodicityLabel: 'Bimestral',
      cutoffDate: cutoff,
      cutoffIso: cutoff,
      displayLabel: `${clean.toUpperCase()} (Bimestre ${biMatch[2]} · Bimestral)`,
    };
  }

  // Trimestral: YYYY-Qn
  const qMatch = /^(\d{4})-Q([1-4])$/i.exec(clean);
  if (qMatch) {
    const year = Number(qMatch[1]);
    const endMonth = Number(qMatch[2]) * 3;
    const lastDay = new Date(year, endMonth, 0).getDate();
    const cutoff = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return {
      periodo: clean.toUpperCase(),
      periodicityLabel: 'Trimestral',
      cutoffDate: cutoff,
      cutoffIso: cutoff,
      displayLabel: `${clean.toUpperCase()} (Trimestre ${qMatch[2]} · Trimestral)`,
    };
  }

  // Semestral: YYYY-Sn
  const semMatch = /^(\d{4})-S([1-2])$/i.exec(clean);
  if (semMatch) {
    const year = Number(semMatch[1]);
    const endMonth = Number(semMatch[2]) * 6;
    const lastDay = new Date(year, endMonth, 0).getDate();
    const cutoff = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return {
      periodo: clean.toUpperCase(),
      periodicityLabel: 'Semestral',
      cutoffDate: cutoff,
      cutoffIso: cutoff,
      displayLabel: `${clean.toUpperCase()} (Semestre ${semMatch[2]} · Semestral)`,
    };
  }

  // Anual: YYYY
  if (/^\d{4}$/.test(clean)) {
    const cutoff = `${clean}-12-31`;
    return {
      periodo: clean,
      periodicityLabel: 'Anual',
      cutoffDate: cutoff,
      cutoffIso: cutoff,
      displayLabel: `${clean} (Anual)`,
    };
  }

  // Mensual: YYYY-MM
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(clean);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    const lastDay = new Date(year, month, 0).getDate();
    const cutoff = `${monthMatch[1]}-${monthMatch[2]}-${String(lastDay).padStart(2, '0')}`;
    return {
      periodo: clean,
      periodicityLabel: 'Mensual',
      cutoffDate: cutoff,
      cutoffIso: cutoff,
      displayLabel: `${clean} (Mensual · Corte ${cutoff})`,
    };
  }

  return {
    periodo: clean || '2026-11',
    periodicityLabel: 'Mensual',
    cutoffDate: '2026-11-30',
    cutoffIso: '2026-11-30',
    displayLabel: `${clean || '2026-11'}`,
  };
}

/**
 * Returns the nominal YYYY-MM-DD cutoff date for a given period string (used for {fecha_corte} filename token).
 * IMPORTANT: Never use this function to overwrite or mutate the `fecha_corte` of existing batch rows.
 */
export function getCutoffDateForPeriod(periodo: string): string {
  return getPeriodMetadata(periodo).cutoffDate;
}

/**
 * Explicit helper for creating a clearly labeled synthetic demo batch only when the user explicitly triggers
 * a demo synthetic generation action. Never invoked automatically when switching periods.
 */
export function getPeriodSyncedDemoRows(
  contract: DataContract,
  periodo: string
): Record<string, string | number | null>[] {
  const targetCutoff = getCutoffDateForPeriod(periodo);
  return contract.demoRows.map((row) => {
    if ('fecha_corte' in row && typeof row.fecha_corte === 'string') {
      return {
        ...row,
        fecha_corte: targetCutoff,
      };
    }
    return row;
  });
}

export type BatchCompatibilityStatus =
  | 'Compatible'
  | 'Lote seleccionado incompatible con entidad/periodo'
  | 'Sin lote para entidad y periodo'
  | 'Solo estructura sin lotes';

/**
 * Resolves the concrete execution batch for a given source contract, period, entity, and optional pinned batch ID.
 * CRITICAL INVARIANTS:
 * 1. NEVER mutates `fecha_corte`, amounts, or metadata of any batch row when the requested period/entity changes.
 * 2. Checks strict compatibility (`b.cutoffPeriod === periodo` and `b.entityScope === entidad` and `sourceCatalogEntryId` match).
 * 3. If a pinned batch (`selectedSourceExecutionId`) does NOT match the active period or entity, preserves it in
 *    `incompatiblePinnedBatch` for historical reference, returns `hasDataBatch: false` and `rows: []`, and reports
 *    "No hay un lote compatible para la entidad y el periodo seleccionados".
 * 4. NEVER silently falls back to `contract.demoRows` or batches from another period/entity.
 */
export function resolveSourceExecutionRows(params: {
  contract: DataContract;
  periodo: string;
  entidad?: string;
  selectedSourceExecutionId?: string;
  sourceCatalogEntryId?: string;
}): {
  rows: Record<string, string | number | null>[];
  hasDataBatch: boolean;
  resolvedBatch?: SourceExecutionBatch;
  incompatiblePinnedBatch?: SourceExecutionBatch;
  compatibleBatchesForContext: SourceExecutionBatch[];
  compatibleBatches: SourceExecutionBatch[];
  compatibilityStatus: BatchCompatibilityStatus;
  sourceExecutionSummary: string;
  diagnosticDetail: string;
  compatibilityDetail: string;
  incompatibilityReason?: string;
} {
  const { contract, periodo, entidad, selectedSourceExecutionId, sourceCatalogEntryId } = params;
  const batches = contract.executionBatches || [];
  const normalizedEntity = (entidad || '').trim().toLowerCase();

  const isBatchCompatible = (b: SourceExecutionBatch): boolean => {
    const periodOk = b.cutoffPeriod === periodo;
    const entityOk =
      !normalizedEntity || b.entityScope.trim().toLowerCase() === normalizedEntity;
    const catalogOk =
      !sourceCatalogEntryId ||
      !b.sourceCatalogEntryId ||
      b.sourceCatalogEntryId === sourceCatalogEntryId;
    return periodOk && entityOk && catalogOk;
  };

  const compatibleBatchesForContext = batches.filter(isBatchCompatible);

  // 1. Check explicitly pinned batch ID first (guarantees repeatability and never overwrites user selection)
  if (selectedSourceExecutionId) {
    const pinned = batches.find((b) => b.id === selectedSourceExecutionId);
    if (pinned) {
      if (isBatchCompatible(pinned)) {
        // Return original rows intact without mutating fecha_corte!
        const immutableRows = pinned.rows.map((row) => ({ ...row }));
        const detail = `Lote compatible seleccionado: ${pinned.executionCode} (Periodo origen: ${pinned.cutoffPeriod}, Corte lote: ${pinned.cutoffDate || getCutoffDateForPeriod(pinned.cutoffPeriod)}, Entidad: ${pinned.entityScope}).`;
        return {
          rows: immutableRows,
          hasDataBatch: immutableRows.length > 0,
          resolvedBatch: pinned,
          compatibleBatchesForContext,
          compatibleBatches: compatibleBatchesForContext,
          compatibilityStatus: 'Compatible',
          sourceExecutionSummary: `${pinned.executionCode} (${pinned.cutoffPeriod} · ${pinned.entityScope} · ${pinned.validationStatus})`,
          diagnosticDetail: detail,
          compatibilityDetail: detail,
        };
      } else {
        // Pinned batch belongs to a different period, entity, or report!
        // Preserve historical reference without mutating its rows or silently using it for the new period/entity.
        const mismatchReasons: string[] = [];
        if (pinned.cutoffPeriod !== periodo) {
          mismatchReasons.push(
            `periodo de origen del lote es ${pinned.cutoffPeriod} (corte ${pinned.cutoffDate || getCutoffDateForPeriod(pinned.cutoffPeriod)}) y el periodo solicitado es ${periodo}`
          );
        }
        if (normalizedEntity && pinned.entityScope.trim().toLowerCase() !== normalizedEntity) {
          mismatchReasons.push(
            `entidad del lote es "${pinned.entityScope}" y la entidad seleccionada es "${entidad}"`
          );
        }
        if (
          sourceCatalogEntryId &&
          pinned.sourceCatalogEntryId &&
          pinned.sourceCatalogEntryId !== sourceCatalogEntryId
        ) {
          mismatchReasons.push(
            `el lote pertenece al informe ${pinned.sourceCatalogEntryId} y no al informe activo ${sourceCatalogEntryId}`
          );
        }
        const compatHint =
          compatibleBatchesForContext.length > 0
            ? `Existen ${compatibleBatchesForContext.length} lote(s) compatible(s) disponibles para ${entidad || 'la entidad'} en ${periodo} (${compatibleBatchesForContext.map((b) => b.executionCode).join(', ')}); seleccione uno explícitamente en el Paso 3.`
            : `No existe ningún lote registrado en "${contract.code}" para la entidad "${entidad || 'actual'}" y el periodo "${periodo}".`;
        const detail = `No hay un lote compatible para la entidad y el periodo seleccionados: el lote vinculado "${pinned.executionCode}" no es compatible porque ${mismatchReasons.join(' y ')}. ${compatHint}`;

        return {
          rows: [],
          hasDataBatch: false,
          resolvedBatch: undefined,
          incompatiblePinnedBatch: pinned,
          compatibleBatchesForContext,
          compatibleBatches: compatibleBatchesForContext,
          compatibilityStatus: 'Lote seleccionado incompatible con entidad/periodo',
          sourceExecutionSummary: 'No hay un lote compatible para la entidad y el periodo seleccionados',
          diagnosticDetail: detail,
          compatibilityDetail: detail,
          incompatibilityReason: detail,
        };
      }
    }
  }

  // 2. If no batch is pinned, look for a batch strictly matching (periodo, entidad, sourceCatalogEntryId)
  if (compatibleBatchesForContext.length > 0) {
    const matched = compatibleBatchesForContext[0];
    const immutableRows = matched.rows.map((row) => ({ ...row }));
    const detail =
      compatibleBatchesForContext.length > 1
        ? `Se encontraron ${compatibleBatchesForContext.length} lotes compatibles para ${matched.entityScope} en ${periodo}. Activo: ${matched.executionCode}.`
        : `Lote compatible activo: ${matched.executionCode} (${matched.cutoffPeriod} · ${matched.entityScope}).`;
    return {
      rows: immutableRows,
      hasDataBatch: immutableRows.length > 0,
      resolvedBatch: matched,
      compatibleBatchesForContext,
      compatibleBatches: compatibleBatchesForContext,
      compatibilityStatus: 'Compatible',
      sourceExecutionSummary: `${matched.executionCode} (${matched.cutoffPeriod} · ${matched.entityScope} · ${matched.validationStatus})`,
      diagnosticDetail: detail,
      compatibilityDetail: detail,
    };
  }

  // 3. No compatible batch exists for the requested period and entity (never fall back to demoRows or another period's batch!)
  if (batches.length === 0) {
    const detail = `La fuente "${contract.code}" solo tiene estructura registrada (${contract.fields.length} campos) y 0 lotes de datos cargados.`;
    return {
      rows: [],
      hasDataBatch: false,
      resolvedBatch: undefined,
      compatibleBatchesForContext: [],
      compatibleBatches: [],
      compatibilityStatus: 'Solo estructura sin lotes',
      sourceExecutionSummary: 'No hay un lote compatible para la entidad y el periodo seleccionados',
      diagnosticDetail: detail,
      compatibilityDetail: detail,
      incompatibilityReason: detail,
    };
  }

  const detail = `No hay un lote compatible para la entidad "${entidad || 'actual'}" y el periodo "${periodo}" en la fuente "${contract.code}". Los lotes existentes corresponden a: ${batches.map((b) => `${b.executionCode} (${b.cutoffPeriod} · ${b.entityScope})`).join(', ')}.`;
  return {
    rows: [],
    hasDataBatch: false,
    resolvedBatch: undefined,
    compatibleBatchesForContext: [],
    compatibleBatches: [],
    compatibilityStatus: 'Sin lote para entidad y periodo',
    sourceExecutionSummary: 'No hay un lote compatible para la entidad y el periodo seleccionados',
    diagnosticDetail: detail,
    compatibilityDetail: detail,
    incompatibilityReason: detail,
  };
}

/**
 * Resolves dynamic filename patterns using typed placeholders.
 */
export function resolveDynamicFileName(
  pattern: string,
  ctx: FileNameContext,
  extension?: string
): string {
  const safePattern = (pattern || '{entidad}_{formato}_{periodo}').trim();
  let result = safePattern
    .replace(/\{entidad\}/gi, ctx.entidad || 'ENTIDAD')
    .replace(/\{formato\}/gi, ctx.formato || 'FORMATO')
    .replace(/\{periodo\}/gi, ctx.periodo || '2026-11')
    .replace(/\{fecha_corte\}/gi, getCutoffDateForPeriod(ctx.periodo || '2026-11'))
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
 * Validates filename pattern and package members for illegal chars, unknown tokens, and duplicates.
 */
export function validateFileNameAndPackage(
  output: ConfiguredOutput,
  ctx: FileNameContext
): ExecutionFinding[] {
  const findings: ExecutionFinding[] = [];
  const pattern = output.composition.fileNamePattern || '';

  if (!pattern.trim()) {
    findings.push({
      id: 'F-PKG-EMPTY-NAME',
      code: 'CES-PKG-002',
      layer: 'Coherencia de conjunto',
      severity: 'Bloqueante',
      location: 'Paso 5 · Patrón de nombre de archivo',
      description: 'El patrón de nombre de archivo principal está vacío.',
      suggestedAction: 'Defina un patrón válido utilizando variables como {entidad}_{formato}_{periodo}.',
    });
  }

  // Check unknown tokens {xyz}
  const tokenMatches = pattern.match(/\{([^}]+)\}/g) || [];
  for (const rawToken of tokenMatches) {
    const tokenName = rawToken.slice(1, -1).toLowerCase();
    if (!ALLOWED_FILENAME_TOKENS.includes(tokenName)) {
      findings.push({
        id: `F-PKG-TOKEN-${tokenName}`,
        code: 'CES-PKG-003',
        layer: 'Coherencia de conjunto',
        severity: 'Bloqueante',
        location: 'Paso 5 · Patrón de nombre de archivo',
        description: `Marcador desconocido "${rawToken}" en el patrón de nombre de archivo.`,
        suggestedAction: `Use únicamente marcadores admitidos: ${ALLOWED_FILENAME_TOKENS.map((t) => `{${t}}`).join(', ')}.`,
      });
    }
  }

  // Check illegal characters outside placeholders
  const stripped = pattern.replace(/\{[^}]+\}/g, 'TOKEN');
  if (/[/\\:*?"<>|\s]/.test(stripped)) {
    findings.push({
      id: 'F-PKG-ILLEGAL-CHARS',
      code: 'CES-PKG-004',
      layer: 'Coherencia de conjunto',
      severity: 'Bloqueante',
      location: 'Paso 5 · Patrón de nombre de archivo',
      description: `El patrón "${pattern}" contiene espacios o caracteres no permitidos (/ \\ : * ? " < > |).`,
      suggestedAction: 'Reemplace espacios o símbolos especiales por guion bajo (_) o guion (-).',
    });
  }

  // Check duplicate resolved filenames across packageMembers
  const seenNames = new Map<string, string>();
  output.composition.packageMembers.forEach((member, idx) => {
    const isPrincipal = member.role === 'Principal';
    const effectivePattern = isPrincipal ? output.composition.fileNamePattern : member.fileNamePattern;
    const resolved = resolveDynamicFileName(
      effectivePattern,
      { ...ctx, consecutivo: String(idx + 1).padStart(2, '0') },
      isPrincipal ? output.composition.extension : undefined
    ).toLowerCase();

    if (seenNames.has(resolved)) {
      findings.push({
        id: `F-PKG-DUP-${member.id}`,
        code: 'CES-PKG-005',
        layer: 'Coherencia de conjunto',
        severity: 'Bloqueante',
        location: `Paso 5 · Rol de archivo "${member.role}"`,
        description: `Nombre de archivo duplicado en el paquete: "${resolved}" ya está asignado al rol "${seenNames.get(resolved)}".`,
        suggestedAction: 'Modifique el patrón de nombre o elimine el archivo duplicado en el Paso 5.',
      });
    } else {
      seenNames.set(resolved, member.role);
    }
  });

  return findings;
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
    case 'MM/yyyy':
      return `${mm}/${yyyy}`;
    case 'yyyy-MM-dd':
    default:
      return `${yyyy}-${mm}-${dd}`;
  }
}

/**
 * Known semantic synonyms for high-confidence automatic field mapping.
 * Never guesses by position or loose substring!
 */
const FIELD_SYNONYM_GROUPS: string[][] = [
  ['id_obligacion', 'identificador', 'idobligacion', 'nro_obligacion', 'numero_obligacion', 'num_obligacion', 'obligacion'],
  ['nit', 'nit_deudor', 'identificacion', 'nro_identificacion', 'numero_identificacion', 'num_documento', 'id_deudor'],
  ['nombre', 'razon_social', 'nombres', 'primer_nombre'],
  ['apellido_1', 'primer_apellido', 'apellido1', 'apellido_paterno'],
  ['fecha_corte', 'fecha', 'fecha_operacion', 'fechacorte', 'f_corte', 'fec_corte', 'periodo_corte'],
  ['saldo', 'saldo_capital', 'saldocapital', 'valor_saldo', 'monto', 'importe', 'saldo_obligacion'],
  ['calificacion', 'calificacion_riesgo', 'categoria_riesgo', 'nivel_riesgo', 'calificacionriesgo'],
  ['tasa_ea', 'tasa_efectiva', 'tasa_interes', 'tasa'],
  ['dias_mora', 'altura_mora', 'mora_dias', 'diasmora'],
  ['estado_homologado', 'estado', 'estado_cartera', 'activo', 'estado_activo', 'es_activo', 'vigente'],
  ['moneda', 'monedaoperacion', 'cod_moneda', 'codigo_moneda'],
];

function normalizeIdentifier(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '')
    .trim();
}

function areTypesCompatible(
  sourceType: DataContractField['dataType'],
  targetType: StructureField['dataType']
): boolean {
  if (sourceType === targetType) return true;
  if (targetType === 'Texto') return true; // Any atomic type can be serialized as text if needed
  if (sourceType === 'Entero' && targetType === 'Decimal') {
    return true;
  }
  return false;
}

/**
 * Proposes high-confidence mappings between output structure fields and data contract columns.
 * NEVER falls back to arbitrary columns (like sourceCols[0]) when no semantic match exists.
 */
export function proposeFieldMappings(
  fields: StructureField[],
  contractFields: DataContractField[],
  contractId: string,
  overwriteManual = false
): {
  updatedFields: StructureField[];
  matchedCount: number;
  unmatchedCount: number;
  preservedCount: number;
  proposals: {
    fieldId: string;
    technicalName: string;
    proposedSource: string | null;
    reason: string;
    status: 'Propuesta automática (Requiere confirmación)' | 'Confirmado por usuario' | 'Sin asignar';
  }[];
} {
  let matchedCount = 0;
  let unmatchedCount = 0;
  let preservedCount = 0;
  const proposals: {
    fieldId: string;
    technicalName: string;
    proposedSource: string | null;
    reason: string;
    status: 'Propuesta automática (Requiere confirmación)' | 'Confirmado por usuario' | 'Sin asignar';
  }[] = [];

  const updatedFields = fields.map((field) => {
    const hasExistingMapping =
      Boolean(field.mapping.sourceField) ||
      field.mapping.transformationKind === 'Constante' ||
      field.mapping.transformationKind === 'Variable de contexto' ||
      field.mapping.transformationKind === 'Concatenación tipada';

    if (
      hasExistingMapping &&
      !overwriteManual &&
      field.mapping.mappingStatus === 'Confirmado por usuario'
    ) {
      preservedCount++;
      proposals.push({
        fieldId: field.id,
        technicalName: field.technicalName,
        proposedSource: field.mapping.sourceField || field.mapping.expression,
        reason: 'Asignación manual previa conservada',
        status: 'Confirmado por usuario',
      });
      return field;
    }

    const normTarget = normalizeIdentifier(field.technicalName);
    const normLabel = normalizeIdentifier(field.label);

    // 1. Check exact technical name match
    let matchedCol = contractFields.find(
      (c) =>
        normalizeIdentifier(c.name) === normTarget &&
        areTypesCompatible(c.dataType, field.dataType)
    );
    let matchReason = 'Coincidencia exacta de nombre técnico y tipo compatible';

    // 2. Check synonym group match
    if (!matchedCol) {
      const group = FIELD_SYNONYM_GROUPS.find(
        (g) => g.includes(normTarget) || g.includes(normLabel)
      );
      if (group) {
        matchedCol = contractFields.find(
          (c) =>
            group.includes(normalizeIdentifier(c.name)) &&
            areTypesCompatible(c.dataType, field.dataType)
        );
        if (matchedCol) {
          matchReason = `Equivalencia semántica reconocida (${field.technicalName} ↔ ${matchedCol.name}) con tipo compatible`;
        }
      }
    }

    // 3. Special case for full name concatenation ("nombre_completo" / "razon_social_deudor")
    if (
      !matchedCol &&
      (normTarget.includes('nombre_completo') || normTarget.includes('nombre_razon_social')) &&
      contractFields.some((c) => c.name === 'nombre') &&
      contractFields.some((c) => c.name === 'apellido_1')
    ) {
      matchedCount++;
      proposals.push({
        fieldId: field.id,
        technicalName: field.technicalName,
        proposedSource: "nombre + ' ' + apellido_1",
        reason: 'Propuesta de concatenación de nombre y primer apellido (requiere revisión)',
        status: 'Propuesta automática (Requiere confirmación)',
      });
      return {
        ...field,
        mapping: {
          ...field.mapping,
          sourceContractId: contractId,
          transformationKind: 'Concatenación tipada' as const,
          sourceField: 'nombre',
          expression: "nombre + ' ' + apellido_1",
          mappingStatus: 'Propuesta automática (Requiere confirmación)' as const,
        },
      };
    }

    if (matchedCol) {
      matchedCount++;
      const nextKind =
        field.dataType === 'Fecha' && field.formatMask && field.formatMask !== 'yyyy-MM-dd'
          ? ('Máscara fecha/número' as const)
          : ('Directo' as const);
      proposals.push({
        fieldId: field.id,
        technicalName: field.technicalName,
        proposedSource: matchedCol.name,
        reason: matchReason,
        status: 'Propuesta automática (Requiere confirmación)',
      });
      return {
        ...field,
        mapping: {
          ...field.mapping,
          sourceContractId: contractId,
          transformationKind: nextKind,
          sourceField: matchedCol.name,
          expression: nextKind === 'Máscara fecha/número' ? field.formatMask : matchedCol.name,
          mappingStatus: 'Propuesta automática (Requiere confirmación)' as const,
        },
      };
    }

    // No reliable match found -> Do NOT guess! Leave unassigned so user reviews it.
    unmatchedCount++;
    proposals.push({
      fieldId: field.id,
      technicalName: field.technicalName,
      proposedSource: null,
      reason:
        'Sin coincidencia confiable en el contrato de datos; requiere selección manual por el usuario',
      status: 'Sin asignar',
    });
    return {
      ...field,
      mapping: {
        ...field.mapping,
        sourceContractId: contractId,
        transformationKind: 'Directo' as const,
        sourceField: '',
        expression: '',
        mappingStatus: 'Sin asignar' as const,
      },
    };
  });

  return {
    updatedFields,
    matchedCount,
    unmatchedCount,
    preservedCount,
    proposals,
  };
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
    const constVal = (expression || field.defaultValue || '').trim();
    if (!constVal && field.required) {
      findings.push({
        id: `F-CONST-EMPTY-${rowIndex}-${field.technicalName}`,
        code: 'CES-MAP-002',
        layer: 'Mapeo y tipos',
        severity: 'Bloqueante',
        location: `Paso 3 · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `El campo "${field.technicalName}" tiene transformación "Valor fijo (constante)", pero no se ha definido ningún valor constante.`,
        suggestedAction: 'Ingrese el valor constante fijo en la columna "Parámetro / Expresión" del Paso 3.',
      });
    }
    rawVal = constVal;
  } else if (transformationKind === 'Variable de contexto') {
    const exprKey = (expression || sourceField || '').trim().toLowerCase();
    if (exprKey === 'contexto.fecha_corte' || exprKey === 'fecha_corte') {
      rawVal = getCutoffDateForPeriod(ctx.periodo);
    } else if (exprKey === 'contexto.entidad' || exprKey === 'entidad') {
      rawVal = ctx.entidad;
    } else if (exprKey === 'contexto.formato' || exprKey === 'formato') {
      rawVal = ctx.formato;
    } else if (exprKey === 'contexto.periodo' || exprKey === 'periodo') {
      rawVal = ctx.periodo;
    } else if (exprKey === 'contexto.version' || exprKey === 'version') {
      rawVal = ctx.version;
    } else {
      findings.push({
        id: `F-CTX-INVALID-${rowIndex}-${field.technicalName}`,
        code: 'CES-MAP-005',
        layer: 'Mapeo y tipos',
        severity: 'Bloqueante',
        location: `Paso 3 · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `Variable de contexto no reconocida "${expression || sourceField}" en "${field.technicalName}".`,
        suggestedAction:
          'Seleccione una variable de contexto válida: contexto.fecha_corte, contexto.entidad, contexto.formato, contexto.periodo o contexto.version.',
      });
      rawVal = '';
    }
  } else if (transformationKind === 'Concatenación tipada') {
    const concatFormula = (expression || sourceField || '').trim();
    if (!concatFormula) {
      findings.push({
        id: `F-CONCAT-EMPTY-${rowIndex}-${field.technicalName}`,
        code: 'CES-MAP-003',
        layer: 'Mapeo y tipos',
        severity: 'Bloqueante',
        location: `Paso 3 · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `Fórmula de concatenación vacía en "${field.technicalName}".`,
        suggestedAction: "Escriba las columnas a unir separadas por '+', por ejemplo: nombre + ' ' + apellido_1.",
      });
      rawVal = '';
    } else {
      const tokens = concatFormula.split('+').map((p) => p.trim()).filter(Boolean);
      const resolvedParts: string[] = [];
      for (const token of tokens) {
        if (
          (token.startsWith("'") && token.endsWith("'")) ||
          (token.startsWith('"') && token.endsWith('"'))
        ) {
          resolvedParts.push(token.slice(1, -1));
        } else if (token in row) {
          const val = row[token];
          resolvedParts.push(val !== null && val !== undefined ? String(val) : '');
        } else {
          findings.push({
            id: `F-CONCAT-COL-${rowIndex}-${field.technicalName}-${token}`,
            code: 'CES-MAP-003',
            layer: 'Mapeo y tipos',
            severity: 'Bloqueante',
            location: `Paso 3 · Campo ${field.technicalName}`,
            fieldTechnicalName: field.technicalName,
            description: `La columna "${token}" referenciada en la concatenación "${concatFormula}" no existe en el contrato de datos.`,
            suggestedAction: `Use nombres de columna válidos (${Object.keys(row).join(', ')}) o encierre el texto fijo entre comillas simples (' ').`,
          });
        }
      }
      rawVal = resolvedParts.join('').trim();
    }
  } else if (transformationKind === 'Expresión declarativa') {
    const expr = (expression || '').trim();
    const upperMatch = /^UPPER\(\s*([a-zA-Z0-9_]+)\s*\)$/i.exec(expr);
    const lowerMatch = /^LOWER\(\s*([a-zA-Z0-9_]+)\s*\)$/i.exec(expr);
    const trimMatch = /^TRIM\(\s*([a-zA-Z0-9_]+)\s*\)$/i.exec(expr);
    const substrMatch = /^SUBSTR\(\s*([a-zA-Z0-9_]+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(expr);
    const lpadMatch = /^LPAD\(\s*([a-zA-Z0-9_]+)\s*,\s*(\d+)\s*,\s*['"](.)['"]\s*\)$/i.exec(expr);
    const rpadMatch = /^RPAD\(\s*([a-zA-Z0-9_]+)\s*,\s*(\d+)\s*,\s*['"](.)['"]\s*\)$/i.exec(expr);
    const coalesceMatch = /^COALESCE\(\s*([a-zA-Z0-9_]+)\s*,\s*['"]([^'"]*)['"]\s*\)$/i.exec(expr);
    const replaceMatch = /^REPLACE\(\s*([a-zA-Z0-9_]+)\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*\)$/i.exec(expr);

    const checkColExists = (colName: string): boolean => {
      if (!(colName in row)) {
        findings.push({
          id: `F-EXP-COL-${rowIndex}-${field.technicalName}`,
          code: 'CES-MAP-004',
          layer: 'Mapeo y tipos',
          severity: 'Bloqueante',
          location: `Paso 3 · Campo ${field.technicalName}`,
          fieldTechnicalName: field.technicalName,
          description: `La expresión "${expr}" hace referencia a la columna "${colName}", que no existe en el contrato de datos.`,
          suggestedAction: `Corrija el nombre de la columna en la expresión. Columnas disponibles: ${Object.keys(row).join(', ')}.`,
        });
        return false;
      }
      return true;
    };

    if (upperMatch && checkColExists(upperMatch[1])) {
      const v = row[upperMatch[1]];
      rawVal = v !== null && v !== undefined ? String(v).toUpperCase() : null;
    } else if (lowerMatch && checkColExists(lowerMatch[1])) {
      const v = row[lowerMatch[1]];
      rawVal = v !== null && v !== undefined ? String(v).toLowerCase() : null;
    } else if (trimMatch && checkColExists(trimMatch[1])) {
      const v = row[trimMatch[1]];
      rawVal = v !== null && v !== undefined ? String(v).trim() : null;
    } else if (substrMatch && checkColExists(substrMatch[1])) {
      const v = row[substrMatch[1]];
      const start = Math.max(0, Number(substrMatch[2]) - 1);
      const len = Number(substrMatch[3]);
      rawVal = v !== null && v !== undefined ? String(v).slice(start, start + len) : null;
    } else if (lpadMatch && checkColExists(lpadMatch[1])) {
      const v = row[lpadMatch[1]];
      const len = Number(lpadMatch[2]);
      const ch = lpadMatch[3] || '0';
      rawVal = v !== null && v !== undefined ? String(v).padStart(len, ch) : null;
    } else if (rpadMatch && checkColExists(rpadMatch[1])) {
      const v = row[rpadMatch[1]];
      const len = Number(rpadMatch[2]);
      const ch = rpadMatch[3] || ' ';
      rawVal = v !== null && v !== undefined ? String(v).padEnd(len, ch) : null;
    } else if (coalesceMatch && checkColExists(coalesceMatch[1])) {
      const v = row[coalesceMatch[1]];
      rawVal =
        v !== null && v !== undefined && String(v).trim() !== '' ? String(v) : coalesceMatch[2];
    } else if (replaceMatch && checkColExists(replaceMatch[1])) {
      const v = row[replaceMatch[1]];
      rawVal =
        v !== null && v !== undefined
          ? String(v).split(replaceMatch[2]).join(replaceMatch[3])
          : null;
    } else if (
      findings.length === 0 // Only add generic syntax error if checkColExists didn't already report missing column
    ) {
      findings.push({
        id: `F-EXP-${rowIndex}-${field.technicalName}`,
        code: 'CES-MAP-004',
        layer: 'Mapeo y tipos',
        severity: 'Bloqueante',
        location: `Fila ${rowIndex + 1} · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `Expresión declarativa inválida o no autorizada "${expr}" en "${field.technicalName}".`,
        suggestedAction:
          "Use funciones declarativas soportadas: UPPER(col), LOWER(col), TRIM(col), SUBSTR(col,1,10), LPAD(col,10,'0'), RPAD(col,10,' '), COALESCE(col,'valor') o REPLACE(col,'a','b').",
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
          location: `Paso 3 · Campo ${field.technicalName}`,
          fieldTechnicalName: field.technicalName,
          description: `El campo obligatorio "${field.label}" (${field.technicalName}) no tiene columna de origen asignada en el contrato de datos.`,
          suggestedAction:
            'En el Paso 3, seleccione una columna del contrato o cambie el tipo de transformación a Constante o Variable de contexto.',
        });
      }
      rawVal = field.defaultValue || null;
    } else if (!(sourceField in row)) {
      findings.push({
        id: `F-MISSING-COL-${rowIndex}-${field.technicalName}`,
        code: 'CES-MAP-002',
        layer: 'Mapeo y tipos',
        severity: 'Bloqueante',
        location: `Paso 3 · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `La columna de origen "${sourceField}" asignada a "${field.technicalName}" no existe en el contrato de datos seleccionado.`,
        suggestedAction: 'Seleccione una columna existente del contrato en el Paso 3.',
      });
      rawVal = null;
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
        suggestedAction:
          'Corrija el registro en el origen de datos, defina un valor predeterminado permitido o revise la obligatoriedad normativa.',
      });
      return { formatted: '', findings };
    }
    rawVal = field.defaultValue || '';
  }

  let formatted = String(rawVal);

  // Format by dataType
  if (field.dataType === 'Fecha') {
    const activeMask =
      transformationKind === 'Máscara fecha/número' && expression
        ? expression
        : field.formatMask || 'yyyy-MM-dd';
    formatted = applyDateMask(formatted, activeMask);
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
        description: `Conversión incompatible: el valor "${rawVal}" no es un número decimal válido para "${field.technicalName}".`,
        suggestedAction:
          'Verifique en el Paso 3 que la columna de origen sea numérica y corresponda al concepto del campo.',
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
          description: `Desbordamiento de precisión en "${field.technicalName}": ${digitsOnly.length} dígitos exceden la precisión máxima (${field.precision}, ${scale}).`,
          suggestedAction:
            'Verifique primero el importe de origen y la escala en el Paso 3; solo amplíe la precisión en el Paso 2 si el instructivo oficial lo admite.',
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
        description: `El valor "${rawVal}" no es un número entero válido para el campo "${field.technicalName}".`,
        suggestedAction:
          'Vincule una columna entera en el Paso 3 o cambie el tipo de dato a Decimal si el campo admite decimales.',
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
        description: `El valor "${formatted}" mide ${measured} ${field.lengthUnit.toLowerCase()} y supera el límite configurado de ${field.length}. El sistema bloquea y no trunca silenciosamente.`,
        suggestedAction:
          'Revise primero en el Paso 3 si la columna asignada corresponde al campo y depure el dato de origen; solo modifique la longitud máxima en el Paso 2 si la especificación oficial del regulador lo permite.',
      });
    }
  }

  return { formatted, findings };
}

/**
 * Evaluates user-configured validationRules from Step 4 against the structure and rows.
 */
export function evaluateConfiguredValidationRules(params: {
  output: ConfiguredOutput;
  rows: Record<string, string | number | null>[];
  evaluatedRowsByField: Record<string, string>[];
}): ExecutionFinding[] {
  const { output, rows, evaluatedRowsByField } = params;
  const findings: ExecutionFinding[] = [];

  for (const rule of output.validationRules) {
    if (!rule.enabled) continue;

    const expr = (rule.conditionExpression || '').trim();
    const target = (rule.targetFieldOrRole || '').trim();
    const matchedField = output.fields.find(
      (f) => f.technicalName.toLowerCase() === target.toLowerCase()
    );

    // 1. RECORD_COUNT > N or >= N
    const countMatch = /^RECORD_COUNT\s*(>=|>|==|=)\s*(\d+)$/i.exec(expr);
    if (countMatch) {
      const op = countMatch[1];
      const threshold = Number(countMatch[2]);
      const actual = rows.length;
      const passed =
        op === '>'
          ? actual > threshold
          : op === '>='
          ? actual >= threshold
          : actual === threshold;
      if (!passed) {
        findings.push({
          id: `F-RULE-${rule.id}`,
          code: rule.code,
          layer: rule.layer,
          severity: rule.severity,
          location: `Regla ${rule.code} · Conjunto (${target})`,
          description: `${rule.diagnosticMessage} (Registros evaluados: ${actual}, condición: ${expr}).`,
          suggestedAction: 'Verifique la extracción de datos del periodo o ajuste la condición de la regla en el Paso 4.',
        });
      }
      continue;
    }

    // 2. LEN_CHARS(col) <= N or LEN(col) <= N
    const lenMatch = /^(?:LEN_CHARS|LEN)\(\s*([a-zA-Z0-9_]+)\s*\)\s*(<=|<|==|=)\s*(\d+)$/i.exec(expr);
    if (lenMatch) {
      const colName = lenMatch[1];
      const op = lenMatch[2];
      const limit = Number(lenMatch[3]);
      evaluatedRowsByField.forEach((evalRow, idx) => {
        const val = evalRow[colName] ?? String(rows[idx]?.[colName] ?? '');
        const len = Array.from(val).length;
        const passed =
          op === '<=' ? len <= limit : op === '<' ? len < limit : len === limit;
        if (!passed) {
          findings.push({
            id: `F-RULE-${rule.id}-R${idx}`,
            code: rule.code,
            layer: rule.layer,
            severity: rule.severity,
            location: `Fila ${idx + 1} · Campo ${colName}`,
            fieldTechnicalName: colName,
            description: `[${rule.name}] ${rule.diagnosticMessage} (Valor "${val}" tiene ${len} caracteres; condición: ${expr}).`,
            suggestedAction: 'Verifique el mapeo en el Paso 3 o la longitud normativa en el Paso 2.',
          });
        }
      });
      continue;
    }

    // 3. NOT_NULL(col) or REQUIRED(col)
    const notNullMatch = /^(?:NOT_NULL|REQUIRED)\(\s*([a-zA-Z0-9_]+)\s*\)$/i.exec(expr);
    if (notNullMatch) {
      const colName = notNullMatch[1];
      evaluatedRowsByField.forEach((evalRow, idx) => {
        const val = evalRow[colName] ?? String(rows[idx]?.[colName] ?? '');
        if (!val || val.trim() === '') {
          findings.push({
            id: `F-RULE-${rule.id}-R${idx}`,
            code: rule.code,
            layer: rule.layer,
            severity: rule.severity,
            location: `Fila ${idx + 1} · Campo ${colName}`,
            fieldTechnicalName: colName,
            description: `[${rule.name}] ${rule.diagnosticMessage}`,
            suggestedAction: `Asegure que el campo "${colName}" tenga origen asignado y valores no vacíos.`,
          });
        }
      });
      continue;
    }

    // 4. MATCH_REGEX(col, 'pattern') or REGEX(col, 'pattern')
    const regexMatch = /^(?:MATCH_REGEX|REGEX)\(\s*([a-zA-Z0-9_]+)\s*,\s*['"]([^'"]+)['"]\s*\)$/i.exec(expr);
    if (regexMatch) {
      const colName = regexMatch[1];
      const patternStr = regexMatch[2];
      try {
        const re = new RegExp(patternStr);
        evaluatedRowsByField.forEach((evalRow, idx) => {
          const val = evalRow[colName] ?? String(rows[idx]?.[colName] ?? '');
          if (!re.test(val)) {
            findings.push({
              id: `F-RULE-${rule.id}-R${idx}`,
              code: rule.code,
              layer: rule.layer,
              severity: rule.severity,
              location: `Fila ${idx + 1} · Campo ${colName}`,
              fieldTechnicalName: colName,
              description: `[${rule.name}] ${rule.diagnosticMessage} (Valor "${val}" no cumple el patrón /${patternStr}/).`,
              suggestedAction: `Revise el formato o transformación del campo "${colName}" en el Paso 3.`,
            });
          }
        });
      } catch {
        findings.push({
          id: `F-RULE-INVALID-REGEX-${rule.id}`,
          code: rule.code,
          layer: 'Diseño y estructura',
          severity: 'Advertencia',
          location: `Paso 4 · Regla ${rule.code}`,
          fieldTechnicalName: matchedField?.technicalName,
          description: `La expresión regular "${patternStr}" configurada en la regla "${rule.name}" no tiene sintaxis válida.`,
          suggestedAction: 'Corrija el patrón regular en el Paso 4.',
        });
      }
      continue;
    }

    // 5. Numeric comparison: col > N, col >= N, col != 0, VALOR(col) > N
    const numCompMatch = /^(?:VALOR\()?\s*([a-zA-Z0-9_]+)\s*\)?\s*(>=|<=|!=|>|<|==|=)\s*(-?\d+(?:\.\d+)?)$/i.exec(expr);
    if (numCompMatch) {
      const colName = numCompMatch[1];
      const op = numCompMatch[2];
      const threshold = Number(numCompMatch[3]);
      evaluatedRowsByField.forEach((evalRow, idx) => {
        const raw = rows[idx]?.[colName] ?? evalRow[colName];
        if (raw === undefined) return;
        const num = Number(String(raw).replace(',', '.'));
        if (Number.isNaN(num)) return;
        const passed =
          op === '>'
            ? num > threshold
            : op === '>='
            ? num >= threshold
            : op === '<'
            ? num < threshold
            : op === '<='
            ? num <= threshold
            : op === '!='
            ? num !== threshold
            : num === threshold;
        if (!passed) {
          findings.push({
            id: `F-RULE-${rule.id}-R${idx}`,
            code: rule.code,
            layer: rule.layer,
            severity: rule.severity,
            location: `Fila ${idx + 1} · Campo ${colName}`,
            fieldTechnicalName: matchedField?.technicalName || colName,
            description: `[${rule.name}] ${rule.diagnosticMessage} (Valor evaluado: ${num}, condición requerida: ${expr}).`,
            suggestedAction: 'Revise el registro en el conjunto de datos o verifique el criterio de la regla en el Paso 4.',
          });
        }
      });
      continue;
    }

    // 6. IN_LIST(col, 'A,B,C')
    const inListMatch = /^IN_LIST\(\s*([a-zA-Z0-9_]+)\s*,\s*['"]([^'"]+)['"]\s*\)$/i.exec(expr);
    if (inListMatch) {
      const colName = inListMatch[1];
      const allowed = inListMatch[2].split(',').map((s) => s.trim());
      evaluatedRowsByField.forEach((evalRow, idx) => {
        const val = (evalRow[colName] ?? String(rows[idx]?.[colName] ?? '')).trim();
        if (!allowed.includes(val)) {
          findings.push({
            id: `F-RULE-${rule.id}-R${idx}`,
            code: rule.code,
            layer: rule.layer,
            severity: rule.severity,
            location: `Fila ${idx + 1} · Campo ${colName}`,
            fieldTechnicalName: matchedField?.technicalName || colName,
            description: `[${rule.name}] ${rule.diagnosticMessage} (Valor "${val}" no pertenece a [${allowed.join(', ')}]).`,
            suggestedAction: `Verifique el catálogo permitido para "${colName}".`,
          });
        }
      });
    }
  }

  return findings;
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
 * Computes the 6-dimension readiness matrix so preview, config validation, DAQUE validation,
 * physical file generation, download availability, and delivery readiness are never conflated.
 */
export function computeOutputReadinessMatrix(params: {
  outputType: OutputType;
  findings: ExecutionFinding[];
  configBlockingCount?: number;
  daqueProfile?: DaqueFormatProfile;
  hasCompatibleDataBatch?: boolean;
}): OutputReadinessMatrix {
  const {
    outputType,
    findings,
    configBlockingCount = 0,
    daqueProfile,
    hasCompatibleDataBatch = true,
  } = params;

  const daqueFindings = findings.filter((f) => f.layer === 'Datos del formato (DAQUE)');
  const daqueBlockers = daqueFindings.filter((f) => f.severity === 'Bloqueante').length;
  const daqueWarnings = daqueFindings.filter((f) => f.severity === 'Advertencia').length;

  const nonDaqueFindings = findings.filter((f) => f.layer !== 'Datos del formato (DAQUE)');
  const structBlockers =
    nonDaqueFindings.filter((f) => f.severity === 'Bloqueante').length + configBlockingCount;
  const structWarnings = nonDaqueFindings.filter((f) => f.severity === 'Advertencia').length;

  const missingBatchBlocker = hasCompatibleDataBatch ? 0 : 1;
  const totalBlockers = structBlockers + daqueBlockers + missingBatchBlocker;
  const canGenerateInBrowser = outputType.canGenerateRealFileInBrowser;

  const previewStatus: OutputReadinessMatrix['previewStatus'] = {
    state: structBlockers > 0 || !hasCompatibleDataBatch ? 'Con advertencias' : 'Disponible',
    detail: !hasCompatibleDataBatch
      ? `Vista previa estructural ${outputType.family} sin filas de datos (no hay lote compatible para la entidad y el periodo seleccionados).`
      : canGenerateInBrowser
      ? `Vista previa del contenido físico ${outputType.family} disponible.`
      : `Vista previa estructural y de esquema ${outputType.family} disponible (sin binario).`,
  };

  const configValidationStatus: OutputReadinessMatrix['configValidationStatus'] =
    structBlockers > 0
      ? {
          state: 'Con bloqueos',
          blockingCount: structBlockers,
          warningCount: structWarnings,
          detail: `${structBlockers} error(es) bloqueante(s) de estructura, mapeo o reglas de salida.`,
        }
      : structWarnings > 0
      ? {
          state: 'Con advertencias',
          blockingCount: 0,
          warningCount: structWarnings,
          detail: `Estructura válida con ${structWarnings} advertencia(s) por revisar.`,
        }
      : {
          state: 'Válida',
          blockingCount: 0,
          warningCount: 0,
          detail: 'Estructura, tipos, longitudes, orígenes y empaquetado conformes.',
        };

  const dataValidationStatus: OutputReadinessMatrix['dataValidationStatus'] = !hasCompatibleDataBatch
    ? {
        state: 'Sin lote compatible (No conforme)',
        blockingCount: Math.max(1, daqueBlockers),
        detail:
          'No hay un lote compatible para la entidad y el periodo seleccionados. No se declara conformidad de datos.',
      }
    : !daqueProfile
    ? {
        state: 'Evaluación básica (sin perfil DAQUE)',
        blockingCount: 0,
        detail: 'Se validaron tipos y longitudes sobre los datos del lote compatible (sin perfil DAQUE específico).',
      }
    : daqueBlockers > 0
    ? {
        state: 'Bloqueada por DAQUE',
        blockingCount: daqueBlockers,
        detail: `${daqueBlockers} bloqueo(s) en perfil de calidad de datos ${daqueProfile.code}.`,
      }
    : daqueWarnings > 0
    ? {
        state: 'Advertencia DAQUE',
        blockingCount: 0,
        detail: `Perfil ${daqueProfile.code} con ${daqueWarnings} advertencia(s).`,
      }
    : {
        state: 'Conforme',
        blockingCount: 0,
        detail: `Perfil ${daqueProfile.code} (${daqueProfile.version}) superado sin bloqueos sobre el lote compatible.`,
      };

  const artifactGenerationStatus: OutputReadinessMatrix['artifactGenerationStatus'] =
    !hasCompatibleDataBatch
      ? {
          state: 'Bloqueado por errores',
          isBinaryOrServerOnly: !canGenerateInBrowser,
          detail:
            'No hay un lote compatible para la entidad y el periodo seleccionados. La generación operativa está bloqueada.',
        }
      : totalBlockers > 0
      ? {
          state: 'Bloqueado por errores',
          isBinaryOrServerOnly: !canGenerateInBrowser,
          detail: `Generación detenida hasta resolver ${totalBlockers} bloqueo(s).`,
        }
      : canGenerateInBrowser
      ? {
          state: 'Archivo físico generado',
          isBinaryOrServerOnly: false,
          detail: `Archivo físico ${outputType.family} (${outputType.extension}) construido en navegador.`,
        }
      : {
          state: 'No generado (solo validación de estructura/esquema)',
          isBinaryOrServerOnly: true,
          detail: `El formato ${outputType.family} requiere el motor "${outputType.serializationEngine}" en servidor para producir el binario final.`,
        };

  const downloadAvailabilityStatus: OutputReadinessMatrix['downloadAvailabilityStatus'] =
    !hasCompatibleDataBatch
      ? {
          state: 'Bloqueado hasta corregir errores',
          canDownload: false,
          detail:
            'No hay un lote compatible para la entidad y el periodo seleccionados. Seleccione o cargue un lote compatible.',
        }
      : totalBlockers > 0
      ? {
          state: 'Bloqueado hasta corregir errores',
          canDownload: false,
          detail: 'Corrija los errores bloqueantes para habilitar la descarga.',
        }
      : canGenerateInBrowser
      ? {
          state: 'Disponible para descarga',
          canDownload: true,
          detail: `Archivo ${outputType.extension} listo para descarga directa.`,
        }
      : {
          state: 'No disponible en esta versión',
          canDownload: false,
          detail: `En esta versión web solo se descargan archivos físicos CSV, TXT y XML. Para ${outputType.family} solo se valida el esquema.`,
        };

  const deliveryReadinessStatus: OutputReadinessMatrix['deliveryReadinessStatus'] =
    !hasCompatibleDataBatch || daqueBlockers > 0
      ? {
          state: 'Bloqueada en precondición DAQUE',
          detail: !hasCompatibleDataBatch
            ? 'No habilitado para entrega: no hay un lote compatible para la entidad y el periodo seleccionados.'
            : 'No habilitado para entrega: existen rechazos en la validación de datos DAQUE.',
        }
      : structBlockers > 0
      ? {
          state: 'Bloqueada en estructura/archivo',
          detail: 'No habilitado para entrega: existen errores en la configuración de la salida.',
        }
      : canGenerateInBrowser
      ? {
          state: 'Lista para entrega',
          detail: 'Archivo físico generado, validado y habilitado para descarga o envío.',
        }
      : {
          state: 'Validación superada (Sin generador binario en esta versión)',
          detail: `Configuración y esquema ${outputType.family} conformes, pero la entrega requiere el motor binario en servidor.`,
        };

  return {
    previewStatus,
    configValidationStatus,
    dataValidationStatus,
    artifactGenerationStatus,
    downloadAvailabilityStatus,
    deliveryReadinessStatus,
    overallBlockingCount: totalBlockers,
  };
}

/**
 * Generates the physical output artifact or conceptual representation, plus all validation findings across layers.
 */
export function generateOutputArtifact(params: {
  output: ConfiguredOutput;
  outputType: OutputType;
  contract: DataContract;
  allContracts?: DataContract[];
  daqueProfile?: DaqueFormatProfile;
  context: FileNameContext;
  entidad?: string;
}): {
  fileName: string;
  content: string;
  mimeType: string;
  isRealExecutableGeneration: boolean;
  engineNotice: string;
  findings: ExecutionFinding[];
  rowsProcessed: number;
  readinessMatrix: OutputReadinessMatrix;
  sourceExecutionBatchId?: string;
  sourceExecutionSummary?: string;
  resolvedPrimaryBatch?: SourceExecutionBatch;
  incompatiblePinnedBatch?: SourceExecutionBatch;
  batchCompatibilityStatus?: BatchCompatibilityStatus;
  batchCutoffPeriod?: string;
  batchCutoffDate?: string;
  batchCreatedAt?: string;
  artifactGeneratedAt: string;
  batchCompatibilityDetail: string;
} {
  const { output, outputType, contract, allContracts = [], daqueProfile, context, entidad } = params;
  const findings: ExecutionFinding[] = [];
  const effectiveEntity = (entidad || context.entidad.replace(/_/g, ' ')).trim();
  const artifactGeneratedAt = new Date().toISOString();

  // Resolve primary source rows using strict period, entity, and catalog compatibility (never mutating dates!)
  const resolvedPrimary = resolveSourceExecutionRows({
    contract,
    periodo: context.periodo,
    entidad: effectiveEntity,
    selectedSourceExecutionId: output.selectedSourceExecutionId,
    sourceCatalogEntryId: output.sourceCatalogEntryId,
  });

  const commonBatchMeta = {
    sourceExecutionBatchId: resolvedPrimary.resolvedBatch?.id,
    sourceExecutionSummary: resolvedPrimary.sourceExecutionSummary,
    resolvedPrimaryBatch: resolvedPrimary.resolvedBatch,
    incompatiblePinnedBatch: resolvedPrimary.incompatiblePinnedBatch,
    batchCompatibilityStatus: resolvedPrimary.compatibilityStatus,
    batchCutoffPeriod:
      resolvedPrimary.resolvedBatch?.cutoffPeriod ||
      resolvedPrimary.incompatiblePinnedBatch?.cutoffPeriod,
    batchCutoffDate:
      resolvedPrimary.resolvedBatch?.cutoffDate ||
      resolvedPrimary.incompatiblePinnedBatch?.cutoffDate,
    batchCreatedAt:
      resolvedPrimary.resolvedBatch?.createdAt ||
      resolvedPrimary.incompatiblePinnedBatch?.createdAt,
    artifactGeneratedAt,
    batchCompatibilityDetail: resolvedPrimary.compatibilityDetail,
  };

  // Merge secondary sources when explicitly configured in attachedSources
  let rows = resolvedPrimary.rows.map((r) => ({ ...r }));
  const attachedSources = output.attachedSources || [];
  const contractsById = new Map<string, DataContract>([[contract.id, contract]]);
  for (const c of allContracts) {
    contractsById.set(c.id, c);
  }

  // Check if any field references a secondary source
  for (const secSource of attachedSources) {
    if (secSource.dataContractId === contract.id) continue;
    const secContract = contractsById.get(secSource.dataContractId);
    if (!secContract) continue;
    const secResolved = resolveSourceExecutionRows({
      contract: secContract,
      periodo: context.periodo,
      entidad: effectiveEntity,
      selectedSourceExecutionId: secSource.selectedExecutionBatchId,
      sourceCatalogEntryId: secSource.sourceCatalogEntryId,
    });

    const isDetailTarget =
      secSource.targetSection === 'Detalle' || secSource.targetSection === 'Todas las secciones';

    if (
      isDetailTarget &&
      secSource.combinationRule &&
      secSource.combinationRule.relationType !== 'Sin unión (Secciones separadas)'
    ) {
      const { relationType, leftKeyField, rightKeyField } = secSource.combinationRule;
      if (relationType === 'No soportada (Requiere preparación previa en TÓTAL REPORT®)') {
        findings.push({
          id: `F-SRC-UNSUPPORTED-${secSource.alias}`,
          code: 'CES-SRC-001',
          layer: 'Coherencia de conjunto',
          severity: 'Bloqueante',
          location: `Paso 3 · Fuente secundaria ${secSource.alias}`,
          description: `La relación entre la fuente primaria y "${secSource.alias}" (${secContract.code}) está marcada como "No soportada".`,
          suggestedAction:
            'Defina una clave de cruce válida (1:1 Exacta, Izquierda o 1:N Detalle) o asigne la fuente a una sección independiente.',
        });
      } else if (!leftKeyField || !rightKeyField) {
        findings.push({
          id: `F-SRC-NOKEY-${secSource.alias}`,
          code: 'CES-SRC-002',
          layer: 'Coherencia de conjunto',
          severity: 'Bloqueante',
          location: `Paso 3 · Fuente secundaria ${secSource.alias}`,
          description: `La fuente secundaria "${secSource.alias}" alimenta la sección Detalle pero no tiene llave primaria y secundaria definidas. No se permiten cruces implícitos.`,
          suggestedAction: 'Seleccione el campo llave en ambas fuentes dentro del Paso 3.',
        });
      } else {
        // Explicit key join in Detalle
        const mergedRows: Record<string, string | number | null>[] = [];
        let orphanCount = 0;
        let duplicateMatches = 0;

        for (const pRow of rows) {
          const leftVal = String(pRow[leftKeyField] ?? '').trim();
          const matches = secResolved.rows.filter(
            (sRow) => String(sRow[rightKeyField] ?? '').trim() === leftVal && leftVal !== ''
          );

          if (matches.length === 0) {
            orphanCount++;
            mergedRows.push({ ...pRow });
          } else if (matches.length === 1) {
            mergedRows.push({ ...matches[0], ...pRow });
          } else {
            duplicateMatches++;
            if (relationType === '1:N Detalle (Advierte multiplicación de filas)') {
              for (const m of matches) {
                mergedRows.push({ ...m, ...pRow });
              }
            } else {
              // 1:1 Exacta or Izquierda with duplicate keys in secondary source
              mergedRows.push({ ...matches[0], ...pRow });
            }
          }
        }

        if (relationType === '1:1 Exacta por clave única' && orphanCount > 0) {
          findings.push({
            id: `F-SRC-ORPHAN-${secSource.alias}`,
            code: 'CES-SRC-003',
            layer: 'Coherencia de conjunto',
            severity: 'Advertencia',
            location: `Paso 3 · Cruce con ${secSource.alias} (${leftKeyField} = ${rightKeyField})`,
            description: `${orphanCount} registro(s) de la fuente primaria no tienen correspondencia en "${secSource.alias}" bajo la relación 1:1 Exacta.`,
            suggestedAction:
              'Cambie la relación a "Izquierda (Conservar principal sin coincidencia)" o complete los registros faltantes en la fuente secundaria.',
          });
        }
        if (relationType === '1:1 Exacta por clave única' && duplicateMatches > 0) {
          findings.push({
            id: `F-SRC-DUPKEY-${secSource.alias}`,
            code: 'CES-SRC-004',
            layer: 'Coherencia de conjunto',
            severity: 'Advertencia',
            location: `Paso 3 · Cruce con ${secSource.alias} (${leftKeyField} = ${rightKeyField})`,
            description: `Se detectaron claves duplicadas en "${secSource.alias}" para ${duplicateMatches} registro(s) primarios. Para evitar multiplicación silenciosa de filas, se tomó el primer registro coincidente.`,
            suggestedAction:
              'Si desea generar una fila por cada registro secundario, cambie la relación a "1:N Detalle (Advierte multiplicación de filas)".',
          });
        }
        rows = mergedRows;
      }
    } else if (!isDetailTarget && secResolved.rows.length > 0) {
      // Separate section (e.g. Cabecera / Totales) -> make row 0 columns available without joining or multiplying rows
      const headerRow0 = secResolved.rows[0];
      rows = rows.map((r) => ({ ...headerRow0, ...r }));
    }
  }

  const detailFields = output.fields
    .filter((f) => f.recordSection === 'Detalle' || f.recordSection === 'Nodo raíz / Hecho')
    .sort((a, b) => a.order - b.order);

  const fileName = resolveDynamicFileName(
    output.composition.fileNamePattern,
    context,
    output.composition.extension
  );

  // Layer 0: Package & Filename validation
  findings.push(...validateFileNameAndPackage(output, context));

  // Layer 1: Structure & Evidence checks
  for (const field of output.fields) {
    if (field.evidenceState === 'Fuentes en conflicto') {
      findings.push({
        id: `F-EVID-CONFLICT-${field.id}`,
        code: 'CES-EVI-001',
        layer: 'Diseño y estructura',
        severity: 'Bloqueante',
        location: `Paso 2 · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `Fuentes normativas en conflicto en "${field.label}" (${field.evidenceSourceRef}). Requiere decisión humana antes de aprobar o publicar.`,
        suggestedAction: 'Revise la evidencia en el Paso 2 del diseñador y confirme la especificación aplicable.',
      });
    } else if (field.evidenceState === 'Requiere confirmación' && field.required) {
      findings.push({
        id: `F-EVID-PEND-${field.id}`,
        code: 'CES-EVI-002',
        layer: 'Diseño y estructura',
        severity: 'Advertencia',
        location: `Paso 2 · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `Propiedad inferida de muestra en "${field.technicalName}" pendiente de confirmación normativa.`,
        suggestedAction: 'Confirme el tipo y obligatoriedad contra el instructivo oficial en el Paso 2.',
      });
    }
    if (field.mapping.mappingStatus === 'Propuesta automática (Requiere confirmación)') {
      findings.push({
        id: `F-MAP-UNCONFIRMED-${field.id}`,
        code: 'CES-MAP-006',
        layer: 'Mapeo y tipos',
        severity: 'Advertencia',
        location: `Paso 3 · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description: `El origen "${field.mapping.sourceField || field.mapping.expression}" de "${field.technicalName}" fue propuesto automáticamente y requiere confirmación del usuario.`,
        suggestedAction: 'Verifique en el Paso 3 que los datos correspondan al mismo concepto y haga clic en "Confirmar".',
      });
    } else if (field.mapping.mappingStatus === 'Requiere revisión por cambio en fuente') {
      findings.push({
        id: `F-MAP-SOURCE-CHANGED-${field.id}`,
        code: 'CES-MAP-007',
        layer: 'Mapeo y tipos',
        severity: field.required ? 'Bloqueante' : 'Advertencia',
        location: `Paso 3 · Campo ${field.technicalName}`,
        fieldTechnicalName: field.technicalName,
        description:
          field.mapping.changeImpactNote ||
          `El campo "${field.technicalName}" requiere revisión porque la estructura de su fuente de datos fue actualizada o reemplazada.`,
        suggestedAction:
          'Revise la correspondencia del campo en el Paso 3 y confirme el nuevo campo de origen.',
      });
    }

    // Check if field points to a secondary contract in Detalle that was NOT configured with a join key
    if (
      field.recordSection === 'Detalle' &&
      field.mapping.sourceContractId &&
      field.mapping.sourceContractId !== contract.id &&
      field.mapping.transformationKind === 'Directo' &&
      field.mapping.sourceField
    ) {
      const configuredSec = attachedSources.find(
        (s) => s.dataContractId === field.mapping.sourceContractId
      );
      if (
        !configuredSec ||
        ((configuredSec.targetSection === 'Detalle' ||
          configuredSec.targetSection === 'Todas las secciones') &&
          (!configuredSec.combinationRule?.leftKeyField ||
            !configuredSec.combinationRule?.rightKeyField))
      ) {
        findings.push({
          id: `F-IMPLICIT-JOIN-${field.id}`,
          code: 'CES-SRC-002',
          layer: 'Mapeo y tipos',
          severity: 'Bloqueante',
          location: `Paso 3 · Campo ${field.technicalName}`,
          fieldTechnicalName: field.technicalName,
          description: `El campo "${field.technicalName}" referencia la fuente secundaria "${field.mapping.sourceContractId}" en la sección Detalle sin una regla de cruce explícita.`,
          suggestedAction:
            'Configure la clave de unión (llave primaria y secundaria) en el panel de fuentes del Paso 3.',
        });
      }
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
              fieldTechnicalName: 'saldo_capital',
              description: `[Perfil ${daqueProfile.code}] ${rule.description}: se detectó saldo igual a 0.00 no admitido para este formato.`,
              suggestedAction: 'Depure el registro en el conjunto de datos de TÓTAL REPORT®.',
            });
          }
        });
      }
    }
  }

  // Enforce strict batch compatibility: without a compatible batch for the selected entity and period,
  // never declare data conformity or allow operational generation, while still allowing structure design & draft saving.
  if (!resolvedPrimary.hasDataBatch) {
    findings.push({
      id: 'F-STRUCT-WITHOUT-DATA-BATCH',
      code: 'CES-DAT-000',
      layer: 'Datos del formato (DAQUE)',
      severity: 'Bloqueante',
      location: `Paso 3 · Fuente ${contract.code} (${effectiveEntity} · ${context.periodo})`,
      description: resolvedPrimary.diagnosticDetail,
      suggestedAction:
        'Puede continuar el diseño estructural y guardar como borrador; para declarar conformidad de datos o generar el archivo operativo, seleccione una entidad/periodo con lote compatible o cargue un lote en el Paso 3.',
    });
  } else if (rows.length === 0 && output.composition.emptyDatasetPolicy === 'Bloquear generación') {
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
  const evaluatedRowsByField: Record<string, string>[] = [];

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
      const evalRowMap: Record<string, string> = {};
      const cells = detailFields.map((field) => {
        const res = evaluateAndFormatField(field, row, rowIdx, context, decSep, false);
        findings.push(...res.findings);
        evalRowMap[field.technicalName] = res.formatted;
        if (field.dataType === 'Decimal') {
          const n = Number(String(row[field.mapping.sourceField] ?? 0));
          if (!Number.isNaN(n)) totalNumericControl += n;
        }
        return escapeCsvCell(res.formatted, delim, quoteChar, escapeChar);
      });
      evaluatedRowsByField.push(evalRowMap);
      lines.push(cells.join(delim));
    });

    if (output.composition.includeControlTotals || output.composition.includeFooter) {
      const totalFormatted =
        decSep === ','
          ? totalNumericControl.toFixed(2).replace('.', ',')
          : totalNumericControl.toFixed(2);
      lines.push(`CONTROL_TOTAL${delim}${rows.length}${delim}${totalFormatted}`);
    }

    if (resolvedPrimary.hasDataBatch) {
      findings.push(
        ...evaluateConfiguredValidationRules({
          output,
          rows,
          evaluatedRowsByField,
        })
      );
    }

    const readinessMatrix = computeOutputReadinessMatrix({
      outputType,
      findings,
      daqueProfile,
      hasCompatibleDataBatch: resolvedPrimary.hasDataBatch,
    });

    return {
      fileName,
      content: lines.join('\n'),
      mimeType: 'text/csv;charset=utf-8',
      isRealExecutableGeneration: resolvedPrimary.hasDataBatch,
      engineNotice: resolvedPrimary.hasDataBatch
        ? `Generación física real ejecutada por ${outputType.serializationEngine} (${outputType.engineVersion}).`
        : `No hay un lote compatible para la entidad y el periodo seleccionados (${effectiveEntity} · ${context.periodo}). Generación física bloqueada.`,
      findings,
      rowsProcessed: rows.length,
      readinessMatrix,
      ...commonBatchMeta,
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
      const evalRowMap: Record<string, string> = {};
      if (isFixed) {
        let line = '';
        detailFields.forEach((field) => {
          const res = evaluateAndFormatField(field, row, rowIdx, context, decSep, true);
          findings.push(...res.findings);
          evalRowMap[field.technicalName] = res.formatted;
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
          evalRowMap[field.technicalName] = res.formatted;
          return res.formatted;
        });
        lines.push(cells.join(delim));
      }
      evaluatedRowsByField.push(evalRowMap);
    });

    if (output.composition.includeFooter || outputType.txtParams?.hasFooterControlRecord) {
      const countStr = String(rows.length).padStart(8, '0');
      const sumStr = totalAmount.toFixed(2).replace('.', '').padStart(16, '0');
      lines.push(`99${countStr}${sumStr}`);
    }

    if (resolvedPrimary.hasDataBatch) {
      findings.push(
        ...evaluateConfiguredValidationRules({
          output,
          rows,
          evaluatedRowsByField,
        })
      );
    }

    const readinessMatrix = computeOutputReadinessMatrix({
      outputType,
      findings,
      daqueProfile,
      hasCompatibleDataBatch: resolvedPrimary.hasDataBatch,
    });

    return {
      fileName,
      content: lines.join('\n'),
      mimeType: 'text/plain;charset=utf-8',
      isRealExecutableGeneration: resolvedPrimary.hasDataBatch,
      engineNotice: resolvedPrimary.hasDataBatch
        ? `Generación física real ejecutada por ${outputType.serializationEngine} (${outputType.engineVersion}).`
        : `No hay un lote compatible para la entidad y el periodo seleccionados (${effectiveEntity} · ${context.periodo}). Generación física bloqueada.`,
      findings,
      rowsProcessed: rows.length,
      readinessMatrix,
      ...commonBatchMeta,
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
      const evalRowMap: Record<string, string> = {};
      const attrs: string[] = [];
      const childNodes: string[] = [];

      detailFields.forEach((field) => {
        const res = evaluateAndFormatField(field, row, rowIdx, context, decSep, false);
        findings.push(...res.findings);
        evalRowMap[field.technicalName] = res.formatted;
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

      evaluatedRowsByField.push(evalRowMap);
      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
      xmlLines.push(`    <Registro secuencia="${rowIdx + 1}"${attrStr}>`);
      xmlLines.push(...childNodes);
      xmlLines.push(`    </Registro>`);
    });

    xmlLines.push(`  </DetalleRegistros>`);
    xmlLines.push(`</${rootEl}>`);

    if (resolvedPrimary.hasDataBatch) {
      findings.push(
        ...evaluateConfiguredValidationRules({
          output,
          rows,
          evaluatedRowsByField,
        })
      );
    }

    const readinessMatrix = computeOutputReadinessMatrix({
      outputType,
      findings,
      daqueProfile,
      hasCompatibleDataBatch: resolvedPrimary.hasDataBatch,
    });

    return {
      fileName,
      content: xmlLines.join('\n'),
      mimeType: 'application/xml;charset=utf-8',
      isRealExecutableGeneration: resolvedPrimary.hasDataBatch,
      engineNotice: resolvedPrimary.hasDataBatch
        ? `Generación XML real y validación de estructura bien formada ejecutada por ${outputType.serializationEngine}. (La validación criptográfica contra archivo XSD externo se ejecuta en servidor).`
        : `No hay un lote compatible para la entidad y el periodo seleccionados (${effectiveEntity} · ${context.periodo}). Generación física bloqueada.`,
      findings,
      rowsProcessed: rows.length,
      readinessMatrix,
      ...commonBatchMeta,
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
      const evalRowMap: Record<string, string> = {};
      const obj: Record<string, unknown> = {};
      detailFields.forEach((field) => {
        const res = evaluateAndFormatField(field, row, rowIdx, context, '.', false);
        findings.push(...res.findings);
        evalRowMap[field.technicalName] = res.formatted;
        obj[field.technicalName] = res.formatted;
      });
      evaluatedRowsByField.push(evalRowMap);
      return obj;
    });

    if (resolvedPrimary.hasDataBatch) {
      findings.push(
        ...evaluateConfiguredValidationRules({
          output,
          rows,
          evaluatedRowsByField,
        })
      );
    }

    const readinessMatrix = computeOutputReadinessMatrix({
      outputType,
      findings,
      daqueProfile,
      hasCompatibleDataBatch: resolvedPrimary.hasDataBatch,
    });

    const payload = {
      _avisoMotor:
        'VALIDACIÓN DE ESQUEMA Y VISTA LÓGICA AVRO (SIN BINARIO EN NAVEGADOR): El esquema de escritura y los registros lógicos fueron evaluados. La codificación binaria Object Container File (.avro) con codec ' +
        (outputType.avroParams?.codec || 'deflate') +
        ' no está disponible en navegador y se ejecuta en el Worker Avro en servidor.',
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
        'VALIDACIÓN DE ESQUEMA (SIN ARCHIVO FÍSICO EN NAVEGADOR): Se verificó el esquema Avro JSON y los registros lógicos. El archivo binario .avro requiere el Worker en servidor.',
      findings,
      rowsProcessed: rows.length,
      readinessMatrix,
      ...commonBatchMeta,
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
      const evalRowMap: Record<string, string> = {};
      detailFields.forEach((field) => {
        const res = evaluateAndFormatField(field, row, rowIdx, context, '.', false);
        findings.push(...res.findings);
        evalRowMap[field.technicalName] = res.formatted;
        const concept = field.xbrlConcept || `ifrs-full:${field.technicalName}`;
        const ctxRef = field.xbrlContextRef || `CTX_${context.periodo.replace('-', '_')}_F${rowIdx + 1}`;
        const unitAttr =
          field.dataType === 'Decimal' || field.dataType === 'Entero'
            ? ` unitRef="${field.xbrlUnitRef || 'U_COP'}" decimals="${field.scale ?? 2}"`
            : '';
        factsXml.push(`  <${concept} contextRef="${ctxRef}"${unitAttr}>${res.formatted}</${concept}>`);
      });
      evaluatedRowsByField.push(evalRowMap);
    });

    if (resolvedPrimary.hasDataBatch) {
      findings.push(
        ...evaluateConfiguredValidationRules({
          output,
          rows,
          evaluatedRowsByField,
        })
      );
    }

    const readinessMatrix = computeOutputReadinessMatrix({
      outputType,
      findings,
      daqueProfile,
      hasCompatibleDataBatch: resolvedPrimary.hasDataBatch,
    });

    const xbrlPreview = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<!-- VISTA PREVIA ESTRUCTURAL XBRL 2.1 (SIN EMPAQUETADO TAXONÓMICO OFFLINE) — La certificación de dimensiones y fórmulas XBRL requiere el motor procesador XBRL en servidor -->`,
      `<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:ifrs-full="http://xbrl.ifrs.org/taxonomy/2026-01-01/ifrs-full">`,
      `  <link:schemaRef xlink:type="simple" xlink:href="${taxonomyUri}" />`,
      `  <xbrli:context id="CTX_${context.periodo.replace('-', '_')}_F1">`,
      `    <xbrli:entity>`,
      `      <xbrli:identifier scheme="${scheme}">${context.entidad}</xbrli:identifier>`,
      `    </xbrli:entity>`,
      `    <xbrli:period>`,
      `      <xbrli:instant>${getCutoffDateForPeriod(context.periodo)}</xbrli:instant>`,
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
        'VALIDACIÓN DE ESTRUCTURA XBRL (SIN CERTIFICADOR TAXONÓMICO EN NAVEGADOR): Previsualización de hechos, contextos y unidades. La generación certificada exige el motor XBRL 2.1 en servidor.',
      findings,
      rowsProcessed: rows.length,
      readinessMatrix,
      ...commonBatchMeta,
    };
  }

  // Family 6 & 7: PDF or XLSX candidate
  const docLines: string[] = [
    `================================================================================`,
    `VISTA PREVIA ESTRUCTURAL DE PLANTILLA DOCUMENTAL (${family}) — ${output.name}`,
    `NOTA: El archivo binario ${family} no se genera en navegador; requiere ${outputType.serializationEngine} en servidor.`,
    `Rol del documento: ${outputType.pdfParams?.documentRoleUse || 'Anexo regulatorio'}`,
    `Estándar requerido: ${outputType.pdfParams?.pdfStandard || 'PDF 1.7'}`,
    `Entidad: ${context.entidad} | Formato: ${context.formato} | Corte: ${context.periodo} (${getCutoffDateForPeriod(context.periodo)})`,
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
    const evalRowMap: Record<string, string> = {};
    const rowCells = detailFields.map((field) => {
      const res = evaluateAndFormatField(field, row, rowIdx, context, ',', false);
      findings.push(...res.findings);
      evalRowMap[field.technicalName] = res.formatted;
      return res.formatted.padEnd(18, ' ');
    });
    evaluatedRowsByField.push(evalRowMap);
    docLines.push(rowCells.join(' | '));
  });

  docLines.push(``);
  docLines.push(`[PIE DE PÁGINA Y CONTROL DE PAGINACIÓN: Página 1 de 1 · Sin cortes de fila · Total Filas: ${rows.length}]`);

  if (resolvedPrimary.hasDataBatch) {
    findings.push(
      ...evaluateConfiguredValidationRules({
        output,
        rows,
        evaluatedRowsByField,
      })
    );
  }

  const readinessMatrix = computeOutputReadinessMatrix({
    outputType,
    findings,
    daqueProfile,
    hasCompatibleDataBatch: resolvedPrimary.hasDataBatch,
  });

  return {
    fileName,
    content: docLines.join('\n'),
    mimeType: 'text/plain;charset=utf-8',
    isRealExecutableGeneration: false,
    engineNotice:
      family === 'XLSX'
        ? 'CAPACIDAD CANDIDATA POR CERTIFICAR: XLSX regulatorio está registrado como candidato y no genera binario en esta versión.'
        : 'VALIDACIÓN DE MAQUETACIÓN (SIN RENDERIZADO PDF EN NAVEGADOR): Estructura de bandas verificada. El archivo PDF/A binario se genera en servidor.',
    findings,
    rowsProcessed: rows.length,
    readinessMatrix,
    ...commonBatchMeta,
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

/**
 * Infers source structure fields from a sample delimited/CSV or JSON file.
 * - Preserves strings with leading zeros (e.g. "000123") as 'Texto'.
 * - Flags ambiguous dates (dd/MM/yyyy vs MM/dd/yyyy) and decimal/thousand separators before converting.
 * - Never deduces mandatory/regulatory length/unique key from complete sample rows.
 * - Never creates fictitious data batches when importing structure.
 */
export function inferSourceStructureFromSampleText(params: {
  rawText: string;
  delimiter?: ';' | ',' | '|' | '\t' | 'Auto';
  headerRowIndex?: number; // 1-indexed
  sectionName?: string;
}): {
  detectedDelimiter: string;
  inferredFields: DataContractField[];
  samplePreviewRows: Record<string, string>[];
  ambiguityWarnings: string[];
  inferenceDisclaimer: string;
} {
  const { rawText, delimiter = 'Auto', headerRowIndex = 1, sectionName = 'Detalle' } = params;
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      detectedDelimiter: ';',
      inferredFields: [],
      samplePreviewRows: [],
      ambiguityWarnings: ['El archivo de muestra está vacío.'],
      inferenceDisclaimer:
        'De un archivo de muestra no se deduce obligatoriedad normativa, clave única ni longitud oficial.',
    };
  }

  const headerIdx = Math.max(0, Math.min(lines.length - 1, headerRowIndex - 1));
  const headerLine = lines[headerIdx];

  let effectiveDelimiter = delimiter === 'Auto' ? ';' : delimiter;
  if (delimiter === 'Auto') {
    const candidates: Array<';' | ',' | '|' | '\t'> = [';', '|', ',', '\t'];
    let bestCount = -1;
    for (const cand of candidates) {
      const count = headerLine.split(cand).length - 1;
      if (count > bestCount) {
        bestCount = count;
        effectiveDelimiter = cand;
      }
    }
  }

  const rawHeaders = headerLine
    .split(effectiveDelimiter)
    .map((h, i) => h.replace(/^['"]|['"]$/g, '').trim() || `campo_${i + 1}`);

  const dataLines = lines.slice(headerIdx + 1, headerIdx + 21);
  const samplePreviewRows: Record<string, string>[] = dataLines.map((line) => {
    const cells = line.split(effectiveDelimiter).map((c) => c.replace(/^['"]|['"]$/g, '').trim());
    const obj: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    return obj;
  });

  const ambiguityWarnings: string[] = [];

  const inferredFields: DataContractField[] = rawHeaders.map((colName) => {
    const values = samplePreviewRows.map((r) => r[colName] ?? '').filter((v) => v !== '');
    const sampleVal = values[0] ?? '';

    let inferredType: DataContractField['dataType'] = 'Texto';
    let formatWarning: string | undefined;

    if (values.length > 0) {
      // 1. Leading zeros check: NEVER convert "000123" to Entero!
      const leadingZeroVal = values.find((v) => /^0\d+$/.test(v));
      if (leadingZeroVal) {
        inferredType = 'Texto';
        formatWarning = `Conservado como Texto para no perder ceros a la izquierda detectados en la muestra (ej. "${leadingZeroVal}").`;
        ambiguityWarnings.push(`${colName}: ${formatWarning}`);
      } else if (values.every((v) => /^(true|false|si|no|s|n)$/i.test(v))) {
        inferredType = 'Booleano';
      } else if (
        values.every(
          (v) =>
            /^\d{4}-\d{2}-\d{2}$/.test(v) ||
            /^\d{2}\/\d{2}\/\d{4}$/.test(v) ||
            /^\d{2}-\d{2}-\d{4}$/.test(v)
        )
      ) {
        inferredType = 'Fecha';
        // Check dd/MM/yyyy vs MM/dd/yyyy ambiguity
        const slashDates = values.filter((v) => /^\d{2}\/\d{2}\/\d{4}$/.test(v));
        if (slashDates.length > 0) {
          const allPartsLe12 = slashDates.every((v) => {
            const [p1, p2] = v.split('/').map(Number);
            return p1 <= 12 && p2 <= 12;
          });
          if (allPartsLe12) {
            formatWarning = `Formato de fecha ambiguo en muestra ("${slashDates[0]}": puede ser dd/MM/aaaa o MM/dd/aaaa). Confirme la máscara antes de convertir.`;
            ambiguityWarnings.push(`${colName}: ${formatWarning}`);
          }
        }
      } else if (values.every((v) => /^-?[1-9]\d*$/.test(v) || v === '0')) {
        inferredType = 'Entero';
      } else if (
        values.every((v) => /^-?\d+([.,]\d+)?$/.test(v) || /^-?\d{1,3}([.,]\d{3})+([.,]\d+)?$/.test(v))
      ) {
        inferredType = 'Decimal';
        const hasMixedSep = values.some(
          (v) => (v.includes('.') && v.includes(',')) || /^\d{1,3}(\.\d{3})+$/.test(v)
        );
        const hasCommaDec = values.some((v) => /,\d+$/.test(v));
        if (hasMixedSep || hasCommaDec) {
          formatWarning = `Separador numérico detectado en muestra ("${sampleVal}"). Confirme separador decimal y de miles antes de convertir.`;
          ambiguityWarnings.push(`${colName}: ${formatWarning}`);
        }
      }
    }

    return {
      name: colName,
      label: colName,
      dataType: inferredType,
      length: Math.max(10, ...values.map((v) => v.length)),
      precision: inferredType === 'Decimal' ? 18 : undefined,
      scale: inferredType === 'Decimal' ? 2 : undefined,
      // Never deduce mandatory (nullable: false) simply because sample rows are non-empty!
      nullable: true,
      lineage: `MUESTRA_CLIENTE.${sectionName.toUpperCase()}.${colName.toUpperCase()}`,
      sampleValues: values.slice(0, 3),
      sectionName,
      propertyOrigin: 'Inferida de muestra (Requiere confirmación)',
      formatWarning,
    };
  });

  return {
    detectedDelimiter: effectiveDelimiter,
    inferredFields,
    samplePreviewRows,
    ambiguityWarnings,
    inferenceDisclaimer:
      'Propiedades inferidas de muestra: que todas las filas del ejemplo tengan dato NO implica obligatoriedad normativa, clave única ni longitud máxima oficial. Al registrar esta estructura no se crean filas de datos ficticias.',
  };
}

/**
 * Evaluates multi-source combinations for Step 3 without allowing silent/implicit joins.
 */
export function evaluateMultiSourceCombination(params: {
  primaryContract: DataContract;
  attachedSources: AttachedOutputSource[];
  allContracts: DataContract[];
  periodo: string;
  entidad?: string;
}): {
  sourceEvaluations: Array<{
    alias: string;
    contractId: string;
    contractName: string;
    targetSection: AttachedOutputSource['targetSection'];
    relationKind: string;
    status: 'Conforme' | 'Secciones independientes (Sin cruce de filas)' | 'Advertencia de cruce' | 'Bloqueo de cruce';
    matchedPrimaryCount: number;
    orphanPrimaryCount: number;
    duplicateSecondaryKeysCount: number;
    resultingRowCount: number;
    diagnostic: string;
  }>;
} {
  const { primaryContract, attachedSources, allContracts, periodo, entidad } = params;
  const primaryResolved = resolveSourceExecutionRows({
    contract: primaryContract,
    periodo,
    entidad,
  });
  const primaryRows = primaryResolved.rows;
  const contractsById = new Map<string, DataContract>(allContracts.map((c) => [c.id, c]));
  contractsById.set(primaryContract.id, primaryContract);

  const sourceEvaluations = attachedSources.map((src, idx) => {
    const contract = contractsById.get(src.dataContractId);
    if (!contract) {
      return {
        alias: src.alias,
        contractId: src.dataContractId,
        contractName: 'Fuente no encontrada',
        targetSection: src.targetSection,
        relationKind: src.combinationRule?.relationType || 'No definida',
        status: 'Bloqueo de cruce' as const,
        matchedPrimaryCount: 0,
        orphanPrimaryCount: primaryRows.length,
        duplicateSecondaryKeysCount: 0,
        resultingRowCount: primaryRows.length,
        diagnostic: `La fuente "${src.dataContractId}" no está disponible en el catálogo.`,
      };
    }

    if (idx === 0 && src.dataContractId === primaryContract.id) {
      return {
        alias: src.alias,
        contractId: contract.id,
        contractName: contract.name,
        targetSection: src.targetSection,
        relationKind: 'Fuente base de sección Detalle',
        status: 'Conforme' as const,
        matchedPrimaryCount: primaryRows.length,
        orphanPrimaryCount: 0,
        duplicateSecondaryKeysCount: 0,
        resultingRowCount: primaryRows.length,
        diagnostic: `Fuente primaria activa con ${primaryRows.length} fila(s) para el periodo ${periodo}.`,
      };
    }

    const secResolved = resolveSourceExecutionRows({
      contract,
      periodo,
      entidad,
      selectedSourceExecutionId: src.selectedExecutionBatchId,
    });
    const secRows = secResolved.rows;
    const relKind = src.combinationRule?.relationType || 'Sin unión (Secciones separadas)';
    const isDetailTarget =
      src.targetSection === 'Detalle' || src.targetSection === 'Todas las secciones';

    if (!isDetailTarget || relKind === 'Sin unión (Secciones separadas)') {
      return {
        alias: src.alias,
        contractId: contract.id,
        contractName: contract.name,
        targetSection: src.targetSection,
        relationKind: 'Sin unión (Secciones separadas)',
        status: 'Secciones independientes (Sin cruce de filas)' as const,
        matchedPrimaryCount: secRows.length,
        orphanPrimaryCount: 0,
        duplicateSecondaryKeysCount: 0,
        resultingRowCount: primaryRows.length,
        diagnostic: `Alimenta la sección "${src.targetSection}" de forma independiente (${secRows.length} fila(s)); no requiere cruzar ni multiplicar registros con Detalle.`,
      };
    }

    if (relKind === 'No soportada (Requiere preparación previa en TÓTAL REPORT®)') {
      return {
        alias: src.alias,
        contractId: contract.id,
        contractName: contract.name,
        targetSection: src.targetSection,
        relationKind: relKind,
        status: 'Bloqueo de cruce' as const,
        matchedPrimaryCount: 0,
        orphanPrimaryCount: primaryRows.length,
        duplicateSecondaryKeysCount: 0,
        resultingRowCount: primaryRows.length,
        diagnostic:
          'Relación marcada como "No soportada": no se puede combinar en la misma sección sin una regla de cruce autorizada.',
      };
    }

    const leftKey = src.combinationRule?.leftKeyField || '';
    const rightKey = src.combinationRule?.rightKeyField || '';
    if (!leftKey || !rightKey) {
      return {
        alias: src.alias,
        contractId: contract.id,
        contractName: contract.name,
        targetSection: src.targetSection,
        relationKind: relKind,
        status: 'Bloqueo de cruce' as const,
        matchedPrimaryCount: 0,
        orphanPrimaryCount: primaryRows.length,
        duplicateSecondaryKeysCount: 0,
        resultingRowCount: primaryRows.length,
        diagnostic:
          'Falta definir la llave primaria o secundaria para combinar en la sección Detalle. El sistema prohíbe cruces implícitos.',
      };
    }

    let matchedPrimaryCount = 0;
    let orphanPrimaryCount = 0;
    let duplicateSecondaryKeysCount = 0;
    let resultingRowCount = 0;

    for (const pRow of primaryRows) {
      const keyVal = String(pRow[leftKey] ?? '').trim();
      const matches = secRows.filter((sRow) => String(sRow[rightKey] ?? '').trim() === keyVal && keyVal !== '');
      if (matches.length === 0) {
        orphanPrimaryCount++;
        resultingRowCount += 1;
      } else {
        matchedPrimaryCount++;
        if (matches.length > 1) {
          duplicateSecondaryKeysCount++;
        }
        resultingRowCount +=
          relKind === '1:N Detalle (Advierte multiplicación de filas)' ? matches.length : 1;
      }
    }

    const hasWarning =
      (relKind === '1:1 Exacta por clave única' &&
        (orphanPrimaryCount > 0 || duplicateSecondaryKeysCount > 0)) ||
      (relKind === '1:N Detalle (Advierte multiplicación de filas)' &&
        resultingRowCount > primaryRows.length);

    return {
      alias: src.alias,
      contractId: contract.id,
      contractName: contract.name,
      targetSection: src.targetSection,
      relationKind: `${relKind} (${leftKey} = ${rightKey})`,
      status: hasWarning ? ('Advertencia de cruce' as const) : ('Conforme' as const),
      matchedPrimaryCount,
      orphanPrimaryCount,
      duplicateSecondaryKeysCount,
      resultingRowCount,
      diagnostic:
        `Cruce explícito por ${leftKey} = ${rightKey}: ${matchedPrimaryCount} coincidencia(s), ${orphanPrimaryCount} huérfano(s) sin pareja y ${duplicateSecondaryKeysCount} clave(s) con múltiples registros secundarios. ` +
        `Filas resultantes en Detalle: ${resultingRowCount}.`,
    };
  });

  return { sourceEvaluations };
}

/**
 * Analyzes the impact of updating or replacing a source DataContract on an output's mapped fields.
 * Marks affected mappings as 'Requiere revisión por cambio en fuente' without silently wiping unaffected mappings.
 */
export function analyzeSourceStructureUpdateImpact(params: {
  fields: StructureField[];
  updatedContract: DataContract;
  previousContractId?: string;
}): {
  updatedFields: StructureField[];
  impactedCount: number;
  preservedCount: number;
  impactedDetails: Array<{
    fieldId: string;
    technicalName: string;
    previousSourceField: string;
    reason: string;
  }>;
} {
  const { fields, updatedContract, previousContractId } = params;
  const targetContractIds = new Set([updatedContract.id, previousContractId].filter(Boolean));
  const contractFieldsByName = new Map(updatedContract.fields.map((f) => [f.name, f]));

  let impactedCount = 0;
  let preservedCount = 0;
  const impactedDetails: Array<{
    fieldId: string;
    technicalName: string;
    previousSourceField: string;
    reason: string;
  }> = [];

  const updatedFields = fields.map((field) => {
    const isTargetingThisSource =
      targetContractIds.has(field.mapping.sourceContractId) || !field.mapping.sourceContractId;

    if (
      !isTargetingThisSource ||
      field.mapping.transformationKind === 'Constante' ||
      field.mapping.transformationKind === 'Variable de contexto' ||
      !field.mapping.sourceField
    ) {
      return field;
    }

    const colName = field.mapping.sourceField;
    const matchedCol = contractFieldsByName.get(colName);

    if (!matchedCol) {
      impactedCount++;
      const reason = `La columna de origen "${colName}" ya no existe en "${updatedContract.name}" (${updatedContract.version}).`;
      impactedDetails.push({
        fieldId: field.id,
        technicalName: field.technicalName,
        previousSourceField: colName,
        reason,
      });
      return {
        ...field,
        mapping: {
          ...field.mapping,
          sourceContractId: updatedContract.id,
          mappingStatus: 'Requiere revisión por cambio en fuente' as const,
          changeImpactNote: reason,
        },
      };
    }

    if (!areTypesCompatible(matchedCol.dataType, field.dataType)) {
      impactedCount++;
      const reason = `El tipo de la columna "${colName}" cambió a "${matchedCol.dataType}" en "${updatedContract.name}" (${updatedContract.version}) y es incompatible con el tipo de salida "${field.dataType}".`;
      impactedDetails.push({
        fieldId: field.id,
        technicalName: field.technicalName,
        previousSourceField: colName,
        reason,
      });
      return {
        ...field,
        mapping: {
          ...field.mapping,
          sourceContractId: updatedContract.id,
          mappingStatus: 'Requiere revisión por cambio en fuente' as const,
          changeImpactNote: reason,
        },
      };
    }

    preservedCount++;
    return {
      ...field,
      mapping: {
        ...field.mapping,
        sourceContractId: updatedContract.id,
        changeImpactNote: undefined,
      },
    };
  });

  return {
    updatedFields,
    impactedCount,
    preservedCount,
    impactedDetails,
  };
}

/**
 * Audits Colombia (Excel) and Perú (Image) catalog entries for:
 * - Duplicate format codes across countries or organisms (e.g. 410 in DIAN Colombia vs 410 in SBS Perú)
 * - Catalog anomalies (empty code, "MENSUAL" in code column, "EXÓGENA" in periodicity column)
 * - Separation between registered catalog entry and actual data structure availability
 */
export function auditCatalogImportEntries(entries: CatalogSourceFormatEntry[]): {
  totalEntries: number;
  withStructureCount: number;
  pendingStructureCount: number;
  sharedCodeGroups: Array<{
    formatCode: string;
    entries: Array<{ id: string; country: string; regulatorOrOrganism: string; reportName: string }>;
  }>;
  anomalies: Array<{
    entryId: string;
    country: string;
    regulatorOrOrganism: string;
    formatCode: string;
    reportName: string;
    issue: string;
  }>;
} {
  let withStructureCount = 0;
  let pendingStructureCount = 0;
  const byCode = new Map<string, CatalogSourceFormatEntry[]>();
  const anomalies: Array<{
    entryId: string;
    country: string;
    regulatorOrOrganism: string;
    formatCode: string;
    reportName: string;
    issue: string;
  }> = [];

  for (const entry of entries) {
    if (
      entry.catalogStatus === 'Estructura disponible' ||
      entry.catalogStatus === 'Estructura y datos disponibles' ||
      Boolean(entry.linkedDataContractId)
    ) {
      withStructureCount++;
    } else {
      pendingStructureCount++;
    }

    const cleanCode = (entry.formatCode || '').trim();
    if (cleanCode) {
      const list = byCode.get(cleanCode) || [];
      list.push(entry);
      byCode.set(cleanCode, list);
    }

    if (!cleanCode) {
      anomalies.push({
        entryId: entry.id,
        country: entry.country,
        regulatorOrOrganism: entry.regulatorOrOrganism,
        formatCode: '(Vacío)',
        reportName: entry.reportName,
        issue:
          entry.catalogAnomalies?.[0] ||
          'Código vacío en el archivo de catálogo; requiere revisión humana sin inventar código.',
      });
    } else if (/^(MENSUAL|TRIMESTRAL|ANUAL|SEMANAL|DIARIA)$/i.test(cleanCode)) {
      anomalies.push({
        entryId: entry.id,
        country: entry.country,
        regulatorOrOrganism: entry.regulatorOrOrganism,
        formatCode: cleanCode,
        reportName: entry.reportName,
        issue:
          entry.catalogAnomalies?.[0] ||
          `Valor de periodicidad ("${cleanCode}") detectado en la columna Código del Excel.`,
      });
    } else if (
      !/^(Mensual|Trimestral|Semestral|Anual|Diaria|Semanal|Bimestral|Eventual)$/i.test(
        (entry.periodicity || '').trim()
      )
    ) {
      anomalies.push({
        entryId: entry.id,
        country: entry.country,
        regulatorOrOrganism: entry.regulatorOrOrganism,
        formatCode: cleanCode,
        reportName: entry.reportName,
        issue:
          entry.catalogAnomalies?.[0] ||
          `Valor atípico ("${entry.periodicity}") en la columna Periodicidad del catálogo.`,
      });
    } else if (entry.catalogAnomalies && entry.catalogAnomalies.length > 0) {
      anomalies.push({
        entryId: entry.id,
        country: entry.country,
        regulatorOrOrganism: entry.regulatorOrOrganism,
        formatCode: cleanCode,
        reportName: entry.reportName,
        issue: entry.catalogAnomalies[0],
      });
    }
  }

  const sharedCodeGroups: Array<{
    formatCode: string;
    entries: Array<{ id: string; country: string; regulatorOrOrganism: string; reportName: string }>;
  }> = [];

  for (const [code, list] of byCode.entries()) {
    if (list.length > 1) {
      sharedCodeGroups.push({
        formatCode: code,
        entries: list.map((e) => ({
          id: e.id,
          country: e.country,
          regulatorOrOrganism: e.regulatorOrOrganism,
          reportName: e.reportName,
        })),
      });
    }
  }

  return {
    totalEntries: entries.length,
    withStructureCount,
    pendingStructureCount,
    sharedCodeGroups,
    anomalies,
  };
}

