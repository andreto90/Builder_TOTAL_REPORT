import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ConfiguredOutput,
  DaqueFormatProfile,
  DataContract,
  DeliveryChannel,
  EnvironmentDeploymentState,
  ExecutionRun,
  FormatOutputAssociation,
  LifecycleStatus,
  NormativeSourceDoc,
  OutputType,
  RegulatoryFormat,
  StructureField,
  TotaliaSuggestion,
  TransmissionType,
  UserRole,
} from '../domain/types';
import {
  INITIAL_ASSOCIATIONS,
  INITIAL_CONFIGURED_OUTPUTS,
  INITIAL_DAQUE_PROFILES,
  INITIAL_DATA_CONTRACTS,
  INITIAL_DELIVERY_CHANNELS,
  INITIAL_ENVIRONMENT_DEPLOYMENTS,
  INITIAL_EXECUTION_RUNS,
  INITIAL_NORMATIVE_SOURCES,
  INITIAL_OUTPUT_TYPES,
  INITIAL_REGULATORY_FORMATS,
  INITIAL_TOTALIA_SUGGESTIONS,
  INITIAL_TRANSMISSION_TYPES,
} from '../domain/seedData';
import { generateOutputArtifact } from '../domain/engine';

export type ActiveModuleView =
  | 'dashboard'
  | 'output-types'
  | 'builder'
  | 'associations'
  | 'governance'
  | 'totalia'
  | 'simulator';

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

  // Domain Repositories
  outputTypes: OutputType[];
  configuredOutputs: ConfiguredOutput[];
  dataContracts: DataContract[];
  daqueProfiles: DaqueFormatProfile[];
  regulatoryFormats: RegulatoryFormat[];
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
  saveAssociation: (assoc: FormatOutputAssociation) => void;
  deleteAssociation: (assocId: string) => void;
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
  resetDemoData: () => void;
}

const STORAGE_KEY = 'total_report_configurator_state_v12';

const ConfiguratorContext = createContext<ConfiguratorContextValue | undefined>(undefined);

export const ConfiguratorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModule, setActiveModule] = useState<ActiveModuleView>('dashboard');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('OUT-CSV-DEMO-A');
  const [preselectedAssocOutputId, setPreselectedAssocOutputId] = useState<string | null>(null);
  const [activeBuilderStep, setActiveBuilderStep] = useState<number>(1);
  const [globalPeriod, setGlobalPeriod] = useState<string>('2026-11');
  const [globalEnvironment, setGlobalEnvironment] = useState<'QA' | 'Producción'>('QA');
  const [globalEntity, setGlobalEntity] = useState<string>('Entidad DEMO');
  const [activeUserRole, setActiveUserRole] = useState<UserRole>('Implementador técnico / regulatorio');

  const [outputTypes, setOutputTypes] = useState<OutputType[]>(INITIAL_OUTPUT_TYPES);
  const [configuredOutputs, setConfiguredOutputs] = useState<ConfiguredOutput[]>(INITIAL_CONFIGURED_OUTPUTS);
  const [dataContracts] = useState<DataContract[]>(INITIAL_DATA_CONTRACTS);
  const [daqueProfiles] = useState<DaqueFormatProfile[]>(INITIAL_DAQUE_PROFILES);
  const [regulatoryFormats] = useState<RegulatoryFormat[]>(INITIAL_REGULATORY_FORMATS);
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

  // Load persisted state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.outputTypes) setOutputTypes(parsed.outputTypes);
        if (parsed.configuredOutputs) setConfiguredOutputs(parsed.configuredOutputs);
        if (parsed.associations) setAssociations(parsed.associations);
        if (parsed.environmentDeployments) setEnvironmentDeployments(parsed.environmentDeployments);
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
        associations,
        environmentDeployments,
        totaliaSuggestions,
        executionRuns,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }, [
    outputTypes,
    configuredOutputs,
    associations,
    environmentDeployments,
    totaliaSuggestions,
    executionRuns,
  ]);

  const openOutputInBuilder = (outputId: string, step = 1) => {
    setSelectedOutputId(outputId);
    setActiveBuilderStep(step);
    setActiveModule('builder');
  };

  const openAssociationForOutput = (outputId: string) => {
    setSelectedOutputId(outputId);
    setPreselectedAssocOutputId(outputId);
    setActiveModule('associations');
  };

  const saveOutputType = (typeItem: OutputType) => {
    setOutputTypes((prev) => {
      const exists = prev.some((t) => t.id === typeItem.id);
      if (exists) {
        return prev.map((t) => (t.id === typeItem.id ? typeItem : t));
      }
      return [...prev, typeItem];
    });
    notify('success', `Tipo de salida "${typeItem.name}" (${typeItem.code}) guardado correctamente.`);
  };

  const saveConfiguredOutput = (updated: ConfiguredOutput, silent = false) => {
    setConfiguredOutputs((prev) => {
      const existing = prev.find((o) => o.id === updated.id);
      if (existing && (existing.status === 'Publicada' || existing.status === 'Aprobada')) {
        if (!silent) {
          notify(
            'error',
            `La salida ${existing.code} v${existing.version} está en estado "${existing.status}" y no puede modificarse directamente. Cree una nueva revisión para editar.`
          );
        }
        return prev;
      }
      const exists = prev.some((o) => o.id === updated.id);
      if (exists) {
        return prev.map((o) => (o.id === updated.id ? { ...updated, updatedAt: '2026-11-09' } : o));
      }
      return [
        { ...updated, updatedAt: '2026-11-09' },
        ...prev,
      ];
    });
    if (!silent) {
      notify('success', `Cambios de la salida "${updated.code}" (v${updated.version}) guardados correctamente.`);
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
    const newId = `${base.id}-REV-${nextVer.replace('.', '_')}`;
    const newFingerprint = `sha256:rev_${Date.now().toString(16)}`;

    const revision: ConfiguredOutput = {
      ...JSON.parse(JSON.stringify(base)),
      id: newId,
      version: nextVer,
      status: 'Borrador',
      baseOutputId: base.id,
      derivationType: 'Revisión',
      updatedAt: '2026-11-05',
      fingerprint: newFingerprint,
      versionHistory: [
        ...base.versionHistory,
        {
          version: nextVer,
          status: 'Borrador',
          createdAt: '2026-11-05',
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
      `Nueva revisión en Borrador (${revision.code} v${revision.version}) creada. Las asociaciones vigentes conservan v${base.version} hasta su adopción explícita.`
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

    const variant: ConfiguredOutput = {
      ...JSON.parse(JSON.stringify(base)),
      id: newId,
      code: newCode,
      name: newName,
      version: '1.0',
      status: 'Borrador',
      baseOutputId: base.id,
      derivationType: 'Variante autorizada',
      updatedAt: '2026-11-05',
      fingerprint: newFingerprint,
      versionHistory: [
        {
          version: '1.0',
          status: 'Borrador',
          createdAt: '2026-11-05',
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

    const clone: ConfiguredOutput = {
      ...JSON.parse(JSON.stringify(base)),
      id: newId,
      code: newCode,
      name: newName,
      version: '1.0',
      status: 'Borrador',
      baseOutputId: undefined,
      derivationType: 'Copia independiente',
      updatedAt: '2026-11-05',
      fingerprint: newFingerprint,
      versionHistory: [
        {
          version: '1.0',
          status: 'Borrador',
          createdAt: '2026-11-05',
          createdBy: activeUserRole,
          justification: `Clonación explícita solicitada por el usuario a partir de ${base.code}.`,
          changesSummary: [`Nueva identidad independiente originada desde ${base.code}.`],
          fingerprint: newFingerprint,
          baseVersionRef: base.code,
          derivationKind: 'Clonación',
        },
      ],
    };

    setConfiguredOutputs((prev) => [clone, ...prev]);
    setSelectedOutputId(clone.id);
    notify('info', `Copia independiente "${newCode}" creada en estado Borrador.`);
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
        `Bloqueo de gobierno (Ruta R6): No se puede aprobar ni publicar "${target.code}" porque el tipo técnico ${outType.family} está en estado "${outType.supportStatus}".`
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
          `Bloqueo de validación: Resuelva primero los campos obligatorios sin mapeo o las propiedades críticas con evidencia pendiente/en conflicto antes de pasar a "${nextStatus}".`
        );
        return false;
      }
    }

    setConfiguredOutputs((prev) =>
      prev.map((o) => {
        if (o.id !== outputId) return o;
        const newEntry = {
          version: o.version,
          status: nextStatus,
          createdAt: '2026-11-05',
          createdBy: activeUserRole,
          approvedBy:
            nextStatus === 'Aprobada' || nextStatus === 'Publicada'
              ? 'Comité de Gobierno y Regulación'
              : undefined,
          justification: justification || `Transición controlada a ${nextStatus}`,
          changesSummary: [`Estado actualizado de ${o.status} a ${nextStatus}.`],
          fingerprint: o.fingerprint,
          derivationKind: 'Nueva revisión' as const,
        };
        return {
          ...o,
          status: nextStatus,
          updatedAt: '2026-11-05',
          versionHistory: [...o.versionHistory, newEntry],
        };
      })
    );

    notify(
      'success',
      `Estado de "${target.code} v${target.version}" actualizado a "${nextStatus}". Las asociaciones existentes no se migran silenciosamente.`
    );
    return true;
  };

  const saveAssociation = (assoc: FormatOutputAssociation) => {
    setAssociations((prev) => {
      const exists = prev.some((a) => a.id === assoc.id);
      if (exists) {
        return prev.map((a) => (a.id === assoc.id ? assoc : a));
      }
      return [...prev, assoc];
    });
    notify(
      'success',
      `Asociación ${assoc.code} guardada por referencia hacia la salida configurada (v${assoc.configuredOutputVersion}) sin duplicar la definición.`
    );
  };

  const deleteAssociation = (assocId: string) => {
    setAssociations((prev) => prev.filter((a) => a.id !== assocId));
    notify('info', 'Asociación eliminada del registro.');
  };

  const adoptOutputVersionInAssociation = (assocId: string, newVersion: string) => {
    setAssociations((prev) =>
      prev.map((a) =>
        a.id === assocId
          ? {
              ...a,
              configuredOutputVersion: newVersion,
              updatedAt: '2026-11-05',
              updatedBy: activeUserRole,
            }
          : a
      )
    );
    notify(
      'success',
      `Asociación actualizada explícitamente a la versión ${newVersion}. Los demás consumidores mantienen su versión previa.`
    );
  };

  const runEnvironmentAction = (
    deploymentId: string,
    action: 'Notificar' | 'Descargar' | 'Instalar' | 'Activar' | 'Revertir'
  ) => {
    const now = '2026-11-05 16:30';
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
    notify('success', `Evento independiente "${action}" registrado y trazado en el ambiente seleccionado.`);
  };

  const decideTotaliaSuggestion = (
    suggestionId: string,
    decision: 'Aceptada en borrador' | 'Rechazada'
  ) => {
    const sug = totaliaSuggestions.find((s) => s.id === suggestionId);
    if (!sug) return;

    setTotaliaSuggestions((prev) =>
      prev.map((s) =>
        s.id === suggestionId
          ? {
              ...s,
              status: decision,
              decidedBy: activeUserRole,
              decidedAt: '2026-11-05 16:35',
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
            updatedAt: '2026-11-05',
            fields: updatedFields,
            versionHistory: [
              ...targetOutput.versionHistory,
              {
                version: nextVer,
                status: 'Borrador',
                createdAt: '2026-11-05',
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
        'No se encontró una asociación activa única para el contexto solicitado. Verifique la matriz de asociaciones.'
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
    const baseContract = dataContracts[0];

    const customRows = baseContract.demoRows.map((r, idx) => {
      let copy = { ...r };
      if (params.injectZeroBalanceError && idx === 1) {
        copy.saldo = 0;
      }
      if (params.injectOverflowError && idx === 0) {
        copy.nombre = 'Consorcio Financiero Internacional de Supervisión Bancaria Multilateral';
      }
      return copy;
    });

    const artifact = generateOutputArtifact({
      output,
      outputType: outType,
      contract: { ...baseContract, demoRows: customRows },
      daqueProfile: daque,
      context: {
        entidad: globalEntity.replace(/\s+/g, '_'),
        formato: fmt?.code || 'DEMO-01',
        periodo: params.cutoffPeriod,
        version: output.version,
      },
    });

    const blockingCount = artifact.findings.filter((f) => f.severity === 'Bloqueante').length;
    const warningCount = artifact.findings.filter((f) => f.severity === 'Advertencia').length;
    const hasDaqueBlock = artifact.findings.some(
      (f) => f.layer === 'Datos del formato (DAQUE)' && f.severity === 'Bloqueante'
    );

    const newRun: ExecutionRun = {
      id: `RUN-${Date.now().toString(36).toUpperCase()}`,
      runCode: `DEMO-GEN-00${executionRuns.length + 43}`,
      createdAt: '2026-11-05 16:40:00',
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
      recordsReviewed: artifact.rowsProcessed,
      blockingCount,
      warningCount,
      generationState: hasDaqueBlock
        ? 'Bloqueada en precondición DAQUE'
        : blockingCount > 0
        ? 'Bloqueada en estructura/archivo'
        : 'Lista para entrega',
      deliveryState: 'Pendiente de envío / descarga',
      generatedFileName: artifact.fileName,
      generatedFileContent: artifact.content,
      generatedMimeType: artifact.mimeType,
      sha256Hash: `sha256:${Date.now().toString(16)}a8f41209c3b1`,
      binaryRuntimeFingerprint: `TÓTAL REPORT® Core v8.4.2 · ${outType.engineHash.slice(0, 22)}`,
      findings: artifact.findings,
    };

    setExecutionRuns((prev) => [newRun, ...prev]);
    notify(
      blockingCount > 0 ? 'warning' : 'success',
      blockingCount > 0
        ? `Ejecución ${newRun.runCode} finalizada con ${blockingCount} bloqueo(s). Revise los hallazgos por capa.`
        : `Ejecución ${newRun.runCode} completada con 0 bloqueos. Conjunto listo para entrega.`
    );
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
    notify('success', `Estado de entrega actualizado a: "${nextDeliveryState}".`);
  };

  const exportDomainJson = (): string => {
    return JSON.stringify(
      {
        schemaVersion: 'TOTAL-REPORT-CES-1.2',
        exportedAt: new Date().toISOString(),
        outputTypes,
        configuredOutputs,
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
      if (parsed.associations) setAssociations(parsed.associations);
      if (parsed.environmentDeployments) setEnvironmentDeployments(parsed.environmentDeployments);
      notify('success', 'Repositorio de configuraciones importado y verificado correctamente.');
      return true;
    } catch {
      notify('error', 'Error de sintaxis al leer el paquete JSON.');
      return false;
    }
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setOutputTypes(INITIAL_OUTPUT_TYPES);
    setConfiguredOutputs(INITIAL_CONFIGURED_OUTPUTS);
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
        activeModule,
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
        outputTypes,
        configuredOutputs,
        dataContracts,
        daqueProfiles,
        regulatoryFormats,
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
        adoptOutputVersionInAssociation,
        runEnvironmentAction,
        decideTotaliaSuggestion,
        executeSimulatedRun,
        updateRunDeliveryState,
        exportDomainJson,
        importDomainJson,
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
