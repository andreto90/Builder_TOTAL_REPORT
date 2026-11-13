import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  CatalogSourceFormatEntry,
  ConfiguredOutput,
  DaqueFormatProfile,
  DataContract,
  DeliveryChannel,
  EntityTypeDefinition,
  EnvironmentDeploymentState,
  ExecutionRun,
  FormatLifecycleStatus,
  FormatOutputAssociation,
  FormatVersionEntry,
  LifecycleStatus,
  NormativeSourceDoc,
  OutputType,
  ReceivingOrganismDefinition,
  RegulatoryFormat,
  SourceExecutionBatch,
  StructureField,
  TotaliaSuggestion,
  TransmissionType,
  UserRole,
} from '../domain/types';
import {
  ENTITY_TYPES_CATALOG,
  INITIAL_ASSOCIATIONS,
  INITIAL_CATALOG_SOURCE_FORMATS,
  INITIAL_CONFIGURED_OUTPUTS,
  INITIAL_DAQUE_PROFILES,
  INITIAL_DATA_CONTRACTS,
  INITIAL_DELIVERY_CHANNELS,
  INITIAL_ENVIRONMENT_DEPLOYMENTS,
  INITIAL_EXECUTION_RUNS,
  INITIAL_NORMATIVE_SOURCES,
  INITIAL_OUTPUT_TYPES,
  INITIAL_RECEIVING_ORGANISMS,
  INITIAL_REGULATORY_FORMATS,
  INITIAL_TOTALIA_SUGGESTIONS,
  INITIAL_TRANSMISSION_TYPES,
} from '../domain/seedData';
import {
  analyzeSourceStructureUpdateImpact,
  evaluateFormatDependencies,
  generateOutputArtifact,
} from '../domain/engine';

export type ActiveModuleView =
  | 'dashboard'
  | 'output-types'
  | 'builder'
  | 'associations'
  | 'governance'
  | 'totalia'
  | 'simulator';

function getNowDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getNowDateTime(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function getNowTimeOnly(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${min}:${ss}`;
}

interface ConfiguratorContextValue {
  // Navigation & Global Context
  activeModule: ActiveModuleView;
  setActiveModule: (m: ActiveModuleView) => void;
  selectedOutputId: string;
  setSelectedOutputId: (id: string) => void;
  activeBuilderStep: number;
  setActiveBuilderStep: (step: number) => void;
  globalPeriod: string;
  setGlobalPeriod: (p: string) => void;
  globalEnvironment: 'QA' | 'Producción';
  setGlobalEnvironment: (env: 'QA' | 'Producción') => void;
  globalEntity: string;
  setGlobalEntity: (ent: string) => void;
  activeUserRole: UserRole;
  setActiveUserRole: (role: UserRole) => void;
  lastSavedAt: string;

  // Domain Repositories
  outputTypes: OutputType[];
  configuredOutputs: ConfiguredOutput[];
  dataContracts: DataContract[];
  catalogSourceFormats: CatalogSourceFormatEntry[];
  daqueProfiles: DaqueFormatProfile[];
  regulatoryFormats: RegulatoryFormat[];
  receivingOrganisms: ReceivingOrganismDefinition[];
  entityTypes: EntityTypeDefinition[];
  transmissionTypes: TransmissionType[];
  deliveryChannels: DeliveryChannel[];
  associations: FormatOutputAssociation[];
  environmentDeployments: EnvironmentDeploymentState[];
  totaliaSuggestions: TotaliaSuggestion[];
  executionRuns: ExecutionRun[];
  normativeSources: NormativeSourceDoc[];

  // Toast / Notification Banner
  bannerMessage: { type: 'success' | 'warning' | 'error' | 'info'; text: string } | null;
  notify: (type: 'success' | 'warning' | 'error' | 'info', text: string) => void;
  clearBanner: () => void;

  // Actions — Output Types
  saveOutputType: (typeItem: OutputType) => void;

  // Actions — Regulatory Formats, Receiving Organisms & Entity Types
  addReceivingOrganism: (org: ReceivingOrganismDefinition) => void;
  createRegulatoryFormat: (format: RegulatoryFormat) => void;
  updateRegulatoryFormat: (updated: RegulatoryFormat) => void;
  editRegulatoryFormat: (
    updated: RegulatoryFormat,
    createNewVersion: boolean,
    changeSummary: string
  ) => void;
  deleteRegulatoryFormat: (formatId: string) => { deleted: boolean; reason: string };
  toggleFormatLifecycleStatus: (
    formatId: string,
    nextStatus: FormatLifecycleStatus,
    reason: string
  ) => void;
  openAssociationForFormat: (formatId: string, preselectedOutputId?: string) => void;
  preselectedAssocFormatId: string | null;
  setPreselectedAssocFormatId: (id: string | null) => void;
  createNewOutputForFormat: (format: RegulatoryFormat) => ConfiguredOutput;

  // Actions — Data Sources, Structures & Execution Batches (Paso 3)
  saveDataContract: (contract: DataContract, propagateImpactToOutputId?: string) => void;
  saveCatalogSourceFormat: (entry: CatalogSourceFormatEntry) => void;
  importCatalogEntriesBatch: (
    entries: CatalogSourceFormatEntry[],
    mode: 'reconcile' | 'append'
  ) => void;
  registerStructureForCatalogEntry: (catalogId: string, contract: DataContract) => void;
  addExecutionBatchToContract: (contractId: string, batch: SourceExecutionBatch) => void;

  // Actions — Configured Outputs & Versioning
  openOutputInBuilder: (outputId: string, step?: number) => void;
  openAssociationForOutput: (outputId: string) => void;
  preselectedAssocOutputId: string | null;
  setPreselectedAssocOutputId: (id: string | null) => void;
  saveConfiguredOutput: (updated: ConfiguredOutput, silent?: boolean) => void;
  deleteConfiguredOutput: (outputId: string) => boolean;
  createNewRevisionFromOutput: (baseOutputId: string, justification: string) => ConfiguredOutput | null;
  deriveVariantFromOutput: (baseOutputId: string, newCode: string, newName: string) => ConfiguredOutput | null;
  duplicateOutputIndependently: (baseOutputId: string, newCode: string, newName: string) => ConfiguredOutput | null;
  transitionOutputStatus: (outputId: string, nextStatus: LifecycleStatus, justification: string) => boolean;

  // Actions — Associations
  saveAssociation: (assoc: FormatOutputAssociation, silent?: boolean) => void;
  deleteAssociation: (assocId: string) => void;
  unlinkAssociation: (assocId: string, reason?: string) => void;
  adoptOutputVersionInAssociation: (assocId: string, newVersion: string) => void;

  // Actions — Environment Distribution & Activation
  runEnvironmentAction: (
    deploymentId: string,
    action: 'Notificar' | 'Descargar' | 'Instalar' | 'Activar' | 'Revertir'
  ) => void;

  // Actions — TOTALiA Suggestions
  decideTotaliaSuggestion: (suggestionId: string, decision: 'Aceptada en borrador' | 'Rechazada') => void;

  // Actions — Execution & Simulation
  executeSimulatedRun: (params: {
    formatId: string;
    transmissionTypeId: string;
    modality: 'Inicial' | 'Corrección' | 'Reemplazo';
    cutoffPeriod: string;
    environment: 'QA' | 'Producción';
    injectZeroBalanceError?: boolean;
    injectOverflowError?: boolean;
  }) => ExecutionRun | null;
  updateRunDeliveryState: (runId: string, nextDeliveryState: ExecutionRun['deliveryState'], ack?: string) => void;

  // Persistence Export / Import / Reset
  exportDomainJson: () => string;
  importDomainJson: (rawJson: string) => boolean;
  restoreBackupSnapshot: () => boolean;
  resetDemoData: () => void;
}

const STORAGE_KEY = 'total_report_configurator_state_v15';
const LEGACY_STORAGE_KEY = 'total_report_configurator_state_v14';
const BACKUP_STORAGE_KEY = 'total_report_configurator_backup_v14';

const ConfiguratorContext = createContext<ConfiguratorContextValue | undefined>(undefined);

export const ConfiguratorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModuleState, setActiveModuleState] = useState<ActiveModuleView>('dashboard');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('OUT-CSV-DEMO-A');
  const [preselectedAssocOutputId, setPreselectedAssocOutputId] = useState<string | null>(null);
  const [preselectedAssocFormatId, setPreselectedAssocFormatId] = useState<string | null>(null);
  const [activeBuilderStep, setActiveBuilderStep] = useState<number>(1);
  const [globalPeriod, setGlobalPeriod] = useState<string>('2026-11');
  const [globalEnvironment, setGlobalEnvironment] = useState<'QA' | 'Producción'>('QA');
  const [globalEntity, setGlobalEntity] = useState<string>('Entidad DEMO');
  const [activeUserRole, setActiveUserRole] = useState<UserRole>('Implementador técnico / regulatorio');
  const [lastSavedAt, setLastSavedAt] = useState<string>(getNowTimeOnly());

  const [outputTypes, setOutputTypes] = useState<OutputType[]>(INITIAL_OUTPUT_TYPES);
  const [configuredOutputs, setConfiguredOutputs] = useState<ConfiguredOutput[]>(INITIAL_CONFIGURED_OUTPUTS);
  const [dataContracts, setDataContracts] = useState<DataContract[]>(INITIAL_DATA_CONTRACTS);
  const [catalogSourceFormats, setCatalogSourceFormats] = useState<CatalogSourceFormatEntry[]>(
    INITIAL_CATALOG_SOURCE_FORMATS
  );
  const [daqueProfiles] = useState<DaqueFormatProfile[]>(INITIAL_DAQUE_PROFILES);
  const [regulatoryFormats, setRegulatoryFormats] = useState<RegulatoryFormat[]>(INITIAL_REGULATORY_FORMATS);
  const [receivingOrganisms, setReceivingOrganisms] = useState<ReceivingOrganismDefinition[]>(
    INITIAL_RECEIVING_ORGANISMS
  );
  const [entityTypes] = useState<EntityTypeDefinition[]>(ENTITY_TYPES_CATALOG);
  const [transmissionTypes] = useState<TransmissionType[]>(INITIAL_TRANSMISSION_TYPES);
  const [deliveryChannels] = useState<DeliveryChannel[]>(INITIAL_DELIVERY_CHANNELS);
  const [associations, setAssociations] = useState<FormatOutputAssociation[]>(INITIAL_ASSOCIATIONS);
  const [environmentDeployments, setEnvironmentDeployments] = useState<EnvironmentDeploymentState[]>(
    INITIAL_ENVIRONMENT_DEPLOYMENTS
  );
  const [totaliaSuggestions, setTotaliaSuggestions] = useState<TotaliaSuggestion[]>(INITIAL_TOTALIA_SUGGESTIONS);
  const [executionRuns, setExecutionRuns] = useState<ExecutionRun[]>(INITIAL_EXECUTION_RUNS);
  const [normativeSources] = useState<NormativeSourceDoc[]>(INITIAL_NORMATIVE_SOURCES);

  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    text: string;
  } | null>(null);

  const notify = (type: 'success' | 'warning' | 'error' | 'info', text: string) => {
    setBannerMessage({ type, text });
  };

  const clearBanner = () => setBannerMessage(null);

  // Clear stale banners when switching top-level screens from the menu
  const setActiveModule = (m: ActiveModuleView) => {
    if (m !== activeModuleState) {
      setBannerMessage(null);
    }
    setActiveModuleState(m);
  };

  // Load persisted state from localStorage with non-destructive backup and catalog reconciliation
  useEffect(() => {
    try {
      const savedV15 = localStorage.getItem(STORAGE_KEY);
      const savedV14 = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (savedV14 && !localStorage.getItem(BACKUP_STORAGE_KEY)) {
        localStorage.setItem(BACKUP_STORAGE_KEY, savedV14);
      }
      const rawToLoad = savedV15 || savedV14;
      if (rawToLoad) {
        const parsed = JSON.parse(rawToLoad);
        if (parsed.outputTypes) setOutputTypes(parsed.outputTypes);
        if (parsed.configuredOutputs && Array.isArray(parsed.configuredOutputs)) {
          const seedMap = new Map(INITIAL_CONFIGURED_OUTPUTS.map((o) => [o.id, o]));
          const reconciledOutputs = parsed.configuredOutputs.map((o: ConfiguredOutput) => {
            const seed = seedMap.get(o.id);
            const normalizedCatId =
              o.sourceCatalogEntryId === 'CAT-PE-411'
                ? 'CAT-PE-440'
                : o.sourceCatalogEntryId || seed?.sourceCatalogEntryId;
            return {
              ...o,
              sourceCatalogEntryId: normalizedCatId,
              selectedSourceExecutionId:
                o.selectedSourceExecutionId || seed?.selectedSourceExecutionId,
            };
          });
          setConfiguredOutputs(reconciledOutputs);
        }
        if (parsed.dataContracts && Array.isArray(parsed.dataContracts)) {
          const seedContractMap = new Map(INITIAL_DATA_CONTRACTS.map((c) => [c.id, c]));
          const mergedContracts = parsed.dataContracts.map((c: DataContract) => {
            const seed = seedContractMap.get(c.id);
            if (!seed) return c;
            const existingBatchIds = new Set((c.executionBatches || []).map((b) => b.id));
            const missingSeedBatches = (seed.executionBatches || []).filter(
              (b) => !existingBatchIds.has(b.id)
            );
            const reconciledBatches = [
              ...(c.executionBatches || []).map((b) => {
                const seedBatch = (seed.executionBatches || []).find((sb) => sb.id === b.id);
                return seedBatch
                  ? {
                      ...b,
                      cutoffDate: b.cutoffDate || seedBatch.cutoffDate,
                      sourceCatalogEntryId:
                        b.sourceCatalogEntryId || seedBatch.sourceCatalogEntryId,
                      sourceStructureVersion:
                        b.sourceStructureVersion || seedBatch.sourceStructureVersion,
                    }
                  : b;
              }),
              ...missingSeedBatches,
            ];
            return {
              ...c,
              executionBatches: reconciledBatches,
            };
          });
          const existingIds = new Set(mergedContracts.map((c: DataContract) => c.id));
          const missingSeed = INITIAL_DATA_CONTRACTS.filter((c) => !existingIds.has(c.id));
          setDataContracts([...mergedContracts, ...missingSeed]);
        }
        if (parsed.catalogSourceFormats && Array.isArray(parsed.catalogSourceFormats)) {
          const seedCatById = new Map(INITIAL_CATALOG_SOURCE_FORMATS.map((e) => [e.id, e]));
          // Remove deprecated erroneous seed IDs (CAT-PE-411, CAT-PE-501) and update corrected seed entries
          const filteredPersisted = parsed.catalogSourceFormats
            .filter(
              (e: CatalogSourceFormatEntry) => e.id !== 'CAT-PE-411' && e.id !== 'CAT-PE-501'
            )
            .map((e: CatalogSourceFormatEntry) => {
              const seedEntry = seedCatById.get(e.id);
              return seedEntry ? { ...seedEntry, linkedDataContractId: e.linkedDataContractId || seedEntry.linkedDataContractId } : e;
            });
          const existingCatIds = new Set(
            filteredPersisted.map((e: CatalogSourceFormatEntry) => e.id)
          );
          const missingCatSeed = INITIAL_CATALOG_SOURCE_FORMATS.filter(
            (e) => !existingCatIds.has(e.id)
          );
          setCatalogSourceFormats([...filteredPersisted, ...missingCatSeed]);
        }
        if (parsed.associations) setAssociations(parsed.associations);
        if (parsed.environmentDeployments) setEnvironmentDeployments(parsed.environmentDeployments);
        if (parsed.regulatoryFormats && Array.isArray(parsed.regulatoryFormats)) {
          const seedMap = new Map(INITIAL_REGULATORY_FORMATS.map((f) => [f.id, f]));
          const merged = parsed.regulatoryFormats.map((f: RegulatoryFormat) => {
            const seed = seedMap.get(f.id);
            if (!seed) return f;
            return {
              ...seed,
              ...f,
              applicableEntityTypes: f.applicableEntityTypes !== undefined ? f.applicableEntityTypes : seed.applicableEntityTypes,
              classificationStatus: f.classificationStatus || seed.classificationStatus,
              internalCode: f.internalCode || seed.internalCode,
              sourceUrl: f.sourceUrl || seed.sourceUrl,
              consultationDate: f.consultationDate || seed.consultationDate,
              verificationLevel: f.verificationLevel || seed.verificationLevel,
              lifecycleStatus: f.lifecycleStatus || seed.lifecycleStatus,
              reportingModality: f.reportingModality || seed.reportingModality,
              issuingOrganism: f.issuingOrganism || seed.issuingOrganism,
              versionHistory: f.versionHistory || seed.versionHistory,
            };
          });
          const existingIds = new Set(merged.map((f: RegulatoryFormat) => f.id));
          const missing = INITIAL_REGULATORY_FORMATS.filter((f) => !existingIds.has(f.id));
          setRegulatoryFormats([...merged, ...missing]);
        }
        if (parsed.receivingOrganisms && Array.isArray(parsed.receivingOrganisms)) {
          const existingOrgIds = new Set(
            parsed.receivingOrganisms.map((o: ReceivingOrganismDefinition) => o.id)
          );
          const missingOrgs = INITIAL_RECEIVING_ORGANISMS.filter(
            (o) => !existingOrgIds.has(o.id)
          );
          setReceivingOrganisms([...parsed.receivingOrganisms, ...missingOrgs]);
        }
        if (parsed.totaliaSuggestions) setTotaliaSuggestions(parsed.totaliaSuggestions);
        if (parsed.executionRuns) setExecutionRuns(parsed.executionRuns);
      }
    } catch {
      // Fallback to seed data
    }
  }, []);

  // Save state changes to localStorage
  useEffect(() => {
    try {
      const payload = {
        outputTypes,
        configuredOutputs,
        dataContracts,
        catalogSourceFormats,
        regulatoryFormats,
        receivingOrganisms,
        associations,
        environmentDeployments,
        totaliaSuggestions,
        executionRuns,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setLastSavedAt(getNowTimeOnly());
    } catch {
      // Ignore quota errors
    }
  }, [
    outputTypes,
    configuredOutputs,
    dataContracts,
    catalogSourceFormats,
    regulatoryFormats,
    receivingOrganisms,
    associations,
    environmentDeployments,
    totaliaSuggestions,
    executionRuns,
  ]);

  const openOutputInBuilder = (outputId: string, step = 1) => {
    setSelectedOutputId(outputId);
    setActiveBuilderStep(step);
    setActiveModuleState('builder');
  };

  const openAssociationForOutput = (outputId: string) => {
    setSelectedOutputId(outputId);
    setPreselectedAssocOutputId(outputId);
    setActiveModuleState('associations');
  };

  const openAssociationForFormat = (formatId: string, preselectedOutputId?: string) => {
    setPreselectedAssocFormatId(formatId);
    if (preselectedOutputId) {
      setSelectedOutputId(preselectedOutputId);
      setPreselectedAssocOutputId(preselectedOutputId);
    }
    setActiveModuleState('associations');
  };

  const addReceivingOrganism = (org: ReceivingOrganismDefinition) => {
    setReceivingOrganisms((prev) => {
      const exists = prev.some(
        (o) =>
          o.id === org.id ||
          (o.country === org.country && o.name.toLowerCase() === org.name.toLowerCase())
      );
      if (exists) {
        return prev.map((o) => (o.id === org.id ? org : o));
      }
      return [...prev, org];
    });
    notify(
      'success',
      `Organismo receptor "${org.name}" (${org.country}) registrado en el catálogo único.`
    );
  };

  const createRegulatoryFormat = (format: RegulatoryFormat) => {
    const nowDate = getNowDate();
    const initialHistory: FormatVersionEntry = {
      versionLabel: format.specificationValidity?.versionLabel || format.normativeVersion || 'v1.0',
      validFrom: format.specificationValidity?.validFrom || nowDate,
      validTo: format.specificationValidity?.validTo || 'Abierta',
      periodicity: format.periodicity,
      applicableEntityTypes: format.applicableEntityTypes,
      supportedFamilies: format.supportedFamilies || ['CSV'],
      changedAt: nowDate,
      changedBy: activeUserRole,
      changeKind: 'Creación inicial',
      changeSummary: `Alta administrativa en estado "${format.lifecycleStatus || 'Activo'}" (${
        format.provenanceKind || 'Oficial'
      }).`,
    };
    const enriched: RegulatoryFormat = {
      ...format,
      versionHistory:
        format.versionHistory && format.versionHistory.length > 0
          ? format.versionHistory
          : [initialHistory],
    };
    setRegulatoryFormats((prev) => [enriched, ...prev]);
    notify(
      'success',
      `Formato "${enriched.code ? `${enriched.code} · ` : ''}${enriched.name}" registrado bajo "${
        enriched.regulator
      }" en estado "${enriched.lifecycleStatus || 'Activo'}".`
    );
  };

  const updateRegulatoryFormat = (updated: RegulatoryFormat) => {
    setRegulatoryFormats((prev) =>
      prev.map((f) => (f.id === updated.id ? updated : f))
    );
    notify(
      'success',
      `Formato "${updated.code || updated.name}" actualizado: Clasificación "${updated.classificationStatus}".`
    );
  };

  const editRegulatoryFormat = (
    updated: RegulatoryFormat,
    createNewVersion: boolean,
    changeSummary: string
  ) => {
    const nowDate = getNowDate();
    setRegulatoryFormats((prev) =>
      prev.map((f) => {
        if (f.id !== updated.id) return f;
        const priorHistory: FormatVersionEntry[] =
          f.versionHistory && f.versionHistory.length > 0
            ? f.versionHistory
            : [
                {
                  versionLabel: f.specificationValidity?.versionLabel || f.normativeVersion || 'v1.0',
                  validFrom: f.specificationValidity?.validFrom || '2026-01-01',
                  validTo: f.specificationValidity?.validTo || 'Abierta',
                  periodicity: f.periodicity,
                  applicableEntityTypes: f.applicableEntityTypes,
                  supportedFamilies: f.supportedFamilies || ['CSV'],
                  changedAt: f.classificationValidatedAt || '2026-11-01',
                  changedBy: f.classificationValidatedBy || 'Sistema',
                  changeKind: 'Creación inicial',
                  changeSummary: 'Versión base registrada en el catálogo.',
                },
              ];

        const nextEntry: FormatVersionEntry = {
          versionLabel:
            updated.specificationValidity?.versionLabel || updated.normativeVersion || 'v1.1',
          validFrom: updated.specificationValidity?.validFrom || nowDate,
          validTo: updated.specificationValidity?.validTo || 'Abierta',
          periodicity: updated.periodicity,
          applicableEntityTypes: updated.applicableEntityTypes,
          supportedFamilies: updated.supportedFamilies || ['CSV'],
          changedAt: nowDate,
          changedBy: activeUserRole,
          changeKind: createNewVersion
            ? 'Nueva versión de especificación'
            : 'Corrección descriptiva',
          changeSummary:
            changeSummary ||
            (createNewVersion
              ? 'Actualización de especificación, vigencia o aplicabilidad.'
              : 'Corrección descriptiva de metadatos informativos.'),
        };

        return {
          ...updated,
          versionHistory: [...priorHistory, nextEntry],
        };
      })
    );
    notify(
      'success',
      createNewVersion
        ? `Formato "${updated.code || updated.name}" actualizado con nueva revisión normativa (${
            updated.normativeVersion
          }). Se preservó la versión anterior en el historial y las salidas publicadas permanecen intactas.`
        : `Corrección descriptiva guardada en el formato "${
            updated.code || updated.name
          }" conservando identificador y asociaciones.`
    );
  };

  const deleteRegulatoryFormat = (formatId: string): { deleted: boolean; reason: string } => {
    const target = regulatoryFormats.find((f) => f.id === formatId);
    if (!target) {
      return { deleted: false, reason: 'El formato solicitado no existe en el catálogo.' };
    }
    const depCheck = evaluateFormatDependencies({
      format: target,
      associations,
      executionRuns,
    });
    if (!depCheck.canDelete) {
      notify('error', depCheck.explanation);
      return { deleted: false, reason: depCheck.explanation };
    }
    setRegulatoryFormats((prev) => prev.filter((f) => f.id !== formatId));
    notify(
      'info',
      `Formato "${target.code ? `${target.code} · ` : ''}${target.name}" eliminado definitivamente del catálogo tras verificar 0 dependencias.`
    );
    return { deleted: true, reason: depCheck.explanation };
  };

  const toggleFormatLifecycleStatus = (
    formatId: string,
    nextStatus: FormatLifecycleStatus,
    reason: string
  ) => {
    const nowDate = getNowDate();
    const target = regulatoryFormats.find((f) => f.id === formatId);
    if (!target) return;

    setRegulatoryFormats((prev) =>
      prev.map((f) => {
        if (f.id !== formatId) return f;
        const priorHistory = f.versionHistory || [];
        const statusEntry: FormatVersionEntry = {
          versionLabel: f.specificationValidity?.versionLabel || f.normativeVersion || 'v1.0',
          validFrom: f.specificationValidity?.validFrom || nowDate,
          validTo: nextStatus === 'Inactivo' ? nowDate : f.specificationValidity?.validTo || 'Abierta',
          periodicity: f.periodicity,
          applicableEntityTypes: f.applicableEntityTypes,
          supportedFamilies: f.supportedFamilies || ['CSV'],
          changedAt: nowDate,
          changedBy: activeUserRole,
          changeKind: 'Cambio de estado',
          changeSummary: `Estado cambiado a "${nextStatus}". Motivo: ${
            reason || 'Decisión administrativa'
          }`,
        };
        return {
          ...f,
          lifecycleStatus: nextStatus,
          deactivatedAt: nextStatus === 'Inactivo' ? nowDate : undefined,
          deactivationReason: nextStatus === 'Inactivo' ? reason : undefined,
          versionHistory: [...priorHistory, statusEntry],
        };
      })
    );

    notify(
      nextStatus === 'Inactivo' ? 'warning' : 'success',
      nextStatus === 'Inactivo'
        ? `Formato "${target.code || target.name}" desactivado desde ${nowDate}. Se bloquean nuevas asociaciones operativas activas conservando el historial y las asociaciones previas para consulta.`
        : `Formato "${target.code || target.name}" reactivado a estado "${nextStatus}".`
    );
  };

  const createNewOutputForFormat = (format: RegulatoryFormat): ConfiguredOutput => {
    const chosenType =
      outputTypes.find((t) => format.supportedFamilies?.includes(t.family)) ||
      outputTypes[0];
    const now = getNowDate();
    const newOutput: ConfiguredOutput = {
      id: `OUT-${format.code ? format.code.toUpperCase().replace(/\s+/g, '_') : 'FMT'}-${Date.now().toString().slice(-4)}`,
      code: `SAL-${format.code ? format.code.toUpperCase().replace(/\s+/g, '_') : 'DESTINO'}-01`,
      name: `Salida para ${format.code || ''} · ${format.name}`.trim(),
      description: `Estructura de salida configurada específicamente para cumplir con los requerimientos de ${format.name} (${format.regulator}).`,
      purpose: `Generación técnica para formato ${format.code || format.name} (${format.regulator}).`,
      responsibleUser: activeUserRole,
      validFrom: now,
      validTo: 'Abierta',
      jurisdiction: format.jurisdiction,
      regulator: format.regulator,
      outputTypeId: chosenType.id,
      version: '1.0',
      status: 'Borrador',
      derivationType: 'Original',
      updatedAt: now,
      fingerprint: `sha256:init_${Date.now().toString(16)}`,
      composition: {
        fileNamePattern: `${(format.code || 'SALIDA').toLowerCase()}_{entidad}_{periodo}`,
        extension: chosenType.extension || 'csv',
        encoding: 'UTF-8',
        delimiter: chosenType.family === 'CSV' ? ';' : 'N/A',
        decimalSeparator: ',',
        includeHeader: true,
        includeControlTotals: false,
        includeFooter: false,
        packaging: 'Sin empaquetar',
        maxPackageBytes: 10485760,
        emptyDatasetPolicy: 'Producir vacío válido',
        packageMembers: [
          {
            id: `PM-${Date.now()}-1`,
            role: 'Principal',
            cardinality: '1..1 (Obligatorio)',
            outputDefinitionId: `OUT-${format.code ? format.code.toUpperCase().replace(/\s+/g, '_') : 'FMT'}-${Date.now().toString().slice(-4)}`,
            outputVersion: '1.0',
            fileNamePattern: `${(format.code || 'SALIDA').toLowerCase()}_{entidad}_{periodo}.${chosenType.extension || 'csv'}`,
            includeInRegulatoryDelivery: true,
            allowRoleMappingOverride: false,
          },
        ],
      },
      dataContractId: dataContracts[0]?.id || 'DC-CARTERA-01',
      defaultDeliveryChannelId: deliveryChannels[0]?.id || 'CHAN-MANUAL-01',
      signatureServiceRef: 'Sin firma digital',
      encryptionPolicy: 'Sin cifrado adicional (TLS canal)',
      sourceDocIds: [],
      fields: [
        {
          id: `FLD-${Date.now()}-1`,
          technicalName: 'id_registro',
          label: 'ID Registro',
          description: 'Identificador único de la operación reportada',
          recordSection: 'Detalle',
          order: 1,
          dataType: 'Texto',
          physicalType: 'VARCHAR(20)',
          length: 20,
          lengthUnit: 'Caracteres',
          required: true,
          nullable: false,
          startPosition: 1,
          formatMask: '',
          defaultValue: '',
          paddingChar: chosenType.family === 'TXT' ? '0' : 'Ninguno',
          alignment: 'Izquierda',
          overflowRule: 'Bloquear con error',
          protectionClass: 'Parametrizable',
          evidenceState: 'Sustento explícito',
          evidenceSourceRef: `Requerimiento de formato ${format.code || format.name}`,
          mapping: {
            transformationKind: 'Directo',
            sourceContractId: dataContracts[0]?.id || 'DC-CARTERA-01',
            sourceField: dataContracts[0]?.fields[0]?.name || 'id_obligacion',
            expression: dataContracts[0]?.fields[0]?.name || 'id_obligacion',
            isParameterizedPoint: false,
            emptyTreatment: 'Error bloqueante',
            mappingStatus: 'Confirmado por usuario',
          },
        },
      ],
      validationRules: [],
      versionHistory: [
        {
          version: '1.0',
          status: 'Borrador',
          createdAt: getNowDateTime(),
          createdBy: activeUserRole,
          justification: `Creación inicial orientada al formato de destino ${format.code || format.name} (${format.regulator}).`,
          changesSummary: ['Estructura inicial en borrador para diseño de campos y mapeo.'],
          fingerprint: `sha256:init_${Date.now().toString(16)}`,
          derivationKind: 'Creación inicial',
        },
      ],
    };

    setConfiguredOutputs((prev) => [newOutput, ...prev]);
    setSelectedOutputId(newOutput.id);
    setActiveBuilderStep(1);
    setActiveModuleState('builder');
    notify(
      'success',
      `Nueva salida en borrador "${newOutput.code}" creada para el formato ${format.code || format.name}. Complete los campos y transformaciones en los 7 pasos.`
    );
    return newOutput;
  };

  const saveOutputType = (typeItem: OutputType) => {
    const updatedItem: OutputType = {
      ...typeItem,
      updatedAt: getNowDate(),
    };
    setOutputTypes((prev) => {
      const exists = prev.some((t) => t.id === updatedItem.id);
      if (exists) {
        return prev.map((t) => (t.id === updatedItem.id ? updatedItem : t));
      }
      return [...prev, updatedItem];
    });
    notify('success', `Tipo de salida "${updatedItem.name}" (${updatedItem.code}) guardado correctamente.`);
  };

  const saveDataContract = (contract: DataContract, propagateImpactToOutputId?: string) => {
    setDataContracts((prev) => {
      const exists = prev.some((c) => c.id === contract.id);
      if (exists) {
        return prev.map((c) => (c.id === contract.id ? contract : c));
      }
      return [contract, ...prev];
    });

    if (propagateImpactToOutputId) {
      setConfiguredOutputs((prev) =>
        prev.map((out) => {
          if (out.id !== propagateImpactToOutputId) return out;
          if (out.status === 'Publicada' || out.status === 'Aprobada') return out;
          const impact = analyzeSourceStructureUpdateImpact({
            fields: out.fields,
            updatedContract: contract,
          });
          if (impact.impactedCount > 0) {
            notify(
              'warning',
              `Estructura "${contract.code}" actualizada a ${contract.version}: ${impact.impactedCount} campo(s) de la salida fueron marcados como "Requiere revisión por cambio en fuente" y ${impact.preservedCount} mapeo(s) válidos se conservaron.`
            );
          } else {
            notify(
              'success',
              `Estructura de origen "${contract.name}" (${contract.version}) registrada y sincronizada sin impactos de incompatibilidad.`
            );
          }
          return {
            ...out,
            updatedAt: getNowDate(),
            fields: impact.updatedFields,
          };
        })
      );
      return;
    }

    notify(
      'success',
      `Estructura de origen "${contract.name}" (${contract.code} · ${contract.fields.length} campos) registrada en el catálogo.`
    );
  };

  const saveCatalogSourceFormat = (entry: CatalogSourceFormatEntry) => {
    setCatalogSourceFormats((prev) => {
      const exists = prev.some((e) => e.id === entry.id);
      if (exists) {
        return prev.map((e) => (e.id === entry.id ? entry : e));
      }
      return [entry, ...prev];
    });
    notify(
      'success',
      `Entrada de catálogo "${entry.reportName}" (${entry.country} · ${entry.regulatorOrOrganism}) guardada en estado "${entry.catalogStatus}".`
    );
  };

  const importCatalogEntriesBatch = (
    entries: CatalogSourceFormatEntry[],
    mode: 'reconcile' | 'append'
  ) => {
    if (entries.length === 0) return;
    setCatalogSourceFormats((prev) => {
      if (mode === 'append') {
        const existingIds = new Set(prev.map((e) => e.id));
        const newUnique = entries.filter((e) => !existingIds.has(e.id));
        return [...newUnique, ...prev];
      }
      // Reconcile mode: match by id or by (country + regulator + code + reportName), preserving linkedDataContractId on existing entries
      const updated = [...prev];
      let addedCount = 0;
      let updatedCount = 0;
      for (const inc of entries) {
        const idx = updated.findIndex(
          (ex) =>
            ex.id === inc.id ||
            (ex.country === inc.country &&
              ex.regulatorOrOrganism.toLowerCase() === inc.regulatorOrOrganism.toLowerCase() &&
              ex.formatCode.toLowerCase() === inc.formatCode.toLowerCase() &&
              (ex.reportName.toLowerCase() === inc.reportName.toLowerCase() ||
                (inc.formatCode !== '' && ex.formatCode === inc.formatCode)))
        );
        if (idx >= 0) {
          const existing = updated[idx];
          updated[idx] = {
            ...inc,
            id: existing.id,
            linkedDataContractId: existing.linkedDataContractId || inc.linkedDataContractId,
            catalogStatus: existing.linkedDataContractId
              ? existing.catalogStatus
              : inc.catalogStatus,
          };
          updatedCount++;
        } else {
          updated.push(inc);
          addedCount++;
        }
      }
      notify(
        'success',
        `Catálogo reconciliado: ${entries.length} fila(s) procesadas (${addedCount} nueva(s), ${updatedCount} actualizada(s) preservando estructuras vinculadas y versiones publicadas).`
      );
      return updated;
    });
  };

  const registerStructureForCatalogEntry = (catalogId: string, contract: DataContract) => {
    setDataContracts((prev) => {
      const exists = prev.some((c) => c.id === contract.id);
      if (exists) {
        return prev.map((c) => (c.id === contract.id ? contract : c));
      }
      return [contract, ...prev];
    });
    setCatalogSourceFormats((prev) =>
      prev.map((e) =>
        e.id === catalogId
          ? {
              ...e,
              linkedDataContractId: contract.id,
              catalogStatus:
                (contract.executionBatches?.length || 0) > 0 || contract.demoRows.length > 0
                  ? 'Estructura y datos disponibles'
                  : 'Estructura disponible',
            }
          : e
      )
    );
    notify(
      'success',
      `Estructura "${contract.code}" (${contract.fields.length} campos) vinculada al formato de catálogo. Ahora puede seleccionarla para diseñar salidas.`
    );
  };

  const addExecutionBatchToContract = (contractId: string, batch: SourceExecutionBatch) => {
    setDataContracts((prev) =>
      prev.map((c) => {
        if (c.id !== contractId) return c;
        const existingBatches = c.executionBatches || [];
        return {
          ...c,
          snapshotId: batch.executionCode,
          demoRows: c.demoRows.length === 0 ? batch.rows : c.demoRows,
          executionBatches: [batch, ...existingBatches],
        };
      })
    );
    setCatalogSourceFormats((prev) =>
      prev.map((e) =>
        e.linkedDataContractId === contractId
          ? { ...e, catalogStatus: 'Estructura y datos disponibles' }
          : e
      )
    );
    notify(
      'success',
      `Lote de datos "${batch.executionCode}" (${batch.recordCount} registros · Corte ${batch.cutoffPeriod} · ${batch.entityScope}) registrado sin sobrescribir ejecuciones anteriores.`
    );
  };

  const saveConfiguredOutput = (updated: ConfiguredOutput, silent = false) => {
    const nowDate = getNowDate();
    // Synchronize Principal packageMember fileNamePattern with composition.fileNamePattern
    const syncedMembers = updated.composition.packageMembers.map((m) =>
      m.role === 'Principal'
        ? {
            ...m,
            fileNamePattern: `${updated.composition.fileNamePattern.replace(
              new RegExp(`\\.${updated.composition.extension}$`, 'i'),
              ''
            )}.${updated.composition.extension}`,
          }
        : m
    );
    const normalized: ConfiguredOutput = {
      ...updated,
      updatedAt: nowDate,
      composition: {
        ...updated.composition,
        packageMembers: syncedMembers,
      },
    };

    setConfiguredOutputs((prev) => {
      const existing = prev.find((o) => o.id === normalized.id);
      if (existing && (existing.status === 'Publicada' || existing.status === 'Aprobada')) {
        if (!silent) {
          notify(
            'error',
            `La salida ${existing.code} v${existing.version} está en estado "${existing.status}" y es inmutable. Cree una nueva revisión en borrador para realizar cambios.`
          );
        }
        return prev;
      }
      const exists = prev.some((o) => o.id === normalized.id);
      if (exists) {
        return prev.map((o) => (o.id === normalized.id ? normalized : o));
      }
      return [normalized, ...prev];
    });
    if (!silent) {
      notify(
        'success',
        `Cambios de la salida "${normalized.code}" (v${normalized.version}) guardados en este navegador (${getNowTimeOnly()}).`
      );
    }
  };

  const deleteConfiguredOutput = (outputId: string): boolean => {
    const target = configuredOutputs.find((o) => o.id === outputId);
    if (!target) return false;
    if (target.status === 'Publicada' || target.status === 'Aprobada') {
      notify(
        'error',
        `No se puede eliminar la salida "${target.code}" porque está en estado "${target.status}".`
      );
      return false;
    }
    const usedInAssoc = associations.some((a) => a.configuredOutputId === outputId);
    if (usedInAssoc) {
      notify(
        'error',
        `No se puede eliminar "${target.code}" mientras tenga formatos regulatorios asociados. Retire primero la asociación.`
      );
      return false;
    }
    const remaining = configuredOutputs.filter((o) => o.id !== outputId);
    setConfiguredOutputs(remaining);
    if (selectedOutputId === outputId && remaining.length > 0) {
      setSelectedOutputId(remaining[0].id);
    }
    notify('info', `Salida en borrador "${target.code}" eliminada.`);
    return true;
  };

  const bumpMinorVersion = (ver: string): string => {
    const parts = ver.split('.');
    if (parts.length >= 2) {
      const major = parseInt(parts[0], 10) || 1;
      const minor = (parseInt(parts[1], 10) || 0) + 1;
      return `${major}.${minor}`;
    }
    return `${ver}.1`;
  };

  const createNewRevisionFromOutput = (
    baseOutputId: string,
    justification: string
  ): ConfiguredOutput | null => {
    const base = configuredOutputs.find((o) => o.id === baseOutputId);
    if (!base) return null;

    const nextVer = bumpMinorVersion(base.version);
    const newId = `${base.id}-REV-${nextVer.replace('.', '_')}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
    const newFingerprint = `sha256:rev_${Date.now().toString(16)}`;
    const nowDate = getNowDate();

    const revision: ConfiguredOutput = {
      ...JSON.parse(JSON.stringify(base)),
      id: newId,
      version: nextVer,
      status: 'Borrador',
      baseOutputId: base.id,
      derivationType: 'Revisión',
      updatedAt: nowDate,
      fingerprint: newFingerprint,
      versionHistory: [
        ...base.versionHistory,
        {
          version: nextVer,
          status: 'Borrador',
          createdAt: getNowDateTime(),
          createdBy: activeUserRole,
          justification: justification || `Nueva revisión derivada de v${base.version}.`,
          changesSummary: [`Revisión en borrador creada a partir de ${base.code} v${base.version}.`],
          fingerprint: newFingerprint,
          baseVersionRef: base.version,
          derivationKind: 'Nueva revisión',
        },
      ],
    };

    setConfiguredOutputs((prev) => [revision, ...prev]);
    setSelectedOutputId(revision.id);
    notify(
      'success',
      `Nueva revisión editable en Borrador (${revision.code} v${revision.version}) creada. Las asociaciones vigentes conservan v${base.version} hasta que decida actualizarlas.`
    );
    return revision;
  };

  const deriveVariantFromOutput = (
    baseOutputId: string,
    newCode: string,
    newName: string
  ): ConfiguredOutput | null => {
    const base = configuredOutputs.find((o) => o.id === baseOutputId);
    if (!base) return null;

    const newId = `OUT-VAR-${Date.now().toString(36).toUpperCase()}`;
    const newFingerprint = `sha256:var_${Date.now().toString(16)}`;
    const nowDate = getNowDate();

    const variant: ConfiguredOutput = {
      ...JSON.parse(JSON.stringify(base)),
      id: newId,
      code: newCode,
      name: newName,
      version: '1.0',
      status: 'Borrador',
      baseOutputId: base.id,
      derivationType: 'Variante autorizada',
      updatedAt: nowDate,
      fingerprint: newFingerprint,
      versionHistory: [
        {
          version: '1.0',
          status: 'Borrador',
          createdAt: getNowDateTime(),
          createdBy: activeUserRole,
          justification: `Variante autorizada derivada de base ${base.code} v${base.version}. Conserva vínculo con bloques compatibles.`,
          changesSummary: [`Derivación controlada desde ${base.code} (${base.version}).`],
          fingerprint: newFingerprint,
          baseVersionRef: `${base.code} v${base.version}`,
          derivationKind: 'Variante autorizada',
        },
      ],
    };

    setConfiguredOutputs((prev) => [variant, ...prev]);
    setSelectedOutputId(variant.id);
    notify('success', `Variante autorizada "${newCode}" creada con vínculo trazable a la base ${base.code}.`);
    return variant;
  };

  const duplicateOutputIndependently = (
    baseOutputId: string,
    newCode: string,
    newName: string
  ): ConfiguredOutput | null => {
    const base = configuredOutputs.find((o) => o.id === baseOutputId);
    if (!base) return null;

    const newId = `OUT-COPY-${Date.now().toString(36).toUpperCase()}`;
    const newFingerprint = `sha256:copy_${Date.now().toString(16)}`;
    const nowDate = getNowDate();

    const clone: ConfiguredOutput = {
      ...JSON.parse(JSON.stringify(base)),
      id: newId,
      code: newCode,
      name: newName,
      version: '1.0',
      status: 'Borrador',
      baseOutputId: undefined,
      derivationType: 'Copia independiente',
      updatedAt: nowDate,
      fingerprint: newFingerprint,
      versionHistory: [
        {
          version: '1.0',
          status: 'Borrador',
          createdAt: getNowDateTime(),
          createdBy: activeUserRole,
          justification: `Duplicación independiente solicitada por el usuario a partir de ${base.code}.`,
          changesSummary: [`Nueva salida independiente originada desde ${base.code}.`],
          fingerprint: newFingerprint,
          baseVersionRef: base.code,
          derivationKind: 'Clonación',
        },
      ],
    };

    setConfiguredOutputs((prev) => [clone, ...prev]);
    setSelectedOutputId(clone.id);
    notify('info', `Salida independiente "${newCode}" (v1.0) creada en estado Borrador.`);
    return clone;
  };

  const transitionOutputStatus = (
    outputId: string,
    nextStatus: LifecycleStatus,
    justification: string
  ): boolean => {
    const target = configuredOutputs.find((o) => o.id === outputId);
    if (!target) return false;

    const outType = outputTypes.find((t) => t.id === target.outputTypeId);
    if (
      (nextStatus === 'Aprobada' || nextStatus === 'Publicada') &&
      outType?.supportStatus === 'Candidata por certificar'
    ) {
      notify(
        'error',
        `Bloqueo de gobierno: No se puede aprobar ni publicar "${target.code}" porque el tipo de archivo ${outType.family} está en estado "${outType.supportStatus}".`
      );
      return false;
    }

    // Check unresolved conflicts or unmapped required fields before approving/publishing
    if (nextStatus === 'Aprobada' || nextStatus === 'Publicada') {
      const hasConflict = target.fields.some((f) => f.evidenceState === 'Fuentes en conflicto');
      const hasPendingCritical = target.fields.some(
        (f) => f.required && f.evidenceState === 'Requiere confirmación'
      );
      const hasUnmapped = target.fields.some(
        (f) => f.required && f.mapping.transformationKind === 'Directo' && !f.mapping.sourceField
      );
      if (hasConflict || hasPendingCritical || hasUnmapped) {
        notify(
          'error',
          `Bloqueo de validación: Resuelva primero los campos obligatorios sin origen asignado o las propiedades con evidencia en conflicto/pendiente antes de pasar a "${nextStatus}".`
        );
        return false;
      }
    }

    const nowDateTime = getNowDateTime();
    const nowDate = getNowDate();

    setConfiguredOutputs((prev) =>
      prev.map((o) => {
        if (o.id !== outputId) return o;
        const newEntry = {
          version: o.version,
          status: nextStatus,
          createdAt: nowDateTime,
          createdBy: activeUserRole,
          approvedBy:
            nextStatus === 'Aprobada' || nextStatus === 'Publicada'
              ? `${activeUserRole} · Comité de Gobierno`
              : undefined,
          justification: justification || `Transición controlada a ${nextStatus}`,
          changesSummary: [`Estado actualizado de ${o.status} a ${nextStatus}.`],
          fingerprint: o.fingerprint,
          derivationKind: 'Nueva revisión' as const,
        };
        return {
          ...o,
          status: nextStatus,
          updatedAt: nowDate,
          versionHistory: [...o.versionHistory, newEntry],
        };
      })
    );

    notify(
      'success',
      `Estado de "${target.code} v${target.version}" actualizado a "${nextStatus}". Las asociaciones existentes conservan su versión hasta que se actualicen explícitamente.`
    );
    return true;
  };

  const saveAssociation = (assoc: FormatOutputAssociation, silent = false) => {
    const updatedAssoc: FormatOutputAssociation = {
      ...assoc,
      updatedAt: getNowDate(),
      updatedBy: activeUserRole,
    };
    setAssociations((prev) => {
      const exists = prev.some((a) => a.id === updatedAssoc.id);
      if (exists) {
        return prev.map((a) => (a.id === updatedAssoc.id ? updatedAssoc : a));
      }
      return [...prev, updatedAssoc];
    });
    if (!silent) {
      notify(
        'success',
        `Asociación ${updatedAssoc.code} guardada en estado "${updatedAssoc.status}" apuntando a la versión v${updatedAssoc.configuredOutputVersion}.`
      );
    }
  };

  const deleteAssociation = (assocId: string) => {
    setAssociations((prev) => prev.filter((a) => a.id !== assocId));
    notify('info', 'Asociación eliminada del registro.');
  };

  const unlinkAssociation = (assocId: string, reason?: string) => {
    const target = associations.find((a) => a.id === assocId);
    if (!target) return;
    const hasExecutions = executionRuns.some((r) => r.associationId === assocId);
    if (hasExecutions || target.status === 'Activa') {
      const nowDate = getNowDate();
      setAssociations((prev) =>
        prev.map((a) =>
          a.id === assocId
            ? {
                ...a,
                status: 'Retirada',
                validTo: nowDate,
                updatedAt: nowDate,
                updatedBy: activeUserRole,
              }
            : a
        )
      );
      notify(
        'info',
        `Salida desvinculada operativamente (${target.code}): la asociación pasó a estado "Retirada" con fin de vigencia ${nowDate} (${
          reason || 'Desvinculación solicitada por el usuario'
        }). El formato de destino y la salida configurada se conservan intactos.`
      );
    } else {
      setAssociations((prev) => prev.filter((a) => a.id !== assocId));
      notify(
        'info',
        `Vínculo en borrador (${target.code}) desvinculado y retirado sin eliminar el formato ni la salida configurada.`
      );
    }
  };

  const adoptOutputVersionInAssociation = (assocId: string, newVersion: string) => {
    setAssociations((prev) =>
      prev.map((a) =>
        a.id === assocId
          ? {
              ...a,
              configuredOutputVersion: newVersion,
              updatedAt: getNowDate(),
              updatedBy: activeUserRole,
            }
          : a
      )
    );
    notify(
      'success',
      `Asociación actualizada explícitamente a la versión v${newVersion}. Los demás formatos asociados conservan su versión previa.`
    );
  };

  const runEnvironmentAction = (
    deploymentId: string,
    action: 'Notificar' | 'Descargar' | 'Instalar' | 'Activar' | 'Revertir'
  ) => {
    const now = getNowDateTime();
    setEnvironmentDeployments((prev) =>
      prev.map((dep) => {
        if (dep.id !== deploymentId) return dep;
        if (action === 'Notificar') {
          return {
            ...dep,
            notificationDate: now,
            auditTrail: [
              {
                stage: 'Notificación',
                timestamp: now,
                actor: activeUserRole,
                version: dep.availableVersion,
                detail: `Aviso de disponibilidad emitido para ${dep.environmentName}. No altera la versión activa (${dep.activeVersion}).`,
              },
              ...dep.auditTrail,
            ],
          };
        }
        if (action === 'Descargar') {
          const targetVer = dep.availableVersion.startsWith('Por importar') ? '3.1' : dep.availableVersion;
          return {
            ...dep,
            availableVersion: targetVer,
            downloadedDate: now,
            compatibilityStatus: 'Conforme',
            auditTrail: [
              {
                stage: 'Descarga',
                timestamp: now,
                actor: activeUserRole,
                version: targetVer,
                detail: `Paquete verificable recibido y firma criptográfica del manifiesto comprobada localmente.`,
              },
              ...dep.auditTrail,
            ],
          };
        }
        if (action === 'Instalar') {
          const targetVer = dep.availableVersion.startsWith('Por importar') ? '3.1' : dep.availableVersion;
          return {
            ...dep,
            installedVersion: targetVer,
            installedDate: now,
            compatibilityStatus: 'Conforme',
            auditTrail: [
              {
                stage: 'Instalación',
                timestamp: now,
                actor: activeUserRole,
                version: targetVer,
                detail: `Versión ${targetVer} instalada en ${dep.environmentName}. La versión operativa activa permanece en ${dep.activeVersion}.`,
              },
              ...dep.auditTrail,
            ],
          };
        }
        if (action === 'Activar') {
          const prevActive = dep.activeVersion;
          return {
            ...dep,
            previousCompatibleVersion: prevActive,
            activeVersion: dep.installedVersion,
            activatedDate: now,
            auditTrail: [
              {
                stage: 'Activación',
                timestamp: now,
                actor: activeUserRole,
                version: dep.installedVersion,
                detail: `Asociación activada con versión ${dep.installedVersion} en ${dep.environmentName} conservando los mismos binarios del producto (${dep.binaryRuntimeVersion}).`,
              },
              ...dep.auditTrail,
            ],
          };
        }
        if (action === 'Revertir') {
          const rollbackVer = dep.previousCompatibleVersion || '2.1';
          return {
            ...dep,
            activeVersion: rollbackVer,
            activatedDate: now,
            auditTrail: [
              {
                stage: 'Reversión',
                timestamp: now,
                actor: activeUserRole,
                version: rollbackVer,
                detail: `Reversión controlada hacia versión compatible previa v${rollbackVer}. Se preserva intacto el historial de ejecuciones.`,
              },
              ...dep.auditTrail,
            ],
          };
        }
        return dep;
      })
    );
    notify('success', `Acción "${action}" ejecutada y registrada en la bitácora del ambiente (${now}).`);
  };

  const decideTotaliaSuggestion = (
    suggestionId: string,
    decision: 'Aceptada en borrador' | 'Rechazada'
  ) => {
    const sug = totaliaSuggestions.find((s) => s.id === suggestionId);
    if (!sug) return;

    const nowDateTime = getNowDateTime();
    const nowDate = getNowDate();

    setTotaliaSuggestions((prev) =>
      prev.map((s) =>
        s.id === suggestionId
          ? {
              ...s,
              status: decision,
              decidedBy: activeUserRole,
              decidedAt: nowDateTime,
            }
          : s
      )
    );

    if (decision === 'Aceptada en borrador' && sug.fieldPatch) {
      const targetOutput = configuredOutputs.find((o) => o.id === sug.targetOutputId);
      if (targetOutput) {
        if (targetOutput.status === 'Publicada' || targetOutput.status === 'Aprobada') {
          // Create a draft revision automatically and apply patch to that draft
          const nextVer = bumpMinorVersion(targetOutput.version);
          const draftId = `${targetOutput.id}-REV-${nextVer.replace('.', '_')}`;
          const updatedFields: StructureField[] = targetOutput.fields.map((f) =>
            f.technicalName === sug.fieldPatch!.fieldTechnicalName
              ? { ...f, ...sug.fieldPatch!.updates }
              : f
          );
          const newDraft: ConfiguredOutput = {
            ...JSON.parse(JSON.stringify(targetOutput)),
            id: draftId,
            version: nextVer,
            status: 'Borrador',
            baseOutputId: targetOutput.id,
            derivationType: 'Revisión',
            updatedAt: nowDate,
            fields: updatedFields,
            versionHistory: [
              ...targetOutput.versionHistory,
              {
                version: nextVer,
                status: 'Borrador',
                createdAt: nowDateTime,
                createdBy: `${activeUserRole} (Asistido por TOTALiA®)`,
                justification: `Aplicación controlada de sugerencia TOTALiA: ${sug.title}`,
                changesSummary: [`${sug.elementAffected}: ${sug.currentValue} -> ${sug.proposedValue}`],
                fingerprint: `sha256:tot_${Date.now().toString(16)}`,
                baseVersionRef: targetOutput.version,
                derivationKind: 'Nueva revisión',
              },
            ],
          };
          setConfiguredOutputs((prev) => [newDraft, ...prev]);
          setSelectedOutputId(newDraft.id);
          notify(
            'success',
            `Sugerencia TOTALiA® aplicada en nuevo Borrador (${newDraft.code} v${newDraft.version}). Requiere validación y aprobación humana antes de publicarse.`
          );
          return;
        } else {
          // Apply directly to existing draft
          setConfiguredOutputs((prev) =>
            prev.map((o) => {
              if (o.id !== targetOutput.id) return o;
              return {
                ...o,
                updatedAt: nowDate,
                fields: o.fields.map((f) =>
                  f.technicalName === sug.fieldPatch!.fieldTechnicalName
                    ? { ...f, ...sug.fieldPatch!.updates }
                    : f
                ),
              };
            })
          );
          notify(
            'success',
            `Sugerencia TOTALiA® aplicada al borrador "${targetOutput.code}". No aprueba ni publica automáticamente.`
          );
          return;
        }
      }
    }

    notify(
      decision === 'Aceptada en borrador' ? 'success' : 'info',
      `Decisión registrada sobre sugerencia TOTALiA®: ${decision}.`
    );
  };

  const executeSimulatedRun = (params: {
    formatId: string;
    transmissionTypeId: string;
    modality: 'Inicial' | 'Corrección' | 'Reemplazo';
    cutoffPeriod: string;
    environment: 'QA' | 'Producción';
    injectZeroBalanceError?: boolean;
    injectOverflowError?: boolean;
  }): ExecutionRun | null => {
    const assoc = associations.find(
      (a) =>
        a.formatId === params.formatId &&
        a.transmissionTypeId === params.transmissionTypeId &&
        a.modality === params.modality &&
        a.environment === params.environment &&
        a.status === 'Activa'
    );

    if (!assoc) {
      notify(
        'error',
        'No se encontró una asociación activa única para el contexto solicitado. Verifique la pantalla D. Formatos y asociaciones.'
      );
      return null;
    }

    const output =
      configuredOutputs.find(
        (o) => o.id === assoc.configuredOutputId && o.version === assoc.configuredOutputVersion
      ) || configuredOutputs.find((o) => o.id === assoc.configuredOutputId);

    if (!output) {
      notify('error', 'La salida configurada referenciada por la asociación no existe.');
      return null;
    }

    const outType = outputTypes.find((t) => t.id === output.outputTypeId) || outputTypes[0];
    const fmt = regulatoryFormats.find((f) => f.id === params.formatId);
    const daque = daqueProfiles.find((d) => d.id === assoc.daqueProfileId);
    const baseContract =
      dataContracts.find((c) => c.id === output.dataContractId) || dataContracts[0];

    const contractForRun: DataContract =
      params.injectZeroBalanceError || params.injectOverflowError
        ? {
            ...baseContract,
            executionBatches: (baseContract.executionBatches || []).map((b) => ({
              ...b,
              rows: b.rows.map((r, idx) => {
                const copy = { ...r };
                if (params.injectZeroBalanceError && idx === 1) {
                  copy.saldo = 0;
                }
                if (params.injectOverflowError && idx === 0) {
                  copy.nombre =
                    'Consorcio Financiero Internacional de Supervisión Bancaria Multilateral';
                }
                return copy;
              }),
            })),
          }
        : baseContract;

    const artifact = generateOutputArtifact({
      output,
      outputType: outType,
      contract: contractForRun,
      allContracts: dataContracts,
      daqueProfile: daque,
      entidad: globalEntity,
      context: {
        entidad: globalEntity.replace(/\s+/g, '_'),
        formato: fmt?.code || 'DEMO-01',
        periodo: params.cutoffPeriod,
        version: output.version,
      },
    });

    const blockingCount = artifact.findings.filter((f) => f.severity === 'Bloqueante').length;
    const warningCount = artifact.findings.filter((f) => f.severity === 'Advertencia').length;
    const computedState = artifact.readinessMatrix.deliveryReadinessStatus.state;

    const newRun: ExecutionRun = {
      id: `RUN-${Date.now().toString(36).toUpperCase()}`,
      runCode: `DEMO-GEN-00${executionRuns.length + 43}`,
      createdAt: getNowDateTime(),
      entityScope: globalEntity,
      environment: params.environment,
      cutoffPeriod: params.cutoffPeriod,
      formatId: params.formatId,
      transmissionTypeId: params.transmissionTypeId,
      modality: params.modality,
      associationId: assoc.id,
      configuredOutputId: output.id,
      configuredOutputVersion: output.version,
      deliveryChannelId: assoc.deliveryChannelId,
      daqueProfileId: assoc.daqueProfileId,
      snapshotId: baseContract.snapshotId,
      sourceExecutionBatchId: artifact.sourceExecutionBatchId,
      sourceExecutionSummary: artifact.sourceExecutionSummary,
      recordsReviewed: artifact.rowsProcessed,
      blockingCount,
      warningCount,
      generationState: computedState,
      deliveryState: 'Pendiente de envío / descarga',
      generatedFileName: artifact.fileName,
      generatedFileContent: artifact.content,
      generatedMimeType: artifact.mimeType,
      sha256Hash: `sha256:${Date.now().toString(16)}a8f41209c3b1`,
      binaryRuntimeFingerprint: `TÓTAL REPORT® Core v8.4.2 · ${outType.engineHash.slice(0, 22)}`,
      configFingerprint: output.fingerprint,
      isPreloadedDemo: false,
      findings: artifact.findings,
    };

    setExecutionRuns((prev) => [newRun, ...prev]);

    if (blockingCount > 0) {
      notify(
        'warning',
        `Ejecución ${newRun.runCode} finalizada con ${blockingCount} bloqueo(s). Estado: ${computedState}.`
      );
    } else if (!outType.canGenerateRealFileInBrowser) {
      notify(
        'info',
        `Ejecución ${newRun.runCode}: Esquema y datos validados sin bloqueos. Nota: La generación de archivo binario ${outType.family} no está disponible en navegador (requiere motor en servidor).`
      );
    } else {
      notify(
        'success',
        `Ejecución ${newRun.runCode} completada con 0 bloqueos. Archivo físico ${newRun.generatedFileName} generado y disponible para descarga.`
      );
    }
    return newRun;
  };

  const updateRunDeliveryState = (
    runId: string,
    nextDeliveryState: ExecutionRun['deliveryState'],
    ack?: string
  ) => {
    setExecutionRuns((prev) =>
      prev.map((r) =>
        r.id === runId
          ? {
              ...r,
              deliveryState: nextDeliveryState,
              externalAckReceipt: ack ?? r.externalAckReceipt,
            }
          : r
      )
    );
    notify('success', `Estado de entrega de la corrida actualizado a: "${nextDeliveryState}".`);
  };

  const exportDomainJson = (): string => {
    return JSON.stringify(
      {
        schemaVersion: 'TOTAL-REPORT-CES-1.5',
        exportedAt: new Date().toISOString(),
        outputTypes,
        configuredOutputs,
        dataContracts,
        catalogSourceFormats,
        associations,
        environmentDeployments,
        totaliaSuggestions,
        executionRuns,
      },
      null,
      2
    );
  };

  const importDomainJson = (rawJson: string): boolean => {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed.outputTypes || !parsed.configuredOutputs) {
        notify('error', 'El archivo JSON no contiene un modelo de dominio válido de TÓTAL REPORT®.');
        return false;
      }
      setOutputTypes(parsed.outputTypes);
      setConfiguredOutputs(parsed.configuredOutputs);
      if (parsed.dataContracts) setDataContracts(parsed.dataContracts);
      if (parsed.catalogSourceFormats) setCatalogSourceFormats(parsed.catalogSourceFormats);
      if (parsed.associations) setAssociations(parsed.associations);
      if (parsed.environmentDeployments) setEnvironmentDeployments(parsed.environmentDeployments);
      notify('success', 'Repositorio de configuraciones importado y verificado correctamente.');
      return true;
    } catch {
      notify('error', 'Error de sintaxis al leer el paquete JSON.');
      return false;
    }
  };

  const restoreBackupSnapshot = (): boolean => {
    try {
      const backup = localStorage.getItem(BACKUP_STORAGE_KEY);
      if (!backup) {
        notify('info', 'No se encontró una instantánea previa de migración en este navegador.');
        return false;
      }
      return importDomainJson(backup);
    } catch {
      notify('error', 'No fue posible restaurar la instantánea previa.');
      return false;
    }
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setOutputTypes(INITIAL_OUTPUT_TYPES);
    setConfiguredOutputs(INITIAL_CONFIGURED_OUTPUTS);
    setDataContracts(INITIAL_DATA_CONTRACTS);
    setCatalogSourceFormats(INITIAL_CATALOG_SOURCE_FORMATS);
    setRegulatoryFormats(INITIAL_REGULATORY_FORMATS);
    setReceivingOrganisms(INITIAL_RECEIVING_ORGANISMS);
    setAssociations(INITIAL_ASSOCIATIONS);
    setEnvironmentDeployments(INITIAL_ENVIRONMENT_DEPLOYMENTS);
    setTotaliaSuggestions(INITIAL_TOTALIA_SUGGESTIONS);
    setExecutionRuns(INITIAL_EXECUTION_RUNS);
    setSelectedOutputId('OUT-CSV-DEMO-A');
    notify('info', 'Datos de demostración restaurados al estado inicial de fábrica.');
  };

  return (
    <ConfiguratorContext.Provider
      value={{
        activeModule: activeModuleState,
        setActiveModule,
        selectedOutputId,
        setSelectedOutputId,
        activeBuilderStep,
        setActiveBuilderStep,
        globalPeriod,
        setGlobalPeriod,
        globalEnvironment,
        setGlobalEnvironment,
        globalEntity,
        setGlobalEntity,
        activeUserRole,
        setActiveUserRole,
        lastSavedAt,
        outputTypes,
        configuredOutputs,
        dataContracts,
        catalogSourceFormats,
        daqueProfiles,
        regulatoryFormats,
        receivingOrganisms,
        entityTypes,
        transmissionTypes,
        deliveryChannels,
        associations,
        environmentDeployments,
        totaliaSuggestions,
        executionRuns,
        normativeSources,
        bannerMessage,
        notify,
        clearBanner,
        saveOutputType,
        addReceivingOrganism,
        createRegulatoryFormat,
        updateRegulatoryFormat,
        editRegulatoryFormat,
        deleteRegulatoryFormat,
        toggleFormatLifecycleStatus,
        openAssociationForFormat,
        preselectedAssocFormatId,
        setPreselectedAssocFormatId,
        createNewOutputForFormat,
        saveDataContract,
        saveCatalogSourceFormat,
        importCatalogEntriesBatch,
        registerStructureForCatalogEntry,
        addExecutionBatchToContract,
        openOutputInBuilder,
        openAssociationForOutput,
        preselectedAssocOutputId,
        setPreselectedAssocOutputId,
        saveConfiguredOutput,
        deleteConfiguredOutput,
        createNewRevisionFromOutput,
        deriveVariantFromOutput,
        duplicateOutputIndependently,
        transitionOutputStatus,
        saveAssociation,
        deleteAssociation,
        unlinkAssociation,
        adoptOutputVersionInAssociation,
        runEnvironmentAction,
        decideTotaliaSuggestion,
        executeSimulatedRun,
        updateRunDeliveryState,
        exportDomainJson,
        importDomainJson,
        restoreBackupSnapshot,
        resetDemoData,
      }}
    >
      {children}
    </ConfiguratorContext.Provider>
  );
};

export const useConfigurator = (): ConfiguratorContextValue => {
  const ctx = useContext(ConfiguratorContext);
  if (!ctx) {
    throw new Error('useConfigurator debe utilizarse dentro de ConfiguratorProvider');
  }
  return ctx;
};
