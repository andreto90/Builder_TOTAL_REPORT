import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderPlus,
  GitMerge,
  Info,
  Layers,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Table,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AttachedOutputSource,
  CatalogSourceFormatEntry,
  ConfiguredOutput,
  DataContract,
  DataContractField,
  OutputType,
  SourceExecutionBatch,
  SourceRelationKind,
  StructureField,
  TechnicalFamily,
  TransformationKind,
} from '../domain/types';
import {
  analyzeSourceStructureUpdateImpact,
  auditCatalogImportEntries,
  evaluateAndFormatField,
  evaluateMultiSourceCombination,
  FileNameContext,
  getCutoffDateForPeriod,
  getPeriodMetadata,
  inferSourceStructureFromSampleText,
  proposeFieldMappings,
  resolveSourceExecutionRows,
} from '../domain/engine';
import {
  buildStructureTemplateWorkbookBuffer,
  detectCatalogHeaderRowIndex,
  evaluateCatalogImportImpact,
  parseAndValidateDataBatchMatrix,
  parseCatalogMatrix,
  parseDelimitedMatrix,
  parseDelimitedTextToInspection,
  parseExcelArrayBuffer,
  parseStructureDefinitionMatrix,
  RawFileInspectionResult,
} from '../domain/fileParser';
import * as XLSX from 'xlsx';
import { HelpTooltip } from './HelpTooltip';

interface Step3DataOriginViewProps {
  activeOutput: ConfiguredOutput;
  activeOutputType: OutputType;
  isImmutable: boolean;
  dataContracts: DataContract[];
  catalogSourceFormats: CatalogSourceFormatEntry[];
  globalEntity: string;
  globalPeriod: string;
  previewContext: FileNameContext;
  onUpdateOutput: (updater: (prev: ConfiguredOutput) => ConfiguredOutput) => void;
  onUpdateFieldMapping: (
    fieldId: string,
    mappingKey: keyof StructureField['mapping'],
    value: string | boolean
  ) => void;
  onSaveDataContract: (contract: DataContract, propagateImpactToOutputId?: string) => void;
  onSaveCatalogSourceFormat: (entry: CatalogSourceFormatEntry) => void;
  onImportCatalogEntriesBatch: (
    entries: CatalogSourceFormatEntry[],
    mode: 'reconcile' | 'append'
  ) => void;
  onRegisterStructureForCatalogEntry: (catalogId: string, contract: DataContract) => void;
  onAddExecutionBatchToContract: (contractId: string, batch: SourceExecutionBatch) => void;
  onRequestCreateRevision: () => void;
  onGoToStep: (step: number) => void;
  notify: (type: 'success' | 'warning' | 'error' | 'info', text: string) => void;
}

type Step3Substage =
  | '1-origen'
  | '2-estructura'
  | '3-datos'
  | '4-mapeo'
  | '5-resultado';

const SAMPLE_STRUCTURE_TEMPLATE_CSV = [
  'nombre_campo;etiqueta_funcional;tipo_dato;longitud;obligatorio;seccion;descripcion',
  'fecha_corte;Fecha de Corte;Fecha;10;SI;Detalle;Fecha de cierre del periodo yyyy-MM-dd',
  'id_obligacion;Número de Obligación;Texto;12;SI;Detalle;Identificador con ceros a la izquierda conservados',
  'nit_deudor;NIT o Identificación;Texto;15;SI;Detalle;Documento del titular sin dígito de verificación',
  'saldo_capital;Saldo Capital Corte;Decimal;18;SI;Detalle;Saldo insoluto en moneda legal',
].join('\n');

const SAMPLE_FILE_FOR_INFERENCE = [
  'fecha_corte;id_obligacion;codigo_oficina;nombre_deudor;fecha_desembolso;saldo_capital;tipo_garantia_cliente',
  '2026-11-30;000123;0045;Ana María Pérez;04/05/2026;1.234,50;HIPOTECARIA',
  '2026-11-30;000124;0012;Carlos Andrés Gómez;06/07/2026;98.450,75;PRENDARIA',
  '2026-11-30;000125;0089;Inversiones del Pacífico S.A.S.;15/08/2026;452.000,00;FNG',
].join('\n');

const SAMPLE_BATCH_CSV = [
  'fecha_corte;id_obligacion;nombre;apellido_1;saldo;tasa_efectiva;estado_homologado;moneda',
  '2026-11-30;000123;Ana;Pérez;1234.50;14.25;VIGENTE;COP',
  '2026-11-30;000124;Carlos Andrés;Gómez;98450.75;18.50;VIGENTE;COP',
  '2026-11-30;000125;Inversiones del Pacífico;S.A.S.;452000.00;11.80;REESTRUCT;PEN',
].join('\n');

export const Step3DataOriginView: React.FC<Step3DataOriginViewProps> = ({
  activeOutput,
  activeOutputType,
  isImmutable,
  dataContracts,
  catalogSourceFormats,
  globalEntity,
  globalPeriod,
  previewContext,
  onUpdateOutput,
  onSaveDataContract,
  onSaveCatalogSourceFormat,
  onImportCatalogEntriesBatch,
  onRegisterStructureForCatalogEntry,
  onAddExecutionBatchToContract,
  onRequestCreateRevision,
  onGoToStep,
  notify,
}) => {
  const [activeSubstage, setActiveSubstage] = useState<Step3Substage>('1-origen');

  // Route selector: A (Formato generado por TÓTAL REPORT®) vs B (Fuentes proporcionadas por el cliente)
  const primaryContract = useMemo(
    () => dataContracts.find((c) => c.id === activeOutput.dataContractId) || dataContracts[0],
    [dataContracts, activeOutput.dataContractId]
  );

  // Resolve exact catalog entry linked to this output (disambiguating shared DataContracts!)
  const activeCatalogEntry = useMemo(() => {
    if (activeOutput.sourceCatalogEntryId) {
      const exact = catalogSourceFormats.find(
        (e) => e.id === activeOutput.sourceCatalogEntryId
      );
      if (exact) return exact;
    }
    const attachedCatId = activeOutput.attachedSources?.[0]?.catalogEntryId;
    if (attachedCatId) {
      const exact = catalogSourceFormats.find((e) => e.id === attachedCatId);
      if (exact) return exact;
    }
    const candidates = catalogSourceFormats.filter(
      (e) => e.linkedDataContractId === primaryContract.id
    );
    if (candidates.length === 1) return candidates[0];
    return (
      candidates.find((e) => e.country === activeOutput.jurisdiction) ||
      candidates[0] ||
      null
    );
  }, [
    activeOutput.sourceCatalogEntryId,
    activeOutput.attachedSources,
    activeOutput.jurisdiction,
    catalogSourceFormats,
    primaryContract.id,
  ]);

  const [selectedOriginRoute, setSelectedOriginRoute] = useState<
    'Formato generado por TÓTAL REPORT®' | 'Fuente proporcionada por el cliente'
  >(primaryContract.originRoute || 'Formato generado por TÓTAL REPORT®');

  // Route A mode: 'disponibles' (Informes del sistema con datos) vs 'catalogo_referencia' (Herramienta administrativa)
  const [routeAMode, setRouteAMode] = useState<'disponibles' | 'catalogo_referencia'>('disponibles');

  // Priority: Reports that actually have structure and execution batches in TÓTAL REPORT®
  const availableReportsWithData = useMemo(() => {
    return catalogSourceFormats
      .filter((entry) => {
        if (!entry.linkedDataContractId) return false;
        const contract = dataContracts.find((c) => c.id === entry.linkedDataContractId);
        return Boolean(contract && contract.fields.length > 0);
      })
      .map((entry) => {
        const contract = dataContracts.find((c) => c.id === entry.linkedDataContractId)!;
        const execInfo = resolveSourceExecutionRows({
          contract,
          periodo: globalPeriod,
          entidad: globalEntity,
          sourceCatalogEntryId: entry.id,
        });
        const isPrimarySelected = Boolean(
          contract.id === primaryContract.id &&
            (activeCatalogEntry ? activeCatalogEntry.id === entry.id : true)
        );
        return {
          entry,
          contract,
          execInfo,
          isPrimarySelected,
        };
      });
  }, [
    catalogSourceFormats,
    dataContracts,
    globalPeriod,
    globalEntity,
    primaryContract.id,
    activeCatalogEntry,
  ]);

  const reportsWithStructureCount = availableReportsWithData.length;
  const reportsWithDataCount = useMemo(() => {
    return availableReportsWithData.filter(
      (r) => r.execInfo.hasDataBatch && r.execInfo.rows.length > 0
    ).length;
  }, [availableReportsWithData]);
  const reportsWithoutDataCount = reportsWithStructureCount - reportsWithDataCount;

  // Route A filters (Colombia / Perú Catalog & System Formats)
  const [catCountryFilter, setCatCountryFilter] = useState<'Todos' | 'Colombia' | 'Perú'>('Todos');
  const [catRegulatorFilter, setCatRegulatorFilter] = useState<string>('Todos');
  const [catPeriodicityFilter, setCatPeriodicityFilter] = useState<string>('Todas');
  const [catStatusFilter, setCatStatusFilter] = useState<string>('Todos');
  const [catSearchQuery, setCatSearchQuery] = useState<string>('');
  const [catPage, setCatPage] = useState<number>(1);
  const [catPageSize, setCatPageSize] = useState<number>(8);
  const [showCatalogAuditModal, setShowCatalogAuditModal] = useState<boolean>(false);
  const [showNewCatalogEntryModal, setShowNewCatalogEntryModal] = useState<boolean>(false);
  const [showImportCatalogModal, setShowImportCatalogModal] = useState<boolean>(false);

  // Catalog File Import State (.xlsx / .csv)
  const [catalogFileInspection, setCatalogFileInspection] =
    useState<RawFileInspectionResult | null>(null);
  const [catalogSelectedSheet, setCatalogSelectedSheet] = useState<string>('');
  const [catalogHeaderRow, setCatalogHeaderRow] = useState<number>(2);
  const [catalogDefaultCountry, setCatalogDefaultCountry] = useState<'Colombia' | 'Perú'>(
    'Colombia'
  );
  const [catalogImportMode, setCatalogImportMode] = useState<
    'reconciliar' | 'solo_nuevos'
  >('reconciliar');
  const [catalogInputSourceMode, setCatalogInputSourceMode] = useState<'file' | 'paste'>('file');
  const [catalogPasteText, setCatalogPasteText] = useState<string>('');
  const [catalogImportPreview, setCatalogImportPreview] = useState<{
    entries: CatalogSourceFormatEntry[];
    totalRead: number;
    rejected: number;
    anomalies: string[];
    impactSummary: {
      newCount: number;
      updatedCount: number;
      unchangedCount: number;
    };
  } | null>(null);

  // Route B modals / panels (4 differentiated client source actions)
  const [activeClientAction, setActiveClientAction] = useState<
    | null
    | 'import-structure'
    | 'infer-from-sample'
    | 'select-registered'
    | 'define-manual'
  >(null);

  // Action 1: Import structure template (File + Paste tabs)
  const [importStructInputMode, setImportStructInputMode] = useState<'file' | 'paste'>('file');
  const [importStructFileInspection, setImportStructFileInspection] =
    useState<RawFileInspectionResult | null>(null);
  const [importStructCode, setImportStructCode] = useState('FUENTE-CLI-PLANTILLA-01');
  const [importStructName, setImportStructName] = useState('Estructura Auxiliar Declarada por Plantilla');
  const [importStructSection, setImportStructSection] = useState('Detalle_Auxiliar');
  const [importStructText, setImportStructText] = useState(SAMPLE_STRUCTURE_TEMPLATE_CSV);
  const [lastStructureLoadReport, setLastStructureLoadReport] = useState<{
    fileName: string;
    totalRowsRead: number;
    acceptedRows: number;
    rejectedRows: number;
    rejections: { rowNumber: number; reason: string }[];
  } | null>(null);

  // Action 2: Infer structure from sample file (File + Paste tabs)
  const [sampleInputMode, setSampleInputMode] = useState<'file' | 'paste'>('file');
  const [sampleLoadedFileName, setSampleLoadedFileName] = useState<string>('');
  const [sampleStructCode, setSampleStructCode] = useState('FUENTE-CLI-MUESTRA-01');
  const [sampleStructName, setSampleStructName] = useState('Fuente Auxiliar Obtenida desde Archivo de Ejemplo');
  const [sampleSectionName, setSampleSectionName] = useState('Tabla_Ejemplo_Cliente');
  const [sampleHeaderRow, setSampleHeaderRow] = useState<number>(1);
  const [sampleDelimiter, setSampleDelimiter] = useState<'Auto' | ';' | ',' | '|' | '\t'>('Auto');
  const [sampleEncoding, setSampleEncoding] = useState<'UTF-8' | 'ISO-8859-1'>('UTF-8');
  const [sampleRawText, setSampleRawText] = useState<string>(SAMPLE_FILE_FOR_INFERENCE);
  const [sampleFieldOverrides, setSampleFieldOverrides] = useState<
    Record<string, { name: string; dataType: DataContractField['dataType'] }>
  >({});

  // Action 4: Define structure manually
  const [manualStructCode, setManualStructCode] = useState('FUENTE-CLI-MANUAL-01');
  const [manualStructName, setManualStructName] = useState('Estructura Manual Registrada por Usuario');
  const [manualFields, setManualFields] = useState<DataContractField[]>([
    {
      name: 'id_obligacion',
      label: 'Identificador de Obligación',
      dataType: 'Texto',
      length: 12,
      nullable: false,
      lineage: 'MANUAL_CLIENTE.DETALLE.ID_OBLIGACION',
      sampleValues: ['000123'],
      sectionName: 'Detalle',
      propertyOrigin: 'Declarada oficialmente',
    },
    {
      name: 'valor_operacion',
      label: 'Valor de la Operación',
      dataType: 'Decimal',
      length: 18,
      precision: 18,
      scale: 2,
      nullable: true,
      lineage: 'MANUAL_CLIENTE.DETALLE.VALOR_OPERACION',
      sampleValues: [150000.0],
      sectionName: 'Detalle',
      propertyOrigin: 'Declarada oficialmente',
    },
  ]);

  // Register structure for pending catalog entry modal
  const [pendingCatalogTarget, setPendingCatalogTarget] =
    useState<CatalogSourceFormatEntry | null>(null);

  // Stage 2: Create output fields from source modal
  const [showCreateFieldsFromSourceModal, setShowCreateFieldsFromSourceModal] =
    useState<boolean>(false);
  const [selectedColsToCreate, setSelectedColsToCreate] = useState<Record<string, boolean>>({});

  // Stage 3: Load data batch modal (separate from structure import!)
  const [showLoadDataBatchModal, setShowLoadDataBatchModal] = useState<boolean>(false);
  const [batchInputMode, setBatchInputMode] = useState<'file' | 'paste'>('file');
  const [batchFileInspection, setBatchFileInspection] =
    useState<RawFileInspectionResult | null>(null);
  const [batchTargetContractId, setBatchTargetContractId] = useState<string>(
    activeOutput.dataContractId
  );
  const [newBatchCode, setNewBatchCode] = useState<string>('LOTE-DATOS-202611-NUEVO');
  const [newBatchEntity, setNewBatchEntity] = useState<string>(globalEntity);
  const [newBatchPeriod, setNewBatchPeriod] = useState<string>(globalPeriod);
  const [newBatchCutoffDate, setNewBatchCutoffDate] = useState<string>(
    getCutoffDateForPeriod(globalPeriod)
  );
  const [newBatchOriginKind, setNewBatchOriginKind] = useState<
    SourceExecutionBatch['originKind']
  >('Carga de lote de fuente cliente');
  const [newBatchCsvText, setNewBatchCsvText] = useState<string>(SAMPLE_BATCH_CSV);

  // Stage 4: Mapping table filters & inline structure drawer
  const [mappingFilterMode, setMappingFilterMode] = useState<
    'all' | 'pending' | 'impacted'
  >('all');
  const [mappingSearch, setMappingSearch] = useState<string>('');
  const [showInlineStructureDrawer, setShowInlineStructureDrawer] = useState<boolean>(false);
  const [inspectedContractId, setInspectedContractId] = useState<string>(
    activeOutput.dataContractId
  );

  // New Catalog Entry form state
  const [newCatCountry, setNewCatCountry] = useState<'Colombia' | 'Perú'>('Colombia');
  const [newCatOrganism, setNewCatOrganism] = useState<string>('Supersolidaria');
  const [newCatCode, setNewCatCode] = useState<string>('915');
  const [newCatInternalPeru, setNewCatInternalPeru] = useState<string>('915');
  const [newCatName, setNewCatName] = useState<string>(
    'Reporte de Cartera Microcrédito y Garantías Comunitarias'
  );
  const [newCatAnnexPeru, setNewCatAnnexPeru] = useState<string>('Anexo 15');
  const [newCatPeriodicity, setNewCatPeriodicity] = useState<string>('Mensual');
  const [newCatFamily, setNewCatFamily] = useState<TechnicalFamily>('CSV');
  const [newCatAreaCol, setNewCatAreaCol] = useState<string>('Riesgo de Crédito');
  const [newCatRespCol, setNewCatRespCol] = useState<string>('Analista Regulatorio');

  // Synchronized attachedSources list (always includes primary source at index 0)
  const effectiveAttachedSources: AttachedOutputSource[] = useMemo(() => {
    const existing = activeOutput.attachedSources || [];
    const primaryAlias = 'FUENTE_PRINCIPAL';
    const hasPrimary = existing.some((s) => s.dataContractId === primaryContract.id);
    if (hasPrimary && existing.length > 0) {
      return existing.map((s, i) =>
        i === 0
          ? {
              ...s,
              catalogEntryId: activeCatalogEntry?.id || s.catalogEntryId,
            }
          : s
      );
    }
    const defaultPrimary: AttachedOutputSource = {
      alias: primaryAlias,
      label: activeCatalogEntry?.reportName || primaryContract.name,
      originRoute:
        primaryContract.originRoute ||
        (primaryContract.sourceSystem.includes('Cliente')
          ? 'Fuente proporcionada por el cliente'
          : 'Formato generado por TÓTAL REPORT®'),
      dataContractId: primaryContract.id,
      catalogEntryId: activeCatalogEntry?.id,
      selectedExecutionBatchId: activeOutput.selectedSourceExecutionId,
      targetSection: 'Detalle',
    };
    return [
      defaultPrimary,
      ...existing.filter((s) => s.dataContractId !== primaryContract.id),
    ];
  }, [
    activeOutput.attachedSources,
    activeOutput.selectedSourceExecutionId,
    primaryContract,
    activeCatalogEntry,
  ]);

  // Evaluate multi-source combination
  const multiSourceEvaluation = useMemo(
    () =>
      evaluateMultiSourceCombination({
        primaryContract,
        attachedSources: effectiveAttachedSources,
        allContracts: dataContracts,
        periodo: globalPeriod,
        entidad: globalEntity,
      }),
    [primaryContract, effectiveAttachedSources, dataContracts, globalPeriod, globalEntity]
  );

  // Resolve primary source execution rows (passing sourceCatalogEntryId to disambiguate shared structures!)
  const primaryExecutionResolution = useMemo(
    () =>
      resolveSourceExecutionRows({
        contract: primaryContract,
        periodo: globalPeriod,
        entidad: globalEntity,
        selectedSourceExecutionId: activeOutput.selectedSourceExecutionId,
        sourceCatalogEntryId: activeCatalogEntry?.id,
      }),
    [
      primaryContract,
      globalPeriod,
      globalEntity,
      activeOutput.selectedSourceExecutionId,
      activeCatalogEntry?.id,
    ]
  );

  // Catalog audit summary
  const catalogAudit = useMemo(
    () => auditCatalogImportEntries(catalogSourceFormats),
    [catalogSourceFormats]
  );

  // Unique regulators in catalog
  const availableRegulators = useMemo(() => {
    const set = new Set<string>();
    catalogSourceFormats.forEach((e) => {
      if (catCountryFilter === 'Todos' || e.country === catCountryFilter) {
        set.add(e.regulatorOrOrganism);
      }
    });
    return Array.from(set);
  }, [catalogSourceFormats, catCountryFilter]);

  // Filtered catalog entries for Route A
  const filteredCatalogEntries = useMemo(() => {
    return catalogSourceFormats.filter((entry) => {
      if (catCountryFilter !== 'Todos' && entry.country !== catCountryFilter) return false;
      if (catRegulatorFilter !== 'Todos' && entry.regulatorOrOrganism !== catRegulatorFilter)
        return false;
      if (
        catPeriodicityFilter !== 'Todas' &&
        entry.periodicity.toLowerCase() !== catPeriodicityFilter.toLowerCase()
      )
        return false;
      if (catStatusFilter === 'Con estructura disponible') {
        if (!entry.linkedDataContractId) return false;
      } else if (catStatusFilter === 'Formato registrado; estructura pendiente') {
        if (entry.linkedDataContractId) return false;
      } else if (catStatusFilter === 'Con observaciones de catálogo') {
        if (!entry.catalogAnomalies || entry.catalogAnomalies.length === 0) return false;
      }

      if (catSearchQuery.trim()) {
        const q = catSearchQuery.toLowerCase().trim();
        const hay = [
          entry.id,
          entry.formatCode,
          entry.internalNumberPeru,
          entry.reportName,
          entry.annexOrFormLabelPeru,
          entry.regulatorOrOrganism,
          entry.areaColombia,
          entry.responsibleColombia,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    catalogSourceFormats,
    catCountryFilter,
    catRegulatorFilter,
    catPeriodicityFilter,
    catStatusFilter,
    catSearchQuery,
  ]);

  // Inferred structure from sample text (Action 2 in Route B)
  const liveSampleInference = useMemo(
    () =>
      inferSourceStructureFromSampleText({
        rawText: sampleRawText,
        delimiter: sampleDelimiter,
        headerRowIndex: sampleHeaderRow,
        sectionName: sampleSectionName,
      }),
    [sampleRawText, sampleDelimiter, sampleHeaderRow, sampleSectionName]
  );

  // Universal file reader for .xlsx, .xls, .csv, .txt, .json
  const inspectUploadedFile = async (
    file: File,
    preferredEncoding: 'UTF-8' | 'ISO-8859-1' = 'UTF-8'
  ): Promise<{ inspection: RawFileInspectionResult; rawTextFallback: string }> => {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const buf = await file.arrayBuffer();
      const inspection = parseExcelArrayBuffer(buf, file.name, file.size);
      const activeSheet =
        inspection.sheets.find((s) => s.name === inspection.selectedSheet) ||
        inspection.sheets[0];
      const csvFallback = activeSheet
        ? activeSheet.rows.map((r) => r.join(';')).join('\n')
        : '';
      return { inspection, rawTextFallback: csvFallback };
    }
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No fue posible leer el archivo'));
      reader.readAsText(file, preferredEncoding);
    });
    const inspection = parseDelimitedTextToInspection(
      text,
      file.name,
      file.size,
      preferredEncoding,
      'Auto'
    );
    return { inspection, rawTextFallback: text };
  };

  // Select a DataContract as Primary Source (with impact check and exact catalogEntryId disambiguation)
  const handleSelectPrimaryContract = (
    contract: DataContract,
    catalogEntryId?: string
  ) => {
    if (isImmutable) {
      notify(
        'warning',
        `La salida ${activeOutput.code} (v${activeOutput.version}) está ${activeOutput.status}. Cree una nueva revisión en borrador para cambiar su fuente vinculada.`
      );
      return;
    }
    const impact = analyzeSourceStructureUpdateImpact({
      fields: activeOutput.fields,
      updatedContract: contract,
      previousContractId: activeOutput.dataContractId,
    });

    const catEntry = catalogEntryId
      ? catalogSourceFormats.find((e) => e.id === catalogEntryId)
      : undefined;

    // Look for a batch compatible with current globalPeriod, globalEntity, and catalogEntryId
    const batches = contract.executionBatches || [];
    const compatibleBatch = batches.find(
      (b) =>
        b.cutoffPeriod === globalPeriod &&
        b.entityScope.toLowerCase() === globalEntity.toLowerCase() &&
        (!catalogEntryId || !b.sourceCatalogEntryId || b.sourceCatalogEntryId === catalogEntryId)
    );
    const chosenBatchId = compatibleBatch?.id || batches[0]?.id;

    const nextPrimarySource: AttachedOutputSource = {
      alias: 'FUENTE_PRINCIPAL',
      label: catEntry?.reportName || contract.name,
      originRoute:
        contract.originRoute ||
        (contract.sourceSystem.includes('Cliente')
          ? 'Fuente proporcionada por el cliente'
          : 'Formato generado por TÓTAL REPORT®'),
      dataContractId: contract.id,
      catalogEntryId,
      selectedExecutionBatchId: chosenBatchId,
      targetSection: 'Detalle',
    };

    const otherSources = effectiveAttachedSources
      .slice(1)
      .filter((s) => s.dataContractId !== contract.id);

    onUpdateOutput((prev) => ({
      ...prev,
      dataContractId: contract.id,
      sourceCatalogEntryId: catalogEntryId,
      selectedSourceExecutionId: chosenBatchId,
      attachedSources: [nextPrimarySource, ...otherSources],
      fields: impact.updatedFields,
    }));

    setInspectedContractId(contract.id);
    setBatchTargetContractId(contract.id);

    if (impact.impactedCount > 0) {
      notify(
        'warning',
        `Fuente principal cambiada a "${catEntry?.reportName || contract.name}": ${impact.impactedCount} campo(s) requieren revisión por cambio en fuente y ${impact.preservedCount} mapeo(s) compatibles se conservaron.`
      );
    } else {
      notify(
        'success',
        `Fuente principal establecida: "${catEntry?.reportName || contract.name}" (${contract.code} · ${contract.fields.length} campos).`
      );
    }
  };

  // Attach a secondary source for multi-source configuration
  const handleAttachSecondarySource = (
    contract: DataContract,
    defaultSection: AttachedOutputSource['targetSection'] = 'Detalle',
    catalogEntryId?: string
  ) => {
    if (isImmutable) return;
    if (effectiveAttachedSources.some((s) => s.dataContractId === contract.id)) {
      notify('info', `La fuente "${contract.name}" ya está vinculada a esta salida.`);
      return;
    }

    const cleanSuffix = contract.code
      .replace(/[^A-Z0-9]/gi, '_')
      .toUpperCase()
      .slice(0, 14);
    const alias = `FUENTE_${cleanSuffix}`;

    const sharedKey = primaryContract.fields.find((pf) =>
      contract.fields.some((sf) => sf.name === pf.name)
    )?.name;

    const isSeparateSection =
      defaultSection === 'Cabecera' ||
      defaultSection === 'Cierre / Totales' ||
      (contract.availableSections?.some((sec) => sec.toLowerCase().includes('cabecera')) ?? false);

    const targetSec: AttachedOutputSource['targetSection'] = isSeparateSection
      ? 'Cabecera'
      : defaultSection;

    const newSecSource: AttachedOutputSource = {
      alias,
      label: contract.name,
      originRoute:
        contract.originRoute ||
        (contract.sourceSystem.includes('Cliente')
          ? 'Fuente proporcionada por el cliente'
          : 'Formato generado por TÓTAL REPORT®'),
      dataContractId: contract.id,
      catalogEntryId,
      selectedExecutionBatchId: contract.executionBatches?.[0]?.id,
      targetSection: targetSec,
      combinationRule: {
        joinWithAlias: 'FUENTE_PRINCIPAL',
        leftKeyField: targetSec === 'Detalle' ? sharedKey || '' : '',
        rightKeyField: targetSec === 'Detalle' ? sharedKey || '' : '',
        relationType:
          targetSec === 'Detalle'
            ? '1:1 Exacta por clave única'
            : 'Sin unión (Secciones separadas)',
      },
    };

    onUpdateOutput((prev) => ({
      ...prev,
      attachedSources: [...effectiveAttachedSources, newSecSource],
    }));

    notify(
      'success',
      `Fuente adicional "${alias}" (${contract.name}) agregada para la sección "${targetSec}".`
    );
  };

  const handleRemoveSecondarySource = (alias: string) => {
    if (isImmutable) return;
    const removed = effectiveAttachedSources.find((s) => s.alias === alias);
    const nextSources = effectiveAttachedSources.filter((s) => s.alias !== alias);
    onUpdateOutput((prev) => ({
      ...prev,
      attachedSources: nextSources,
      fields: prev.fields.map((f) =>
        removed && f.mapping.sourceContractId === removed.dataContractId
          ? {
              ...f,
              mapping: {
                ...f.mapping,
                sourceContractId: prev.dataContractId,
                sourceAlias: 'FUENTE_PRINCIPAL',
                mappingStatus: 'Requiere revisión por cambio en fuente',
                changeImpactNote: `La fuente secundaria "${alias}" fue desvinculada de la salida.`,
              },
            }
          : f
      ),
    }));
  };

  const handleUpdateSecondarySource = (
    alias: string,
    patch: Partial<AttachedOutputSource>
  ) => {
    if (isImmutable) return;
    onUpdateOutput((prev) => ({
      ...prev,
      attachedSources: effectiveAttachedSources.map((s) =>
        s.alias === alias ? { ...s, ...patch } : s
      ),
    }));
  };

  // Download structure template CSV
  const handleDownloadStructureTemplate = () => {
    const blob = new Blob([SAMPLE_STRUCTURE_TEMPLATE_CSV], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_estructura_fuente_total_report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify(
      'info',
      'Plantilla CSV de estructura descargada (nombre_campo;etiqueta_funcional;tipo_dato;longitud;obligatorio;seccion).'
    );
  };

  // Download structure template XLSX
  const handleDownloadStructureTemplateXlsx = () => {
    const buf = buildStructureTemplateWorkbookBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_estructura_fuente_total_report.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('info', 'Plantilla Excel (.xlsx) de estructura descargada.');
  };

  // Complete Action 1: Register structure from template or uploaded file (0 fictitious data rows!)
  const handleRegisterImportedTemplateStructure = (linkToOutput = true) => {
    let matrixRows: string[][] = [];
    let sourceFileName = 'plantilla_pegada.csv';

    if (importStructInputMode === 'file' && importStructFileInspection) {
      const sheet =
        importStructFileInspection.sheets.find(
          (s) => s.name === importStructFileInspection.selectedSheet
        ) || importStructFileInspection.sheets[0];
      matrixRows = sheet?.rows || [];
      sourceFileName = importStructFileInspection.fileName;
    } else {
      const parsed = parseDelimitedTextToInspection(
        importStructText,
        'plantilla_estructura.csv',
        importStructText.length,
        'UTF-8',
        'Auto'
      );
      matrixRows = parsed.sheets[0]?.rows || [];
    }

    const parsedResult = parseStructureDefinitionMatrix({
      rows: matrixRows,
      headerRowIndex1Based: 1,
      defaultSection: importStructSection || 'Detalle',
      fileName: sourceFileName,
    });

    setLastStructureLoadReport(parsedResult.report);

    if (parsedResult.fields.length === 0) {
      notify(
        'error',
        `No fue posible registrar la estructura: ${parsedResult.report.rejections[0]?.reason || '0 campos válidos'}.`
      );
      return;
    }

    const newContract: DataContract = {
      id: `DC-CLI-TPL-${Date.now().toString(36).toUpperCase()}`,
      code: importStructCode.trim() || 'FUENTE-CLI-PLANTILLA',
      name: importStructName.trim() || 'Estructura Importada desde Plantilla',
      version: 'v1.0',
      sourceSystem: 'Fuente Externa Registrada por el Cliente',
      originRoute: 'Fuente proporcionada por el cliente',
      jurisdiction: activeOutput.jurisdiction,
      regulatorOrReceiver: `Fuente Externa (${sourceFileName})`,
      periodicity: 'Mensual',
      structureAvailability: 'Estructura disponible',
      structureEvidenceKind: 'Estructura declarada por plantilla/esquema',
      availableSections: Array.from(
        new Set(parsedResult.fields.map((f) => f.sectionName || 'Detalle'))
      ),
      granularity:
        'Definida por plantilla estructural del cliente (0 filas de datos; sin lote cargado aún)',
      primaryKey: [parsedResult.fields[0]?.name || 'id'],
      snapshotId: 'ESTRUCTURA-DECLARADA-SIN-LOTE',
      fields: parsedResult.fields,
      // Crucial rule: Importing a structure NEVER creates fictitious data rows!
      demoRows: [],
      executionBatches: [],
    };

    onSaveDataContract(newContract);
    if (linkToOutput && !isImmutable) {
      handleSelectPrimaryContract(newContract);
      setActiveClientAction(null);
      setActiveSubstage('2-estructura');
    } else {
      notify(
        'success',
        `Estructura "${newContract.name}" (${newContract.fields.length} campos, 0 filas de datos) guardada en el repositorio sin alterar la salida publicada.`
      );
    }
  };

  // Complete Action 2: Register structure inferred from sample file (0 fictitious data rows in contract!)
  const handleConfirmSampleInferredStructure = (linkToOutput = true) => {
    if (liveSampleInference.inferredFields.length === 0) {
      notify('error', 'No se detectaron columnas en el archivo de muestra.');
      return;
    }

    const confirmedFields: DataContractField[] = liveSampleInference.inferredFields.map((f) => {
      const override = sampleFieldOverrides[f.name];
      return {
        ...f,
        name: override?.name?.trim() || f.name,
        label: override?.name?.trim() || f.label,
        dataType: override?.dataType || f.dataType,
        propertyOrigin: 'Inferida de muestra (Requiere confirmación)',
      };
    });

    const newContract: DataContract = {
      id: `DC-CLI-SMP-${Date.now().toString(36).toUpperCase()}`,
      code: sampleStructCode.trim() || 'FUENTE-CLI-MUESTRA',
      name: sampleStructName.trim() || 'Estructura Inferida de Muestra del Cliente',
      version: 'v1.0',
      sourceSystem: 'Fuente Externa Registrada por el Cliente',
      originRoute: 'Fuente proporcionada por el cliente',
      jurisdiction: activeOutput.jurisdiction,
      regulatorOrReceiver: `Fuente Externa (${sampleLoadedFileName || sampleEncoding})`,
      periodicity: 'Mensual',
      structureAvailability: 'Estructura disponible',
      structureEvidenceKind: 'Estructura inferida de archivo de ejemplo',
      availableSections: [sampleSectionName || 'Detalle'],
      granularity:
        'Estructura inferida de archivo de muestra (obligatoriedad, llaves y longitudes máximas sujetas a confirmación; 0 filas de datos registradas)',
      primaryKey: [],
      snapshotId: 'ESTRUCTURA-MUESTRA-SIN-LOTE',
      fields: confirmedFields,
      // Do NOT create fictitious execution batches when only inferring structure
      demoRows: [],
      executionBatches: [],
    };

    onSaveDataContract(newContract);
    if (linkToOutput && !isImmutable) {
      handleSelectPrimaryContract(newContract);
      setActiveClientAction(null);
      setActiveSubstage('2-estructura');
    } else {
      notify(
        'success',
        `Estructura inferida "${newContract.name}" (${newContract.fields.length} campos, 0 filas de datos) guardada en el repositorio sin alterar la salida publicada.`
      );
    }
  };

  // Complete Action 4: Register manual structure
  const handleSaveManualStructure = (linkToOutput = true) => {
    if (manualFields.length === 0) {
      notify('error', 'Agregue al menos un campo a la estructura manual.');
      return;
    }
    const newContract: DataContract = {
      id: `DC-CLI-MAN-${Date.now().toString(36).toUpperCase()}`,
      code: manualStructCode.trim() || 'FUENTE-CLI-MANUAL',
      name: manualStructName.trim() || 'Estructura Manual del Cliente',
      version: 'v1.0',
      sourceSystem: 'Fuente Externa Registrada por el Cliente',
      originRoute: 'Fuente proporcionada por el cliente',
      jurisdiction: activeOutput.jurisdiction,
      regulatorOrReceiver: 'Definición Manual del Cliente',
      periodicity: 'Mensual',
      structureAvailability: 'Estructura disponible',
      structureEvidenceKind: 'Estructura declarada por plantilla/esquema',
      availableSections: Array.from(new Set(manualFields.map((f) => f.sectionName || 'Detalle'))),
      granularity: 'Estructura definida manualmente por el usuario (sin lote de datos cargado)',
      primaryKey: [manualFields[0].name],
      snapshotId: 'ESTRUCTURA-MANUAL-SIN-LOTE',
      fields: manualFields,
      demoRows: [],
      executionBatches: [],
    };

    onSaveDataContract(newContract);
    if (linkToOutput && !isImmutable) {
      handleSelectPrimaryContract(newContract);
      setActiveClientAction(null);
      setActiveSubstage('2-estructura');
    } else {
      notify(
        'success',
        `Estructura manual "${newContract.name}" guardada en el repositorio sin alterar la salida publicada.`
      );
    }
  };

  // Register synthetic or template structure for a catalog entry that was in "Formato registrado; estructura pendiente"
  const handleRegisterStructureForPendingCatalog = (entry: CatalogSourceFormatEntry) => {
    const newContractId = `DC-CAT-${entry.country.slice(0, 2).toUpperCase()}-${entry.formatCode || 'PEND'}-${Date.now()
      .toString(36)
      .slice(-3)
      .toUpperCase()}`;
    const synthFields: DataContractField[] = [
      {
        name: 'fecha_corte',
        label: 'Fecha de Corte del Reporte',
        dataType: 'Fecha',
        length: 10,
        formatMask: 'yyyy-MM-dd',
        nullable: false,
        lineage: `SYNTH_${entry.formatCode || 'FMT'}.FECHA_CORTE`,
        sampleValues: ['2026-11-30'],
        sectionName: 'Detalle',
        propertyOrigin: 'Datos sintéticos de prueba',
      },
      {
        name: 'id_registro',
        label: 'Identificador de Registro (Con ceros a la izquierda)',
        dataType: 'Texto',
        length: 12,
        nullable: false,
        lineage: `SYNTH_${entry.formatCode || 'FMT'}.ID_REGISTRO`,
        sampleValues: ['000101', '000102'],
        sectionName: 'Detalle',
        propertyOrigin: 'Datos sintéticos de prueba',
        formatWarning: 'Identificador alfanumérico/numérico preservado como Texto.',
      },
      {
        name: 'concepto_reportado',
        label: 'Concepto o Cuenta del Formato',
        dataType: 'Catálogo',
        length: 10,
        nullable: false,
        lineage: `SYNTH_${entry.formatCode || 'FMT'}.CONCEPTO`,
        sampleValues: ['CONC-01', 'CONC-02'],
        sectionName: 'Detalle',
        propertyOrigin: 'Datos sintéticos de prueba',
      },
      {
        name: 'valor_reportado',
        label: 'Importe o Saldo Reportado',
        dataType: 'Decimal',
        length: 18,
        precision: 18,
        scale: 2,
        nullable: false,
        lineage: `SYNTH_${entry.formatCode || 'FMT'}.VALOR`,
        sampleValues: [125000.5, 84300.0],
        sectionName: 'Detalle',
        propertyOrigin: 'Datos sintéticos de prueba',
      },
    ];

    const newContract: DataContract = {
      id: newContractId,
      code: `FMT-${entry.country.slice(0, 2).toUpperCase()}-${entry.formatCode || 'SIN-COD'}`,
      name: `${entry.reportName} (${entry.regulatorOrOrganism})`,
      version: 'v1.0-sintetica',
      sourceSystem: 'TÓTAL REPORT® — Núcleo de Preparación',
      originRoute: 'Formato generado por TÓTAL REPORT®',
      jurisdiction: entry.country,
      regulatorOrReceiver: entry.regulatorOrOrganism,
      periodicity: entry.periodicity,
      structureAvailability: 'Estructura disponible',
      structureEvidenceKind: 'Datos sintéticos de prueba',
      availableSections: ['Detalle'],
      granularity:
        'Estructura sintética de prueba registrada por el usuario para habilitar diseño (0 lotes de datos cargados)',
      primaryKey: ['id_registro'],
      snapshotId: 'ESTRUCTURA-SINTETICA-SIN-LOTE',
      fields: synthFields,
      demoRows: [],
      executionBatches: [],
    };

    onRegisterStructureForCatalogEntry(entry.id, newContract);
    setPendingCatalogTarget(null);
  };

  // Stage 2: Simulate / Apply source structure version update to test impact detection
  const handleSimulateSourceStructureUpdate = () => {
    const currentMinor = parseInt(primaryContract.version.split('.')[1] || '0', 10) + 1;
    const nextVersion = `v1.${currentMinor}`;

    const mappedField = activeOutput.fields.find(
      (f) =>
        f.mapping.transformationKind === 'Directo' &&
        Boolean(f.mapping.sourceField) &&
        (!f.mapping.sourceContractId || f.mapping.sourceContractId === primaryContract.id)
    );
    const targetColName = mappedField?.mapping.sourceField || primaryContract.fields[0]?.name;

    const updatedFields: DataContractField[] = primaryContract.fields.map((col) => {
      if (col.name === targetColName) {
        return {
          ...col,
          name: `${col.name}_v2`,
          label: `${col.label} (Renombrado en ${nextVersion})`,
        };
      }
      return col;
    });

    const updatedContract: DataContract = {
      ...primaryContract,
      version: nextVersion,
      fields: updatedFields,
    };

    onSaveDataContract(updatedContract, activeOutput.id);
  };

  // Stage 2: Create output fields from source columns (without overwriting existing fields!)
  const handleCreateOutputFieldsFromSource = () => {
    if (isImmutable) return;
    const existingTechNames = new Set(
      activeOutput.fields.map((f) => f.technicalName.toLowerCase())
    );
    const colsToAdd = primaryContract.fields.filter(
      (col) =>
        selectedColsToCreate[col.name] && !existingTechNames.has(col.name.toLowerCase())
    );

    if (colsToAdd.length === 0) {
      notify(
        'info',
        'Seleccione al menos un campo de la fuente que no exista aún en la estructura de salida.'
      );
      return;
    }

    const baseOrder = activeOutput.fields.length;
    const createdFields: StructureField[] = colsToAdd.map((col, idx) => ({
      id: `FLD-FROM-SRC-${Date.now().toString(36).toUpperCase()}-${idx}`,
      order: baseOrder + idx + 1,
      technicalName: col.name,
      label: col.label || col.name,
      recordSection: 'Detalle',
      dataType: col.dataType,
      physicalType:
        col.dataType === 'Decimal'
          ? 'BigDecimal'
          : col.dataType === 'Entero'
          ? 'Long'
          : col.dataType === 'Fecha'
          ? 'LocalDate'
          : col.dataType === 'Booleano'
          ? 'Boolean'
          : 'String',
      length: col.length || 20,
      lengthUnit: 'Caracteres',
      precision: col.precision,
      scale: col.scale,
      alignment: col.dataType === 'Decimal' || col.dataType === 'Entero' ? 'Derecha' : 'Izquierda',
      paddingChar: 'Ninguno',
      overflowRule: 'Bloquear con error',
      formatMask: col.formatMask || (col.dataType === 'Fecha' ? 'yyyy-MM-dd' : ''),
      required: !col.nullable,
      nullable: col.nullable,
      defaultValue: '',
      protectionClass: 'Parametrizable',
      description: `Creado opcionalmente desde la fuente ${primaryContract.code} (${col.lineage})`,
      evidenceState:
        col.propertyOrigin === 'Inferida de muestra (Requiere confirmación)'
          ? 'Requiere confirmación'
          : 'Sustento explícito',
      evidenceSourceRef: `${primaryContract.code} (${primaryContract.version})`,
      mapping: {
        transformationKind: 'Directo',
        sourceContractId: primaryContract.id,
        sourceAlias: 'FUENTE_PRINCIPAL',
        sourceField: col.name,
        expression: col.name,
        isParameterizedPoint: false,
        emptyTreatment: !col.nullable ? 'Error bloqueante' : 'Nulo explícito',
        mappingStatus: 'Confirmado por usuario',
      },
    }));

    onUpdateOutput((prev) => ({
      ...prev,
      fields: [...prev.fields, ...createdFields],
    }));
    setShowCreateFieldsFromSourceModal(false);
    notify(
      'success',
      `Se agregaron ${createdFields.length} campo(s) nuevos a la salida desde "${primaryContract.code}" sin sobrescribir los campos existentes.`
    );
  };

  // Stage 3: Load data batch for a registered source (using parseAndValidateDataBatchMatrix!)
  const handleLoadDataBatchSubmit = () => {
    const targetContract =
      dataContracts.find((c) => c.id === batchTargetContractId) || primaryContract;

    let matrixRows: string[][] = [];
    let sourceFileName = 'lote_manual.csv';

    if (batchInputMode === 'file' && batchFileInspection) {
      const sheet =
        batchFileInspection.sheets.find(
          (s) => s.name === batchFileInspection.selectedSheet
        ) || batchFileInspection.sheets[0];
      matrixRows = sheet?.rows || [];
      sourceFileName = batchFileInspection.fileName;
    } else {
      const parsed = parseDelimitedTextToInspection(
        newBatchCsvText,
        'lote_pegado.csv',
        newBatchCsvText.length,
        'UTF-8',
        'Auto'
      );
      matrixRows = parsed.sheets[0]?.rows || [];
    }

    const batchValidation = parseAndValidateDataBatchMatrix({
      rows: matrixRows,
      headerRowIndex1Based: 1,
      contract: targetContract,
      fileName: sourceFileName,
    });

    if (batchValidation.acceptedRows.length === 0) {
      notify(
        'error',
        `El lote fue rechazado (0 filas aceptadas, ${batchValidation.report.rejectedRows} rechazadas): ${batchValidation.report.rejections[0]?.reason || 'Verifique las columnas requeridas'}.`
      );
      return;
    }

    const periodClean = newBatchPeriod.trim() || globalPeriod;
    const cutoffDateClean =
      newBatchCutoffDate.trim() || getCutoffDateForPeriod(periodClean);

    const newBatch: SourceExecutionBatch = {
      id: `EXEC-BATCH-${Date.now().toString(36).toUpperCase()}`,
      executionCode:
        newBatchCode.trim() || `LOTE-${periodClean}-${Date.now().toString().slice(-3)}`,
      entityScope: newBatchEntity.trim() || globalEntity,
      cutoffPeriod: periodClean,
      cutoffDate: cutoffDateClean,
      sourceCatalogEntryId:
        targetContract.id === primaryContract.id ? activeCatalogEntry?.id : undefined,
      sourceStructureVersion: targetContract.version,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      originKind: newBatchOriginKind,
      validationStatus:
        batchValidation.report.rejectedRows > 0
          ? 'Con advertencias no bloqueantes'
          : 'Validado y conforme',
      recordCount: batchValidation.acceptedRows.length,
      rows: batchValidation.acceptedRows,
      loadReport: batchValidation.report,
    };

    onAddExecutionBatchToContract(targetContract.id, newBatch);

    // If this is the primary contract, pin this newly loaded batch on the draft output if editable
    if (!isImmutable && targetContract.id === primaryContract.id) {
      onUpdateOutput((prev) => ({
        ...prev,
        selectedSourceExecutionId: newBatch.id,
      }));
    }

    setShowLoadDataBatchModal(false);
  };

  // Explicit synthetic demo batch generator (clearly separated from real batches!)
  const handleGenerateExplicitSyntheticBatch = () => {
    const cutoffDate = getCutoffDateForPeriod(globalPeriod);
    const synthRow: Record<string, string | number | null> = {};
    primaryContract.fields.forEach((f) => {
      if (f.name === 'fecha_corte' || f.dataType === 'Fecha') {
        synthRow[f.name] = cutoffDate;
      } else if (f.dataType === 'Decimal') {
        synthRow[f.name] = 125000.5;
      } else if (f.dataType === 'Entero') {
        synthRow[f.name] = 1;
      } else {
        synthRow[f.name] = String(f.sampleValues?.[0] ?? '000999');
      }
    });

    const synthBatch: SourceExecutionBatch = {
      id: `EXEC-SYNTH-${globalPeriod}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
      executionCode: `LOTE-SINTETICO-DEMO-${globalPeriod.replace(/[^A-Z0-9]/gi, '')}`,
      entityScope: globalEntity,
      cutoffPeriod: globalPeriod,
      cutoffDate,
      sourceCatalogEntryId: activeCatalogEntry?.id,
      sourceStructureVersion: primaryContract.version,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      originKind: 'Generación sintética explícita de demostración',
      validationStatus: 'Validado y conforme',
      recordCount: 1,
      rows: [synthRow],
    };

    onAddExecutionBatchToContract(primaryContract.id, synthBatch);
    if (!isImmutable) {
      onUpdateOutput((prev) => ({
        ...prev,
        selectedSourceExecutionId: synthBatch.id,
      }));
    }
    notify(
      'info',
      `Lote sintético de demostración "${synthBatch.executionCode}" generado explícitamente para ${globalEntity} · ${globalPeriod} (${cutoffDate}).`
    );
  };

  // Generate a 152-row .xlsx workbook in memory (Row 1 title, Row 2 headers) to test and prove 152-row Excel import
  const handleLoad152RowsExcelVerificationWorkbook = () => {
    const rows: (string | number)[][] = [
      ['LISTADO DE FORMATOS REGULATORIOS TÓTAL REPORT® — MATRIZ DE CONCILIACIÓN (152 FORMATOS)'],
      [
        'ENTIDAD',
        'CODIGO FORMATO',
        'NOMBRE FORMATO',
        'PERIODICIDAD',
        'FUENTES',
        'AREA',
        'RESPONSABLE',
      ],
    ];

    // First include existing Colombia catalog entries
    const colEntries = catalogSourceFormats.filter((e) => e.country === 'Colombia');
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

    // Pad up to 152 data rows (Rows 3..154) with realistic Colombia regulator formats (SFC, Supersolidaria, DIAN, SHD, BanRep)
    const regulators = ['SFC', 'Supersolidaria', 'DIAN', 'SHD Bogotá', 'Banco de la República'];
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
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const inspection = parseExcelArrayBuffer(
      buf,
      'Listado_de_Formatos_Prueba_152_Filas.xlsx',
      buf.byteLength
    );
    setCatalogFileInspection(inspection);
    setCatalogSelectedSheet(inspection.selectedSheet);
    setCatalogHeaderRow(inspection.detectedHeaderRowIndex);
    setCatalogDefaultCountry('Colombia');

    const activeSheet = inspection.sheets[0];
    const parsed = parseCatalogMatrix(
      activeSheet ? activeSheet.rows : [],
      inspection.detectedHeaderRowIndex,
      'Colombia',
      'Listado_de_Formatos_Prueba_152_Filas.xlsx'
    );
    const impact = evaluateCatalogImportImpact(
      catalogSourceFormats,
      parsed.entries
    );
    setCatalogImportPreview({
      entries: parsed.entries,
      totalRead: parsed.totalRowsRead,
      rejected: parsed.rejectedRows.length,
      anomalies: parsed.anomalies,
      impactSummary: {
        newCount: impact.newEntries.length,
        updatedCount: impact.updatedEntries.length,
        unchangedCount: impact.unchangedEntries.length,
      },
    });
  };

  const handleConfirmCatalogImport = () => {
    if (!catalogImportPreview || catalogImportPreview.entries.length === 0) return;
    const mode = catalogImportMode === 'solo_nuevos' ? 'append' : 'reconcile';
    onImportCatalogEntriesBatch(catalogImportPreview.entries, mode);
    notify(
      'success',
      `Catálogo actualizado: ${catalogImportPreview.impactSummary.newCount} nuevos, ${catalogImportPreview.impactSummary.updatedCount} actualizados. Se preservaron los vínculos de salidas publicadas.`
    );
    setShowImportCatalogModal(false);
  };

  // Stage 4: Filtered fields for the 7-column mapping table
  const filteredMappingFields = useMemo(() => {
    return activeOutput.fields.filter((f) => {
      const isMapped =
        Boolean(f.mapping.sourceField) ||
        f.mapping.transformationKind === 'Constante' ||
        f.mapping.transformationKind === 'Variable de contexto' ||
        f.mapping.transformationKind === 'Concatenación tipada' ||
        f.mapping.transformationKind === 'Expresión declarativa';

      if (mappingFilterMode === 'pending') {
        const isPendingOrUnconfirmed =
          !isMapped ||
          f.mapping.mappingStatus === 'Sin asignar' ||
          f.mapping.mappingStatus === 'Propuesta automática (Requiere confirmación)' ||
          f.mapping.mappingStatus === 'Requiere revisión por cambio en fuente';
        if (!isPendingOrUnconfirmed) return false;
      } else if (mappingFilterMode === 'impacted') {
        if (f.mapping.mappingStatus !== 'Requiere revisión por cambio en fuente') return false;
      }

      if (mappingSearch.trim()) {
        const q = mappingSearch.toLowerCase().trim();
        const hay = `${f.technicalName} ${f.label} ${f.mapping.sourceField} ${f.recordSection}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeOutput.fields, mappingFilterMode, mappingSearch]);

  // Compute mapping stats
  const mappingStats = useMemo(() => {
    let confirmed = 0;
    let proposed = 0;
    let impacted = 0;
    let unassigned = 0;

    activeOutput.fields.forEach((f) => {
      const hasSource =
        Boolean(f.mapping.sourceField) ||
        f.mapping.transformationKind === 'Constante' ||
        f.mapping.transformationKind === 'Variable de contexto' ||
        f.mapping.transformationKind === 'Concatenación tipada' ||
        f.mapping.transformationKind === 'Expresión declarativa';

      if (f.mapping.mappingStatus === 'Requiere revisión por cambio en fuente') {
        impacted++;
      } else if (f.mapping.mappingStatus === 'Propuesta automática (Requiere confirmación)') {
        proposed++;
      } else if (hasSource) {
        confirmed++;
      } else {
        unassigned++;
      }
    });

    return {
      total: activeOutput.fields.length,
      confirmed,
      proposed,
      impacted,
      unassigned,
    };
  }, [activeOutput.fields]);

  const inspectedContract =
    dataContracts.find((c) => c.id === inspectedContractId) || primaryContract;

  const totalCatalogPages = Math.max(
    1,
    Math.ceil(filteredCatalogEntries.length / catPageSize)
  );
  const currentCatalogPage = Math.min(catPage, totalCatalogPages);
  const paginatedCatalogEntries = filteredCatalogEntries.slice(
    (currentCatalogPage - 1) * catPageSize,
    currentCatalogPage * catPageSize
  );

  return (
    <div className="space-y-4">
      {/* 0. Barra persistente de identificación inequívoca del origen (5 eslabones) */}
      <div className="bg-[#0F1F38] text-white rounded-xl border border-slate-800 p-3.5 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/30 text-blue-200 font-bold text-[10px] uppercase tracking-wider">
              Cadena de Trazabilidad del Origen Activo
            </span>
            <span className="text-slate-300 text-[11px]">
              Diferencia informe de origen, estructura, entidad, periodo solicitado y lote/ejecución
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isImmutable && (
              <button
                type="button"
                onClick={onRequestCreateRevision}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold cursor-pointer"
              >
                Crear nueva revisión en borrador para editar vínculos
              </button>
            )}
            <button
              type="button"
              onClick={() => onGoToStep(4)}
              className="px-3 py-1 rounded bg-[#1E4E8C] hover:bg-blue-700 border border-blue-400/30 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              Ir al Paso 4: Reglas y validaciones
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 5 Eslabones: Informe de origen → Estructura/versión → Entidad cliente → Periodo → Lote/ejecución */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          <div className="p-2 rounded bg-[#172B4D] border border-slate-700">
            <div className="text-[10px] uppercase text-blue-200 font-semibold">
              1. Informe de origen
            </div>
            <div className="font-bold text-white truncate mt-0.5">
              {activeCatalogEntry
                ? `${activeCatalogEntry.country} · ${activeCatalogEntry.regulatorOrOrganism} · ${
                    activeCatalogEntry.internalNumberPeru ||
                    activeCatalogEntry.formatCode ||
                    'S/C'
                  }`
                : primaryContract.originRoute === 'Fuente proporcionada por el cliente'
                ? `Fuente Cliente · ${primaryContract.code}`
                : primaryContract.name}
            </div>
            <div className="text-[10px] text-slate-300 truncate">
              {activeCatalogEntry ? activeCatalogEntry.reportName : primaryContract.sourceSystem}
            </div>
          </div>

          <div className="p-2 rounded bg-[#172B4D] border border-slate-700">
            <div className="text-[10px] uppercase text-blue-200 font-semibold">
              2. Estructura / versión
            </div>
            <div className="font-mono font-bold text-white truncate mt-0.5">
              {primaryContract.code} ({primaryContract.version})
            </div>
            <div className="text-[10px] text-slate-300 truncate">
              {primaryContract.fields.length} campos · ID: {primaryContract.id}
            </div>
          </div>

          <div className="p-2 rounded bg-[#172B4D] border border-slate-700">
            <div className="text-[10px] uppercase text-blue-200 font-semibold">
              3. Entidad cliente
            </div>
            <div className="font-bold text-white truncate mt-0.5">{globalEntity}</div>
            <div className="text-[10px] text-slate-300 truncate">
              Receptor: {activeCatalogEntry?.regulatorOrOrganism || primaryContract.regulatorOrReceiver}
            </div>
          </div>

          <div className="p-2 rounded bg-[#172B4D] border border-slate-700">
            <div className="text-[10px] uppercase text-blue-200 font-semibold">
              4. Periodo solicitado
            </div>
            <div className="font-mono font-bold text-white truncate mt-0.5">
              {globalPeriod} (Corte {getCutoffDateForPeriod(globalPeriod)})
            </div>
            <div className="text-[10px] text-slate-300 truncate">
              Periodicidad fuente: {activeCatalogEntry?.periodicity || primaryContract.periodicity || 'Mensual'}
            </div>
          </div>

          <div
            className={`p-2 rounded border ${
              primaryExecutionResolution.hasDataBatch
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-100'
                : 'bg-rose-950/90 border-rose-500/60 text-rose-100'
            }`}
          >
            <div className="text-[10px] uppercase font-semibold opacity-90">
              5. Lote / ejecución
            </div>
            <div className="font-mono font-bold truncate mt-0.5">
              {primaryExecutionResolution.hasDataBatch && primaryExecutionResolution.resolvedBatch
                ? `${primaryExecutionResolution.resolvedBatch.executionCode} (${primaryExecutionResolution.resolvedBatch.cutoffPeriod})`
                : 'Sin lote compatible'}
            </div>
            <div className="text-[10px] truncate opacity-90">
              {primaryExecutionResolution.hasDataBatch && primaryExecutionResolution.resolvedBatch
                ? `Corte lote: ${
                    primaryExecutionResolution.resolvedBatch.cutoffDate ||
                    getCutoffDateForPeriod(primaryExecutionResolution.resolvedBatch.cutoffPeriod)
                  } · ${primaryExecutionResolution.rows.length} fila(s)`
                : 'No hay un lote compatible para la entidad y el periodo seleccionados'}
            </div>
          </div>
        </div>
      </div>

      {/* Alerta inmediata si el periodo/entidad global no tiene lote compatible */}
      {!primaryExecutionResolution.hasDataBatch && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 max-w-4xl">
            <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">
                No hay un lote compatible para la entidad y el periodo seleccionados ({globalEntity} · {globalPeriod})
              </div>
              <p className="text-rose-900 mt-0.5">
                {primaryExecutionResolution.compatibilityDetail}
                {primaryExecutionResolution.incompatiblePinnedBatch && (
                  <>
                    {' '}
                    La referencia histórica{' '}
                    <code className="font-mono font-bold">
                      {primaryExecutionResolution.incompatiblePinnedBatch.executionCode}
                    </code>{' '}
                    conserva intacto su periodo original (
                    <code className="font-mono font-bold">
                      {primaryExecutionResolution.incompatiblePinnedBatch.cutoffPeriod}
                    </code>
                    , fecha de corte{' '}
                    <code className="font-mono font-bold">
                      {primaryExecutionResolution.incompatiblePinnedBatch.cutoffDate ||
                        getCutoffDateForPeriod(
                          primaryExecutionResolution.incompatiblePinnedBatch.cutoffPeriod
                        )}
                    </code>
                    ) y <strong>no se reutiliza silenciosamente</strong> ni altera sus fechas para el nuevo corte. Puede continuar el diseño y guardar borrador, pero la conformidad de datos y la generación operativa quedan bloqueadas hasta seleccionar o cargar un lote compatible.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubstage('3-datos')}
              className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-900 text-white font-bold cursor-pointer"
            >
              Ver lotes / Cargar lote compatible
            </button>
          </div>
        </div>
      )}

      {/* 1. Marco funcional del proceso TÓTAL REPORT® y separación conceptual */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                PASO 3 DE 7
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Origen de datos y correspondencia de campos
              </h3>
              <HelpTooltip
                title="Separación funcional en TÓTAL REPORT®"
                description="Un formato generado en datos por TÓTAL REPORT® puede alimentar una salida sin volver a construir sus cálculos. El formato que aporta información de entrada no tiene que coincidir con el formato regulatorio al que se asociará la entrega en la pantalla D."
                example="Ejemplo: El Formato 239 o el informe de Cartera aporta los datos ya calculados; la salida los transforma en archivo CSV, TXT o XML."
              />
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Elija la fuente de información, revise su estructura, identifique el lote de datos para{' '}
              <strong className="text-slate-900">{globalEntity}</strong> en el corte{' '}
              <strong className="text-slate-900">{globalPeriod}</strong> y asigne cada campo al archivo de salida.
            </p>
          </div>

          {/* Resumen de los 5 estados separados del proceso */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
              1. Catálogo: {catalogAudit.totalEntries} formatos
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold">
              2. Estructura activa: {primaryContract.code} ({primaryContract.fields.length} campos)
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg border font-semibold ${
                primaryExecutionResolution.hasDataBatch
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              3. Datos ({globalPeriod}):{' '}
              {primaryExecutionResolution.hasDataBatch
                ? `${primaryExecutionResolution.rows.length} fila(s) disponibles`
                : 'Sin lote compatible para el periodo'}
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg border font-semibold ${
                mappingStats.unassigned === 0 && mappingStats.impacted === 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              4. Mapeo: {mappingStats.confirmed}/{mappingStats.total} confirmados
            </span>
          </div>
        </div>

        {/* Barra de navegación visual de las 5 subetapas del Paso 3 */}
        <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2">
          {[
            {
              id: '1-origen' as const,
              num: '1',
              title: 'Elegir origen',
              subtitle:
                effectiveAttachedSources.length > 1
                  ? `${effectiveAttachedSources.length} fuentes vinculadas`
                  : primaryContract.originRoute === 'Fuente proporcionada por el cliente'
                  ? 'Ruta B · Fuente cliente'
                  : 'Ruta A · Formato sistema',
              badgeColor: 'bg-indigo-600 text-white',
            },
            {
              id: '2-estructura' as const,
              num: '2',
              title: 'Revisar estructura',
              subtitle: `${primaryContract.fields.length} campos · ${primaryContract.version}`,
              badgeColor: 'bg-slate-800 text-white',
            },
            {
              id: '3-datos' as const,
              num: '3',
              title: 'Identificar datos disponibles',
              subtitle: primaryExecutionResolution.hasDataBatch
                ? `Lote ${primaryExecutionResolution.resolvedBatch?.executionCode || primaryContract.snapshotId}`
                : 'Sin lote compatible',
              badgeColor: primaryExecutionResolution.hasDataBatch
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white',
            },
            {
              id: '4-mapeo' as const,
              num: '4',
              title: 'Asignar campos',
              subtitle:
                mappingStats.impacted > 0
                  ? `${mappingStats.impacted} por cambio en fuente`
                  : mappingStats.unassigned > 0 || mappingStats.proposed > 0
                  ? `${mappingStats.unassigned + mappingStats.proposed} pendientes`
                  : `${mappingStats.confirmed} asignados`,
              badgeColor:
                mappingStats.impacted > 0
                  ? 'bg-red-600 text-white'
                  : mappingStats.unassigned > 0 || mappingStats.proposed > 0
                  ? 'bg-amber-600 text-white'
                  : 'bg-emerald-600 text-white',
            },
            {
              id: '5-resultado' as const,
              num: '5',
              title: 'Revisar resultado',
              subtitle: 'Estado integral de origen',
              badgeColor: 'bg-slate-700 text-white',
            },
          ].map((stage) => {
            const isCurrent = activeSubstage === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveSubstage(stage.id)}
                className={`text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                    isCurrent ? 'bg-indigo-600 text-white' : stage.badgeColor
                  }`}
                >
                  {stage.num}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{stage.title}</div>
                  <div className="text-[11px] text-slate-600 truncate">{stage.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          SUBETAPA 1: ELEGIR ORIGEN (RUTA A vs RUTA B + GESTIÓN MULTIFUENTE)
         ===================================================================== */}
      {activeSubstage === '1-origen' && (
        <div className="space-y-4">
          {/* Dos alternativas principales claramente explicadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tarjeta Ruta A */}
            <div
              onClick={() => setSelectedOriginRoute('Formato generado por TÓTAL REPORT®')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedOriginRoute('Formato generado por TÓTAL REPORT®');
                }
              }}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedOriginRoute === 'Formato generado por TÓTAL REPORT®'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    A
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      A. Usar un formato generado por TÓTAL REPORT®
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      “Seleccione un informe del sistema y utilice su estructura y sus datos para configurar la salida”.
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                    selectedOriginRoute === 'Formato generado por TÓTAL REPORT®'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {selectedOriginRoute === 'Formato generado por TÓTAL REPORT®'
                    ? 'Ruta activa'
                    : 'Elegir Ruta A'}
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                <span>
                  Incluye catálogos de <strong>Colombia</strong> (SFC, Supersolidaria, DIAN, SHD) y{' '}
                  <strong>Perú</strong> (SBS / BCRP).
                </span>
                <span className="font-semibold text-indigo-700">
                  Reutiliza cálculos ya generados →
                </span>
              </div>
            </div>

            {/* Tarjeta Ruta B */}
            <div
              onClick={() => setSelectedOriginRoute('Fuente proporcionada por el cliente')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedOriginRoute('Fuente proporcionada por el cliente');
                }
              }}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedOriginRoute === 'Fuente proporcionada por el cliente'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    B
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      B. Usar fuentes proporcionadas por el cliente
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      “Importe o registre la estructura de una fuente externa y asigne sus campos a la salida”.
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                    selectedOriginRoute === 'Fuente proporcionada por el cliente'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {selectedOriginRoute === 'Fuente proporcionada por el cliente'
                    ? 'Ruta activa'
                    : 'Elegir Ruta B'}
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                <span>
                  4 opciones: Importar plantilla/esquema, Obtener desde muestra, Seleccionar registrada o Definir manualmente.
                </span>
                <span className="font-semibold text-emerald-700">
                  Separa estructura de lote de datos →
                </span>
              </div>
            </div>
          </div>

          {/* CONTENIDO DE RUTA A: FORMATOS GENERADOS POR EL SISTEMA Y CATÁLOGOS COLOMBIA / PERÚ */}
          {selectedOriginRoute === 'Formato generado por TÓTAL REPORT®' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
              {/* Selector de modo en Ruta A: Informes con datos (Prioritario) vs Catálogo de referencia (Administrativo) */}
              <div className="flex border-b border-slate-200 gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => setRouteAMode('disponibles')}
                  className={`py-2 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
                    routeAMode === 'disponibles'
                      ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Database className="w-4 h-4 text-indigo-600" />
                  Informes del sistema ({reportsWithStructureCount})
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      reportsWithDataCount > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {reportsWithDataCount > 0
                      ? `${reportsWithDataCount} con datos para ${globalPeriod}`
                      : `0 con datos para ${globalPeriod}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRouteAMode('catalogo_referencia')}
                  className={`py-2 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
                    routeAMode === 'catalogo_referencia'
                      ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-4 h-4 text-slate-500" />
                  Catálogo normativo de referencia ({catalogSourceFormats.length} formatos)
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                    Informativo / Consultivo
                  </span>
                </button>
              </div>

              {/* VISTA 1: INFORMES DEL SISTEMA DISPONIBLES CON DATOS (PRIORITARIA) */}
              {routeAMode === 'disponibles' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="font-bold flex items-center gap-1.5 text-slate-900">
                        <CheckCircle2 className="w-4 h-4 text-indigo-700 shrink-0" />
                        Informes del sistema: {reportsWithStructureCount} con estructura disponible · {reportsWithDataCount} con datos para este periodo
                      </div>
                      <p className="mt-0.5 text-slate-700">
                        Todos los {reportsWithStructureCount} informes cuentan con estructura técnica de campos disponible para diseñar y mapear la salida. Para generar el archivo físico operativo se requiere un lote con registros compatibles para <strong>{globalEntity}</strong> y el periodo <strong>{globalPeriod}</strong>.{' '}
                        {reportsWithDataCount === 0 && (
                          <span className="font-semibold text-amber-900">
                            Actualmente ningún informe tiene lote cargado en {globalPeriod}; las estructuras están 100% disponibles para diseñar el formato y cargar los datos después.
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded border shrink-0 ${
                        reportsWithDataCount > 0
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
                          : 'text-amber-900 bg-amber-50 border-amber-300'
                      }`}
                    >
                      {reportsWithDataCount > 0
                        ? `${reportsWithDataCount} informe(s) con datos listos para generar`
                        : `0 con datos · ${reportsWithStructureCount} con estructura para diseñar`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {availableReportsWithData.map(
                      ({ entry, contract, execInfo, isPrimarySelected }) => (
                        <div
                          key={entry.id}
                          className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                            isPrimarySelected
                              ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    entry.country === 'Colombia'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-rose-100 text-rose-900'
                                  }`}
                                >
                                  {entry.country}
                                </span>
                                <span className="text-xs font-bold text-slate-800">
                                  {entry.regulatorOrOrganism}
                                </span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  isPrimarySelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {entry.formatCode
                                  ? `Cód. ${entry.formatCode}`
                                  : entry.internalNumberPeru || contract.code}
                              </span>
                            </div>

                            <div>
                              <h5 className="text-sm font-bold text-slate-900">
                                {entry.reportName}
                              </h5>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {entry.originEvidenceNote || `Estructura base: ${contract.name}`}
                              </p>
                            </div>

                            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1.5 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-600">Campos en estructura:</span>
                                <span className="font-bold text-slate-900">
                                  {contract.fields.length} campos
                                </span>
                              </div>
                              <div
                                className="text-[10px] font-mono text-slate-500 truncate"
                                title={contract.fields.map((f) => f.name).join(', ')}
                              >
                                {contract.fields.slice(0, 4).map((f) => f.name).join(', ')}...
                              </div>
                              <div className="pt-1 border-t border-slate-200 flex items-center justify-between">
                                <span className="text-slate-600">Lote para {globalPeriod}:</span>
                                <span
                                  className={`font-bold ${
                                    execInfo.hasDataBatch ? 'text-emerald-700' : 'text-amber-800'
                                  }`}
                                >
                                  {execInfo.hasDataBatch
                                    ? `✓ ${execInfo.rows.length} registros (${execInfo.resolvedBatch?.executionCode})`
                                    : 'Sin lote en este periodo (Estructura lista)'}
                                </span>
                              </div>
                              {!execInfo.hasDataBatch && (
                                <div className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200/80 rounded px-2 py-1">
                                  Estructura disponible para mapear y diseñar. Para generar archivo físico, cargue un lote en la pestaña inferior.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                            {isPrimarySelected ? (
                              <div className="flex flex-wrap items-center gap-1.5 w-full">
                                <span className="px-2 py-1 rounded bg-indigo-600 text-white text-[11px] font-bold inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Origen seleccionado
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveSubstage('2-estructura')}
                                  className="px-2.5 py-1 rounded border border-indigo-300 bg-white hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold cursor-pointer"
                                >
                                  Ver estructura
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveSubstage('3-datos')}
                                  className="px-2.5 py-1 rounded border border-indigo-300 bg-white hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold cursor-pointer"
                                >
                                  {execInfo.hasDataBatch
                                    ? `Ver datos (${execInfo.rows.length})`
                                    : 'Ver datos (0 reg.)'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveSubstage('4-mapeo')}
                                  className="px-2.5 py-1 rounded bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Mapear campos →
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 w-full">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectPrimaryContract(contract, entry.id);
                                    setActiveSubstage('2-estructura');
                                  }}
                                  className="text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
                                >
                                  Consultar estructura
                                </button>
                                <button
                                  type="button"
                                  disabled={isImmutable}
                                  onClick={() => handleSelectPrimaryContract(contract, entry.id)}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                >
                                  Seleccionar como Origen
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* VISTA 2: CATÁLOGO NORMATIVO DE REFERENCIA (ADMINISTRATIVO / CONSULTIVO) */}
              {routeAMode === 'catalogo_referencia' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <strong>Referencia normativa informativa:</strong> Este catálogo compila los formatos establecidos por los reguladores de Colombia y Perú. Es una referencia consultiva sobre los formatos que pueden existir.{' '}
                        <strong>
                          No es obligatorio importarlo íntegramente ni usarlo como datos para alimentar una salida.
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Database className="w-4 h-4 text-indigo-600" />
                        Catálogo de formatos e informes del sistema (Colombia y Perú)
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        En el catálogo, <strong>Organismo / Entidad reguladora</strong> identifica al ente supervisor o receptor (ej. Supersolidaria, DIAN, SFC, SBS Perú), mientras que la entidad cliente activa es{' '}
                        <strong className="text-slate-900">{globalEntity}</strong>. Dos informes pueden compartir una estructura técnica sin convertirse en el mismo informe ni en el mismo lote.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowImportCatalogModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Importar catálogo (.xlsx / .csv)
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCatalogAuditModal(true)}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        Auditoría y procedencia ({catalogAudit.anomalies.length} obs.)
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewCatalogEntryModal(true)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Registrar formato en catálogo
                      </button>
                    </div>
                  </div>

                  {/* Filtros de búsqueda de Ruta A */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    País / Jurisdicción
                  </label>
                  <select
                    value={catCountryFilter}
                    onChange={(e) => {
                      setCatCountryFilter(e.target.value as 'Todos' | 'Colombia' | 'Perú');
                      setCatRegulatorFilter('Todos');
                      setCatPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Todos">Todos (Colombia y Perú)</option>
                    <option value="Colombia">Colombia (Catálogo Excel)</option>
                    <option value="Perú">Perú (Catálogo SBS/BCRP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Organismo regulador / receptor
                  </label>
                  <select
                    value={catRegulatorFilter}
                    onChange={(e) => {
                      setCatRegulatorFilter(e.target.value);
                      setCatPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Todos">Todos los organismos</option>
                    {availableRegulators.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Periodicidad
                  </label>
                  <select
                    value={catPeriodicityFilter}
                    onChange={(e) => {
                      setCatPeriodicityFilter(e.target.value);
                      setCatPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Todas">Todas</option>
                    <option value="SEMANAL">Semanal</option>
                    <option value="Mensual">Mensual</option>
                    <option value="Bimestral">Bimestral</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="SEMESTRAL">Semestral</option>
                    <option value="ANUAL">Anual</option>
                    <option value="Diaria">Diaria</option>
                    <option value="EXÓGENA">EXÓGENA (Observación literal)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Disponibilidad de estructura
                  </label>
                  <select
                    value={catStatusFilter}
                    onChange={(e) => {
                      setCatStatusFilter(e.target.value);
                      setCatPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Todos">Todos los estados</option>
                    <option value="Con estructura disponible">Con estructura disponible</option>
                    <option value="Formato registrado; estructura pendiente">
                      Formato registrado; estructura pendiente
                    </option>
                    <option value="Con observaciones de catálogo">
                      Con observaciones de catálogo por revisar
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Buscar por código, Nro Interno o nombre
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={catSearchQuery}
                      onChange={(e) => {
                        setCatSearchQuery(e.target.value);
                        setCatPage(1);
                      }}
                      placeholder="Ej. 440, 620, 640, 410, 239, EXOGENA..."
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Tabla de formatos del catálogo Colombia y Perú */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                      <th className="py-2.5 px-3">País / Organismo Receptor</th>
                      <th className="py-2.5 px-3">Código / Identificación</th>
                      <th className="py-2.5 px-3">Nombre del Formato / Informe</th>
                      <th className="py-2.5 px-3">Periodicidad y Procedencia</th>
                      <th className="py-2.5 px-3">Estado de Estructura y Datos ({globalPeriod})</th>
                      <th className="py-2.5 px-3 text-right">Acción de Origen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {paginatedCatalogEntries.map((entry) => {
                      const linkedContract = entry.linkedDataContractId
                        ? dataContracts.find((c) => c.id === entry.linkedDataContractId)
                        : undefined;
                      // Exact catalog entry identity check so two entries sharing a DataContract never highlight simultaneously!
                      const isPrimarySelected = Boolean(
                        linkedContract &&
                          linkedContract.id === primaryContract.id &&
                          (activeCatalogEntry
                            ? activeCatalogEntry.id === entry.id
                            : true)
                      );
                      const execInfo = linkedContract
                        ? resolveSourceExecutionRows({
                            contract: linkedContract,
                            periodo: globalPeriod,
                            entidad: globalEntity,
                            sourceCatalogEntryId: entry.id,
                          })
                        : null;

                      return (
                        <tr
                          key={entry.id}
                          className={`transition-colors ${
                            isPrimarySelected
                              ? 'bg-indigo-50/70'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3 px-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  entry.country === 'Colombia'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-rose-100 text-rose-900'
                                }`}
                              >
                                {entry.country}
                              </span>
                              <span className="font-bold text-slate-900">
                                {entry.regulatorOrOrganism}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              ID Catálogo: {entry.id}
                            </div>
                          </td>

                          <td className="py-3 px-3 align-top">
                            {entry.country === 'Perú' ? (
                              <div className="space-y-0.5">
                                <div className="font-mono font-bold text-slate-900">
                                  Nro Interno: {entry.internalNumberPeru || entry.formatCode}
                                </div>
                                <div className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-semibold">
                                  Informe: {entry.annexOrFormLabelPeru || 'Por confirmar'}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="font-mono font-bold text-slate-900">
                                  {entry.formatCode ? (
                                    `Cód. ${entry.formatCode}`
                                  ) : (
                                    <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                      (Código vacío en Excel)
                                    </span>
                                  )}
                                </div>
                                {entry.suggestedTechnicalFamily && (
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                    Familia sugerida: {entry.suggestedTechnicalFamily}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top max-w-xs">
                            <div className="font-bold text-slate-900">{entry.reportName}</div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {entry.originEvidenceNote}
                            </p>
                            {entry.catalogAnomalies && entry.catalogAnomalies.length > 0 && (
                              <div className="mt-1.5 p-1.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>{entry.catalogAnomalies[0]}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top">
                            <div className="font-semibold text-slate-800">
                              Periodicidad: {entry.periodicity}
                            </div>
                            <div className="mt-1">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  entry.provenanceKind ===
                                    'Importado desde archivo de usuario' ||
                                  entry.provenanceKind ===
                                    'Referencia contrastada (Catálogo suministrado)'
                                    ? 'bg-emerald-100 text-emerald-900'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {entry.provenanceKind || 'Precargado de demostración'}
                              </span>
                            </div>
                            {entry.country === 'Colombia' && (
                              <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                                {entry.sourceDescriptionColombia && (
                                  <div>
                                    <strong>Fuentes (Catálogo):</strong> {entry.sourceDescriptionColombia}
                                  </div>
                                )}
                                {entry.areaColombia && (
                                  <div>
                                    <strong>Área:</strong> {entry.areaColombia} ·{' '}
                                    <strong>Resp.:</strong> {entry.responsibleColombia}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top">
                            {linkedContract ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Estructura ({linkedContract.code} · {linkedContract.fields.length} campos)
                                </span>
                                <div
                                  className={`text-[11px] font-semibold ${
                                    execInfo?.hasDataBatch ? 'text-indigo-700' : 'text-rose-700'
                                  }`}
                                >
                                  {execInfo?.hasDataBatch
                                    ? `Lote compatible (${globalPeriod}): ${execInfo.rows.length} fila(s) (${execInfo.resolvedBatch?.executionCode})`
                                    : `Sin lote compatible para ${globalEntity} · ${globalPeriod}`}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold">
                                  Formato registrado; estructura pendiente
                                </span>
                                <p className="text-[11px] text-slate-500">
                                  Solo existe la ficha del catálogo. El sistema no inventa campos oficiales.
                                </p>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 align-top text-right">
                            {linkedContract ? (
                              <div className="flex flex-col items-end gap-1.5">
                                {isPrimarySelected ? (
                                  <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold">
                                    ✓ Fuente principal activa
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isImmutable}
                                    onClick={() =>
                                      handleSelectPrimaryContract(linkedContract, entry.id)
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    Usar como fuente principal
                                  </button>
                                )}
                                {!isPrimarySelected && (
                                  <button
                                    type="button"
                                    disabled={isImmutable}
                                    onClick={() =>
                                      handleAttachSecondarySource(
                                        linkedContract,
                                        'Detalle',
                                        entry.id
                                      )
                                    }
                                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-[11px] font-semibold cursor-pointer"
                                  >
                                    + Agregar como fuente secundaria
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingCatalogTarget(entry)}
                                className="px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[11px] font-bold cursor-pointer"
                              >
                                Registrar estructura de prueba / plantilla
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación del catálogo para evitar saturación visual */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                <div>
                  Mostrando{' '}
                  <strong>
                    {filteredCatalogEntries.length === 0
                      ? 0
                      : (currentCatalogPage - 1) * catPageSize + 1}
                  </strong>{' '}
                  a{' '}
                  <strong>
                    {Math.min(
                      currentCatalogPage * catPageSize,
                      filteredCatalogEntries.length
                    )}
                  </strong>{' '}
                  de <strong>{filteredCatalogEntries.length}</strong> formatos filtrados (Total en catálogo:{' '}
                  <strong>{catalogSourceFormats.length}</strong>)
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Filas por página del catálogo"
                    value={catPageSize}
                    onChange={(e) => {
                      setCatPageSize(Number(e.target.value));
                      setCatPage(1);
                    }}
                    className="border border-slate-300 rounded px-2 py-1 bg-white text-xs"
                  >
                    <option value={8}>8 por página</option>
                    <option value={20}>20 por página</option>
                    <option value={50}>50 por página</option>
                    <option value={200}>Mostrar todos</option>
                  </select>
                  <button
                    type="button"
                    disabled={currentCatalogPage <= 1}
                    onClick={() => setCatPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 font-semibold cursor-pointer"
                  >
                    Anterior
                  </button>
                  <span className="font-mono font-semibold">
                    Pág. {currentCatalogPage} / {totalCatalogPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentCatalogPage >= totalCatalogPages}
                    onClick={() =>
                      setCatPage((p) => Math.min(totalCatalogPages, p + 1))
                    }
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 font-semibold cursor-pointer"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

          {/* CONTENIDO DE RUTA B: FUENTES PROPORCIONADAS POR EL CLIENTE (4 ACCIONES DIFERENCIADAS) */}
          {selectedOriginRoute === 'Fuente proporcionada por el cliente' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-emerald-600" />
                    Opciones para fuentes proporcionadas por el cliente
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Importar o definir la estructura de una fuente registra sus columnas y tipos, pero{' '}
                    <strong>no crea registros de datos ficticios (0 filas)</strong>. Además, puede{' '}
                    <strong>guardar cualquier fuente en el repositorio</strong> aunque la salida actual esté publicada.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadStructureTemplateXlsx}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar plantilla Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadStructureTemplate}
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar plantilla CSV
                  </button>
                </div>
              </div>

              {/* 4 Tarjetas de acción diferenciadas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    key: 'import-structure' as const,
                    title: '1. Importar estructura de una fuente',
                    desc: 'Seleccione un archivo .xlsx, .csv o .json desde su equipo (o pegue contenido) sin crear datos ficticios.',
                    icon: Upload,
                  },
                  {
                    key: 'infer-from-sample' as const,
                    title: '2. Obtener estructura desde archivo de ejemplo',
                    desc: 'Suba un archivo de muestra (.xlsx/.csv/.txt), preserve ceros a la izquierda ("000123") y confirme tipos.',
                    icon: FileSpreadsheet,
                  },
                  {
                    key: 'select-registered' as const,
                    title: '3. Seleccionar una fuente registrada',
                    desc: 'Reutilice estructuras externas ya registradas por el cliente (Garantías, Cabecera, Portafolio).',
                    icon: Database,
                  },
                  {
                    key: 'define-manual' as const,
                    title: '4. Definir estructura manualmente',
                    desc: 'Declare uno a uno los campos, tipos de dato, longitud, precisión/escala, formato de fecha y obligatoriedad.',
                    icon: Table,
                  },
                ].map((act) => {
                  const Icon = act.icon;
                  const isSelected = activeClientAction === act.key;
                  return (
                    <button
                      key={act.key}
                      type="button"
                      onClick={() =>
                        setActiveClientAction(isSelected ? null : act.key)
                      }
                      className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700">
                            {isSelected ? 'Abierto' : 'Abrir opción →'}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900">{act.title}</div>
                        <p className="text-[11px] text-slate-600 mt-1">{act.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Panel desplegable Opción 1: Importar estructura de una fuente */}
              {activeClientAction === 'import-structure' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-emerald-300 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h5 className="text-xs font-bold text-slate-900">
                      1. Importar definición de estructura desde archivo (.xlsx, .csv, .txt, .json)
                    </h5>
                    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setImportStructInputMode('file')}
                        className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                          importStructInputMode === 'file'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-700'
                        }`}
                      >
                        Seleccionar archivo del equipo
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportStructInputMode('paste')}
                        className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                          importStructInputMode === 'paste'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-700'
                        }`}
                      >
                        Pegar contenido (Secundario)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Código de la estructura
                      </label>
                      <input
                        type="text"
                        value={importStructCode}
                        onChange={(e) => setImportStructCode(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nombre funcional de la fuente
                      </label>
                      <input
                        type="text"
                        value={importStructName}
                        onChange={(e) => setImportStructName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Sección o tabla predeterminada
                      </label>
                      <input
                        type="text"
                        value={importStructSection}
                        onChange={(e) => setImportStructSection(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {importStructInputMode === 'file' ? (
                    <div className="p-3.5 rounded-xl bg-white border border-dashed border-emerald-400 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-900">
                            Seleccionar archivo de estructura (.xlsx, .xls, .csv, .txt, .json)
                          </label>
                          <p className="text-[11px] text-slate-500">
                            Columnas esperadas: nombre_campo, etiqueta_funcional, tipo_dato, longitud, obligatorio, seccion, descripcion
                          </p>
                        </div>
                        <input
                          type="file"
                          aria-label="Archivo de definición de estructura"
                          accept=".xlsx,.xls,.csv,.txt,.json"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const { inspection, rawTextFallback } =
                                await inspectUploadedFile(file);
                              setImportStructFileInspection(inspection);
                              if (rawTextFallback) setImportStructText(rawTextFallback);
                              notify(
                                'info',
                                `Archivo "${file.name}" (${file.size} bytes) leído correctamente.`
                              );
                            } catch (err) {
                              notify('error', `Error al leer el archivo: ${String(err)}`);
                            }
                          }}
                          className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:font-bold hover:file:bg-emerald-700 cursor-pointer"
                        />
                      </div>

                      {importStructFileInspection && (
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              <strong>Archivo:</strong>{' '}
                              <code className="font-mono">
                                {importStructFileInspection.fileName}
                              </code>{' '}
                              ({importStructFileInspection.fileSize} bytes ·{' '}
                              {(importStructFileInspection.fileKind || importStructFileInspection.fileType).toUpperCase()})
                            </span>
                            {importStructFileInspection.sheets.length > 1 && (
                              <select
                                value={importStructFileInspection.selectedSheet}
                                onChange={(e) =>
                                  setImportStructFileInspection({
                                    ...importStructFileInspection,
                                    selectedSheet: e.target.value,
                                  })
                                }
                                className="border border-slate-300 rounded px-2 py-1 bg-white text-xs"
                              >
                                {importStructFileInspection.sheets.map((s) => (
                                  <option key={s.name} value={s.name}>
                                    Hoja: {s.name} ({s.rows.length} filas)
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Definición de columnas (nombre_campo;etiqueta_funcional;tipo_dato;longitud;obligatorio;seccion)
                      </label>
                      <textarea
                        rows={5}
                        value={importStructText}
                        onChange={(e) => setImportStructText(e.target.value)}
                        className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  )}

                  {lastStructureLoadReport && (
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1">
                      <div className="font-bold text-slate-800">
                        Resultado de validación de plantilla ({lastStructureLoadReport.fileName}):{' '}
                        <span className="text-emerald-700">
                          {lastStructureLoadReport.acceptedRows} aceptadas
                        </span>{' '}
                        ·{' '}
                        <span className="text-rose-700">
                          {lastStructureLoadReport.rejectedRows} rechazadas
                        </span>{' '}
                        (Total leídas: {lastStructureLoadReport.totalRowsRead})
                      </div>
                      {lastStructureLoadReport.rejections.map((r, i) => (
                        <div key={i} className="text-[11px] text-rose-800">
                          • Fila {r.rowNumber}: {r.reason}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-slate-600">
                      Al registrar esta plantilla se crean únicamente las definiciones de campos (0 filas de datos).
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRegisterImportedTemplateStructure(false)}
                        className="px-3 py-1.5 rounded-lg border border-emerald-700 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold cursor-pointer"
                      >
                        Guardar fuente en el repositorio (Sin alterar salida)
                      </button>
                      <button
                        type="button"
                        disabled={isImmutable}
                        onClick={() => handleRegisterImportedTemplateStructure(true)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                      >
                        Guardar y vincular a esta salida
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Panel desplegable Opción 2: Obtener estructura desde archivo de ejemplo */}
              {activeClientAction === 'infer-from-sample' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-emerald-300 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">
                        2. Obtener estructura desde un archivo de ejemplo (.xlsx, .csv, .txt)
                      </h5>
                      <p className="text-[11px] text-slate-600">
                        {liveSampleInference.inferenceDisclaimer}
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setSampleInputMode('file')}
                        className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                          sampleInputMode === 'file'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-700'
                        }`}
                      >
                        Seleccionar archivo de muestra
                      </button>
                      <button
                        type="button"
                        onClick={() => setSampleInputMode('paste')}
                        className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                          sampleInputMode === 'paste'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-700'
                        }`}
                      >
                        Pegar muestra (Secundario)
                      </button>
                    </div>
                  </div>

                  {sampleInputMode === 'file' && (
                    <div className="p-3 rounded-xl bg-white border border-dashed border-emerald-400 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-bold text-slate-900">
                          Subir archivo de ejemplo (.xlsx, .xls, .csv, .txt):
                        </span>{' '}
                        <span className="text-slate-600">
                          Preserva ceros a la izquierda (&quot;000123&quot;) como Texto sin reconstruir ceros ya perdidos en origen.
                        </span>
                      </div>
                      <input
                        type="file"
                        aria-label="Archivo de ejemplo para inferir estructura"
                        accept=".xlsx,.xls,.csv,.txt"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const { inspection, rawTextFallback } =
                              await inspectUploadedFile(file, sampleEncoding);
                            setSampleLoadedFileName(file.name);
                            setSampleHeaderRow(inspection.detectedHeaderRowIndex || 1);
                            if (rawTextFallback) {
                              setSampleRawText(rawTextFallback);
                            }
                            notify(
                              'info',
                              `Muestra "${file.name}" cargada para inspección de estructura (0 filas se guardarán como lote).`
                            );
                          } catch (err) {
                            notify('error', `Error al leer muestra: ${String(err)}`);
                          }
                        }}
                        className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:font-bold hover:file:bg-emerald-700 cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Controles de lectura de muestra */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Código de fuente
                      </label>
                      <input
                        type="text"
                        value={sampleStructCode}
                        onChange={(e) => setSampleStructCode(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nombre de la fuente
                      </label>
                      <input
                        type="text"
                        value={sampleStructName}
                        onChange={(e) => setSampleStructName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Fila de encabezado
                      </label>
                      <select
                        value={sampleHeaderRow}
                        onChange={(e) => setSampleHeaderRow(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value={1}>Fila 1 (Primera línea)</option>
                        <option value={2}>Fila 2 (Título en Fila 1)</option>
                        <option value={3}>Fila 3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Delimitador
                      </label>
                      <select
                        value={sampleDelimiter}
                        onChange={(e) =>
                          setSampleDelimiter(
                            e.target.value as 'Auto' | ';' | ',' | '|' | '\t'
                          )
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="Auto">Automático ({liveSampleInference.detectedDelimiter})</option>
                        <option value=";">Punto y coma (;)</option>
                        <option value=",">Coma (,)</option>
                        <option value="|"> Tubería (|)</option>
                        <option value={'\t'}>Tabulador (Tab)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Codificación / Tabla
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          value={sampleEncoding}
                          onChange={(e) =>
                            setSampleEncoding(e.target.value as 'UTF-8' | 'ISO-8859-1')
                          }
                          className="w-1/2 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="UTF-8">UTF-8</option>
                          <option value="ISO-8859-1">ISO-8859-1</option>
                        </select>
                        <input
                          type="text"
                          value={sampleSectionName}
                          onChange={(e) => setSampleSectionName(e.target.value)}
                          placeholder="Hoja/Tabla"
                          className="w-1/2 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Contenido de muestra inspeccionado (Identificadores con ceros a la izquierda &quot;000123&quot;, fechas &quot;04/05/2026&quot; y decimales &quot;1.234,50&quot;)
                    </label>
                    <textarea
                      rows={4}
                      value={sampleRawText}
                      onChange={(e) => setSampleRawText(e.target.value)}
                      className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  {/* Advertencias de ambigüedad detectadas antes de convertir */}
                  {liveSampleInference.ambiguityWarnings.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                      <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                        Advertencias sobre formatos ambiguos y ceros a la izquierda en la muestra:
                      </div>
                      <ul className="list-disc pl-5 text-[11px] text-amber-900 space-y-0.5">
                        {liveSampleInference.ambiguityWarnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tabla de previsualización y confirmación de campos detectados */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                          <th className="py-2 px-3">Nombre detectado (Editable)</th>
                          <th className="py-2 px-3">Tipo inferido (Confirmar)</th>
                          <th className="py-2 px-3">Muestra observada</th>
                          <th className="py-2 px-3">Origen de la propiedad</th>
                          <th className="py-2 px-3">Observación de formato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {liveSampleInference.inferredFields.map((field) => {
                          const override = sampleFieldOverrides[field.name];
                          const currentName = override?.name ?? field.name;
                          const currentType = override?.dataType ?? field.dataType;
                          return (
                            <tr key={field.name}>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={currentName}
                                  onChange={(e) =>
                                    setSampleFieldOverrides((prev) => ({
                                      ...prev,
                                      [field.name]: {
                                        name: e.target.value,
                                        dataType: currentType,
                                      },
                                    }))
                                  }
                                  className="px-2 py-1 text-xs font-mono border border-slate-300 rounded bg-white w-44"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={currentType}
                                  onChange={(e) =>
                                    setSampleFieldOverrides((prev) => ({
                                      ...prev,
                                      [field.name]: {
                                        name: currentName,
                                        dataType: e.target.value as DataContractField['dataType'],
                                      },
                                    }))
                                  }
                                  className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                                >
                                  <option value="Texto">Texto (Preserva ceros iniciales)</option>
                                  <option value="Decimal">Decimal</option>
                                  <option value="Entero">Entero</option>
                                  <option value="Fecha">Fecha</option>
                                  <option value="Catálogo">Catálogo</option>
                                  <option value="Booleano">Booleano</option>
                                </select>
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-700">
                                {field.sampleValues.map(String).join(' | ')}
                              </td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                                  {field.propertyOrigin}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-[11px] text-slate-600">
                                {field.formatWarning || 'Sin ambigüedad detectada'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-600">
                      Al confirmar, se registra únicamente la estructura de campos (0 filas de datos).
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmSampleInferredStructure(false)}
                        className="px-3 py-1.5 rounded-lg border border-emerald-700 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold cursor-pointer"
                      >
                        Guardar fuente en el repositorio (Sin alterar salida)
                      </button>
                      <button
                        type="button"
                        disabled={isImmutable}
                        onClick={() => handleConfirmSampleInferredStructure(true)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                      >
                        Confirmar tipos y vincular a esta salida
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Panel desplegable Opción 3: Seleccionar una fuente registrada del cliente */}
              {(activeClientAction === 'select-registered' || activeClientAction === null) && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-800">
                    Fuentes proporcionadas por el cliente ya registradas en el repositorio:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {dataContracts
                      .filter(
                        (c) =>
                          c.originRoute === 'Fuente proporcionada por el cliente' ||
                          c.sourceSystem.includes('Cliente')
                      )
                      .map((clientContract) => {
                        const isPrimary = clientContract.id === primaryContract.id;
                        const isAttached = effectiveAttachedSources.some(
                          (s) => s.dataContractId === clientContract.id
                        );
                        const batchRes = resolveSourceExecutionRows({
                          contract: clientContract,
                          periodo: globalPeriod,
                          entidad: globalEntity,
                        });
                        return (
                          <div
                            key={clientContract.id}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                              isPrimary
                                ? 'border-emerald-600 bg-emerald-50/40'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] font-bold text-emerald-800">
                                  {clientContract.code}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                  {clientContract.fields.length} campos · {clientContract.version}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-slate-900 mt-1">
                                {clientContract.name}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                Secciones: {(clientContract.availableSections || ['Detalle']).join(', ')}
                              </div>
                              <div
                                className={`text-[11px] font-semibold mt-1.5 ${
                                  batchRes.hasDataBatch ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {batchRes.hasDataBatch
                                  ? `Lote disponible (${globalPeriod}): ${batchRes.rows.length} fila(s)`
                                  : `Solo estructura registrada (0 filas en ${globalPeriod})`}
                              </div>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                              {isPrimary ? (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">
                                  ✓ Fuente principal activa
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isImmutable}
                                  onClick={() => handleSelectPrimaryContract(clientContract)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Usar como principal
                                </button>
                              )}
                              {!isAttached && (
                                <button
                                  type="button"
                                  disabled={isImmutable}
                                  onClick={() => handleAttachSecondarySource(clientContract)}
                                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-[11px] font-semibold cursor-pointer"
                                >
                                  + Vincular como secundaria
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Panel desplegable Opción 4: Definir estructura manualmente (Completa con longitud, precisión, escala, nulos y formato Fecha) */}
              {activeClientAction === 'define-manual' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-emerald-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">
                        4. Definir estructura de fuente manualmente (Propiedades completas por tipo)
                      </h5>
                      <p className="text-[11px] text-slate-600">
                        Configure nombre técnico, etiqueta, tipo de dato, longitud máxima, precisión/escala (Decimal), máscara de fecha (Fecha), obligatoriedad y sección.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setManualFields((prev) => [
                          ...prev,
                          {
                            name: `campo_${prev.length + 1}`,
                            label: `Campo Manual ${prev.length + 1}`,
                            dataType: 'Texto',
                            length: 20,
                            nullable: true,
                            lineage: `MANUAL_CLIENTE.CAMPO_${prev.length + 1}`,
                            sampleValues: [],
                            sectionName: 'Detalle',
                            propertyOrigin: 'Declarada oficialmente',
                          },
                        ])
                      }
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar columna
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Código técnico de la fuente
                      </label>
                      <input
                        type="text"
                        value={manualStructCode}
                        onChange={(e) => setManualStructCode(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nombre funcional de la fuente
                      </label>
                      <input
                        type="text"
                        value={manualStructName}
                        onChange={(e) => setManualStructName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {manualFields.map((mf, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200 text-xs"
                      >
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-500">
                            Nombre técnico
                          </label>
                          <input
                            type="text"
                            value={mf.name}
                            onChange={(e) =>
                              setManualFields((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, name: e.target.value } : item
                                )
                              )
                            }
                            placeholder="nombre_campo"
                            className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-500">
                            Etiqueta funcional
                          </label>
                          <input
                            type="text"
                            value={mf.label}
                            onChange={(e) =>
                              setManualFields((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, label: e.target.value } : item
                                )
                              )
                            }
                            placeholder="Etiqueta"
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-500">
                            Tipo de dato
                          </label>
                          <select
                            value={mf.dataType}
                            onChange={(e) => {
                              const nextType = e.target.value as DataContractField['dataType'];
                              setManualFields((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        dataType: nextType,
                                        length: nextType === 'Fecha' ? 10 : item.length || 20,
                                        precision: nextType === 'Decimal' ? 18 : undefined,
                                        scale: nextType === 'Decimal' ? 2 : undefined,
                                        formatMask:
                                          nextType === 'Fecha'
                                            ? item.formatMask || 'yyyy-MM-dd'
                                            : undefined,
                                      }
                                    : item
                                )
                              );
                            }}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                          >
                            <option value="Texto">Texto</option>
                            <option value="Decimal">Decimal</option>
                            <option value="Entero">Entero</option>
                            <option value="Fecha">Fecha</option>
                            <option value="Catálogo">Catálogo</option>
                            <option value="Booleano">Booleano</option>
                          </select>
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-slate-500">
                            Longitud
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={mf.length}
                            onChange={(e) =>
                              setManualFields((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, length: Math.max(1, Number(e.target.value) || 1) }
                                    : item
                                )
                              )
                            }
                            className="w-full px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          {mf.dataType === 'Decimal' ? (
                            <div className="grid grid-cols-2 gap-1">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500">
                                  Precisión
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={mf.precision ?? 18}
                                  onChange={(e) =>
                                    setManualFields((prev) =>
                                      prev.map((item, i) =>
                                        i === idx
                                          ? { ...item, precision: Number(e.target.value) || 18 }
                                          : item
                                      )
                                    )
                                  }
                                  className="w-full px-1.5 py-1 text-xs font-mono border border-slate-300 rounded"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500">
                                  Escala
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={mf.scale ?? 2}
                                  onChange={(e) =>
                                    setManualFields((prev) =>
                                      prev.map((item, i) =>
                                        i === idx
                                          ? { ...item, scale: Number(e.target.value) || 0 }
                                          : item
                                      )
                                    )
                                  }
                                  className="w-full px-1.5 py-1 text-xs font-mono border border-slate-300 rounded"
                                />
                              </div>
                            </div>
                          ) : mf.dataType === 'Fecha' ? (
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500">
                                Formato fecha
                              </label>
                              <select
                                value={mf.formatMask || 'yyyy-MM-dd'}
                                onChange={(e) =>
                                  setManualFields((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, formatMask: e.target.value } : item
                                    )
                                  )
                                }
                                className="w-full px-1.5 py-1 text-xs font-mono border border-slate-300 rounded bg-white"
                              >
                                <option value="yyyy-MM-dd">yyyy-MM-dd</option>
                                <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                                <option value="dd-MM-yyyy">dd-MM-yyyy</option>
                                <option value="yyyyMMdd">yyyyMMdd</option>
                              </select>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500">
                                Sección
                              </label>
                              <input
                                type="text"
                                value={mf.sectionName || 'Detalle'}
                                onChange={(e) =>
                                  setManualFields((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, sectionName: e.target.value } : item
                                    )
                                  )
                                }
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                              />
                            </div>
                          )}
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-2 pt-3">
                          <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={!mf.nullable}
                              onChange={(e) =>
                                setManualFields((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, nullable: !e.target.checked } : item
                                  )
                                )
                              }
                            />
                            <span>Obligatorio</span>
                          </label>
                        </div>
                        <div className="sm:col-span-1 text-right pt-3">
                          <button
                            type="button"
                            onClick={() =>
                              setManualFields((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded cursor-pointer"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSaveManualStructure(false)}
                      className="px-3 py-1.5 rounded-lg border border-emerald-700 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold cursor-pointer"
                    >
                      Guardar fuente en el repositorio (Sin alterar salida)
                    </button>
                    <button
                      type="button"
                      disabled={isImmutable}
                      onClick={() => handleSaveManualStructure(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                    >
                      Guardar estructura manual y vincular a esta salida
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PANEL DE SOPORTE PARA MÚLTIPLES FUENTES Y REGLAS DE COMBINACIÓN EXPLÍCITAS */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-indigo-600" />
                  Fuentes vinculadas a esta salida y reglas de combinación ({effectiveAttachedSources.length})
                  <HelpTooltip
                    title="Uso de múltiples fuentes sin uniones implícitas"
                    description="Una salida puede alimentarse de más de una fuente. Si cada fuente alimenta una sección diferente (por ejemplo, Cabecera vs. Detalle), no es necesario unir registros. Si dos fuentes alimentan la misma sección (Detalle), debe declarar explícitamente la llave de cruce y el tipo de relación."
                    example="Ejemplo: FUENTE_PRINCIPAL (Cartera) + FUENTE_GARANTIAS cruzadas por id_obligacion = id_obligacion (Relación 1:1 Exacta o Izquierda)."
                  />
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  El sistema prohíbe uniones implícitas. Configure aquí si una fuente secundaria alimenta otra sección o cómo se cruza por llave.
                </p>
              </div>

              {/* Detalle técnico: Contrato de datos acompañado de definición comprensible */}
              <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-2 text-xs">
                <span className="text-slate-600 font-medium">Detalle técnico · Contrato de datos:</span>
                <code className="font-mono font-bold text-indigo-900">{primaryContract.id}</code>
                <HelpTooltip
                  title="¿Qué es el Contrato de datos técnico?"
                  description="Es el identificador técnico interno que respalda la versión exacta de las columnas, tipos de dato y linaje que una fuente (formato del sistema o archivo del cliente) entrega al motor de generación."
                />
              </div>
            </div>

            {/* Tarjetas de fuentes vinculadas */}
            <div className="space-y-3">
              {effectiveAttachedSources.map((src, idx) => {
                const evalItem = multiSourceEvaluation.sourceEvaluations.find(
                  (e) => e.alias === src.alias
                );
                const secContract = dataContracts.find((c) => c.id === src.dataContractId);
                const isPrimary = idx === 0;

                return (
                  <div
                    key={src.alias}
                    className={`p-3.5 rounded-xl border ${
                      isPrimary
                        ? 'border-indigo-200 bg-indigo-50/30'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            isPrimary
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-white'
                          }`}
                        >
                          {src.alias}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{src.label}</span>
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] text-slate-600">
                          {src.originRoute}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {evalItem && (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              evalItem.status === 'Conforme' ||
                              evalItem.status === 'Secciones independientes (Sin cruce de filas)'
                                ? 'bg-emerald-100 text-emerald-900'
                                : evalItem.status === 'Advertencia de cruce'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-red-100 text-red-900'
                            }`}
                          >
                            {evalItem.status}
                          </span>
                        )}
                        {!isPrimary && !isImmutable && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSecondarySource(src.alias)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                            aria-label={`Desvincular fuente ${src.alias}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Configuración de sección y regla de cruce para fuentes secundarias */}
                    {!isPrimary && secContract && (
                      <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Sección destino en la salida
                          </label>
                          <select
                            disabled={isImmutable}
                            value={src.targetSection}
                            onChange={(e) => {
                              const nextSec = e.target
                                .value as AttachedOutputSource['targetSection'];
                              handleUpdateSecondarySource(src.alias, {
                                targetSection: nextSec,
                                combinationRule: {
                                  joinWithAlias: 'FUENTE_PRINCIPAL',
                                  leftKeyField:
                                    nextSec === 'Detalle'
                                      ? src.combinationRule?.leftKeyField || 'id_obligacion'
                                      : '',
                                  rightKeyField:
                                    nextSec === 'Detalle'
                                      ? src.combinationRule?.rightKeyField || 'id_obligacion'
                                      : '',
                                  relationType:
                                    nextSec === 'Detalle'
                                      ? '1:1 Exacta por clave única'
                                      : 'Sin unión (Secciones separadas)',
                                },
                              });
                            }}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          >
                            <option value="Cabecera">Cabecera (Sección independiente)</option>
                            <option value="Detalle">Detalle (Requiere llave de cruce)</option>
                            <option value="Cierre / Totales">
                              Cierre / Totales (Sección independiente)
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Tipo de relación con FUENTE_PRINCIPAL
                          </label>
                          <select
                            disabled={isImmutable}
                            value={
                              src.combinationRule?.relationType ||
                              'Sin unión (Secciones separadas)'
                            }
                            onChange={(e) =>
                              handleUpdateSecondarySource(src.alias, {
                                combinationRule: {
                                  joinWithAlias: 'FUENTE_PRINCIPAL',
                                  leftKeyField: src.combinationRule?.leftKeyField || '',
                                  rightKeyField: src.combinationRule?.rightKeyField || '',
                                  relationType: e.target.value as SourceRelationKind,
                                },
                              })
                            }
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          >
                            <option value="Sin unión (Secciones separadas)">
                              Sin unión (Secciones separadas)
                            </option>
                            <option value="1:1 Exacta por clave única">
                              1:1 Exacta por clave única
                            </option>
                            <option value="Izquierda (Conservar principal sin coincidencia)">
                              Izquierda (Conservar principal sin coincidencia)
                            </option>
                            <option value="1:N Detalle (Advierte multiplicación de filas)">
                              1:N Detalle (Advierte multiplicación de filas)
                            </option>
                            <option value="No soportada (Requiere preparación previa en TÓTAL REPORT®)">
                              No soportada (Bloquea combinación)
                            </option>
                          </select>
                        </div>

                        {src.targetSection === 'Detalle' &&
                          src.combinationRule?.relationType !==
                            'Sin unión (Secciones separadas)' && (
                            <>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Campo llave en FUENTE_PRINCIPAL
                                </label>
                                <select
                                  disabled={isImmutable}
                                  value={src.combinationRule?.leftKeyField || ''}
                                  onChange={(e) =>
                                    handleUpdateSecondarySource(src.alias, {
                                      combinationRule: {
                                        joinWithAlias: 'FUENTE_PRINCIPAL',
                                        relationType:
                                          src.combinationRule?.relationType ||
                                          '1:1 Exacta por clave única',
                                        leftKeyField: e.target.value,
                                        rightKeyField: src.combinationRule?.rightKeyField || '',
                                      },
                                    })
                                  }
                                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                                >
                                  <option value="">-- Seleccione llave primaria --</option>
                                  {primaryContract.fields.map((pf) => (
                                    <option key={pf.name} value={pf.name}>
                                      {pf.name} ({pf.dataType})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Campo llave en {src.alias}
                                </label>
                                <select
                                  disabled={isImmutable}
                                  value={src.combinationRule?.rightKeyField || ''}
                                  onChange={(e) =>
                                    handleUpdateSecondarySource(src.alias, {
                                      combinationRule: {
                                        joinWithAlias: 'FUENTE_PRINCIPAL',
                                        relationType:
                                          src.combinationRule?.relationType ||
                                          '1:1 Exacta por clave única',
                                        leftKeyField: src.combinationRule?.leftKeyField || '',
                                        rightKeyField: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                                >
                                  <option value="">-- Seleccione llave secundaria --</option>
                                  {secContract.fields.map((sf) => (
                                    <option key={sf.name} value={sf.name}>
                                      {sf.name} ({sf.dataType})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </>
                          )}
                      </div>
                    )}

                    {evalItem && (
                      <div className="mt-2 text-[11px] text-slate-600">{evalItem.diagnostic}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Acciones rápidas para agregar fuentes secundarias de demostración */}
            {!isImmutable && (
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Vincular fuente secundaria rápidamente:
                  </span>
                  {dataContracts
                    .filter(
                      (c) =>
                        !effectiveAttachedSources.some((s) => s.dataContractId === c.id)
                    )
                    .slice(0, 3)
                    .map((cand) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => handleAttachSecondarySource(cand)}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3 text-indigo-600" />
                        {cand.code}
                      </button>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubstage('2-estructura')}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  Continuar a 2. Revisar estructura
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBETAPA 2: REVISAR ESTRUCTURA DE LA FUENTE
         ===================================================================== */}
      {activeSubstage === '2-estructura' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Estructura de datos aportada por la fuente seleccionada
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Inspeccione las secciones, campos, tipos y origen de evidencia de la fuente. Importar o consultar la estructura de la fuente no altera ni reemplaza los campos del archivo de salida salvo que usted lo solicite explícitamente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isImmutable && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const initSel: Record<string, boolean> = {};
                      const existingNames = new Set(
                        activeOutput.fields.map((f) => f.technicalName.toLowerCase())
                      );
                      primaryContract.fields.forEach((col) => {
                        if (!existingNames.has(col.name.toLowerCase())) {
                          initSel[col.name] = true;
                        }
                      });
                      setSelectedColsToCreate(initSel);
                      setShowCreateFieldsFromSourceModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Crear campos de salida desde esta fuente (Con vista previa)
                  </button>
                  <button
                    type="button"
                    onClick={handleSimulateSourceStructureUpdate}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Simular actualización de versión de la fuente (Evaluar impacto)
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Selector de fuente vinculada a inspeccionar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Fuente inspeccionada:</span>
              {effectiveAttachedSources.map((s) => {
                const c = dataContracts.find((item) => item.id === s.dataContractId);
                if (!c) return null;
                const active = c.id === inspectedContract.id;
                return (
                  <button
                    key={s.alias}
                    type="button"
                    onClick={() => setInspectedContractId(c.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {s.alias}: {c.code} ({c.version})
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-slate-600">
              <strong>Evidencia estructural:</strong>{' '}
              <span className="font-semibold text-slate-900">
                {inspectedContract.structureEvidenceKind || 'Estructura oficial del sistema'}
              </span>
            </div>
          </div>

          {/* Metadatos de Perú o Colombia si existen en la fuente */}
          {inspectedContract.peruMetadata && (
            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-950 flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong>Metadatos de catálogo Perú (SBS / BCRP):</strong> Nro Interno:{' '}
                <code className="font-mono font-bold">
                  {inspectedContract.peruMetadata.nroInterno}
                </code>{' '}
                | Nombre Informe: <strong>{inspectedContract.peruMetadata.nombreInforme}</strong> |
                Informe: <strong>{inspectedContract.peruMetadata.informe}</strong> | Periodicidad:{' '}
                <strong>{inspectedContract.peruMetadata.periodicidad}</strong>
              </div>
              <span className="px-2 py-0.5 rounded bg-white border border-rose-300 text-[11px] font-bold">
                Campos etiquetados como datos sintéticos de prueba sujetos a confirmación
              </span>
            </div>
          )}

          {/* Tabla de estructura de la fuente */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-3">Sección / Tabla</th>
                  <th className="py-2.5 px-3">Campo de origen</th>
                  <th className="py-2.5 px-3">Etiqueta funcional</th>
                  <th className="py-2.5 px-3">Tipo y longitud</th>
                  <th className="py-2.5 px-3">Admite nulos</th>
                  <th className="py-2.5 px-3">Origen de la propiedad</th>
                  <th className="py-2.5 px-3">Valores de muestra / Linaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inspectedContract.fields.map((col) => (
                  <tr key={col.name} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {col.sectionName || (inspectedContract.availableSections?.[0] ?? 'Detalle')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-900">
                      {col.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 font-medium">{col.label}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                        {col.dataType}
                      </span>{' '}
                      <span className="text-slate-500">
                        (Long. {col.length}
                        {col.precision ? `, Prec. ${col.precision},${col.scale ?? 0}` : ''})
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {col.nullable ? (
                        <span className="text-slate-600">Sí (Opcional en fuente)</span>
                      ) : (
                        <span className="font-bold text-slate-900">No (No nulo declarativo)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          col.propertyOrigin === 'Inferida de muestra (Requiere confirmación)'
                            ? 'bg-amber-100 text-amber-900'
                            : col.propertyOrigin === 'Datos sintéticos de prueba'
                            ? 'bg-purple-100 text-purple-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {col.propertyOrigin || 'Declarada oficialmente'}
                      </span>
                      {col.formatWarning && (
                        <div className="text-[11px] text-amber-800 mt-0.5">
                          ⚠️ {col.formatWarning}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-slate-700">
                        {col.sampleValues && col.sampleValues.length > 0
                          ? col.sampleValues.map(String).join(' | ')
                          : '(Sin muestra)'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{col.lineage}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveSubstage('1-origen')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Volver a 1. Elegir origen
            </button>
            <button
              type="button"
              onClick={() => setActiveSubstage('3-datos')}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              Continuar a 3. Identificar datos disponibles
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBETAPA 3: IDENTIFICAR DATOS DISPONIBLES (LOTES Y EJECUCIONES)
         ===================================================================== */}
      {activeSubstage === '3-datos' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Disponibilidad de datos y selección de ejecución de origen ({globalEntity} · Corte {globalPeriod})
                <HelpTooltip
                  title="Trazabilidad e inmutabilidad del lote de origen"
                  description="Cambiar el selector superior de Entidad o Periodo nunca reescribe la fecha de corte ni los registros de un lote existente. Si el lote fijado pertenece a otro periodo o entidad, se conserva su referencia histórica como no compatible y se bloquea la generación operativa hasta seleccionar o cargar un lote válido."
                />
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Separa los 4 conceptos temporales: (1) Periodo solicitado (<strong>{globalPeriod}</strong>), (2) Periodo y fecha de corte originales del lote, (3) Fecha de ejecución/carga del lote y (4) Fecha de generación del archivo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isImmutable && (
                <button
                  type="button"
                  onClick={handleGenerateExplicitSyntheticBatch}
                  className="px-3 py-1.5 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generar lote sintético de demostración (Explícito)
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setBatchTargetContractId(primaryContract.id);
                  setNewBatchPeriod(globalPeriod);
                  setNewBatchCutoffDate(getPeriodMetadata(globalPeriod).cutoffIso);
                  setNewBatchEntity(globalEntity);
                  setShowLoadDataBatchModal(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Cargar lote de datos (.xlsx / .csv / .txt)
              </button>
            </div>
          </div>

          {/* Aviso explícito cuando NO hay lote compatible para la entidad y el periodo seleccionados */}
          {!primaryExecutionResolution.hasDataBatch && (
            <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3 max-w-3xl">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-950">
                    No hay un lote compatible para la entidad y el periodo seleccionados ({globalEntity} · {globalPeriod})
                  </div>
                  <p className="text-xs text-amber-900 mt-0.5">
                    {primaryExecutionResolution.incompatibilityReason ||
                      `La fuente ${primaryContract.name} (${primaryContract.code}) cuenta con ${primaryContract.fields.length} campos definidos, por lo que puede continuar al paso 4 (Asignar campos) y guardar su diseño en borrador. Sin embargo, se bloquea declarar conformidad sobre datos del periodo y generar el archivo operativo hasta cargar o seleccionar un lote compatible.`}
                  </p>
                  {primaryExecutionResolution.incompatiblePinnedBatch && (
                    <div className="mt-1.5 text-[11px] font-mono bg-white/90 px-2.5 py-1 rounded border border-amber-300 text-amber-950">
                      Referencia histórica conservada sin mutar fecha_corte: Lote{' '}
                      <strong>{primaryExecutionResolution.incompatiblePinnedBatch.executionCode}</strong> · Entidad origen:{' '}
                      <strong>{primaryExecutionResolution.incompatiblePinnedBatch.entityScope}</strong> · Periodo origen:{' '}
                      <strong>{primaryExecutionResolution.incompatiblePinnedBatch.cutoffPeriod}</strong> · Fecha corte original:{' '}
                      <strong>
                        {primaryExecutionResolution.incompatiblePinnedBatch.cutoffDate ||
                          String(primaryExecutionResolution.incompatiblePinnedBatch.rows[0]?.fecha_corte ?? 'N/A')}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setBatchTargetContractId(primaryContract.id);
                    setNewBatchPeriod(globalPeriod);
                    setNewBatchCutoffDate(getPeriodMetadata(globalPeriod).cutoffIso);
                    setNewBatchEntity(globalEntity);
                    setShowLoadDataBatchModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold cursor-pointer"
                >
                  Cargar lote compatible
                </button>
                {!isImmutable && (
                  <button
                    type="button"
                    onClick={handleGenerateExplicitSyntheticBatch}
                    className="px-3 py-1.5 rounded-lg border border-amber-700 bg-white hover:bg-amber-100 text-amber-950 text-xs font-bold cursor-pointer"
                  >
                    Generar lote sintético explícito
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Lista de ejecuciones / lotes disponibles en la fuente primaria */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-800">
                Ejecuciones / lotes registrados en {primaryContract.name} ({primaryContract.code}) — Compatibles en este contexto:{' '}
                <span className="text-indigo-700">{primaryExecutionResolution.compatibleBatches.length}</span> de{' '}
                {(primaryContract.executionBatches || []).length}
              </div>
            </div>

            {(primaryContract.executionBatches || []).length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                No hay lotes de ejecución registrados en esta estructura. Use{' '}
                <strong>"Cargar lote de datos (.xlsx / .csv / .txt)"</strong> o{' '}
                <strong>"Generar lote sintético de demostración (Explícito)"</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(primaryContract.executionBatches || []).map((batch) => {
                  const isCompatibleWithContext = primaryExecutionResolution.compatibleBatches.some(
                    (cb) => cb.id === batch.id
                  );
                  const isActiveResolved =
                    primaryExecutionResolution.resolvedBatch?.id === batch.id;
                  const isHistoricalIncompatiblePinned =
                    primaryExecutionResolution.incompatiblePinnedBatch?.id === batch.id;

                  return (
                    <div
                      key={batch.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                        isActiveResolved
                          ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                          : isHistoricalIncompatiblePinned
                          ? 'border-amber-400 bg-amber-50/40'
                          : isCompatibleWithContext
                          ? 'border-emerald-200 bg-white'
                          : 'border-slate-200 bg-slate-50/70 opacity-85'
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-950">
                            {batch.executionCode}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isCompatibleWithContext
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isCompatibleWithContext
                                ? 'Compatible con contexto activo'
                                : 'Otro periodo / entidad / formato'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                batch.validationStatus === 'Validado y conforme'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {batch.validationStatus}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-700 mt-2 bg-white/80 p-2 rounded-lg border border-slate-200/80">
                          <div>
                            <span className="text-slate-500">Entidad origen:</span>{' '}
                            <strong>{batch.entityScope}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Periodo corte lote:</span>{' '}
                            <strong className="font-mono">{batch.cutoffPeriod}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Fecha corte original:</span>{' '}
                            <strong className="font-mono">
                              {batch.cutoffDate || String(batch.rows[0]?.fecha_corte ?? 'N/A')}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Fecha ejecución/carga:</span>{' '}
                            <strong className="font-mono">{batch.createdAt}</strong>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-600 mt-1.5">
                          <strong>Procedencia:</strong> {batch.originKind} ·{' '}
                          <strong>Registros:</strong> {batch.recordCount} fila(s)
                          {batch.loadReport && (
                            <span>
                              {' '}
                              · Leídas: {batch.loadReport.totalRowsRead} / Aceptadas:{' '}
                              {batch.loadReport.acceptedRows} / Rechazadas:{' '}
                              {batch.loadReport.rejectedRows}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-slate-500">
                          ID: {batch.id}
                        </span>
                        {isActiveResolved ? (
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold">
                            ✓ Lote activo y compatible
                          </span>
                        ) : isHistoricalIncompatiblePinned ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-950 text-[11px] font-bold">
                            ⚠️ Referencia fijada (Incompatible con {globalPeriod} / {globalEntity})
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isImmutable}
                            onClick={() => {
                              onUpdateOutput((prev) => ({
                                ...prev,
                                selectedSourceExecutionId: batch.id,
                              }));
                              notify(
                                isCompatibleWithContext ? 'success' : 'warning',
                                isCompatibleWithContext
                                  ? `Lote "${batch.executionCode}" seleccionado para (${globalEntity} · ${globalPeriod}).`
                                  : `Se fijó la referencia al lote "${batch.executionCode}" (${batch.entityScope} · ${batch.cutoffPeriod}). Como no coincide con el contexto activo (${globalEntity} · ${globalPeriod}), no se reutilizarán sus filas para este corte.`
                              );
                            }}
                            className="px-2.5 py-1 rounded-lg border border-indigo-300 bg-white hover:bg-indigo-50 text-indigo-800 text-[11px] font-bold cursor-pointer"
                          >
                            {isCompatibleWithContext
                              ? 'Seleccionar este lote'
                              : 'Fijar referencia histórica'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vista previa de las primeras filas del lote activo (solo cuando es compatible) */}
          {primaryExecutionResolution.rows.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800">
                Muestra inmutable de registros del lote compatible activo ({primaryExecutionResolution.sourceExecutionSummary}):
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-mono">
                      <th className="py-2 px-3">#</th>
                      {primaryContract.fields.map((f) => (
                        <th key={f.name} className="py-2 px-3">
                          {f.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {primaryExecutionResolution.rows.slice(0, 4).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-500">{idx + 1}</td>
                        {primaryContract.fields.map((f) => (
                          <td key={f.name} className="py-2 px-3 text-slate-800">
                            {String(r[f.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveSubstage('2-estructura')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              ← Volver a 2. Revisar estructura
            </button>
            <button
              type="button"
              onClick={() => setActiveSubstage('4-mapeo')}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              Continuar a 4. Asignar campos ({activeOutput.fields.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBETAPA 4: ASIGNAR CAMPOS (TABLA DE CORRESPONDENCIA DE 7 COLUMNAS)
         ===================================================================== */}
      {activeSubstage === '4-mapeo' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-indigo-600" />
                Tabla de correspondencia de campos (Origen → Salida)
                <HelpTooltip
                  title="Reglas de correspondencia y validación"
                  description="Cada campo de salida indica de qué fuente proviene, qué columna o transformación utiliza y cómo se transforma el valor de entrada en el valor de salida. El sistema nunca asigna columnas al azar cuando no existe coincidencia confiable."
                />
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Verifique el ejemplo de entrada y el ejemplo de salida formateado en vivo para cada campo.
              </p>
            </div>

            {!isImmutable && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const proposalResult = proposeFieldMappings(
                      activeOutput.fields,
                      primaryContract.fields,
                      primaryContract.id,
                      false
                    );
                    onUpdateOutput((prev) => ({
                      ...prev,
                      fields: proposalResult.updatedFields,
                    }));
                    notify(
                      proposalResult.unmatchedCount > 0 ? 'warning' : 'info',
                      `Propuesta automática: ${proposalResult.matchedCount} coincidencia(s) de alta confianza propuesta(s), ${proposalResult.preservedCount} asignación(es) manual(es) conservada(s) y ${proposalResult.unmatchedCount} campo(s) sin coincidencia dejados sin asignar para su revisión.`
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Proponer correspondencias por nombre/tipo compatible
                </button>

                {mappingStats.proposed > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateOutput((prev) => ({
                        ...prev,
                        fields: prev.fields.map((f) =>
                          f.mapping.mappingStatus ===
                          'Propuesta automática (Requiere confirmación)'
                            ? {
                                ...f,
                                mapping: {
                                  ...f.mapping,
                                  mappingStatus: 'Confirmado por usuario',
                                },
                              }
                            : f
                        ),
                      }));
                      notify(
                        'success',
                        'Todas las propuestas automáticas fueron confirmadas por el usuario.'
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirmar propuestas automáticas ({mappingStats.proposed})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setShowInlineStructureDrawer(!showInlineStructureDrawer)
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showInlineStructureDrawer
                    ? 'Ocultar estructura de fuentes'
                    : 'Consultar estructura sin salir'}
                </button>
              </div>
            )}
          </div>

          {/* Alerta si existen campos impactados por actualización de la fuente */}
          {mappingStats.impacted > 0 && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-950">
                  <strong>
                    Atención: {mappingStats.impacted} campo(s) requieren revisión por cambio en la estructura de la fuente.
                  </strong>{' '}
                  Seleccione la nueva columna de origen y confirme el mapeo para levantar el bloqueo.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMappingFilterMode('impacted')}
                className="px-2.5 py-1 rounded-lg bg-red-700 text-white text-xs font-bold"
              >
                Filtrar afectados ({mappingStats.impacted})
              </button>
            </div>
          )}

          {/* Panel rápido para consultar estructura de las fuentes sin salir del mapeo */}
          {showInlineStructureDrawer && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-indigo-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950">
                  Consulta rápida de columnas disponibles en las fuentes vinculadas:
                </span>
                <button
                  type="button"
                  onClick={() => setShowInlineStructureDrawer(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cerrar ✕
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {effectiveAttachedSources.map((src) => {
                  const c = dataContracts.find((item) => item.id === src.dataContractId);
                  if (!c) return null;
                  return (
                    <div
                      key={src.alias}
                      className="p-2.5 rounded-lg bg-white border border-slate-200"
                    >
                      <div className="text-xs font-bold text-slate-900 mb-1">
                        {src.alias} — {c.name} ({c.version})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.fields.map((col) => (
                          <span
                            key={col.name}
                            className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-800"
                          >
                            {col.name}{' '}
                            <span className="text-indigo-700 font-sans font-semibold">
                              ({col.dataType})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Barra de filtros de la tabla de correspondencia */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
              <button
                type="button"
                onClick={() => setMappingFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  mappingFilterMode === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                Todos ({mappingStats.total})
              </button>
              <button
                type="button"
                onClick={() => setMappingFilterMode('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  mappingFilterMode === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                Solo pendientes / por confirmar (
                {mappingStats.unassigned + mappingStats.proposed + mappingStats.impacted})
              </button>
              {mappingStats.impacted > 0 && (
                <button
                  type="button"
                  onClick={() => setMappingFilterMode('impacted')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    mappingFilterMode === 'impacted'
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-red-700 border border-red-200'
                  }`}
                >
                  Con cambio en fuente ({mappingStats.impacted})
                </button>
              )}
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
                placeholder="Filtrar campo de salida u origen..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* TABLA DE 7 COLUMNAS: Campo de salida | Fuente | Campo de origen | Transformación | Ejemplo de entrada | Ejemplo de salida | Estado */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-3">1. Campo de salida</th>
                  <th className="py-2.5 px-3">2. Fuente</th>
                  <th className="py-2.5 px-3">3. Campo de origen</th>
                  <th className="py-2.5 px-3">4. Transformación</th>
                  <th className="py-2.5 px-3">5. Ejemplo de entrada</th>
                  <th className="py-2.5 px-3">6. Ejemplo de salida</th>
                  <th className="py-2.5 px-3">7. Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredMappingFields.map((field) => {
                  const selectedSourceContractId =
                    field.mapping.sourceContractId || primaryContract.id;
                  const fieldSourceContract =
                    dataContracts.find((c) => c.id === selectedSourceContractId) ||
                    primaryContract;
                  const fieldSourceAttach =
                    effectiveAttachedSources.find(
                      (s) => s.dataContractId === fieldSourceContract.id
                    ) || effectiveAttachedSources[0];

                  const sourceRowsResolution = resolveSourceExecutionRows({
                    contract: fieldSourceContract,
                    periodo: globalPeriod,
                    entidad: globalEntity,
                    selectedSourceExecutionId: fieldSourceAttach?.selectedExecutionBatchId,
                  });

                  const sampleRow =
                    sourceRowsResolution.rows[0] ||
                    primaryExecutionResolution.rows[0] ||
                    {};

                  // Compute raw input preview
                  let rawInputExample = '(Sin lote de datos)';
                  if (field.mapping.transformationKind === 'Constante') {
                    rawInputExample = field.mapping.expression || field.defaultValue || '(Vacío)';
                  } else if (field.mapping.transformationKind === 'Variable de contexto') {
                    rawInputExample = field.mapping.expression || 'contexto.fecha_corte';
                  } else if (sourceRowsResolution.hasDataBatch) {
                    if (field.mapping.transformationKind === 'Concatenación tipada') {
                      rawInputExample = `${sampleRow.nombre ?? ''} | ${sampleRow.apellido_1 ?? ''}`;
                    } else if (field.mapping.sourceField) {
                      const v = sampleRow[field.mapping.sourceField];
                      rawInputExample =
                        v !== undefined && v !== null ? String(v) : '(Columna no hallada)';
                    } else {
                      rawInputExample = '(Sin columna asignada)';
                    }
                  }

                  // Compute formatted output example & live validation findings
                  const decSep =
                    activeOutput.composition.decimalSeparator ??
                    activeOutputType.csvParams?.decimalSeparator ??
                    ',';
                  const isFixedTxt =
                    activeOutputType.family === 'TXT' &&
                    (activeOutputType.txtParams?.mode === 'Ancho fijo' ||
                      activeOutput.composition.delimiter === 'Ancho fijo');

                  const liveEval = evaluateAndFormatField(
                    field,
                    sampleRow,
                    0,
                    previewContext,
                    decSep,
                    isFixedTxt
                  );

                  const hasBlockingError = liveEval.findings.some(
                    (f) => f.severity === 'Bloqueante'
                  );
                  const isConfirmed =
                    field.mapping.mappingStatus === 'Confirmado por usuario' ||
                    (!field.mapping.mappingStatus && Boolean(field.mapping.sourceField));
                  const isProposed =
                    field.mapping.mappingStatus ===
                    'Propuesta automática (Requiere confirmación)';
                  const isImpacted =
                    field.mapping.mappingStatus ===
                    'Requiere revisión por cambio en fuente';

                  return (
                    <tr
                      key={field.id}
                      className={`hover:bg-slate-50/80 ${
                        isImpacted
                          ? 'bg-red-50/40'
                          : isProposed
                          ? 'bg-amber-50/30'
                          : ''
                      }`}
                    >
                      {/* Columna 1: Campo de salida */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-mono font-bold text-slate-900">
                          {field.technicalName}
                          {field.required && (
                            <span className="ml-1 text-red-600" title="Campo obligatorio">
                              *
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600">{field.label}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {field.recordSection}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] font-semibold">
                            {field.dataType} ({field.length})
                          </span>
                        </div>
                      </td>

                      {/* Columna 2: Fuente */}
                      <td className="py-2.5 px-3 align-top">
                        <select
                          disabled={isImmutable}
                          value={fieldSourceContract.id}
                          onChange={(e) => {
                            const nextContractId = e.target.value;
                            const nextContract =
                              dataContracts.find((c) => c.id === nextContractId) ||
                              primaryContract;
                            const nextAttach = effectiveAttachedSources.find(
                              (s) => s.dataContractId === nextContractId
                            );
                            const matchingCol =
                              nextContract.fields.find(
                                (col) => col.name === field.mapping.sourceField
                              )?.name ||
                              nextContract.fields[0]?.name ||
                              '';
                            onUpdateOutput((prev) => ({
                              ...prev,
                              fields: prev.fields.map((f) =>
                                f.id === field.id
                                  ? {
                                      ...f,
                                      mapping: {
                                        ...f.mapping,
                                        sourceContractId: nextContractId,
                                        sourceAlias:
                                          nextAttach?.alias || 'FUENTE_PRINCIPAL',
                                        sourceField: matchingCol,
                                        expression: matchingCol,
                                        mappingStatus: 'Confirmado por usuario',
                                        changeImpactNote: undefined,
                                      },
                                    }
                                  : f
                              ),
                            }));
                          }}
                          className="w-40 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-semibold text-slate-800"
                        >
                          {effectiveAttachedSources.map((src) => (
                            <option key={src.alias} value={src.dataContractId}>
                              {src.alias}
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[10rem]">
                          {fieldSourceContract.code}
                        </div>
                      </td>

                      {/* Columna 3: Campo de origen */}
                      <td className="py-2.5 px-3 align-top">
                        {field.mapping.transformationKind === 'Constante' ? (
                          <span className="text-[11px] text-slate-500 italic">
                            (No requiere columna; usa valor fijo)
                          </span>
                        ) : field.mapping.transformationKind === 'Variable de contexto' ? (
                          <select
                            disabled={isImmutable}
                            value={field.mapping.expression || 'contexto.fecha_corte'}
                            onChange={(e) => {
                              const val = e.target.value;
                              onUpdateOutput((prev) => ({
                                ...prev,
                                fields: prev.fields.map((f) =>
                                  f.id === field.id
                                    ? {
                                        ...f,
                                        mapping: {
                                          ...f.mapping,
                                          sourceField: val,
                                          expression: val,
                                          mappingStatus: 'Confirmado por usuario',
                                          changeImpactNote: undefined,
                                        },
                                      }
                                    : f
                                ),
                              }));
                            }}
                            className="w-44 px-2 py-1 text-xs font-mono bg-white border border-slate-300 rounded"
                          >
                            <option value="contexto.fecha_corte">contexto.fecha_corte</option>
                            <option value="contexto.entidad">contexto.entidad</option>
                            <option value="contexto.formato">contexto.formato</option>
                            <option value="contexto.periodo">contexto.periodo</option>
                            <option value="contexto.version">contexto.version</option>
                          </select>
                        ) : (
                          <select
                            disabled={isImmutable}
                            value={field.mapping.sourceField}
                            onChange={(e) => {
                              const colName = e.target.value;
                              onUpdateOutput((prev) => ({
                                ...prev,
                                fields: prev.fields.map((f) =>
                                  f.id === field.id
                                    ? {
                                        ...f,
                                        mapping: {
                                          ...f.mapping,
                                          sourceContractId: fieldSourceContract.id,
                                          sourceField: colName,
                                          expression:
                                            f.mapping.transformationKind === 'Directo'
                                              ? colName
                                              : f.mapping.expression,
                                          mappingStatus: colName
                                            ? 'Confirmado por usuario'
                                            : 'Sin asignar',
                                          changeImpactNote: undefined,
                                        },
                                      }
                                    : f
                                ),
                              }));
                            }}
                            className={`w-48 px-2 py-1 text-xs font-mono bg-white border rounded ${
                              !field.mapping.sourceField || isImpacted
                                ? 'border-amber-400 bg-amber-50/40'
                                : 'border-slate-300'
                            }`}
                          >
                            <option value="">-- Sin asignar --</option>
                            {fieldSourceContract.fields.map((col) => (
                              <option key={col.name} value={col.name}>
                                {col.name} ({col.dataType})
                              </option>
                            ))}
                          </select>
                        )}
                        {isImpacted && field.mapping.changeImpactNote && (
                          <div className="text-[10px] text-red-700 font-semibold mt-1 max-w-[12rem]">
                            ⚠️ {field.mapping.changeImpactNote}
                          </div>
                        )}
                      </td>

                      {/* Columna 4: Transformación */}
                      <td className="py-2.5 px-3 align-top space-y-1">
                        <select
                          disabled={isImmutable}
                          value={field.mapping.transformationKind}
                          onChange={(e) => {
                            const nextKind = e.target.value as TransformationKind;
                            let nextExpr = field.mapping.expression;
                            if (nextKind === 'Concatenación tipada' && !nextExpr.includes('+')) {
                              nextExpr = "nombre + ' ' + apellido_1";
                            } else if (nextKind === 'Máscara fecha/número') {
                              nextExpr = field.formatMask || 'dd-MM-yyyy';
                            } else if (nextKind === 'Variable de contexto') {
                              nextExpr = 'contexto.fecha_corte';
                            } else if (nextKind === 'Expresión declarativa') {
                              nextExpr = `UPPER(${field.mapping.sourceField || 'nombre'})`;
                            }
                            onUpdateOutput((prev) => ({
                              ...prev,
                              fields: prev.fields.map((f) =>
                                f.id === field.id
                                  ? {
                                      ...f,
                                      mapping: {
                                        ...f.mapping,
                                        transformationKind: nextKind,
                                        expression: nextExpr,
                                        mappingStatus: 'Confirmado por usuario',
                                        changeImpactNote: undefined,
                                      },
                                    }
                                  : f
                              ),
                            }));
                          }}
                          className="w-44 px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                        >
                          <option value="Directo">Asignación directa</option>
                          <option value="Máscara fecha/número">Máscara de fecha o número</option>
                          <option value="Concatenación tipada">Unir varios campos (+)</option>
                          <option value="Constante">Valor fijo (constante)</option>
                          <option value="Variable de contexto">Variable de contexto</option>
                          <option value="Expresión declarativa">
                            Expresión declarativa (UPPER/LPAD)
                          </option>
                        </select>

                        {field.mapping.transformationKind !== 'Directo' && (
                          <input
                            type="text"
                            disabled={isImmutable}
                            value={field.mapping.expression}
                            onChange={(e) => {
                              const exprVal = e.target.value;
                              onUpdateOutput((prev) => ({
                                ...prev,
                                fields: prev.fields.map((f) =>
                                  f.id === field.id
                                    ? {
                                        ...f,
                                        mapping: {
                                          ...f.mapping,
                                          expression: exprVal,
                                          mappingStatus: 'Confirmado por usuario',
                                        },
                                      }
                                    : f
                                ),
                              }));
                            }}
                            placeholder="Parámetro o fórmula..."
                            className="w-44 px-2 py-1 text-[11px] font-mono bg-white border border-slate-300 rounded block"
                          />
                        )}
                      </td>

                      {/* Columna 5: Ejemplo de entrada */}
                      <td className="py-2.5 px-3 align-top font-mono text-[11px] text-slate-600">
                        <div className="px-2 py-1 rounded bg-slate-100 border border-slate-200 inline-block max-w-[10rem] truncate">
                          {rawInputExample}
                        </div>
                      </td>

                      {/* Columna 6: Ejemplo de salida */}
                      <td className="py-2.5 px-3 align-top font-mono text-[11px]">
                        <div
                          className={`px-2 py-1 rounded border inline-block max-w-[11rem] truncate font-bold ${
                            hasBlockingError
                              ? 'bg-red-50 border-red-300 text-red-900'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          }`}
                        >
                          {liveEval.formatted || '(Vacío)'}
                        </div>
                        {liveEval.findings.length > 0 && (
                          <div className="text-[10px] text-red-700 font-sans mt-0.5 max-w-[12rem]">
                            {liveEval.findings[0].description}
                          </div>
                        )}
                      </td>

                      {/* Columna 7: Estado */}
                      <td className="py-2.5 px-3 align-top">
                        <div className="flex flex-col items-start gap-1">
                          {isImpacted ? (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-900 text-[10px] font-bold">
                              Requiere revisión por cambio en fuente
                            </span>
                          ) : hasBlockingError ? (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-900 text-[10px] font-bold">
                              Con bloqueo de validación
                            </span>
                          ) : isProposed ? (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                              Propuesta automática (Confirmar)
                            </span>
                          ) : isConfirmed ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                              ✓ Confirmado por usuario
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold">
                              Sin asignar
                            </span>
                          )}

                          {(isProposed || isImpacted) && !isImmutable && (
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateOutput((prev) => ({
                                  ...prev,
                                  fields: prev.fields.map((f) =>
                                    f.id === field.id
                                      ? {
                                          ...f,
                                          mapping: {
                                            ...f.mapping,
                                            mappingStatus: 'Confirmado por usuario',
                                            changeImpactNote: undefined,
                                          },
                                        }
                                      : f
                                  ),
                                }));
                              }}
                              className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold"
                            >
                              Confirmar asignación
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveSubstage('3-datos')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Volver a 3. Identificar datos disponibles
            </button>
            <button
              type="button"
              onClick={() => setActiveSubstage('5-resultado')}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              Continuar a 5. Revisar resultado
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBETAPA 5: REVISAR RESULTADO (MATRIZ DE 5 ESTADOS SEPARADOS)
         ===================================================================== */}
      {activeSubstage === '5-resultado' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              5. Diagnóstico integral del origen de datos y correspondencia de campos
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              El configurador separa claramente cada estado operativo para no confundir el registro de un formato en catálogo con la disponibilidad de estructura o con la existencia de datos del periodo.
            </p>
          </div>

          {/* 5 Tarjetas de estado desacopladas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
              <div className="text-[11px] font-bold text-slate-500 uppercase">
                1. Catálogo registrado
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {primaryContract.originRoute || 'Formato generado por TÓTAL REPORT®'}
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                {primaryContract.regulatorOrReceiver || activeOutput.regulator} ·{' '}
                {primaryContract.jurisdiction || activeOutput.jurisdiction}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
              <div className="text-[11px] font-bold text-emerald-800 uppercase">
                2. Estructura disponible
              </div>
              <div className="text-sm font-bold text-emerald-950 mt-1">
                {primaryContract.code} ({primaryContract.version})
              </div>
              <p className="text-[11px] text-emerald-900 mt-1">
                {primaryContract.fields.length} campos · Evidencia:{' '}
                {primaryContract.structureEvidenceKind || 'Oficial'}
              </p>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${
                primaryExecutionResolution.hasDataBatch
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-amber-200 bg-amber-50/60'
              }`}
            >
              <div
                className={`text-[11px] font-bold uppercase ${
                  primaryExecutionResolution.hasDataBatch
                    ? 'text-emerald-800'
                    : 'text-amber-800'
                }`}
              >
                3. Datos disponibles ({globalPeriod})
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {primaryExecutionResolution.hasDataBatch
                  ? `${primaryExecutionResolution.rows.length} fila(s) en el lote`
                  : 'Sin lote de datos (0 filas)'}
              </div>
              <p className="text-[11px] text-slate-700 mt-1">
                {primaryExecutionResolution.sourceExecutionSummary}
              </p>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${
                mappingStats.unassigned === 0 &&
                mappingStats.proposed === 0 &&
                mappingStats.impacted === 0
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-amber-200 bg-amber-50/60'
              }`}
            >
              <div className="text-[11px] font-bold text-slate-700 uppercase">
                4. Estado de mapeo
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {mappingStats.confirmed} de {mappingStats.total} confirmados
              </div>
              <p className="text-[11px] text-slate-700 mt-1">
                {mappingStats.unassigned} sin asignar · {mappingStats.proposed} propuestos ·{' '}
                {mappingStats.impacted} con cambio en fuente
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50">
              <div className="text-[11px] font-bold text-indigo-800 uppercase">
                5. Combinación de fuentes
              </div>
              <div className="text-sm font-bold text-indigo-950 mt-1">
                {effectiveAttachedSources.length} fuente(s) vinculada(s)
              </div>
              <p className="text-[11px] text-indigo-900 mt-1">
                {multiSourceEvaluation.sourceEvaluations.every(
                  (e) => e.status !== 'Bloqueo de cruce'
                )
                  ? 'Sin cruces implícitos no autorizados'
                  : 'Requiere definir llave de cruce en Detalle'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setActiveSubstage('4-mapeo')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Volver a 4. Asignar campos
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onGoToStep(4)}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                Continuar al Paso 4: Reglas y validaciones
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onGoToStep(6)}
                className="px-3.5 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold"
              >
                Ir a Paso 6: Prueba de generación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: AUDITORÍA DE CATÁLOGOS COLOMBIA (EXCEL) Y PERÚ (IMAGEN)
         ===================================================================== */}
      {showCatalogAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Auditoría de importación de catálogos de formatos (Colombia Excel y Perú Imagen)
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Verifica que los códigos compartidos entre países u organismos no colisionen y señala valores atípicos reales del catálogo sin inventar campos ni suponer valores.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogAuditModal(false)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
              >
                Cerrar ✕
              </button>
            </div>

            {/* Grupos con código compartido (Ej. 410 en DIAN Colombia vs 410 en SBS Perú) */}
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
              <div className="text-xs font-bold text-indigo-950">
                Códigos compartidos entre países u organismos (Sin colisión por clave global):
              </div>
              {catalogAudit.sharedCodeGroups.map((group) => (
                <div
                  key={group.formatCode}
                  className="p-2.5 rounded-lg bg-white border border-indigo-200 text-xs"
                >
                  <div className="font-bold text-slate-900">
                    Código / Nro Interno compartido: <code className="font-mono">{group.formatCode}</code>
                  </div>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[11px] text-slate-700">
                    {group.entries.map((e) => (
                      <li key={e.id}>
                        <strong>{e.country}</strong> · {e.regulatorOrOrganism} — {e.reportName} (ID interno único:{' '}
                        <code className="font-mono font-bold">{e.id}</code>)
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Anomalías detectadas en el catálogo */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900">
                Observaciones detectadas en el inventario para revisión humana ({catalogAudit.anomalies.length}):
              </div>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {catalogAudit.anomalies.map((anom) => (
                  <div key={anom.entryId} className="p-3 text-xs flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900">
                        [{anom.country} · {anom.regulatorOrOrganism}] Cód: {anom.formatCode} — {anom.reportName}
                      </div>
                      <div className="text-amber-800 mt-0.5">⚠️ {anom.issue}</div>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">
                      {anom.entryId}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: REGISTRAR NUEVO FORMATO EN CATÁLOGO (COLOMBIA O PERÚ)
         ===================================================================== */}
      {showNewCatalogEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Registrar formato en el catálogo de orígenes
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Registra la ficha del formato en estado <strong>"Formato registrado; estructura pendiente"</strong> sin inventar campos oficiales.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCatalogEntryModal(false)}
                className="text-xs font-bold text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">País</label>
                <select
                  value={newCatCountry}
                  onChange={(e) => setNewCatCountry(e.target.value as 'Colombia' | 'Perú')}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                >
                  <option value="Colombia">Colombia</option>
                  <option value="Perú">Perú</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Organismo regulador / receptor
                </label>
                <input
                  type="text"
                  value={newCatOrganism}
                  onChange={(e) => setNewCatOrganism(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {newCatCountry === 'Perú' ? 'Nro Interno (Perú)' : 'Código del formato'}
                </label>
                <input
                  type="text"
                  value={newCatCountry === 'Perú' ? newCatInternalPeru : newCatCode}
                  onChange={(e) => {
                    setNewCatCode(e.target.value);
                    setNewCatInternalPeru(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Periodicidad</label>
                <input
                  type="text"
                  value={newCatPeriodicity}
                  onChange={(e) => setNewCatPeriodicity(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Nombre del Formato / Nombre Informe
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>
              {newCatCountry === 'Perú' ? (
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Denominación oficial en columna Informe (Ej. Anexo 2, Forma A, Reporte 1)
                  </label>
                  <input
                    type="text"
                    value={newCatAnnexPeru}
                    onChange={(e) => setNewCatAnnexPeru(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Área (Catálogo)</label>
                    <input
                      type="text"
                      value={newCatAreaCol}
                      onChange={(e) => setNewCatAreaCol(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Responsable (Catálogo)
                    </label>
                    <input
                      type="text"
                      value={newCatRespCol}
                      onChange={(e) => setNewCatRespCol(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Familia técnica sugerida
                </label>
                <select
                  value={newCatFamily}
                  onChange={(e) => setNewCatFamily(e.target.value as TechnicalFamily)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                >
                  <option value="CSV">CSV</option>
                  <option value="TXT">TXT</option>
                  <option value="XML">XML</option>
                  <option value="XBRL">XBRL</option>
                  <option value="AVRO">AVRO</option>
                  <option value="PDF">PDF</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewCatalogEntryModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const newEntry: CatalogSourceFormatEntry = {
                    id: `CAT-${newCatCountry.slice(0, 2).toUpperCase()}-${
                      newCatCode || 'SINCOD'
                    }-${Date.now().toString(36).slice(-3).toUpperCase()}`,
                    country: newCatCountry,
                    regulatorOrOrganism: newCatOrganism,
                    formatCode: newCatCode,
                    internalNumberPeru:
                      newCatCountry === 'Perú' ? newCatInternalPeru : undefined,
                    reportName: newCatName,
                    annexOrFormLabelPeru:
                      newCatCountry === 'Perú' ? newCatAnnexPeru : undefined,
                    periodicity: newCatPeriodicity,
                    areaColombia: newCatCountry === 'Colombia' ? newCatAreaCol : undefined,
                    responsibleColombia:
                      newCatCountry === 'Colombia' ? newCatRespCol : undefined,
                    suggestedTechnicalFamily: newCatFamily,
                    catalogStatus: 'Formato registrado; estructura pendiente',
                    catalogAnomalies: [],
                    originEvidenceNote:
                      'Formato incorporado al catálogo; estructura de campos pendiente de definición.',
                  };
                  onSaveCatalogSourceFormat(newEntry);
                  setShowNewCatalogEntryModal(false);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                Guardar en catálogo (Estructura pendiente)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: REGISTRAR ESTRUCTURA PARA FORMATO CON ESTRUCTURA PENDIENTE
         ===================================================================== */}
      {pendingCatalogTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <h4 className="text-base font-bold text-slate-900">
              Registrar estructura para {pendingCatalogTarget.reportName}
            </h4>
            <p className="text-xs text-slate-600">
              Actualmente este formato está en estado{' '}
              <strong>"Formato registrado; estructura pendiente"</strong>. El sistema no inventa campos regulatorios oficiales automáticamente. Puede registrar una estructura de trabajo etiquetada explícitamente como{' '}
              <strong>"Datos sintéticos de prueba"</strong> para habilitar el diseño de la salida.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingCatalogTarget(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  handleRegisterStructureForPendingCatalog(pendingCatalogTarget)
                }
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                Registrar estructura sintética de prueba
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: CREAR CAMPOS DE SALIDA DESDE LA FUENTE (SIN SOBRESCRIBIR)
         ===================================================================== */}
      {showCreateFieldsFromSourceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Crear campos de salida a partir de la fuente ({primaryContract.code})
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Seleccione qué columnas de la fuente desea agregar como nuevos campos en la estructura del archivo de salida.{' '}
                  <strong>Nunca se sobrescriben los campos ya definidos en la salida.</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateFieldsFromSourceModal(false)}
                className="text-xs font-bold text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-200 text-xs">
              {primaryContract.fields.map((col) => {
                const alreadyExists = activeOutput.fields.some(
                  (f) => f.technicalName.toLowerCase() === col.name.toLowerCase()
                );
                return (
                  <label
                    key={col.name}
                    className={`p-3 flex items-center justify-between gap-3 ${
                      alreadyExists ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        disabled={alreadyExists}
                        checked={Boolean(selectedColsToCreate[col.name]) && !alreadyExists}
                        onChange={(e) =>
                          setSelectedColsToCreate((prev) => ({
                            ...prev,
                            [col.name]: e.target.checked,
                          }))
                        }
                      />
                      <div>
                        <span className="font-mono font-bold text-slate-900">{col.name}</span> —{' '}
                        <span className="text-slate-700">{col.label}</span>
                      </div>
                    </div>
                    <div className="text-[11px]">
                      {alreadyExists ? (
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                          Ya existe en la salida (se conserva intacto)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-semibold">
                          {col.dataType} (Long. {col.length})
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateFieldsFromSourceModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateOutputFieldsFromSource}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                Agregar campos seleccionados a la salida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: CARGAR LOTE DE DATOS PARA UNA FUENTE (OPERACIÓN SEPARADA)
         ===================================================================== */}
      {showLoadDataBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Cargar lote de datos en una fuente registrada (.xlsx / .csv / .txt)
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Valida cada fila contra la estructura de la fuente, conserva ceros a la izquierda en textos y registra fechas de corte originales sin alterar otros lotes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLoadDataBatchModal(false)}
                className="text-xs font-bold text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Fuente destino del lote
                </label>
                <select
                  value={batchTargetContractId}
                  onChange={(e) => setBatchTargetContractId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  {dataContracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Código identificador del lote
                </label>
                <input
                  type="text"
                  value={newBatchCode}
                  onChange={(e) => setNewBatchCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Entidad cliente del lote
                </label>
                <input
                  type="text"
                  value={newBatchEntity}
                  onChange={(e) => setNewBatchEntity(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Periodo de corte (Ej. 2026-11, 2026-12)
                </label>
                <input
                  type="text"
                  value={newBatchPeriod}
                  onChange={(e) => {
                    const nextP = e.target.value;
                    setNewBatchPeriod(nextP);
                    setNewBatchCutoffDate(getPeriodMetadata(nextP).cutoffIso);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Fecha de corte original (YYYY-MM-DD)
                </label>
                <input
                  type="text"
                  value={newBatchCutoffDate}
                  onChange={(e) => setNewBatchCutoffDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Procedencia del lote
                </label>
                <select
                  value={newBatchOriginKind}
                  onChange={(e) =>
                    setNewBatchOriginKind(
                      e.target.value as SourceExecutionBatch['originKind']
                    )
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Carga de lote de fuente cliente">
                    Carga de lote de fuente cliente
                  </option>
                  <option value="Ejecución de informe TÓTAL REPORT®">
                    Ejecución de informe TÓTAL REPORT®
                  </option>
                  <option value="Lote de demostración precargado">
                    Lote de demostración precargado
                  </option>
                </select>
              </div>
            </div>

            {/* Selector principal de archivo vs Pegar contenido */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setBatchInputMode('file')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  batchInputMode === 'file'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                Seleccionar archivo (.xlsx, .csv, .txt)
              </button>
              <button
                type="button"
                onClick={() => setBatchInputMode('paste')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  batchInputMode === 'paste'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                Pegar contenido (Opción secundaria)
              </button>
            </div>

            {batchInputMode === 'file' ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800">
                    Archivo de lote de datos (.xlsx, .xls, .csv, .txt):
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const info = await inspectUploadedFile(f);
                      setBatchFileInspection(info.inspection);
                    }}
                    className="text-xs text-slate-700 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                  />
                </div>
                {batchFileInspection && (
                  <div className="flex flex-wrap items-center gap-3 text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900">
                      📄 {batchFileInspection.fileName} ({(batchFileInspection.fileSize / 1024).toFixed(1)} KB)
                    </span>
                    {batchFileInspection.sheets.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600 font-semibold">Hoja:</span>
                        <select
                          value={batchFileInspection.selectedSheet}
                          onChange={(e) => {
                            const nextSheet = e.target.value;
                            setBatchFileInspection((prev) =>
                              prev ? { ...prev, selectedSheet: nextSheet } : null
                            );
                          }}
                          className="px-2 py-0.5 border border-slate-300 rounded text-xs"
                        >
                          {batchFileInspection.sheets.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name} ({s.rows.length} filas)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 font-semibold">Fila de encabezado:</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={batchFileInspection.detectedHeaderRowIndex + 1}
                        onChange={(e) => {
                          const nextHdr = Math.max(0, (Number(e.target.value) || 1) - 1);
                          setBatchFileInspection((prev) =>
                            prev ? { ...prev, detectedHeaderRowIndex: nextHdr } : null
                          );
                        }}
                        className="w-14 px-2 py-0.5 border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Registros del lote (CSV delimitado por ; o , — preserva ceros iniciales en columnas de texto)
                </label>
                <textarea
                  rows={5}
                  value={newBatchCsvText}
                  onChange={(e) => setNewBatchCsvText(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLoadDataBatchModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleLoadDataBatchSubmit}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                Validar y registrar lote de datos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 6: IMPORTAR Y CONCILIAR CATÁLOGO DE FORMATOS (.XLSX / .CSV)
         ===================================================================== */}
      {showImportCatalogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Importar y conciliar catálogo de formatos (.xlsx / .csv)
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Lee archivos Excel con título en la fila 1 y encabezados en la fila 2 (<code>Entidad de Control</code>, <code>Código</code>, <code>Nombre del Formato</code>, <code>Periodicidad</code>, <code>Área</code>, <code>Responsable</code>). Conserva códigos vacíos, duplicados y alfanuméricos sin fusionar ni perder filas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportCatalogModal(false)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cerrar ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <div className="font-bold">
                Nota de transparencia sobre archivos en el contenedor actual:
              </div>
              <p>
                En <code>/public/assets/aistudio/</code> únicamente se encuentra el archivo PDF de propuesta funcional; el archivo físico <code>Listado_de_Formatos.xlsx</code> y la imagen completa de Perú no están montados en el sistema de archivos local. Siguiendo la regla de fidelidad regulatoria, el sistema <strong>no inventa de memoria las 152 filas</strong>. Seleccione su archivo <code>Listado_de_Formatos.xlsx</code> aquí para importar y conciliar las 152 filas reales, o utilice el botón de verificación de libro Excel de 152 filas con título en fila 1 y encabezados en fila 2.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  País por defecto (si el archivo no incluye columna País)
                </label>
                <select
                  value={catalogDefaultCountry}
                  onChange={(e) =>
                    setCatalogDefaultCountry(e.target.value as 'Colombia' | 'Perú')
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Colombia">Colombia (Superfinanciera / DIAN / BanRep / FOGAFIN...)</option>
                  <option value="Perú">Perú (SBS / BCRP / SMV)</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex items-end justify-end gap-2">
                <button
                  type="button"
                  onClick={handleLoad152RowsExcelVerificationWorkbook}
                  className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold cursor-pointer"
                >
                  Generar y analizar libro .xlsx de prueba de 152 filas (Fila 1 título + Fila 2 encabezados)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setCatalogInputSourceMode('file')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  catalogInputSourceMode === 'file'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                Seleccionar archivo (.xlsx, .xls, .csv)
              </button>
              <button
                type="button"
                onClick={() => setCatalogInputSourceMode('paste')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  catalogInputSourceMode === 'paste'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                Pegar tabla CSV (Opción secundaria)
              </button>
            </div>

            {catalogInputSourceMode === 'file' ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800">
                    Seleccionar archivo de catálogo (.xlsx, .xls, .csv):
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const info = await inspectUploadedFile(f);
                      setCatalogFileInspection(info.inspection);
                      const targetMatrix =
                        info.inspection.sheets.length > 0
                          ? info.inspection.sheets[0].rows
                          : parseDelimitedMatrix(info.rawTextFallback, info.inspection.delimiter);
                      const parsed = parseCatalogMatrix(
                        targetMatrix,
                        info.inspection.detectedHeaderRowIndex,
                        catalogDefaultCountry,
                        f.name
                      );
                      const impact = evaluateCatalogImportImpact(
                        catalogSourceFormats,
                        parsed.entries
                      );
                      setCatalogImportPreview({
                        entries: parsed.entries,
                        totalRead: parsed.totalRowsRead,
                        rejected: parsed.rejectedRows.length,
                        anomalies: parsed.anomalies,
                        impactSummary: {
                          newCount: impact.newEntries.length,
                          updatedCount: impact.updatedEntries.length,
                          unchangedCount: impact.unchangedEntries.length,
                        },
                      });
                    }}
                    className="text-xs text-slate-700 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                  />
                </div>

                {catalogFileInspection && (
                  <div className="flex flex-wrap items-center gap-3 text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900">
                      📄 {catalogFileInspection.fileName} ({(catalogFileInspection.fileSize / 1024).toFixed(1)} KB)
                    </span>
                    {catalogFileInspection.sheets.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600 font-semibold">Hoja:</span>
                        <select
                          value={catalogFileInspection.selectedSheet}
                          onChange={(e) => {
                            const nextSheet = e.target.value;
                            setCatalogFileInspection((prev) =>
                              prev ? { ...prev, selectedSheet: nextSheet } : null
                            );
                            const sheetObj = catalogFileInspection.sheets.find(
                              (s) => s.name === nextSheet
                            );
                            if (sheetObj) {
                              const parsed = parseCatalogMatrix(
                                sheetObj.rows,
                                catalogFileInspection.detectedHeaderRowIndex,
                                catalogDefaultCountry,
                                catalogFileInspection.fileName
                              );
                              const impact = evaluateCatalogImportImpact(
                                catalogSourceFormats,
                                parsed.entries
                              );
                              setCatalogImportPreview({
                                entries: parsed.entries,
                                totalRead: parsed.totalRowsRead,
                                rejected: parsed.rejectedRows.length,
                                anomalies: parsed.anomalies,
                                impactSummary: {
                                  newCount: impact.newEntries.length,
                                  updatedCount: impact.updatedEntries.length,
                                  unchangedCount: impact.unchangedEntries.length,
                                },
                              });
                            }
                          }}
                          className="px-2 py-0.5 border border-slate-300 rounded text-xs"
                        >
                          {catalogFileInspection.sheets.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name} ({s.rows.length} filas)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 font-semibold">Fila de encabezado:</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={catalogFileInspection.detectedHeaderRowIndex + 1}
                        onChange={(e) => {
                          const nextHdr = Math.max(0, (Number(e.target.value) || 1) - 1);
                          setCatalogFileInspection((prev) =>
                            prev ? { ...prev, detectedHeaderRowIndex: nextHdr } : null
                          );
                          const sheetObj =
                            catalogFileInspection.sheets.find(
                              (s) => s.name === catalogFileInspection.selectedSheet
                            ) || catalogFileInspection.sheets[0];
                          const targetMatrix = sheetObj
                            ? sheetObj.rows
                            : parseDelimitedMatrix(
                                catalogFileInspection.rawText,
                                catalogFileInspection.delimiter
                              );
                          const parsed = parseCatalogMatrix(
                            targetMatrix,
                            nextHdr,
                            catalogDefaultCountry,
                            catalogFileInspection.fileName
                          );
                          const impact = evaluateCatalogImportImpact(
                            catalogSourceFormats,
                            parsed.entries
                          );
                          setCatalogImportPreview({
                            entries: parsed.entries,
                            totalRead: parsed.totalRowsRead,
                            rejected: parsed.rejectedRows.length,
                            anomalies: parsed.anomalies,
                            impactSummary: {
                              newCount: impact.newEntries.length,
                              updatedCount: impact.updatedEntries.length,
                              unchangedCount: impact.unchangedEntries.length,
                            },
                          });
                        }}
                        className="w-14 px-2 py-0.5 border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={catalogPasteText}
                  onChange={(e) => {
                    const txt = e.target.value;
                    setCatalogPasteText(txt);
                    const matrix = parseDelimitedMatrix(txt);
                    const hdrIdx = detectCatalogHeaderRowIndex(matrix);
                    const parsed = parseCatalogMatrix(
                      matrix,
                      hdrIdx,
                      catalogDefaultCountry,
                      'Pegado manual'
                    );
                    const impact = evaluateCatalogImportImpact(
                      catalogSourceFormats,
                      parsed.entries
                    );
                    setCatalogImportPreview({
                      entries: parsed.entries,
                      totalRead: parsed.totalRowsRead,
                      rejected: parsed.rejectedRows.length,
                      anomalies: parsed.anomalies,
                      impactSummary: {
                        newCount: impact.newEntries.length,
                        updatedCount: impact.updatedEntries.length,
                        unchangedCount: impact.unchangedEntries.length,
                      },
                    });
                  }}
                  placeholder="Entidad de Control;Código;Nombre del Formato;Periodicidad;Área;Responsable"
                  className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            )}

            {/* Resumen de conciliación previa a importar */}
            {catalogImportPreview && (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-emerald-950">
                    Vista previa de conciliación del catálogo:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-white border border-emerald-300 font-bold text-emerald-900">
                      Filas leídas: {catalogImportPreview.totalRead}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                      Aceptadas: {catalogImportPreview.entries.length}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold">
                      Nuevas: {catalogImportPreview.impactSummary.newCount}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                      Actualizadas (conservando vínculo): {catalogImportPreview.impactSummary.updatedCount}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
                      Sin cambio: {catalogImportPreview.impactSummary.unchangedCount}
                    </span>
                  </div>
                </div>
                {catalogImportPreview.anomalies.length > 0 && (
                  <div className="text-[11px] text-amber-900">
                    Observaciones detectadas ({catalogImportPreview.anomalies.length}):{' '}
                    {catalogImportPreview.anomalies.slice(0, 3).join(' · ')}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportCatalogModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!catalogImportPreview || catalogImportPreview.entries.length === 0}
                onClick={handleConfirmCatalogImport}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                Confirmar e importar {catalogImportPreview?.entries.length || 0} formato(s) al catálogo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
