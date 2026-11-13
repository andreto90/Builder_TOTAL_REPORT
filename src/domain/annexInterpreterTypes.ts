import {
  ConfiguredOutput,
  CsvParameters,
  EmptyDatasetPolicy,
  OutputType,
  OutputValidationRule,
  PdfParameters,
  RegulatoryFormat,
  StructureField,
  TechnicalFamily,
  TxtParameters,
  ValidationLayer,
  XmlParameters,
} from './types';
import {
  buildAutoOutputCode,
  buildAutoTechnicalName,
  buildQuickOutputDefaults,
  buildSmartStructureField,
  recalculateStructureFieldsForFamily,
} from './engine';
import {
  AMERICAS_AND_EUROPE_COUNTRIES,
  normalizeSearchText,
} from './jurisdictionsCatalog';

export const ACCEPTED_ANNEX_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
] as const;

export const ACCEPTED_ANNEX_INPUT_ATTR =
  '.pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,image/png,image/jpeg,image/webp';

export const MAX_ANNEX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export type AnnexUploadKind = 'pdf' | 'word_docx' | 'word_doc' | 'excel' | 'image';

export interface AnnexFileValidationResult {
  ok: boolean;
  kind?: AnnexUploadKind;
  normalizedMimeType?: string;
  extension?: string;
  error?: string;
}

export function validateAnnexUploadFile(
  fileName: string,
  mimeType: string,
  sizeBytes: number
): AnnexFileValidationResult {
  const cleanName = (fileName || '').trim();
  const dotIdx = cleanName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? cleanName.slice(dotIdx).toLowerCase() : '';

  if (sizeBytes <= 0) {
    return {
      ok: false,
      error: 'El archivo seleccionado está vacío o no contiene bytes válidos.',
    };
  }

  if (sizeBytes > MAX_ANNEX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `El archivo supera el límite máximo permitido de ${Math.round(
        MAX_ANNEX_FILE_SIZE_BYTES / (1024 * 1024)
      )} MB.`,
    };
  }

  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return { ok: true, kind: 'pdf', extension: '.pdf', normalizedMimeType: 'application/pdf' };
  }
  if (
    ext === '.docx' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return {
      ok: true,
      kind: 'word_docx',
      extension: '.docx',
      normalizedMimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
  if (ext === '.doc' || mimeType === 'application/msword') {
    return {
      ok: true,
      kind: 'word_doc',
      extension: '.doc',
      normalizedMimeType: 'application/msword',
    };
  }
  if (
    ext === '.xlsx' ||
    ext === '.xls' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return {
      ok: true,
      kind: 'excel',
      extension: ext === '.xls' ? '.xls' : '.xlsx',
      normalizedMimeType:
        ext === '.xls'
          ? 'application/vnd.ms-excel'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
  if (
    ext === '.png' ||
    ext === '.jpg' ||
    ext === '.jpeg' ||
    ext === '.webp' ||
    mimeType.startsWith('image/')
  ) {
    const resolvedMime =
      ext === '.png' || mimeType === 'image/png'
        ? 'image/png'
        : ext === '.webp' || mimeType === 'image/webp'
        ? 'image/webp'
        : 'image/jpeg';
    return { ok: true, kind: 'image', extension: ext || '.png', normalizedMimeType: resolvedMime };
  }

  return {
    ok: false,
    error:
      'Tipo de archivo no admitido. Cargue un anexo normativo en PDF (.pdf), Word (.docx / .doc), Excel (.xlsx / .xls) o imagen (.png, .jpg, .webp).',
  };
}

export interface InterpretedFieldProposal {
  technicalName: string;
  label: string;
  description: string;
  recordSection: 'Cabecera' | 'Detalle' | 'Cierre / Totales' | 'Nodo raíz / Hecho';
  dataType: 'Texto' | 'Entero' | 'Decimal' | 'Fecha' | 'Booleano' | 'Catálogo' | 'Registro / Grupo';
  length: number;
  precision?: number;
  scale?: number;
  startPosition?: number;
  formatMask: string;
  paddingChar: ' ' | '0' | 'Ninguno';
  alignment: 'Izquierda' | 'Derecha';
  required: boolean;
  defaultValue: string;
  evidenceNote: string;
}

export interface InterpretedValidationProposal {
  name: string;
  layer: ValidationLayer;
  targetFieldTechnicalName: string;
  conditionExpression: string;
  severity: 'Bloqueante' | 'Advertencia';
  diagnosticMessage: string;
  evidenceNote: string;
}

export interface UninterpretedAnnexItem {
  category:
    | 'Identificación y país'
    | 'Tipo de archivo y codificación'
    | 'Campos y longitudes'
    | 'Tipos de dato y máscaras'
    | 'Validaciones y reglas DAQUE'
    | 'Transmisión y nomenclatura'
    | 'Legibilidad o formato del documento';
  aspect: string;
  reason: string;
  recommendedAction: string;
}

export interface NormativeAnnexInterpretation {
  sourceFileName: string;
  sourceKind: AnnexUploadKind;
  summary: string;
  confidenceLevel: 'Alta' | 'Media' | 'Baja';
  detectedDocumentMeta: {
    documentTitle: string;
    normativeReference: string;
    country: string;
    regulatorShortOrName: string;
    formatCode: string;
    formatName: string;
    periodicity: string;
    reportingModality: 'Periódico' | 'Por evento' | 'No especificado';
    applicableEntityTypes: string[];
  };
  suggestedOutputConfig: {
    outputName: string;
    outputCode: string;
    description: string;
    recommendedFamily: TechnicalFamily;
    encoding: 'UTF-8' | 'UTF-8 con BOM' | 'ISO-8859-1' | 'ASCII' | 'Binario';
    fileNamePattern: string;
    delimiter: ';' | ',' | '|' | '\t' | 'Ancho fijo' | 'N/A';
    decimalSeparator: ',' | '.';
    includeHeader: boolean;
    includeFooter: boolean;
    includeControlTotals: boolean;
    emptyDatasetPolicy: EmptyDatasetPolicy;
    xmlRootElement: string;
    xmlNamespace: string;
    hasHeaderRecord: boolean;
    hasFooterControlRecord: boolean;
  };
  suggestedFields: InterpretedFieldProposal[];
  suggestedValidations: InterpretedValidationProposal[];
  uninterpretedItems: UninterpretedAnnexItem[];
}

export interface AppliedAnnexInterpretationResult {
  draft: ConfiguredOutput;
  matchedCountry: string;
  matchedRegulatorName: string;
  matchedOutputTypeId: string;
  matchedFormats: RegulatoryFormat[];
  uninterpretedCount: number;
}

/**
 * Resolves the canonical country name in AMERICAS_AND_EUROPE_COUNTRIES from an arbitrary AI-extracted string.
 */
export function resolveCanonicalCountry(rawCountry: string): string {
  const norm = normalizeSearchText(rawCountry);
  if (!norm) return '';
  const direct = AMERICAS_AND_EUROPE_COUNTRIES.find(
    (c) => normalizeSearchText(c.country) === norm
  );
  if (direct) return direct.country;

  // Common English/alias country names
  const aliasMap: Record<string, string> = {
    usa: 'Estados Unidos',
    'united states': 'Estados Unidos',
    'ee.uu.': 'Estados Unidos',
    eeuu: 'Estados Unidos',
    mexico: 'México',
    peru: 'Perú',
    brazil: 'Brasil',
    spain: 'España',
    uk: 'Reino Unido',
    'united kingdom': 'Reino Unido',
    germany: 'Alemania',
    france: 'Francia',
    italy: 'Italia',
    switzerland: 'Suiza',
    netherlands: 'Países Bajos',
    luxembourg: 'Luxemburgo',
    ireland: 'Irlanda',
    canada: 'Canadá',
    dominican: 'República Dominicana',
    'european union': 'Unión Europea (Supranacional)',
    eu: 'Unión Europea (Supranacional)',
  };
  for (const [k, v] of Object.entries(aliasMap)) {
    if (norm === k || norm.includes(k)) return v;
  }

  const partial = AMERICAS_AND_EUROPE_COUNTRIES.find(
    (c) =>
      normalizeSearchText(c.country).includes(norm) ||
      norm.includes(normalizeSearchText(c.country))
  );
  return partial ? partial.country : '';
}

/**
 * Finds candidate RegulatoryFormat records matching an annex interpretation.
 */
export function matchCatalogFormatsForInterpretation(
  interpretation: NormativeAnnexInterpretation,
  formats: RegulatoryFormat[],
  resolvedCountry: string
): RegulatoryFormat[] {
  const meta = interpretation.detectedDocumentMeta;
  const normCode = normalizeSearchText(meta.formatCode);
  const normName = normalizeSearchText(meta.formatName);
  const normReg = normalizeSearchText(meta.regulatorShortOrName);

  // Resolve regulator alias names (shortName <-> full name) within resolvedCountry
  const regulatorAliases = new Set<string>();
  if (normReg) regulatorAliases.add(normReg);
  const jurEntry = resolvedCountry
    ? AMERICAS_AND_EUROPE_COUNTRIES.find((c) => c.country === resolvedCountry)
    : undefined;
  if (jurEntry && normReg) {
    for (const r of jurEntry.regulators) {
      const nShort = normalizeSearchText(r.shortName);
      const nName = normalizeSearchText(r.name);
      if (nShort === normReg || nName === normReg || nName.includes(normReg) || normReg.includes(nShort)) {
        regulatorAliases.add(nShort);
        regulatorAliases.add(nName);
      }
    }
  }

  const codeTokens = normCode
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !['serie', 'formato', 'anexo', 'form'].includes(t));

  const scored = formats
    .filter((f) => f.lifecycleStatus !== 'Inactivo')
    .map((f) => {
      let score = 0;
      const fmtCountry = f.country || f.jurisdiction;
      if (resolvedCountry && fmtCountry === resolvedCountry) {
        score += 30;
      } else if (resolvedCountry && fmtCountry !== resolvedCountry) {
        return { format: f, score: 0 };
      }

      const fmtRegNorm = normalizeSearchText(f.regulator);
      const regMatched = Array.from(regulatorAliases).some(
        (alias) =>
          alias.length >= 2 &&
          (fmtRegNorm.includes(alias) ||
            alias.includes(fmtRegNorm) ||
            normalizeSearchText(f.regulator.split(' - ')[0]) === alias)
      );
      if (regMatched) {
        score += 25;
      }

      const fmtCodeNorm = normalizeSearchText(f.code);
      if (normCode && fmtCodeNorm) {
        if (
          fmtCodeNorm === normCode ||
          fmtCodeNorm.includes(normCode) ||
          normCode.includes(fmtCodeNorm)
        ) {
          score += 40;
        } else if (codeTokens.some((tok) => fmtCodeNorm.includes(tok))) {
          score += 25;
        }
      }

      if (
        normName &&
        normName.length >= 4 &&
        (normalizeSearchText(f.name).includes(normName) ||
          normName.includes(normalizeSearchText(f.name)))
      ) {
        score += 20;
      }

      return { format: f, score };
    })
    .filter((item) => item.score >= 50)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 5).map((s) => s.format);
}

/**
 * Pure conversion from a Gemini NormativeAnnexInterpretation into a complete ConfiguredOutput draft,
 * preserving uninterpreted points transparently and never fabricating unconfirmed parameters as Sustento explícito.
 */
export function buildConfiguredOutputFromInterpretation(params: {
  interpretation: NormativeAnnexInterpretation;
  outputTypes: OutputType[];
  regulatoryFormats: RegulatoryFormat[];
  existingCodes: string[];
  responsibleUser: string;
  defaultContractId?: string;
  defaultChannelId?: string;
  fallbackJurisdiction?: string;
  fallbackRegulator?: string;
  nowDate?: string;
  nowDateTime?: string;
}): AppliedAnnexInterpretationResult {
  const {
    interpretation,
    outputTypes,
    regulatoryFormats,
    existingCodes,
    responsibleUser,
    defaultContractId = 'DC-CARTERA-01',
    defaultChannelId = 'CHAN-MANUAL-01',
    fallbackJurisdiction = 'Colombia',
    fallbackRegulator = 'Sin entidad reguladora específica (Formato personalizado)',
    nowDate = '2026-11-12',
    nowDateTime = '2026-11-12 09:00',
  } = params;

  const meta = interpretation.detectedDocumentMeta;
  const cfg = interpretation.suggestedOutputConfig;

  const matchedCountry =
    resolveCanonicalCountry(meta.country) || fallbackJurisdiction || 'Colombia';

  const outputType =
    outputTypes.find((t) => t.family === cfg.recommendedFamily) || outputTypes[0];

  const usedTechNames: string[] = [];
  const proposedFields: StructureField[] = (
    interpretation.suggestedFields.length > 0
      ? interpretation.suggestedFields
      : [
          {
            technicalName: 'registro_pendiente_revision',
            label: 'Campo pendiente de definición normativa',
            description:
              'El documento no permitió extraer campos detallados automáticamente.',
            recordSection: 'Detalle' as const,
            dataType: 'Texto' as const,
            length: 50,
            formatMask: 'Alfanumérico',
            paddingChar: 'Ninguno' as const,
            alignment: 'Izquierda' as const,
            required: true,
            defaultValue: '',
            evidenceNote: 'Revisar sección de elementos no interpretados.',
          },
        ]
  ).map((pf, idx) => {
    const cleanTech = buildAutoTechnicalName(
      pf.technicalName || pf.label || `campo_${idx + 1}`,
      usedTechNames
    );
    usedTechNames.push(cleanTech);

    const baseField = buildSmartStructureField({
      label: pf.label || cleanTech,
      dataType: pf.dataType || 'Texto',
      family: outputType.family,
      existingFields: [],
      sourceContractId: defaultContractId,
      required: pf.required,
      customLength: Math.max(1, pf.length || 20),
    });

    const isExplicit =
      Boolean(pf.evidenceNote) &&
      !/infer|pendiente|no especific/i.test(pf.evidenceNote);

    return {
      ...baseField,
      id: `FLD-AI-${Date.now().toString().slice(-4)}-${idx + 1}`,
      technicalName: cleanTech,
      label: pf.label || cleanTech,
      description: pf.description || baseField.description,
      recordSection: pf.recordSection || 'Detalle',
      order: idx + 1,
      dataType: pf.dataType || baseField.dataType,
      length: Math.max(1, pf.length || baseField.length),
      precision:
        pf.dataType === 'Decimal' ? pf.precision || pf.length || 18 : baseField.precision,
      scale: pf.dataType === 'Decimal' ? (pf.scale ?? 2) : baseField.scale,
      startPosition:
        outputType.family === 'TXT' && pf.startPosition && pf.startPosition > 0
          ? pf.startPosition
          : undefined,
      formatMask: pf.formatMask || baseField.formatMask,
      paddingChar: pf.paddingChar || baseField.paddingChar,
      alignment: pf.alignment || baseField.alignment,
      required: Boolean(pf.required),
      nullable: !pf.required,
      defaultValue: pf.defaultValue || '',
      protectionClass: isExplicit ? 'Normativa protegida' : 'Inferida pendiente',
      evidenceState: isExplicit ? 'Sustento explícito' : 'Requiere confirmación',
      evidenceSourceRef: `TOTALiA® (${interpretation.sourceFileName}): ${
        pf.evidenceNote || 'Extraído de anexo normativo'
      }`,
    };
  });

  const normalizedFields = recalculateStructureFieldsForFamily(
    proposedFields,
    outputType.family
  );

  const outputName =
    cfg.outputName.trim() ||
    meta.formatName.trim() ||
    `Salida ${interpretation.sourceFileName.replace(/\.[^.]+$/, '')}`;

  const rawSuggestedCode = (cfg.outputCode || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
  const finalCode =
    rawSuggestedCode &&
    !existingCodes.some((c) => c.toUpperCase() === rawSuggestedCode)
      ? rawSuggestedCode
      : buildAutoOutputCode(outputName, existingCodes);

  const baseDraft = buildQuickOutputDefaults({
    name: outputName,
    outputType,
    existingCodes,
    overrideCode: finalCode,
    regulator: meta.regulatorShortOrName.trim() || fallbackRegulator,
    jurisdiction: matchedCountry,
    customFields: normalizedFields,
    responsibleUser,
    defaultContractId,
    defaultChannelId,
    nowDate,
    nowDateTime,
  });

  // Apply family-specific parameters extracted from the normative annex
  const csvOverride: Partial<CsvParameters> | undefined =
    outputType.family === 'CSV'
      ? {
          delimiter:
            cfg.delimiter === ',' || cfg.delimiter === '|' || cfg.delimiter === '\t'
              ? cfg.delimiter
              : ';',
          decimalSeparator: cfg.decimalSeparator === '.' ? '.' : ',',
          includeHeader: Boolean(cfg.includeHeader),
        }
      : undefined;

  const txtOverride: Partial<TxtParameters> | undefined =
    outputType.family === 'TXT'
      ? {
          mode: cfg.delimiter === 'Ancho fijo' || !cfg.delimiter ? 'Ancho fijo' : 'Delimitado',
          hasHeaderRecord: Boolean(cfg.hasHeaderRecord),
          hasFooterControlRecord: Boolean(cfg.hasFooterControlRecord),
        }
      : undefined;

  const xmlOverride: Partial<XmlParameters> | undefined =
    outputType.family === 'XML'
      ? {
          rootElement: cfg.xmlRootElement.trim() || 'EntregaRegulatoriaXML',
          targetNamespace: cfg.xmlNamespace.trim() || 'urn:regulatorio:anexo:v1',
        }
      : undefined;

  const pdfOverride: Partial<PdfParameters> | undefined =
    outputType.family === 'PDF' ? {} : undefined;

  const validationRules: OutputValidationRule[] = interpretation.suggestedValidations.map(
    (v, idx) => ({
      id: `VAL-AI-${Date.now().toString().slice(-4)}-${idx + 1}`,
      code: `REG-AI-${String(idx + 1).padStart(2, '0')}`,
      name: v.name || `Validación normativa ${idx + 1}`,
      layer: v.layer || 'Diseño y estructura',
      targetFieldOrRole: v.targetFieldTechnicalName || '*',
      conditionExpression: v.conditionExpression || 'NO_NULO',
      severity: v.severity || 'Advertencia',
      isNormativeProtected: true,
      owner: 'Política de salida y entrega',
      diagnosticMessage: v.diagnosticMessage || v.name,
      enabled: true,
    })
  );

  const uninterpretedNotes =
    interpretation.uninterpretedItems.length > 0
      ? ` | Puntos por confirmar (${interpretation.uninterpretedItems.length}): ${interpretation.uninterpretedItems
          .map((u) => u.aspect)
          .slice(0, 4)
          .join(', ')}`
      : '';

  const resolvedEncoding: ConfiguredOutput['composition']['encoding'] =
    cfg.encoding === 'ASCII'
      ? 'UTF-8'
      : cfg.encoding || baseDraft.composition.encoding;

  const draft: ConfiguredOutput = {
    ...baseDraft,
    description:
      (cfg.description || interpretation.summary || baseDraft.description) +
      uninterpretedNotes,
    composition: {
      ...baseDraft.composition,
      fileNamePattern:
        cfg.fileNamePattern.trim() || baseDraft.composition.fileNamePattern,
      encoding: resolvedEncoding,
      delimiter: cfg.delimiter || baseDraft.composition.delimiter,
      decimalSeparator: cfg.decimalSeparator || baseDraft.composition.decimalSeparator,
      includeHeader: cfg.includeHeader,
      includeFooter: cfg.includeFooter,
      includeControlTotals: cfg.includeControlTotals,
      emptyDatasetPolicy:
        cfg.emptyDatasetPolicy || baseDraft.composition.emptyDatasetPolicy,
    },
    csvParamsOverride: csvOverride,
    txtParamsOverride: txtOverride,
    xmlParamsOverride: xmlOverride,
    pdfParamsOverride: pdfOverride,
    validationRules,
    versionHistory: [
      {
        version: '1.0',
        status: 'Borrador',
        createdAt: nowDateTime,
        createdBy: responsibleUser,
        justification: `Estructura inicial sugerida por TOTALiA® desde anexo "${interpretation.sourceFileName}" (${
          meta.normativeReference || 'Referencia documental adjunta'
        }).`,
        changesSummary: [
          `Interpretados ${normalizedFields.length} campo(s) y ${validationRules.length} validación(es) en familia ${outputType.family}.`,
          ...(interpretation.uninterpretedItems.length > 0
            ? [
                `${interpretation.uninterpretedItems.length} elemento(s) marcados para confirmación manual por ausencia o ambigüedad en el anexo.`,
              ]
            : []),
        ],
        fingerprint: baseDraft.fingerprint,
        derivationKind: 'Creación inicial',
      },
    ],
  };

  const matchedFormats = matchCatalogFormatsForInterpretation(
    interpretation,
    regulatoryFormats,
    matchedCountry
  );

  return {
    draft,
    matchedCountry,
    matchedRegulatorName: meta.regulatorShortOrName.trim() || fallbackRegulator,
    matchedOutputTypeId: outputType.id,
    matchedFormats,
    uninterpretedCount: interpretation.uninterpretedItems.length,
  };
}
