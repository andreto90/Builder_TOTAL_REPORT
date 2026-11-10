import React, { useState, useMemo } from 'react';
import { useConfigurator } from '../context/ConfiguratorContext';
import {
  RegulatoryFormat,
  TechnicalFamily,
  FormatLifecycleStatus,
  ReceivingOrganismDefinition,
} from '../domain/types';
import {
  filterRegulatoryFormats,
  validateAssociationContext,
  generateTotaliaFormatRecommendations,
  checkFormatDuplicateCandidates,
  evaluateFormatDependencies,
  evaluateFormatEditImpact,
  computeOrganismSummaries,
} from '../domain/engine';
import {
  Search,
  Filter,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Plus,
  Eye,
  Link2,
  FileSpreadsheet,
  Building2,
  X,
  Check,
  Edit3,
  Trash2,
  PowerOff,
  Power,
  Unlink,
  ExternalLink,
  Upload,
  History,
  FileText,
} from 'lucide-react';

interface TooltipProps {
  title: string;
  body: string;
}

const TooltipHelp: React.FC<TooltipProps> = ({ title, body }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`Ayuda sobre ${title}`}
        className="text-slate-400 hover:text-[#1E4E8C] focus:outline-none focus:ring-2 focus:ring-[#1E4E8C] rounded-full cursor-pointer"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-2.5 bg-slate-900 text-white text-[11px] rounded shadow-xl z-50 pointer-events-none leading-relaxed border border-slate-700"
        >
          <div className="font-bold text-sky-300 mb-0.5">{title}</div>
          <div className="text-slate-200 font-normal">{body}</div>
        </div>
      )}
    </span>
  );
};

interface DestinationFormatsCatalogViewProps {
  onSwitchToAssociationsTab?: (formatIdFilter?: string) => void;
}

const ENTITY_COUNTRY_MAP: Record<
  string,
  { country: 'Colombia' | 'Perú'; entityType: string }
> = {
  'Entidad DEMO': {
    country: 'Colombia',
    entityType: 'Establecimientos Bancarios',
  },
  'Banco Supervisado CO': {
    country: 'Colombia',
    entityType: 'Establecimientos Bancarios',
  },
  'Cooperativa Financiera de Antioquia': {
    country: 'Colombia',
    entityType: 'Cooperativas Financieras y de Ahorro y Crédito',
  },
  'Financiera Supervisada PE': {
    country: 'Perú',
    entityType: 'Empresas Bancarias y Financieras (SBS)',
  },
};

export const DestinationFormatsCatalogView: React.FC<DestinationFormatsCatalogViewProps> = ({
  onSwitchToAssociationsTab,
}) => {
  const {
    globalEntity,
    globalPeriod,
    globalEnvironment,
    activeUserRole,
    regulatoryFormats,
    receivingOrganisms,
    entityTypes,
    transmissionTypes,
    deliveryChannels,
    configuredOutputs,
    outputTypes,
    associations,
    executionRuns,
    preselectedAssocOutputId,
    setPreselectedAssocOutputId,
    addReceivingOrganism,
    createRegulatoryFormat,
    updateRegulatoryFormat,
    editRegulatoryFormat,
    deleteRegulatoryFormat,
    toggleFormatLifecycleStatus,
    saveAssociation,
    unlinkAssociation,
    openOutputInBuilder,
    createNewOutputForFormat,
  } = useConfigurator();

  const activeEntityContext = useMemo(
    () =>
      ENTITY_COUNTRY_MAP[globalEntity] || {
        country: 'Colombia' as const,
        entityType: 'Establecimientos Bancarios',
      },
    [globalEntity]
  );

  // Sub-view mode inside Option D Tab 1: 'catalog' vs 'by_organism'
  const [catalogSubMode, setCatalogSubMode] = useState<'catalog' | 'by_organism'>('catalog');

  // Independent & combinable filters
  const [selectedCountry, setSelectedCountry] = useState<'ALL' | 'Colombia' | 'Perú'>(
    activeEntityContext.country
  );
  const [selectedRegulator, setSelectedRegulator] = useState<string>('ALL');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('ALL');
  const [selectedPeriodicity, setSelectedPeriodicity] = useState<string>('ALL');
  const [selectedReportingModality, setSelectedReportingModality] = useState<
    'ALL' | 'Periódico' | 'Por evento'
  >('ALL');
  const [selectedAvailability, setSelectedAvailability] = useState<
    | 'ALL'
    | 'Vigente'
    | 'Por entrar en vigencia'
    | 'Histórico / En revisión'
    | 'Pendiente de especificación'
  >('ALL');
  const [selectedLifecycleStatus, setSelectedLifecycleStatus] = useState<
    'ALL' | FormatLifecycleStatus
  >('ALL');
  const [selectedClassification, setSelectedClassification] = useState<
    | 'ALL'
    | 'Clasificado y validado'
    | 'Pendiente de clasificación'
    | 'Con observaciones de aplicabilidad'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleResetToActiveContext = () => {
    setSelectedCountry(activeEntityContext.country);
    setSelectedEntityType(activeEntityContext.entityType);
    setSelectedRegulator('ALL');
    setSelectedPeriodicity('ALL');
    setSelectedReportingModality('ALL');
    setSelectedAvailability('ALL');
    setSelectedLifecycleStatus('ALL');
    setSelectedClassification('ALL');
    setSearchQuery('');
  };

  // Available entity types for selected country
  const availableEntityTypes = useMemo(() => {
    const fromCat = entityTypes
      .filter((et) => selectedCountry === 'ALL' || et.country === selectedCountry)
      .map((et) => et.name);
    const fromFormats = regulatoryFormats
      .filter((f) => selectedCountry === 'ALL' || (f.country || f.jurisdiction) === selectedCountry)
      .flatMap((f) => f.applicableEntityTypes);
    return Array.from(new Set([...fromCat, ...fromFormats])).sort();
  }, [entityTypes, regulatoryFormats, selectedCountry]);

  // Available receiving organisms for selected country
  const availableRegulators = useMemo(() => {
    const fromOrgs = receivingOrganisms
      .filter((o) => selectedCountry === 'ALL' || o.country === selectedCountry)
      .map((o) => o.name);
    const fromFormats = regulatoryFormats
      .filter((f) => selectedCountry === 'ALL' || (f.country || f.jurisdiction) === selectedCountry)
      .map((f) => f.regulator);
    return Array.from(new Set([...fromOrgs, ...fromFormats])).sort();
  }, [receivingOrganisms, regulatoryFormats, selectedCountry]);

  // Organism summaries for "Formatos por organismo receptor"
  const organismSummaries = useMemo(
    () =>
      computeOrganismSummaries({
        organisms: receivingOrganisms,
        formats: regulatoryFormats,
        associations,
        countryFilter: selectedCountry,
        entityTypeFilter: selectedEntityType,
      }),
    [receivingOrganisms, regulatoryFormats, associations, selectedCountry, selectedEntityType]
  );

  // Filtered formats result
  const filterResult = useMemo(
    () =>
      filterRegulatoryFormats(regulatoryFormats, {
        country: selectedCountry,
        entityType: selectedEntityType,
        regulator: selectedRegulator,
        periodicity: selectedPeriodicity,
        reportingModality: selectedReportingModality,
        lifecycleStatus: selectedLifecycleStatus,
        classificationStatus: selectedClassification,
        normativeAvailability: selectedAvailability,
        searchQuery,
      }),
    [
      regulatoryFormats,
      selectedCountry,
      selectedEntityType,
      selectedRegulator,
      selectedPeriodicity,
      selectedReportingModality,
      selectedLifecycleStatus,
      selectedClassification,
      selectedAvailability,
      searchQuery,
    ]
  );

  const filteredFormats = filterResult.filtered;

  // Modals State
  const [detailFormat, setDetailFormat] = useState<RegulatoryFormat | null>(null);
  const [associateModalFormat, setAssociateModalFormat] = useState<RegulatoryFormat | null>(null);
  const [classifyModalFormat, setClassifyModalFormat] = useState<RegulatoryFormat | null>(null);
  const [totaliaModalFormat, setTotaliaModalFormat] = useState<RegulatoryFormat | null>(null);

  // Format Lifecycle Administration Modals
  const [showAddFormatModal, setShowAddFormatModal] = useState<boolean>(false);
  const [editModalFormat, setEditModalFormat] = useState<RegulatoryFormat | null>(null);
  const [deleteOrDeactivateFormat, setDeleteOrDeactivateFormat] =
    useState<RegulatoryFormat | null>(null);
  const [showAddOrganismModal, setShowAddOrganismModal] = useState<boolean>(false);

  // Feedback Banner
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const pendingOutput = useMemo(
    () => configuredOutputs.find((o) => o.id === preselectedAssocOutputId) || null,
    [configuredOutputs, preselectedAssocOutputId]
  );

  const canManageCatalog = activeUserRole !== 'Operador de reporte';

  // ============================================================================
  // ASSOCIATION MODAL STATE & HANDLERS
  // ============================================================================
  const [assocOutputId, setAssocOutputId] = useState<string>('');
  const [assocTransmissionId, setAssocTransmissionId] = useState<string>('');
  const [assocChannelId, setAssocChannelId] = useState<string>('');
  const [assocModality, setAssocModality] = useState<'Inicial' | 'Corrección' | 'Reemplazo'>(
    'Inicial'
  );
  const [assocStatus, setAssocStatus] = useState<
    'Activa' | 'Instalada sin activar' | 'Borrador'
  >('Activa');
  const [assocValidFrom, setAssocValidFrom] = useState<string>('2026-01-01');
  const [assocPrefixOverride, setAssocPrefixOverride] = useState<string>('');

  const handleOpenAssociateModal = (format: RegulatoryFormat) => {
    setAssociateModalFormat(format);
    const defaultOutputId =
      preselectedAssocOutputId ||
      configuredOutputs.find((o) => {
        const ot = outputTypes.find((t) => t.id === o.outputTypeId);
        return ot && (format.supportedFamilies || []).includes(ot.family);
      })?.id ||
      configuredOutputs[0]?.id ||
      '';
    setAssocOutputId(defaultOutputId);

    const defaultTransId =
      format.enabledTransmissionTypes[0] ||
      transmissionTypes[0]?.id ||
      'TX-ORDINARIO';
    setAssocTransmissionId(defaultTransId);
    setAssocChannelId(deliveryChannels[0]?.id || 'CHAN-MANUAL-01');
    setAssocModality('Inicial');
    setAssocStatus(
      format.classificationStatus === 'Pendiente de clasificación' ||
        format.normativeAvailability === 'Por entrar en vigencia' ||
        format.lifecycleStatus === 'Borrador' ||
        format.lifecycleStatus === 'Inactivo'
        ? 'Instalada sin activar'
        : 'Activa'
    );
    setAssocValidFrom(format.specificationValidity?.validFrom || '2026-01-01');
    const cleanCode = (format.code || format.internalCode || 'FMT').replace(
      /[^A-Za-z0-9]/g,
      '_'
    );
    setAssocPrefixOverride(`${cleanCode}_`);
  };

  const assocValidation = useMemo(() => {
    if (!associateModalFormat) return null;
    const out = configuredOutputs.find((o) => o.id === assocOutputId);
    const ot = outputTypes.find((t) => t.id === out?.outputTypeId);
    const trans = transmissionTypes.find((t) => t.id === assocTransmissionId);
    return validateAssociationContext({
      format: associateModalFormat,
      transmissionType: trans,
      configuredOutput: out,
      outputType: ot,
      entityType:
        selectedEntityType !== 'ALL' ? selectedEntityType : undefined,
      country:
        selectedCountry !== 'ALL'
          ? selectedCountry
          : (associateModalFormat.country || associateModalFormat.jurisdiction),
      existingAssociations: associations,
      proposedStatus: assocStatus,
      proposedModality: assocModality,
      proposedEnvironment: globalEnvironment,
      proposedValidFrom: assocValidFrom,
    });
  }, [
    associateModalFormat,
    assocOutputId,
    assocTransmissionId,
    assocStatus,
    assocModality,
    assocValidFrom,
    configuredOutputs,
    outputTypes,
    transmissionTypes,
    selectedEntityType,
    selectedCountry,
    associations,
    globalEnvironment,
  ]);

  const handleSaveAssociation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!associateModalFormat || !assocValidation || !assocValidation.isValid) return;
    if (assocStatus === 'Activa' && !assocValidation.canActivate) return;

    const out = configuredOutputs.find((o) => o.id === assocOutputId);
    const cleanCode = (
      associateModalFormat.code ||
      associateModalFormat.internalCode ||
      'FMT'
    ).replace(/[^A-Za-z0-9]/g, '');
    const newCode = `ASO-${cleanCode}-${associations.length + 1}`;

    saveAssociation({
      id: `ASO-${Date.now()}`,
      code: newCode,
      formatId: associateModalFormat.id,
      transmissionTypeId: assocTransmissionId,
      modality: assocModality,
      configuredOutputId: assocOutputId,
      configuredOutputVersion: out?.version || '1.0',
      deliveryChannelId: assocChannelId,
      daqueProfileId: associateModalFormat.daqueProfileId || 'DAQUE-PROF-01',
      entityScope: globalEntity,
      entityTypeScope:
        selectedEntityType !== 'ALL'
          ? selectedEntityType
          : activeEntityContext.entityType,
      environment: globalEnvironment,
      validFrom: assocValidFrom,
      validTo: 'Abierta',
      status: assocStatus,
      parameterOverrides: {
        fileNamePrefix: assocPrefixOverride || `${cleanCode}_`,
      },
      updatedAt: '2026-11-10',
      updatedBy: activeUserRole,
    });

    setFeedbackBanner({
      type: 'success',
      message: `Asociación ${newCode} registrada: Formato "${associateModalFormat.code || associateModalFormat.internalCode} — ${associateModalFormat.name}" vinculado con la salida "${out?.code} (v${out?.version})" en estado [${assocStatus}].`,
    });
    setAssociateModalFormat(null);
    if (preselectedAssocOutputId) {
      setPreselectedAssocOutputId(null);
    }
  };

  // ============================================================================
  // CLASSIFICATION MODAL STATE & HANDLERS
  // ============================================================================
  const [classSelectedTypes, setClassSelectedTypes] = useState<string[]>([]);
  const [classNotes, setClassNotes] = useState<string>('');

  const handleOpenClassifyModal = (format: RegulatoryFormat) => {
    setClassifyModalFormat(format);
    setClassSelectedTypes([...format.applicableEntityTypes]);
    setClassNotes(format.classificationNotes || '');
  };

  const handleSaveClassification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classifyModalFormat) return;
    const updated: RegulatoryFormat = {
      ...classifyModalFormat,
      applicableEntityTypes: classSelectedTypes,
      classificationStatus:
        classSelectedTypes.length > 0
          ? 'Clasificado y validado'
          : 'Pendiente de clasificación',
      classificationNotes:
        classNotes || 'Clasificación institucional validada por usuario autorizado.',
      classificationValidatedBy: activeUserRole,
      classificationValidatedAt: '2026-11-10',
    };
    updateRegulatoryFormat(updated);
    if (detailFormat?.id === updated.id) {
      setDetailFormat(updated);
    }
    setFeedbackBanner({
      type: 'success',
      message: `Aplicabilidad del formato "${updated.code || updated.internalCode} — ${updated.name}" actualizada (${classSelectedTypes.length} tipo(s) de entidad).`,
    });
    setClassifyModalFormat(null);
  };

  // ============================================================================
  // ADD FORMAT MODAL STATE & HANDLERS ("Agregar formato")
  // ============================================================================
  const [addFmtCountry, setAddFmtCountry] = useState<'Colombia' | 'Perú'>('Colombia');
  const [addFmtRegulator, setAddFmtRegulator] = useState<string>('SFC');
  const [addFmtIssuingOrganism, setAddFmtIssuingOrganism] = useState<string>('');
  const [addFmtCode, setAddFmtCode] = useState<string>('');
  const [addFmtInternalCode, setAddFmtInternalCode] = useState<string>('');
  const [addFmtInternalNumber, setAddFmtInternalNumber] = useState<string>('');
  const [addFmtAnnexType, setAddFmtAnnexType] = useState<string>('');
  const [addFmtName, setAddFmtName] = useState<string>('');
  const [addFmtDescription, setAddFmtDescription] = useState<string>('');
  const [addFmtEntityTypes, setAddFmtEntityTypes] = useState<string[]>([]);
  const [addFmtCustomEntityType, setAddFmtCustomEntityType] = useState<string>('');
  const [addFmtAdditionalCond, setAddFmtAdditionalCond] = useState<string>('');
  const [addFmtPeriodicity, setAddFmtPeriodicity] = useState<string>('Mensual');
  const [addFmtReportingModality, setAddFmtReportingModality] = useState<
    'Periódico' | 'Por evento'
  >('Periódico');
  const [addFmtVersion, setAddFmtVersion] = useState<string>('v1.0');
  const [addFmtValidFrom, setAddFmtValidFrom] = useState<string>('2026-01-01');
  const [addFmtValidTo, setAddFmtValidTo] = useState<string>('Abierta');
  const [addFmtAvailability, setAddFmtAvailability] = useState<
    RegulatoryFormat['normativeAvailability']
  >('Vigente');
  const [addFmtObligation, setAddFmtObligation] = useState<string>('');
  const [addFmtSourceUrl, setAddFmtSourceUrl] = useState<string>('');
  const [addFmtSupportDoc, setAddFmtSupportDoc] = useState<{
    fileName: string;
    uploadedAt: string;
    summary: string;
  } | null>(null);
  const [addFmtTransIds, setAddFmtTransIds] = useState<string[]>(['TX-ORDINARIO']);
  const [addFmtFamilies, setAddFmtFamilies] = useState<TechnicalFamily[]>(['TXT']);
  const [addFmtProvenance, setAddFmtProvenance] = useState<
    'Oficial' | 'Aportado por el cliente' | 'Referencia interna'
  >('Oficial');
  const [addFmtLifecycleStatus, setAddFmtLifecycleStatus] =
    useState<FormatLifecycleStatus>('Borrador');
  const [addFmtError, setAddFmtError] = useState<string | null>(null);

  const handleOpenAddFormatModal = (
    presetCountry?: 'Colombia' | 'Perú',
    presetRegulator?: string
  ) => {
    const c = presetCountry || (selectedCountry === 'ALL' ? 'Colombia' : selectedCountry);
    setAddFmtCountry(c);
    setAddFmtRegulator(
      presetRegulator || (c === 'Colombia' ? 'SFC' : 'SBS Perú')
    );
    setAddFmtIssuingOrganism('');
    setAddFmtCode('');
    const suffix = Math.floor(100 + Math.random() * 900);
    setAddFmtInternalCode(`FMT-${c === 'Colombia' ? 'CO' : 'PE'}-REG-${suffix}`);
    setAddFmtInternalNumber('');
    setAddFmtAnnexType('');
    setAddFmtName('');
    setAddFmtDescription('');
    setAddFmtEntityTypes(selectedEntityType !== 'ALL' ? [selectedEntityType] : []);
    setAddFmtCustomEntityType('');
    setAddFmtAdditionalCond('');
    setAddFmtPeriodicity('Mensual');
    setAddFmtReportingModality('Periódico');
    setAddFmtVersion('v1.0');
    setAddFmtValidFrom('2026-01-01');
    setAddFmtValidTo('Abierta');
    setAddFmtAvailability('Vigente');
    setAddFmtObligation('');
    setAddFmtSourceUrl('');
    setAddFmtSupportDoc(null);
    setAddFmtTransIds(['TX-ORDINARIO']);
    setAddFmtFamilies(['TXT']);
    setAddFmtProvenance('Oficial');
    setAddFmtLifecycleStatus('Borrador');
    setAddFmtError(null);
    setShowAddFormatModal(true);
  };

  const duplicateCheckForAdd = useMemo(() => {
    if (!showAddFormatModal) return null;
    return checkFormatDuplicateCandidates(regulatoryFormats, {
      jurisdiction: addFmtCountry,
      regulator: addFmtRegulator,
      code: addFmtCode,
      internalCode: addFmtInternalCode,
      internalNumberPeru: addFmtInternalNumber,
      annexOrFormLabelPeru: addFmtAnnexType,
      name: addFmtName,
    });
  }, [
    showAddFormatModal,
    regulatoryFormats,
    addFmtCountry,
    addFmtRegulator,
    addFmtCode,
    addFmtInternalCode,
    addFmtInternalNumber,
    addFmtAnnexType,
    addFmtName,
  ]);

  const handleAddSupportDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddFmtSupportDoc({
      fileName: file.name,
      uploadedAt: '2026-11-10',
      summary: `Soporte documental adjunto (${Math.max(1, Math.round(file.size / 1024))} KB)`,
    });
  };

  const handleCreateFormatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFmtError(null);

    if (!addFmtName.trim()) {
      setAddFmtError('El nombre completo del formato o reporte es obligatorio.');
      return;
    }

    if (duplicateCheckForAdd?.hasExactDuplicate) {
      setAddFmtError(
        duplicateCheckForAdd.duplicates.find((d) => d.severity === 'Bloqueante')?.reason ||
          'Ya existe un formato duplicado para este país y organismo receptor.'
      );
      return;
    }

    // Requirement 2: Allow saving Borrador with pending info; to Activate, require complete data & evidence
    if (addFmtLifecycleStatus === 'Activo') {
      if (addFmtEntityTypes.length === 0) {
        setAddFmtError(
          'Para activar el formato ("Activo") debe seleccionar al menos un tipo de entidad reportante aplicable. Si aún está en definición, guárdelo como "Borrador".'
        );
        return;
      }
      if (!addFmtObligation.trim() || !addFmtVersion.trim() || addFmtFamilies.length === 0) {
        setAddFmtError(
          'Para activar el formato debe registrar la referencia normativa/documento técnico, la versión y al menos una familia técnica confirmada.'
        );
        return;
      }
    }

    const internalId =
      addFmtInternalCode.trim() ||
      `FMT-${addFmtCountry === 'Colombia' ? 'CO' : 'PE'}-${Date.now().toString().slice(-4)}`;

    const newFormat: RegulatoryFormat = {
      id: internalId,
      code: addFmtCode.trim(), // Puede ser vacío si se identifica por nombre o anexo
      internalCode: internalId,
      name: addFmtName.trim(),
      jurisdiction: addFmtCountry,
      country: addFmtCountry,
      regulator: addFmtRegulator,
      issuingOrganism: addFmtIssuingOrganism.trim() || undefined,
      obligation: addFmtObligation.trim() || 'Pendiente de referencia normativa',
      periodicity: addFmtPeriodicity,
      reportingModality: addFmtReportingModality,
      normativeVersion: addFmtVersion.trim() || 'v1.0',
      daqueProfileId: 'DAQUE-PROF-01',
      enabledTransmissionTypes:
        addFmtTransIds.length > 0 ? addFmtTransIds : ['TX-ORDINARIO'],
      description:
        addFmtDescription.trim() ||
        `Formato regulatorio registrado para ${addFmtRegulator} (${addFmtCountry}).`,
      internalNumberPeru:
        addFmtCountry === 'Perú' && addFmtInternalNumber.trim()
          ? addFmtInternalNumber.trim()
          : undefined,
      annexOrFormLabelPeru: addFmtAnnexType.trim() || undefined,
      applicableEntityTypes: addFmtEntityTypes,
      additionalApplicabilityConditions: addFmtAdditionalCond.trim() || undefined,
      classificationStatus:
        addFmtEntityTypes.length > 0
          ? 'Clasificado y validado'
          : 'Pendiente de clasificación',
      classificationNotes:
        addFmtEntityTypes.length > 0
          ? `Aplicabilidad registrada para ${addFmtEntityTypes.length} tipo(s) de entidad.`
          : 'Formato guardado con aplicabilidad pendiente de clasificación.',
      lifecycleStatus: addFmtLifecycleStatus,
      normativeAvailability: addFmtAvailability,
      specificationValidity: {
        validFrom: addFmtValidFrom.trim() || '2026-01-01',
        validTo: addFmtValidTo.trim() || 'Abierta',
        versionLabel: addFmtVersion.trim() || 'v1.0',
      },
      technicalReadinessStatus:
        addFmtLifecycleStatus === 'Activo'
          ? 'Especificación técnica completa'
          : 'Especificación parcial',
      supportedFamilies: addFmtFamilies.length > 0 ? addFmtFamilies : ['TXT'],
      documentedRequirements: [
        `Periodicidad: ${addFmtPeriodicity} (${addFmtReportingModality})`,
        `Procedencia: ${addFmtProvenance}`,
      ],
      provenanceKind: addFmtProvenance,
      provenanceRef: addFmtSupportDoc
        ? `Soporte documental adjunto: ${addFmtSupportDoc.fileName}`
        : addFmtSourceUrl
        ? `Fuente oficial: ${addFmtSourceUrl}`
        : `Registrado en catálogo (${addFmtProvenance})`,
      sourceUrl: addFmtSourceUrl.trim() || undefined,
      consultationDate: '2026-11-10',
      verificationLevel:
        addFmtProvenance === 'Oficial'
          ? 'Oficial contrastado'
          : addFmtProvenance === 'Aportado por el cliente'
          ? 'Aportado por el cliente'
          : 'Referencia interna',
      supportDocument: addFmtSupportDoc || undefined,
      versionHistory: [
        {
          versionLabel: addFmtVersion.trim() || 'v1.0',
          validFrom: addFmtValidFrom.trim() || '2026-01-01',
          validTo: addFmtValidTo.trim() || 'Abierta',
          periodicity: addFmtPeriodicity,
          applicableEntityTypes: addFmtEntityTypes,
          supportedFamilies: addFmtFamilies,
          changedAt: '2026-11-10',
          changedBy: activeUserRole,
          changeKind: 'Creación inicial',
          changeSummary: `Alta inicial del formato en estado ${addFmtLifecycleStatus}.`,
        },
      ],
    };

    createRegulatoryFormat(newFormat);
    setShowAddFormatModal(false);
    setFeedbackBanner({
      type: 'success',
      message: `Formato "${newFormat.code || newFormat.internalCode} — ${newFormat.name}" registrado en el catálogo único en estado [${newFormat.lifecycleStatus}].`,
    });
  };

  // ============================================================================
  // EDIT FORMAT MODAL STATE & HANDLERS ("Editar formato")
  // ============================================================================
  const [editCode, setEditCode] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editRegulator, setEditRegulator] = useState<string>('');
  const [editIssuingOrganism, setEditIssuingOrganism] = useState<string>('');
  const [editPeriodicity, setEditPeriodicity] = useState<string>('Mensual');
  const [editReportingModality, setEditReportingModality] = useState<
    'Periódico' | 'Por evento'
  >('Periódico');
  const [editVersion, setEditVersion] = useState<string>('');
  const [editValidFrom, setEditValidFrom] = useState<string>('');
  const [editValidTo, setEditValidTo] = useState<string>('');
  const [editAvailability, setEditAvailability] = useState<
    RegulatoryFormat['normativeAvailability']
  >('Vigente');
  const [editLifecycleStatus, setEditLifecycleStatus] =
    useState<FormatLifecycleStatus>('Activo');
  const [editObligation, setEditObligation] = useState<string>('');
  const [editSourceUrl, setEditSourceUrl] = useState<string>('');
  const [editEntityTypes, setEditEntityTypes] = useState<string[]>([]);
  const [editFamilies, setEditFamilies] = useState<TechnicalFamily[]>([]);
  const [editChangeSummary, setEditChangeSummary] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  const handleOpenEditFormatModal = (format: RegulatoryFormat) => {
    setEditModalFormat(format);
    setEditCode(format.code || '');
    setEditName(format.name);
    setEditDescription(format.description || '');
    setEditRegulator(format.regulator);
    setEditIssuingOrganism(format.issuingOrganism || '');
    setEditPeriodicity(format.periodicity);
    setEditReportingModality(format.reportingModality || 'Periódico');
    setEditVersion(format.normativeVersion);
    setEditValidFrom(format.specificationValidity?.validFrom || '2026-01-01');
    setEditValidTo(format.specificationValidity?.validTo || 'Abierta');
    setEditAvailability(format.normativeAvailability);
    setEditLifecycleStatus(format.lifecycleStatus || 'Activo');
    setEditObligation(format.obligation);
    setEditSourceUrl(format.sourceUrl || '');
    setEditEntityTypes([...format.applicableEntityTypes]);
    setEditFamilies([...(format.supportedFamilies || ['TXT'])]);
    setEditChangeSummary('');
    setEditError(null);
  };

  const draftEditedFormat = useMemo<RegulatoryFormat | null>(() => {
    if (!editModalFormat) return null;
    return {
      ...editModalFormat,
      code: editCode.trim(),
      name: editName.trim(),
      description: editDescription.trim(),
      regulator: editRegulator,
      issuingOrganism: editIssuingOrganism.trim() || undefined,
      periodicity: editPeriodicity,
      reportingModality: editReportingModality,
      normativeVersion: editVersion.trim(),
      normativeAvailability: editAvailability,
      lifecycleStatus: editLifecycleStatus,
      obligation: editObligation.trim(),
      sourceUrl: editSourceUrl.trim() || undefined,
      applicableEntityTypes: editEntityTypes,
      classificationStatus:
        editEntityTypes.length > 0
          ? 'Clasificado y validado'
          : 'Pendiente de clasificación',
      supportedFamilies: editFamilies,
      specificationValidity: {
        validFrom: editValidFrom.trim() || '2026-01-01',
        validTo: editValidTo.trim() || 'Abierta',
        versionLabel: editVersion.trim() || editModalFormat.normativeVersion,
      },
    };
  }, [
    editModalFormat,
    editCode,
    editName,
    editDescription,
    editRegulator,
    editIssuingOrganism,
    editPeriodicity,
    editReportingModality,
    editVersion,
    editAvailability,
    editLifecycleStatus,
    editObligation,
    editSourceUrl,
    editEntityTypes,
    editFamilies,
    editValidFrom,
    editValidTo,
  ]);

  const editImpactDiagnostic = useMemo(() => {
    if (!editModalFormat || !draftEditedFormat) return null;
    return evaluateFormatEditImpact({
      original: editModalFormat,
      updated: draftEditedFormat,
      associations,
      configuredOutputs,
    });
  }, [editModalFormat, draftEditedFormat, associations, configuredOutputs]);

  const handleSaveEditFormat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalFormat || !draftEditedFormat || !editImpactDiagnostic) return;
    setEditError(null);

    if (editLifecycleStatus === 'Activo' && editEntityTypes.length === 0) {
      setEditError(
        'Para mantener o activar el formato en estado "Activo" debe contar con al menos un tipo de entidad aplicable.'
      );
      return;
    }

    const summary =
      editChangeSummary.trim() ||
      (editImpactDiagnostic.requiresNewVersion
        ? `Actualización de especificación/aplicabilidad (${editImpactDiagnostic.structuralDiffs.join('; ')})`
        : 'Corrección descriptiva de metadatos del formato.');

    editRegulatoryFormat(
      draftEditedFormat,
      editImpactDiagnostic.requiresNewVersion,
      summary
    );

    setFeedbackBanner({
      type: editImpactDiagnostic.impactedAssociations.length > 0 ? 'warning' : 'success',
      message: `${editImpactDiagnostic.changeClassification}: Formato "${draftEditedFormat.code || draftEditedFormat.internalCode} — ${draftEditedFormat.name}" actualizado conservando su ID interno y asociaciones.`,
    });

    if (detailFormat?.id === draftEditedFormat.id) {
      setDetailFormat(draftEditedFormat);
    }
    setEditModalFormat(null);
  };

  // ============================================================================
  // DELETE / DEACTIVATE MODAL STATE & HANDLERS
  // ============================================================================
  const [deactivationReasonInput, setDeactivationReasonInput] = useState<string>(
    'Sustitución normativa o suspensión operativa de nuevas asociaciones.'
  );

  const deleteDependenciesDiagnostic = useMemo(() => {
    if (!deleteOrDeactivateFormat) return null;
    return evaluateFormatDependencies({
      format: deleteOrDeactivateFormat,
      associations,
      executionRuns,
    });
  }, [deleteOrDeactivateFormat, associations, executionRuns]);

  const handleConfirmDeleteFormat = () => {
    if (!deleteOrDeactivateFormat) return;
    const res = deleteRegulatoryFormat(deleteOrDeactivateFormat.id);
    if (!res.deleted) {
      setFeedbackBanner({
        type: 'error',
        message: res.reason,
      });
      return;
    }
    setFeedbackBanner({
      type: 'success',
      message: `Formato "${deleteOrDeactivateFormat.code || deleteOrDeactivateFormat.internalCode} — ${deleteOrDeactivateFormat.name}" eliminado definitivamente.`,
    });
    if (detailFormat?.id === deleteOrDeactivateFormat.id) {
      setDetailFormat(null);
    }
    setDeleteOrDeactivateFormat(null);
  };

  const handleConfirmToggleLifecycle = (targetStatus: FormatLifecycleStatus) => {
    if (!deleteOrDeactivateFormat) return;
    toggleFormatLifecycleStatus(
      deleteOrDeactivateFormat.id,
      targetStatus,
      deactivationReasonInput
    );
    setFeedbackBanner({
      type: targetStatus === 'Inactivo' ? 'warning' : 'success',
      message:
        targetStatus === 'Inactivo'
          ? `Formato "${deleteOrDeactivateFormat.code || deleteOrDeactivateFormat.internalCode} — ${deleteOrDeactivateFormat.name}" desactivado. Se impiden nuevas asociaciones operativas activas conservando el historial.`
          : `Formato "${deleteOrDeactivateFormat.code || deleteOrDeactivateFormat.internalCode} — ${deleteOrDeactivateFormat.name}" reactivado para operación.`,
    });
    setDeleteOrDeactivateFormat(null);
  };

  // ============================================================================
  // ADD RECEIVING ORGANISM MODAL STATE
  // ============================================================================
  const [newOrgCountry, setNewOrgCountry] = useState<'Colombia' | 'Perú'>('Colombia');
  const [newOrgCode, setNewOrgCode] = useState<string>('');
  const [newOrgName, setNewOrgName] = useState<string>('');
  const [newOrgDesc, setNewOrgDesc] = useState<string>('');
  const [newOrgUrl, setNewOrgUrl] = useState<string>('');

  const handleCreateOrganism = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgCode.trim() || !newOrgName.trim()) return;
    const created: ReceivingOrganismDefinition = {
      id: `ORG-${newOrgCountry === 'Colombia' ? 'CO' : 'PE'}-${newOrgCode
        .trim()
        .toUpperCase()}`,
      code: newOrgCode.trim().toUpperCase(),
      name: newOrgCode.trim().toUpperCase(),
      shortName: newOrgName.trim(),
      country: newOrgCountry,
      description:
        newOrgDesc.trim() || `Organismo receptor registrado en ${newOrgCountry}.`,
      officialUrl: newOrgUrl.trim() || 'https://www.gov.co',
      referenceUrls: newOrgUrl.trim() ? [newOrgUrl.trim()] : [],
      consultationDate: '2026-11-10',
      isSystemDefault: false,
    };
    addReceivingOrganism(created);
    setShowAddOrganismModal(false);
    setNewOrgCode('');
    setNewOrgName('');
    setNewOrgDesc('');
    setNewOrgUrl('');
    setFeedbackBanner({
      type: 'success',
      message: `Organismo receptor "${created.code} — ${created.shortName}" (${created.country}) incorporado al catálogo.`,
    });
  };

  // ============================================================================
  // TOTALiA® MODAL TABS STATE
  // ============================================================================
  const [totaliaTab, setTotaliaTab] = useState<
    'reuse' | 'prepare' | 'classify' | 'versions'
  >('reuse');
  const [totaliaDraftText, setTotaliaDraftText] = useState<string>('');

  const getFormatAssociations = (formatId: string) =>
    associations.filter((a) => a.formatId === formatId);

  return (
    <div className="space-y-4">
      {/* Banner: Pending Output Association Context (from Builder Step 7 or Outputs List) */}
      {pendingOutput && (
        <div className="bg-[#1E4E8C] text-white rounded-md p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-sky-400">
          <div className="flex items-start gap-3">
            <Link2 className="w-5 h-5 text-sky-300 shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-sky-200">
                Flujo de asociación activo desde el Diseñador de Salidas
              </div>
              <div className="text-sm font-bold mt-0.5">
                Salida seleccionada para vincular:{' '}
                <span className="font-mono bg-white/15 px-1.5 py-0.5 rounded">
                  {pendingOutput.code} (v{pendingOutput.version})
                </span>{' '}
                — {pendingOutput.name} [{pendingOutput.status}]
              </div>
              <p className="text-xs text-sky-100 mt-1">
                Filtre por{' '}
                <strong>
                  País → Organismo receptor o Tipo de entidad reportante → Formato de destino
                </strong>{' '}
                y haga clic en <strong>“Asociar salida”</strong> en el formato receptor deseado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPreselectedAssocOutputId(null)}
            className="px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-semibold text-white shrink-0 cursor-pointer self-start sm:self-center"
          >
            Cancelar selección
          </button>
        </div>
      )}

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-3 rounded-md border flex items-center justify-between text-xs ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : feedbackBanner.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-500 hover:text-slate-800 ml-3 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Concept Separation & Mode Switcher Bar */}
      <div className="bg-white border border-slate-200 rounded-md p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Catálogo Único de Formatos Regulatorios y Consulta por Organismo Receptor
              </h3>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1E4E8C] border border-blue-200 text-[10px] font-bold">
                Repositorio único de destinos
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Consulte, agregue, edite, versione, desactive o asocie formatos regulatorios diferenciando siempre{' '}
              <strong>Organismo receptor</strong> (SFC, DIAN, Fogafín, UIAF, SBS Perú),{' '}
              <strong>Tipo de entidad reportante</strong>, <strong>Formato de destino</strong> y{' '}
              <strong>Salida configurada</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Sub-mode Toggle: General Catalog vs Formats by Receiving Organism */}
            <div className="inline-flex rounded-md border border-slate-300 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setCatalogSubMode('catalog')}
                className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  catalogSubMode === 'catalog'
                    ? 'bg-[#1E4E8C] text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Catálogo de formatos ({filteredFormats.length})
              </button>
              <button
                type="button"
                onClick={() => setCatalogSubMode('by_organism')}
                className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  catalogSubMode === 'by_organism'
                    ? 'bg-[#1E4E8C] text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Formatos por organismo receptor ({organismSummaries.length})
              </button>
            </div>

            {canManageCatalog && (
              <button
                type="button"
                onClick={() => handleOpenAddFormatModal()}
                className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar formato
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setTotaliaTab('prepare');
                setTotaliaModalFormat(filteredFormats[0] || regulatoryFormats[0]);
              }}
              className="px-3 py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
              Asistencia TOTALiA®
            </button>
          </div>
        </div>

        {/* Active Context Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-slate-50 px-3 py-2 rounded border border-slate-200">
          <div className="flex flex-wrap items-center gap-2 text-slate-700">
            <span className="font-semibold text-slate-900">Contexto operativo actual:</span>
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-800">
              Entidad cliente: {globalEntity}
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-semibold text-[#1E4E8C]">
              País: {activeEntityContext.country}
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-semibold text-indigo-900">
              Categoría institucional: {activeEntityContext.entityType}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-slate-700">
              Periodo: {globalPeriod}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetToActiveContext}
              className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              Filtrar por contexto activo ({activeEntityContext.country} ·{' '}
              {activeEntityContext.entityType})
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCountry('ALL');
                setSelectedEntityType('ALL');
                setSelectedRegulator('ALL');
                setSelectedPeriodicity('ALL');
                setSelectedReportingModality('ALL');
                setSelectedAvailability('ALL');
                setSelectedLifecycleStatus('ALL');
                setSelectedClassification('ALL');
                setSearchQuery('');
              }}
              className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              Ver todos los países y organismos
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================================ */}
      {/* SUB-MODE 2: FORMATOS POR ORGANISMO RECEPTOR                                  */}
      {/* ============================================================================ */}
      {catalogSubMode === 'by_organism' && (
        <div className="bg-white border border-slate-200 rounded-md p-4 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1E4E8C]" />
                Vista “Formatos por organismo receptor”
                <TooltipHelp
                  title="Organismo receptor vs Tipo de entidad reportante"
                  body="El organismo receptor es la autoridad supervisora, tributaria o de inteligencia financiera que recibe el formato (SFC, DIAN, Fogafín, UIAF, SBS Perú). No se debe confundir con la entidad cliente ni con el tipo de entidad reportante."
                />
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Seleccione Colombia o Perú y consulte las fichas de cada organismo receptor. Las métricas contabilizan formatos únicos registrados (sin inflar por versiones históricas).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Filtrar organismos por país"
                value={selectedCountry}
                onChange={(e) =>
                  setSelectedCountry(e.target.value as 'ALL' | 'Colombia' | 'Perú')
                }
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold bg-white text-slate-800"
              >
                <option value="ALL">Todos los países (Colombia y Perú)</option>
                <option value="Colombia">Colombia (SFC, DIAN, Fogafín, UIAF...)</option>
                <option value="Perú">Perú (SBS Perú, BCRP...)</option>
              </select>
              {canManageCatalog && (
                <button
                  type="button"
                  onClick={() => setShowAddOrganismModal(true)}
                  className="px-3 py-1.5 rounded border border-[#1E4E8C] text-[#1E4E8C] hover:bg-blue-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Registrar organismo receptor
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {organismSummaries.map((item) => {
              const { organism } = item;
              return (
                <div
                  key={organism.id}
                  className="border border-slate-200 rounded-md p-4 bg-slate-50/60 hover:bg-white hover:border-blue-300 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            organism.country === 'Colombia'
                              ? 'bg-amber-100 text-amber-950 border border-amber-300'
                              : 'bg-rose-100 text-rose-950 border border-rose-300'
                          }`}
                        >
                          {organism.country}
                        </span>
                        <h5 className="text-sm font-bold text-slate-900 mt-1">
                          {organism.code} — {organism.shortName}
                        </h5>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-[#1E4E8C] text-white text-xs font-bold shrink-0">
                        {item.totalFormats}{' '}
                        {item.totalFormats === 1 ? 'formato' : 'formatos'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {organism.description}
                    </p>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="bg-white border border-slate-200 rounded p-2 text-center">
                        <div className="text-sm font-bold text-emerald-700">
                          {item.activeFormats}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Activos / Vigentes
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2 text-center">
                        <div className="text-sm font-bold text-amber-700">
                          {item.pendingClassificationFormats}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Pend. clasificar
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2 text-center">
                        <div className="text-sm font-bold text-[#1E4E8C]">
                          {item.associatedOutputsCount}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Salidas asociadas
                        </div>
                      </div>
                    </div>

                    {/* Reference Source Transparency */}
                    <div className="bg-white border border-slate-200 rounded p-2.5 text-[11px] space-y-1">
                      <div className="font-semibold text-slate-700 flex items-center justify-between">
                        <span>Fuente oficial de referencia:</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Consulta: {organism.consultationDate}
                        </span>
                      </div>
                      {organism.officialUrl ? (
                        <a
                          href={organism.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1E4E8C] hover:underline flex items-center gap-1 break-all font-mono text-[10px]"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {organism.officialUrl}
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">
                          Referencia interna de catálogo
                        </span>
                      )}
                      {organism.referenceUrls && organism.referenceUrls.length > 1 && (
                        <a
                          href={organism.referenceUrls[1]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-700 hover:underline flex items-center gap-1 break-all font-mono text-[10px] mt-1"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          Normatividad / Documentos Técnicos
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCountry(organism.country);
                        setSelectedRegulator(organism.name);
                        setSelectedEntityType('ALL');
                        setCatalogSubMode('catalog');
                      }}
                      className="flex-1 px-3 py-1.5 rounded bg-[#1E4E8C] hover:bg-[#163A69] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Consultar formatos ({item.totalFormats})
                    </button>
                    {canManageCatalog && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenAddFormatModal(organism.country, organism.name)
                        }
                        title="Registrar nuevo formato para este organismo"
                        className="px-2.5 py-1.5 rounded border border-emerald-700 text-emerald-800 hover:bg-emerald-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* SUB-MODE 1: CATÁLOGO ÚNICO Y FILTROS DIFERENCIADOS                           */}
      {/* ============================================================================ */}
      {catalogSubMode === 'catalog' && (
        <>
          <div className="bg-white border border-slate-200 rounded-md p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* 1. País */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  1. País / Jurisdicción
                </label>
                <select
                  aria-label="Filtrar por país"
                  value={selectedCountry}
                  onChange={(e) => {
                    const nextCountry = e.target.value as 'ALL' | 'Colombia' | 'Perú';
                    setSelectedCountry(nextCountry);
                    setSelectedEntityType('ALL');
                    setSelectedRegulator('ALL');
                  }}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white font-semibold text-slate-900"
                >
                  <option value="ALL">Todos (Colombia y Perú)</option>
                  <option value="Colombia">Colombia</option>
                  <option value="Perú">Perú</option>
                </select>
              </div>

              {/* 2. Organismo receptor */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  2. Organismo receptor
                  <TooltipHelp
                    title="Organismo receptor"
                    body="Entidad supervisora, tributaria o de inteligencia financiera que recibe el formato (ej. SFC, DIAN, Fogafín, UIAF en Colombia; SBS Perú, BCRP en Perú). Puede comenzar filtrando por país y organismo receptor, o por país y tipo de entidad."
                  />
                </label>
                <select
                  aria-label="Filtrar por organismo receptor"
                  value={selectedRegulator}
                  onChange={(e) => setSelectedRegulator(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white font-semibold text-slate-900"
                >
                  <option value="ALL">
                    Todos los organismos ({availableRegulators.length})
                  </option>
                  {availableRegulators.map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Tipo de Entidad Reportante */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  3. Tipo de entidad reportante
                  <TooltipHelp
                    title="Tipo de entidad reportante"
                    body="Categoría institucional o sector supervisado al que aplica el formato (ej. Establecimientos Bancarios, Sociedades Comisionistas de Bolsa, Grandes Contribuyentes DIAN, Empresas Bancarias SBS). Es distinto de la entidad cliente específica."
                  />
                </label>
                <select
                  aria-label="Filtrar por tipo de entidad reportante"
                  value={selectedEntityType}
                  onChange={(e) => setSelectedEntityType(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white font-semibold text-slate-900"
                >
                  <option value="ALL">
                    Todos los tipos de entidad ({availableEntityTypes.length})
                  </option>
                  {availableEntityTypes.map((et) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Vigencia normativa */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Vigencia normativa
                  <TooltipHelp
                    title="Vigencia y versión"
                    body="Indica si la versión del formato está vigente, por entrar en vigencia en una fecha futura, o en histórico. No se permite activar una entrega operativa sobre una versión fuera de vigencia."
                  />
                </label>
                <select
                  aria-label="Filtrar por vigencia"
                  value={selectedAvailability}
                  onChange={(e) =>
                    setSelectedAvailability(
                      e.target.value as
                        | 'ALL'
                        | 'Vigente'
                        | 'Por entrar en vigencia'
                        | 'Histórico / En revisión'
                        | 'Pendiente de especificación'
                    )
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value="ALL">Todas las vigencias</option>
                  <option value="Vigente">Vigente</option>
                  <option value="Por entrar en vigencia">Por entrar en vigencia</option>
                  <option value="Histórico / En revisión">Histórico / En revisión</option>
                  <option value="Pendiente de especificación">
                    Pendiente de especificación
                  </option>
                </select>
              </div>

              {/* 5. Estado operativo */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Estado operativo
                </label>
                <select
                  aria-label="Filtrar por estado operativo del formato"
                  value={selectedLifecycleStatus}
                  onChange={(e) =>
                    setSelectedLifecycleStatus(
                      e.target.value as 'ALL' | FormatLifecycleStatus
                    )
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="Activo">Activo</option>
                  <option value="Pendiente de validación">Pendiente de validación</option>
                  <option value="Borrador">Borrador</option>
                  <option value="Inactivo">Inactivo (Desactivado)</option>
                </select>
              </div>
            </div>

            {/* Secondary Filter Row: Periodicity, Modality, Classification, Search */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100 items-center">
              <div className="md:col-span-2">
                <select
                  aria-label="Filtrar por periodicidad"
                  value={selectedPeriodicity}
                  onChange={(e) => setSelectedPeriodicity(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value="ALL">Periodicidad: Todas</option>
                  <option value="Diaria">Diaria</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Mensual">Mensual</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                  <option value="Por evento">Por evento</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  aria-label="Filtrar por modalidad de reporte"
                  value={selectedReportingModality}
                  onChange={(e) =>
                    setSelectedReportingModality(
                      e.target.value as 'ALL' | 'Periódico' | 'Por evento'
                    )
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value="ALL">Modalidad: Todas</option>
                  <option value="Periódico">Periódico</option>
                  <option value="Por evento">Por evento (ej. ROS UIAF)</option>
                </select>
              </div>

              <div className="md:col-span-4">
                <select
                  aria-label="Filtrar por estado de clasificación"
                  value={selectedClassification}
                  onChange={(e) =>
                    setSelectedClassification(
                      e.target.value as
                        | 'ALL'
                        | 'Clasificado y validado'
                        | 'Pendiente de clasificación'
                        | 'Con observaciones de aplicabilidad'
                    )
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value="ALL">Clasificación institucional: Todas</option>
                  <option value="Clasificado y validado">Clasificado y validado</option>
                  <option value="Pendiente de clasificación">
                    Pendiente de clasificación por tipo de entidad
                  </option>
                  <option value="Con observaciones de aplicabilidad">
                    Con observaciones de aplicabilidad
                  </option>
                </select>
              </div>

              <div className="md:col-span-4 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  aria-label="Buscar por código oficial, ID interno, nro interno SBS, nombre o anexo"
                  placeholder="Buscar por código (239, 1001, FDI, ROS, 440), ID interno o nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-slate-300 rounded pl-8 pr-2.5 py-1.5 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Quick Organism Pills Bar for immediate switching */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-600 mr-1">
              Consulta rápida por organismo receptor:
            </span>
            <button
              type="button"
              onClick={() => setSelectedRegulator('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                selectedRegulator === 'ALL'
                  ? 'bg-[#1E4E8C] text-white border-[#1E4E8C]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Todos ({filterResult.totalInCountry})
            </button>
            {organismSummaries.map((s) => {
              const isSelected = selectedRegulator === s.organism.name;
              return (
                <button
                  key={s.organism.id}
                  type="button"
                  onClick={() => {
                    setSelectedCountry(s.organism.country);
                    setSelectedRegulator(s.organism.name);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#1E4E8C] text-white border-[#1E4E8C]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{s.organism.code}</span>
                  <span className="opacity-75 text-[10px]">({s.totalFormats})</span>
                </button>
              );
            })}
          </div>

          {/* Formats Catalog Table */}
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="font-semibold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                <span>
                  Catálogo de Formatos de Destino ({filteredFormats.length}{' '}
                  {filteredFormats.length === 1
                    ? 'formato encontrado'
                    : 'formatos encontrados'}
                  )
                </span>
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-3">
                <span>
                  País:{' '}
                  <strong>
                    {selectedCountry === 'ALL' ? 'Todos' : selectedCountry}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Organismo:{' '}
                  <strong>
                    {selectedRegulator === 'ALL' ? 'Todos' : selectedRegulator}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Tipo de entidad:{' '}
                  <strong>
                    {selectedEntityType === 'ALL' ? 'Todos' : selectedEntityType}
                  </strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-600 font-bold">
                    <th className="py-2.5 px-3">País / Organismo receptor</th>
                    <th className="py-2.5 px-3">
                      Código / ID Interno / Formato
                      <TooltipHelp
                        title="Código oficial vs Identificador interno"
                        body="Algunos reportes regulatorios u operativos se identifican por nombre o anexo sin código numérico oficial (ej. FDI Fogafín o Anexo 1 ROS UIAF). El sistema mantiene siempre un identificador interno estable separado del código oficial."
                      />
                    </th>
                    <th className="py-2.5 px-3">
                      Aplicabilidad por Tipo de Entidad
                      <TooltipHelp
                        title="Aplicabilidad pendiente"
                        body="Cuando una referencia externa no declara explícitamente el tipo de entidad reportante, se registra como 'Pendiente de clasificación' para no asumir falsamente que aplica a todas las entidades."
                      />
                    </th>
                    <th className="py-2.5 px-3">Periodicidad / Vigencia / Estado</th>
                    <th className="py-2.5 px-3">Transmisión / Familia</th>
                    <th className="py-2.5 px-3">Salidas Asociadas</th>
                    <th className="py-2.5 px-3 text-right">
                      Acciones
                      <TooltipHelp
                        title="Asociar, Editar, Eliminar o Desactivar"
                        body="Permite consultar la ficha completa, vincular una salida, editar metadatos o especificación (con control de versiones) y eliminar o desactivar según existan dependencias."
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredFormats.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No se encontraron formatos regulatorios para la combinación de filtros seleccionada.
                      </td>
                    </tr>
                  ) : (
                    filteredFormats.map((fmt) => {
                      const fmtAssocs = getFormatAssociations(fmt.id);
                      const isPendingClass =
                        fmt.classificationStatus === 'Pendiente de clasificación';
                      const isInactive = fmt.lifecycleStatus === 'Inactivo';
                      const fmtCountry = fmt.country || fmt.jurisdiction;
                      const matchesSelectedEntityType =
                        selectedEntityType !== 'ALL' &&
                        fmt.applicableEntityTypes.includes(selectedEntityType);

                      return (
                        <tr
                          key={fmt.id}
                          className={`hover:bg-slate-50/90 transition-colors ${
                            isInactive
                              ? 'bg-slate-100/70 opacity-80'
                              : isPendingClass
                              ? 'bg-amber-50/20'
                              : ''
                          }`}
                        >
                          {/* País / Organismo */}
                          <td className="py-3 px-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  fmtCountry === 'Colombia'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                                }`}
                              >
                                {fmtCountry}
                              </span>
                              <span className="font-bold text-slate-800">
                                {fmt.regulator}
                              </span>
                            </div>
                            {fmt.issuingOrganism && (
                              <div className="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 mt-1 inline-block">
                                Norma emitida por: {fmt.issuingOrganism}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {fmt.verificationLevel || fmt.provenanceKind || 'Oficial'}
                            </div>
                          </td>

                          {/* Código / ID Interno / Nombre */}
                          <td className="py-3 px-3 align-top max-w-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {fmt.code ? (
                                <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-900">
                                  Cód: {fmt.code}
                                </span>
                              ) : (
                                <span className="text-[10px] italic px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900">
                                  Sin código numérico (por nombre/anexo)
                                </span>
                              )}
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600">
                                ID: {fmt.internalCode || fmt.id}
                              </span>
                              {fmt.internalNumberPeru && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-900 font-semibold">
                                  Nro. Interno: {fmt.internalNumberPeru}
                                </span>
                              )}
                              {fmt.annexOrFormLabelPeru && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#1E4E8C] font-semibold">
                                  {fmt.annexOrFormLabelPeru}
                                </span>
                              )}
                            </div>
                            <div className="font-bold text-slate-900 mt-1">{fmt.name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {fmt.obligation}
                            </div>
                          </td>

                          {/* Aplicabilidad por Tipo de Entidad */}
                          <td className="py-3 px-3 align-top max-w-xs">
                            {isPendingClass ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-bold">
                                  <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                                  Pendiente de clasificación por tipo de entidad
                                </span>
                                <p className="text-[10px] text-amber-900 leading-snug">
                                  {fmt.classificationNotes}
                                </p>
                                {canManageCatalog && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenClassifyModal(fmt)}
                                    className="text-[10px] font-bold text-[#1E4E8C] hover:underline cursor-pointer"
                                  >
                                    + Clasificar aplicabilidad institucional
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-1">
                                  {fmt.applicableEntityTypes.map((et) => (
                                    <span
                                      key={et}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                        et === selectedEntityType ||
                                        et === activeEntityContext.entityType
                                          ? 'bg-indigo-100 text-indigo-950 border-indigo-300 font-bold'
                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                      }`}
                                    >
                                      {et}
                                    </span>
                                  ))}
                                </div>
                                {matchesSelectedEntityType && (
                                  <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Compatible con tipo de entidad filtrado
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Periodicidad / Vigencia / Estado */}
                          <td className="py-3 px-3 align-top">
                            <div className="font-semibold text-slate-800">
                              {fmt.periodicity}{' '}
                              <span className="text-[10px] font-normal text-slate-500">
                                ({fmt.reportingModality || 'Periódico'})
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {fmt.normativeVersion}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  fmt.normativeAvailability === 'Vigente'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : fmt.normativeAvailability === 'Por entrar en vigencia'
                                    ? 'bg-sky-50 text-sky-900 border border-sky-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-300'
                                }`}
                              >
                                {fmt.normativeAvailability}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  fmt.lifecycleStatus === 'Inactivo'
                                    ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                    : fmt.lifecycleStatus === 'Borrador'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : fmt.lifecycleStatus === 'Pendiente de validación'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                              >
                                {fmt.lifecycleStatus || 'Activo'}
                              </span>
                            </div>
                            {fmt.specificationValidity && (
                              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                Vigencia: {fmt.specificationValidity.validFrom}
                              </div>
                            )}
                          </td>

                          {/* Transmisión / Familia */}
                          <td className="py-3 px-3 align-top">
                            <div className="flex flex-wrap gap-1 mb-1">
                              {(fmt.supportedFamilies || []).map((fam) => (
                                <span
                                  key={fam}
                                  className="px-1.5 py-0.5 rounded bg-blue-50 text-[#1E4E8C] border border-blue-200 font-mono text-[10px] font-semibold"
                                >
                                  {fam}
                                </span>
                              ))}
                            </div>
                            <div className="text-[10px] text-slate-600">
                              {fmt.enabledTransmissionTypes
                                .map(
                                  (tid) =>
                                    transmissionTypes.find((t) => t.id === tid)?.name || tid
                                )
                                .join(', ')}
                            </div>
                          </td>

                          {/* Salidas Asociadas */}
                          <td className="py-3 px-3 align-top">
                            {fmtAssocs.length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">
                                Sin salidas asociadas
                              </span>
                            ) : (
                              <div className="space-y-1">
                                {fmtAssocs.map((a) => {
                                  const out = configuredOutputs.find(
                                    (o) => o.id === a.configuredOutputId
                                  );
                                  return (
                                    <div
                                      key={a.id}
                                      className="p-1.5 rounded bg-slate-50 border border-slate-200 text-[10px]"
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-mono font-bold text-[#1E4E8C]">
                                          {out?.code || a.configuredOutputId} (v
                                          {a.configuredOutputVersion})
                                        </span>
                                        <span
                                          className={`px-1 py-0.2 rounded font-bold ${
                                            a.status === 'Activa'
                                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                              : a.status === 'Instalada sin activar'
                                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                              : 'bg-slate-200 text-slate-700'
                                          }`}
                                        >
                                          {a.status}
                                        </span>
                                      </div>
                                      <div className="text-slate-600 truncate mt-0.5">
                                        {out?.name}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-3 align-top text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                type="button"
                                disabled={isInactive}
                                onClick={() => handleOpenAssociateModal(fmt)}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs ${
                                  isInactive
                                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                    : 'bg-[#1E4E8C] text-white hover:bg-[#163A69] cursor-pointer'
                                }`}
                              >
                                <Link2 className="w-3 h-3" />
                                Asociar salida
                              </button>
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setDetailFormat(fmt)}
                                  className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  Ficha
                                </button>
                                {canManageCatalog && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditFormatModal(fmt)}
                                      title="Editar formato"
                                      className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3 text-[#1E4E8C]" />
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteOrDeactivateFormat(fmt)}
                                      title="Eliminar o desactivar formato"
                                      className="px-2 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTotaliaTab('reuse');
                                    setTotaliaModalFormat(fmt);
                                  }}
                                  title="Asistencia contextual TOTALiA para este formato"
                                  className="px-2 py-1 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Sparkles className="w-3 h-3 text-indigo-700" />
                                  TOTALiA®
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ============================================================================ */}
      {/* MODAL 1: FORMAT DETAIL ("FICHA DEL FORMATO")                                 */}
      {/* ============================================================================ */}
      {detailFormat && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-4xl w-full overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold">
                  Ficha del Formato Regulatorio de Destino:{' '}
                  {detailFormat.code ? `Cód. ${detailFormat.code}` : detailFormat.internalCode} —{' '}
                  {detailFormat.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailFormat(null)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Top Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    País / Organismo Receptor
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {detailFormat.country || detailFormat.jurisdiction} ·{' '}
                    {detailFormat.regulator}
                  </div>
                  {detailFormat.issuingOrganism && (
                    <div className="text-[11px] text-indigo-800 mt-0.5 font-semibold">
                      Norma emitida por: {detailFormat.issuingOrganism}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Identificación Oficial / Interna
                  </span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    Oficial: {detailFormat.code || 'Sin código numérico'} · ID:{' '}
                    {detailFormat.internalCode || detailFormat.id}
                  </div>
                  {(detailFormat.internalNumberPeru ||
                    detailFormat.annexOrFormLabelPeru) && (
                    <div className="text-[11px] text-slate-600 font-mono">
                      {detailFormat.internalNumberPeru
                        ? `Nro. ${detailFormat.internalNumberPeru} `
                        : ''}
                      {detailFormat.annexOrFormLabelPeru
                        ? `(${detailFormat.annexOrFormLabelPeru})`
                        : ''}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Periodicidad / Modalidad / Versión
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {detailFormat.periodicity} (
                    {detailFormat.reportingModality || 'Periódico'}) ·{' '}
                    <span className="font-mono">{detailFormat.normativeVersion}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Vigencia:{' '}
                    {detailFormat.specificationValidity?.validFrom || '2026-01-01'} (
                    {detailFormat.normativeAvailability})
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Estado Operativo y Procedencia
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        detailFormat.lifecycleStatus === 'Inactivo'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : detailFormat.lifecycleStatus === 'Borrador'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}
                    >
                      {detailFormat.lifecycleStatus || 'Activo'}
                    </span>
                    <span>· {detailFormat.provenanceKind || 'Oficial'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {detailFormat.verificationLevel || 'Verificado en catálogo'}
                  </div>
                </div>
              </div>

              {/* Description & Reference Source Transparency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded p-3 space-y-1.5">
                  <div className="font-bold text-slate-800">
                    Descripción y Obligación / Referencia Normativa
                  </div>
                  <p className="text-slate-600">{detailFormat.description}</p>
                  <div className="text-slate-800 font-medium bg-slate-50 p-2 rounded border border-slate-200">
                    <strong>Norma / Documento técnico:</strong> {detailFormat.obligation}
                  </div>
                </div>

                <div className="border border-slate-200 rounded p-3 space-y-1.5 bg-slate-50/50">
                  <div className="font-bold text-slate-800 flex items-center justify-between">
                    <span>Transparencia de Fuente y Evidencia Documental</span>
                    {detailFormat.consultationDate && (
                      <span className="text-[10px] font-mono text-slate-500">
                        Fecha consulta: {detailFormat.consultationDate}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    {detailFormat.provenanceRef}
                  </div>
                  {detailFormat.sourceUrl && (
                    <a
                      href={detailFormat.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1E4E8C] hover:underline font-mono text-[11px] flex items-center gap-1 break-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      {detailFormat.sourceUrl}
                    </a>
                  )}
                  {detailFormat.supportDocument && (
                    <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-emerald-700" />
                        Soporte adjunto: {detailFormat.supportDocument.fileName}
                      </span>
                      <span className="font-mono text-[10px]">
                        {detailFormat.supportDocument.uploadedAt}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Applicability Section */}
              <div className="border border-slate-200 rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#1E4E8C]" />
                    <span>Aplicabilidad por Tipo de Entidad Reportante</span>
                  </div>
                  {canManageCatalog && (
                    <button
                      type="button"
                      onClick={() => handleOpenClassifyModal(detailFormat)}
                      className="text-[11px] font-bold text-[#1E4E8C] hover:underline cursor-pointer"
                    >
                      Editar clasificación institucional
                    </button>
                  )}
                </div>
                {detailFormat.classificationStatus === 'Pendiente de clasificación' ? (
                  <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-amber-950">
                    <strong>Estado: Pendiente de clasificación por tipo de entidad.</strong>{' '}
                    {detailFormat.classificationNotes}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {detailFormat.applicableEntityTypes.map((et) => (
                      <span
                        key={et}
                        className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold"
                      >
                        {et}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Associated Outputs List with "Desvincular salida" */}
              <div className="border border-slate-200 rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-[#1E4E8C]" />
                    <span>
                      Salidas Configuradas Asociadas a este Formato (
                      {getFormatAssociations(detailFormat.id).length})
                    </span>
                    <TooltipHelp
                      title="Desvincular salida vs Eliminar formato"
                      body="Desvincular retira o finaliza la asociación entre este formato y una salida configurada sin eliminar ni el formato ni la salida."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const fmt = detailFormat;
                      setDetailFormat(null);
                      handleOpenAssociateModal(fmt);
                    }}
                    className="px-2.5 py-1 rounded bg-[#1E4E8C] text-white text-[11px] font-bold hover:bg-[#163A69] cursor-pointer"
                  >
                    + Asociar otra salida
                  </button>
                </div>

                {getFormatAssociations(detailFormat.id).length === 0 ? (
                  <p className="text-slate-500 italic">
                    Aún no hay salidas configuradas vinculadas a este formato. Puede asociar una salida existente o iniciar el diseño de una nueva.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {getFormatAssociations(detailFormat.id).map((a) => {
                      const out = configuredOutputs.find(
                        (o) => o.id === a.configuredOutputId
                      );
                      const trans = transmissionTypes.find(
                        (t) => t.id === a.transmissionTypeId
                      );
                      return (
                        <div
                          key={a.id}
                          className="p-2.5 rounded bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span className="font-mono text-[#1E4E8C]">{a.code}</span>
                              <span>→</span>
                              <span>
                                {out?.code} (v{a.configuredOutputVersion}) — {out?.name}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  a.status === 'Activa'
                                    ? 'bg-emerald-100 text-emerald-900'
                                    : a.status === 'Retirada'
                                    ? 'bg-slate-200 text-slate-600'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {a.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              Transmisión: <strong>{trans?.name}</strong> · Modalidad:{' '}
                              <strong>{a.modality}</strong> · Vigencia: {a.validFrom} a{' '}
                              {a.validTo}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {out && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailFormat(null);
                                  openOutputInBuilder(out.id, 1);
                                }}
                                className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold cursor-pointer"
                              >
                                Abrir salida en diseñador
                              </button>
                            )}
                            {canManageCatalog && a.status !== 'Retirada' && (
                              <button
                                type="button"
                                onClick={() => {
                                  unlinkAssociation(
                                    a.id,
                                    `Desvinculación solicitada desde ficha del formato ${detailFormat.code || detailFormat.internalCode}`
                                  );
                                  setFeedbackBanner({
                                    type: 'warning',
                                    message: `Asociación ${a.code} desvinculada del formato "${detailFormat.code || detailFormat.internalCode}". Ni el formato ni la salida configurada fueron eliminados.`,
                                  });
                                }}
                                className="px-2 py-1 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Unlink className="w-3 h-3" />
                                Desvincular salida
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Version History & Audit Trail */}
              <div className="border border-slate-200 rounded p-3 space-y-2 bg-slate-50/40">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-[#1E4E8C]" />
                  <span>Historial de Versiones y Cambios del Formato</span>
                </div>
                {!detailFormat.versionHistory ||
                detailFormat.versionHistory.length === 0 ? (
                  <div className="text-[11px] text-slate-600">
                    Versión actual registrada:{' '}
                    <strong>{detailFormat.normativeVersion}</strong> (Vigente desde{' '}
                    {detailFormat.specificationValidity?.validFrom || '2026-01-01'}).
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {detailFormat.versionHistory.map((vh, idx) => (
                      <div
                        key={`${vh.versionLabel}-${idx}`}
                        className="p-2 rounded bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#1E4E8C] mr-2">
                            {vh.versionLabel}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold mr-2">
                            {vh.changeKind}
                          </span>
                          <span className="text-slate-700">{vh.changeSummary}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono shrink-0">
                          Vigencia: {vh.validFrom} · {vh.changedBy} ({vh.changedAt})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const fmt = detailFormat;
                      setDetailFormat(null);
                      createNewOutputForFormat(fmt);
                    }}
                    className="px-3 py-1.5 rounded border border-[#1E4E8C] text-[#1E4E8C] hover:bg-blue-50 font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Crear nueva salida para este formato
                  </button>
                  {canManageCatalog && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const fmt = detailFormat;
                          setDetailFormat(null);
                          handleOpenEditFormatModal(fmt);
                        }}
                        className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#1E4E8C]" />
                        Editar formato
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const fmt = detailFormat;
                          setDetailFormat(null);
                          setDeleteOrDeactivateFormat(fmt);
                        }}
                        className="px-3 py-1.5 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar / Desactivar
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {onSwitchToAssociationsTab && (
                    <button
                      type="button"
                      onClick={() => {
                        const id = detailFormat.id;
                        setDetailFormat(null);
                        onSwitchToAssociationsTab(id);
                      }}
                      className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                    >
                      Ver en matriz de asociaciones
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailFormat(null)}
                    className="px-3.5 py-1.5 rounded bg-slate-800 text-white font-semibold hover:bg-slate-900 cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL 2: AGREGAR FORMATO ("Agregar formato")                                 */}
      {/* ============================================================================ */}
      {showAddFormatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-3xl w-full overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-4 py-3 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-300" />
                <h3 className="text-sm font-bold">
                  Agregar Formato al Catálogo Regulatorio Único
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFormatModal(false)}
                className="text-xs text-emerald-200 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <form
              onSubmit={handleCreateFormatSubmit}
              className="p-4 overflow-y-auto space-y-4 text-xs"
            >
              {addFmtError && (
                <div className="p-3 rounded bg-rose-50 border border-rose-300 text-rose-950 font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>{addFmtError}</span>
                </div>
              )}

              {/* Real-time Duplicate Detection Warning */}
              {duplicateCheckForAdd && duplicateCheckForAdd.duplicates.length > 0 && (
                <div className="p-3 rounded bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    Control de duplicidad: Se detectaron{' '}
                    {duplicateCheckForAdd.duplicates.length} coincidencia(s) en el catálogo
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5">
                    {duplicateCheckForAdd.duplicates.map((dup, i) => (
                      <li key={`${dup.format.id}-${i}`}>
                        <strong>[{dup.severity}]</strong> {dup.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    País / Jurisdicción *
                  </label>
                  <select
                    aria-label="País del nuevo formato"
                    value={addFmtCountry}
                    onChange={(e) => {
                      const c = e.target.value as 'Colombia' | 'Perú';
                      setAddFmtCountry(c);
                      setAddFmtRegulator(c === 'Colombia' ? 'SFC' : 'SBS Perú');
                    }}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-semibold"
                  >
                    <option value="Colombia">Colombia</option>
                    <option value="Perú">Perú</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Organismo receptor *
                  </label>
                  <select
                    aria-label="Organismo receptor del nuevo formato"
                    value={addFmtRegulator}
                    onChange={(e) => setAddFmtRegulator(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-semibold"
                  >
                    {receivingOrganisms
                      .filter((o) => o.country === addFmtCountry)
                      .map((o) => (
                        <option key={o.id} value={o.name}>
                          {o.code} — {o.shortName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Código oficial (opcional)
                    <TooltipHelp
                      title="Código oficial opcional"
                      body="No es obligatorio inventar un código oficial cuando el reporte se identifica mediante nombre, anexo o formulario (ej. FDI Fogafín o Anexo 1 ROS UIAF)."
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 102, 1001 o dejar vacío"
                    value={addFmtCode}
                    onChange={(e) => setAddFmtCode(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Identificador interno estable *
                  </label>
                  <input
                    type="text"
                    required
                    value={addFmtInternalCode}
                    onChange={(e) => setAddFmtInternalCode(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Anexo / Forma / Nro Interno
                  </label>
                  <div className="flex gap-1.5">
                    {addFmtCountry === 'Perú' && (
                      <input
                        type="text"
                        placeholder="Nro SBS"
                        value={addFmtInternalNumber}
                        onChange={(e) => setAddFmtInternalNumber(e.target.value)}
                        className="w-1/2 border border-slate-300 rounded px-2 py-1.5 font-mono"
                      />
                    )}
                    <input
                      type="text"
                      placeholder="Ej. Anexo 1 / Forma A"
                      value={addFmtAnnexType}
                      onChange={(e) => setAddFmtAnnexType(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nombre completo del formato, reporte o anexo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Formato de Depósitos Individuales - FDI"
                    value={addFmtName}
                    onChange={(e) => setAddFmtName(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Organismo emisor norma (si difiere)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. SFC instruye para UIAF"
                    value={addFmtIssuingOrganism}
                    onChange={(e) => setAddFmtIssuingOrganism(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">
                    Descripción funcional
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Descripción del propósito regulatorio y alcance del formato..."
                    value={addFmtDescription}
                    onChange={(e) => setAddFmtDescription(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Periodicidad *
                  </label>
                  <select
                    value={addFmtPeriodicity}
                    onChange={(e) => setAddFmtPeriodicity(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="Diaria">Diaria</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Mensual">Mensual</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Anual">Anual</option>
                    <option value="Por evento">Por evento</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Modalidad de reporte *
                  </label>
                  <select
                    value={addFmtReportingModality}
                    onChange={(e) =>
                      setAddFmtReportingModality(
                        e.target.value as 'Periódico' | 'Por evento'
                      )
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="Periódico">Periódico</option>
                    <option value="Por evento">Por evento</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Versión y Vigencia (Inicio / Fin) *
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="v1.0"
                      value={addFmtVersion}
                      onChange={(e) => setAddFmtVersion(e.target.value)}
                      className="w-1/3 border border-slate-300 rounded px-2 py-1.5 font-mono"
                    />
                    <input
                      type="text"
                      placeholder="2026-01-01"
                      value={addFmtValidFrom}
                      onChange={(e) => setAddFmtValidFrom(e.target.value)}
                      className="w-1/3 border border-slate-300 rounded px-2 py-1.5 font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Abierta"
                      value={addFmtValidTo}
                      onChange={(e) => setAddFmtValidTo(e.target.value)}
                      className="w-1/3 border border-slate-300 rounded px-2 py-1.5 font-mono"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Referencia normativa o documento técnico
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Circular Externa 029 SFC / Resolución DIAN 000162"
                    value={addFmtObligation}
                    onChange={(e) => setAddFmtObligation(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Procedencia *
                  </label>
                  <select
                    value={addFmtProvenance}
                    onChange={(e) =>
                      setAddFmtProvenance(
                        e.target.value as
                          | 'Oficial'
                          | 'Aportado por el cliente'
                          | 'Referencia interna'
                      )
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="Oficial">Oficial</option>
                    <option value="Aportado por el cliente">Aportado por el cliente</option>
                    <option value="Referencia interna">Referencia interna</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Enlace oficial de soporte (URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.superfinanciera.gov.co/..."
                    value={addFmtSourceUrl}
                    onChange={(e) => setAddFmtSourceUrl(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Adjuntar documento de soporte
                  </label>
                  <label className="flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 cursor-pointer text-[11px] font-semibold text-slate-700">
                    <Upload className="w-3.5 h-3.5 text-[#1E4E8C]" />
                    <span>
                      {addFmtSupportDoc
                        ? addFmtSupportDoc.fileName
                        : 'Subir PDF / Anexo...'}
                    </span>
                    <input
                      type="file"
                      onChange={handleAddSupportDocUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Applicable Entity Types */}
              <div className="border border-slate-200 rounded p-3 space-y-2 bg-slate-50/50">
                <div className="font-bold text-slate-800">
                  Tipos de entidad reportante a los que aplica (requerido para estado Activo; puede quedar pendiente en Borrador)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entityTypes
                    .filter((et) => et.country === addFmtCountry)
                    .map((et) => {
                      const checked = addFmtEntityTypes.includes(et.name);
                      return (
                        <button
                          key={et.id}
                          type="button"
                          onClick={() =>
                            setAddFmtEntityTypes((prev) =>
                              prev.includes(et.name)
                                ? prev.filter((x) => x !== et.name)
                                : [...prev, et.name]
                            )
                          }
                          className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                            checked
                              ? 'bg-[#1E4E8C] text-white border-[#1E4E8C]'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {checked ? '✓ ' : '+ '}
                          {et.name}
                        </button>
                      );
                    })}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Agregar otro tipo de entidad o condición..."
                    value={addFmtCustomEntityType}
                    onChange={(e) => setAddFmtCustomEntityType(e.target.value)}
                    className="flex-1 border border-slate-300 rounded px-2.5 py-1 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (addFmtCustomEntityType.trim()) {
                        setAddFmtEntityTypes((prev) => [
                          ...prev,
                          addFmtCustomEntityType.trim(),
                        ]);
                        setAddFmtCustomEntityType('');
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 text-white font-semibold cursor-pointer"
                  >
                    Añadir tipo
                  </button>
                </div>
              </div>

              {/* Families, Transmission & Initial Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Familias técnicas confirmadas
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {(
                      ['CSV', 'TXT', 'XML', 'XBRL', 'AVRO', 'XLSX'] as TechnicalFamily[]
                    ).map((fam) => {
                      const active = addFmtFamilies.includes(fam);
                      return (
                        <button
                          key={fam}
                          type="button"
                          onClick={() =>
                            setAddFmtFamilies((prev) =>
                              prev.includes(fam)
                                ? prev.filter((f) => f !== fam)
                                : [...prev, fam]
                            )
                          }
                          className={`px-2 py-1 rounded font-mono text-[10px] font-bold border cursor-pointer ${
                            active
                              ? 'bg-[#1E4E8C] text-white border-[#1E4E8C]'
                              : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {fam}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Estado del formato *
                  </label>
                  <select
                    aria-label="Estado inicial del nuevo formato"
                    value={addFmtLifecycleStatus}
                    onChange={(e) =>
                      setAddFmtLifecycleStatus(
                        e.target.value as FormatLifecycleStatus
                      )
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-bold"
                  >
                    <option value="Borrador">
                      Borrador (permite información pendiente)
                    </option>
                    <option value="Pendiente de validación">
                      Pendiente de validación
                    </option>
                    <option value="Activo">
                      Activo (exige datos y evidencia completos)
                    </option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Vigencia normativa *
                  </label>
                  <select
                    value={addFmtAvailability}
                    onChange={(e) =>
                      setAddFmtAvailability(
                        e.target.value as RegulatoryFormat['normativeAvailability']
                      )
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="Vigente">Vigente</option>
                    <option value="Por entrar en vigencia">
                      Por entrar en vigencia
                    </option>
                    <option value="Histórico / En revisión">
                      Histórico / En revisión
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddFormatModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                >
                  Registrar formato en catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL 3: EDITAR FORMATO (CON IMPACTO DESCRIPTIVO VS ESPECIFICACIÓN)          */}
      {/* ============================================================================ */}
      {editModalFormat && editImpactDiagnostic && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-3xl w-full overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-4 py-3 bg-[#1E4E8C] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-sky-300" />
                <h3 className="text-sm font-bold">
                  Editar Formato: {editModalFormat.code || editModalFormat.internalCode} —{' '}
                  {editModalFormat.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModalFormat(null)}
                className="text-xs text-sky-200 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <form
              onSubmit={handleSaveEditFormat}
              className="p-4 overflow-y-auto space-y-4 text-xs"
            >
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 font-semibold">
                    Identificador interno conservado:
                  </span>{' '}
                  <strong className="font-mono text-slate-900">
                    {editModalFormat.internalCode || editModalFormat.id}
                  </strong>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                    editImpactDiagnostic.requiresNewVersion
                      ? 'bg-amber-100 text-amber-950 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                  }`}
                >
                  Tipo de cambio: {editImpactDiagnostic.changeClassification}
                </span>
              </div>

              {editError && (
                <div className="p-3 rounded bg-rose-50 border border-rose-300 text-rose-950 font-semibold">
                  {editError}
                </div>
              )}

              {/* Structural Change Impact Warning */}
              {editImpactDiagnostic.requiresNewVersion && (
                <div className="p-3 rounded bg-amber-50 border border-amber-300 text-amber-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    {editImpactDiagnostic.impactWarningSummary}
                  </div>
                  <div className="text-[11px]">
                    <strong>Diferencias técnico-normativas detectadas:</strong>{' '}
                    {editImpactDiagnostic.structuralDiffs.join(' · ')}
                  </div>
                  {editImpactDiagnostic.impactedAssociations.length > 0 && (
                    <div className="text-[11px] bg-white p-2 rounded border border-amber-200">
                      <strong>
                        Asociaciones y salidas vinculadas que deben revisarse (
                        {editImpactDiagnostic.impactedAssociations.length}):
                      </strong>
                      <ul className="list-disc list-inside mt-0.5">
                        {editImpactDiagnostic.impactedAssociations.map((a) => {
                          const out = editImpactDiagnostic.impactedOutputs.find(
                            (o) => o.id === a.configuredOutputId
                          );
                          return (
                            <li key={a.id}>
                              Asociación <strong>{a.code}</strong> [{a.status}] → Salida{' '}
                              <strong>
                                {out?.code} (v{a.configuredOutputVersion}) —{' '}
                                {out?.name}
                              </strong>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Código oficial (opcional)
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nombre completo del formato *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-semibold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Organismo receptor *
                  </label>
                  <input
                    type="text"
                    required
                    value={editRegulator}
                    onChange={(e) => setEditRegulator(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Estado operativo *
                  </label>
                  <select
                    value={editLifecycleStatus}
                    onChange={(e) =>
                      setEditLifecycleStatus(
                        e.target.value as FormatLifecycleStatus
                      )
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-bold"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Pendiente de validación">
                      Pendiente de validación
                    </option>
                    <option value="Borrador">Borrador</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Versión normativa *
                  </label>
                  <input
                    type="text"
                    required
                    value={editVersion}
                    onChange={(e) => setEditVersion(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Vigencia desde *
                  </label>
                  <input
                    type="text"
                    required
                    value={editValidFrom}
                    onChange={(e) => setEditValidFrom(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Disponibilidad normativa *
                  </label>
                  <select
                    value={editAvailability}
                    onChange={(e) =>
                      setEditAvailability(
                        e.target.value as RegulatoryFormat['normativeAvailability']
                      )
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="Vigente">Vigente</option>
                    <option value="Por entrar en vigencia">
                      Por entrar en vigencia
                    </option>
                    <option value="Histórico / En revisión">
                      Histórico / En revisión
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">
                    Referencia normativa / documento técnico *
                  </label>
                  <input
                    type="text"
                    value={editObligation}
                    onChange={(e) => setEditObligation(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">
                    Descripción funcional
                  </label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">
                    Justificación / Resumen del cambio para auditoría
                  </label>
                  <input
                    type="text"
                    placeholder="Describa si es una corrección descriptiva o una actualización de versión/especificación..."
                    value={editChangeSummary}
                    onChange={(e) => setEditChangeSummary(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditModalFormat(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#1E4E8C] hover:bg-[#163A69] text-white font-bold cursor-pointer"
                >
                  Confirmar y guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL 4: ELIMINAR O DESACTIVAR FORMATO (CON CONTROL DE DEPENDENCIAS)         */}
      {/* ============================================================================ */}
      {deleteOrDeactivateFormat && deleteDependenciesDiagnostic && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-xl w-full overflow-hidden">
            <div className="px-4 py-3 bg-rose-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-300" />
                <h3 className="text-sm font-bold">
                  Eliminar o Desactivar Formato Regulatorio
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteOrDeactivateFormat(null)}
                className="text-xs text-rose-200 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div className="p-3 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  Formato seleccionado
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {deleteOrDeactivateFormat.code ||
                    deleteOrDeactivateFormat.internalCode}{' '}
                  — {deleteOrDeactivateFormat.name}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Organismo: {deleteOrDeactivateFormat.regulator} · Estado actual:{' '}
                  <strong>{deleteOrDeactivateFormat.lifecycleStatus || 'Activo'}</strong>
                </div>
              </div>

              {/* Dependency evaluation result */}
              {deleteDependenciesDiagnostic.canDelete ? (
                <div className="p-3 rounded bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    Sin dependencias operativas ni históricas
                  </div>
                  <p className="text-[11px]">{deleteDependenciesDiagnostic.explanation}</p>
                  <p className="text-[11px] font-semibold">
                    ¿Confirma que desea eliminar físicamente el formato{' '}
                    <span className="font-mono">
                      {deleteOrDeactivateFormat.code ||
                        deleteOrDeactivateFormat.internalCode}{' '}
                      ({deleteOrDeactivateFormat.name})
                    </span>
                    , o prefiere únicamente desactivarlo?
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                    Eliminación física bloqueada para proteger la trazabilidad
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {deleteDependenciesDiagnostic.explanation}
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="bg-white p-2 rounded border border-amber-200">
                      <div className="font-bold text-sm text-slate-900">
                        {deleteDependenciesDiagnostic.linkedAssociations.length}
                      </div>
                      <div className="text-[10px] text-slate-500">Asociaciones</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-amber-200">
                      <div className="font-bold text-sm text-slate-900">
                        {deleteDependenciesDiagnostic.linkedRuns.length}
                      </div>
                      <div className="text-[10px] text-slate-500">Corridas / Entregas</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-amber-200">
                      <div className="font-bold text-sm text-slate-900">
                        {deleteDependenciesDiagnostic.hasVersionHistoryDependencies
                          ? 'Sí'
                          : 'No'}
                      </div>
                      <div className="text-[10px] text-slate-500">Historial versiones</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Deactivate / Reactivate Section */}
              <div className="border border-slate-200 rounded p-3 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <PowerOff className="w-3.5 h-3.5 text-amber-700" />
                  <span>
                    Opción recomendada:{' '}
                    {deleteOrDeactivateFormat.lifecycleStatus === 'Inactivo'
                      ? 'Reactivar formato para operación'
                      : 'Desactivar formato (conserva historial y asociaciones previas)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Al desactivar el formato, se impiden nuevas asociaciones operativas activas desde la fecha de efecto, pero se conserva íntegro para consulta y auditoría histórica.
                </p>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Motivo de desactivación / cambio de estado:
                  </label>
                  <input
                    type="text"
                    value={deactivationReasonInput}
                    onChange={(e) => setDeactivationReasonInput(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDeleteOrDeactivateFormat(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>

                {deleteOrDeactivateFormat.lifecycleStatus === 'Inactivo' ? (
                  <button
                    type="button"
                    onClick={() => handleConfirmToggleLifecycle('Activo')}
                    className="px-3.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" />
                    Reactivar formato
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConfirmToggleLifecycle('Inactivo')}
                    className="px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                    Desactivar formato
                  </button>
                )}

                {deleteDependenciesDiagnostic.canDelete && (
                  <button
                    type="button"
                    onClick={handleConfirmDeleteFormat}
                    className="px-3.5 py-1.5 rounded bg-rose-700 hover:bg-rose-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Confirmar eliminación definitiva
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL 5: REGISTRAR NUEVO ORGANISMO RECEPTOR                                  */}
      {/* ============================================================================ */}
      {showAddOrganismModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-4 py-3 bg-[#1E4E8C] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Registrar Nuevo Organismo Receptor</h3>
              <button
                type="button"
                onClick={() => setShowAddOrganismModal(false)}
                className="text-xs text-sky-200 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <form onSubmit={handleCreateOrganism} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">País *</label>
                <select
                  value={newOrgCountry}
                  onChange={(e) =>
                    setNewOrgCountry(e.target.value as 'Colombia' | 'Perú')
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                >
                  <option value="Colombia">Colombia</option>
                  <option value="Perú">Perú</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Sigla / Código *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. BANREP, SMV, SUNAT"
                  value={newOrgCode}
                  onChange={(e) => setNewOrgCode(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Banco de la República de Colombia"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  value={newOrgDesc}
                  onChange={(e) => setNewOrgDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Enlace oficial (URL)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newOrgUrl}
                  onChange={(e) => setNewOrgUrl(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddOrganismModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-[#1E4E8C] text-white font-bold cursor-pointer"
                >
                  Guardar organismo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL 6: ASSOCIATE CONFIGURED OUTPUT TO FORMAT                               */}
      {/* ============================================================================ */}
      {associateModalFormat && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="px-4 py-3 bg-[#1E4E8C] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-sky-300" />
                <h3 className="text-sm font-bold">
                  Asociar Salida Configurada a Formato de Destino
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssociateModalFormat(null)}
                className="text-xs text-sky-200 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSaveAssociation} className="p-4 space-y-4 text-xs">
              <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  Recorrido seleccionado: País → Organismo / Tipo de entidad → Formato de destino
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  [{associateModalFormat.country || associateModalFormat.jurisdiction}]{' '}
                  {associateModalFormat.regulator} · Formato{' '}
                  {associateModalFormat.code || associateModalFormat.internalCode} —{' '}
                  {associateModalFormat.name} ({associateModalFormat.normativeVersion})
                </div>
                <div className="text-[11px] text-slate-600">
                  Familias técnicas admitidas:{' '}
                  <strong className="font-mono text-[#1E4E8C]">
                    {(associateModalFormat.supportedFamilies || []).join(', ')}
                  </strong>{' '}
                  · Clasificación:{' '}
                  <strong>{associateModalFormat.classificationStatus}</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Salida configurada y versión */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    1. Salida configurada y versión a vincular *
                  </label>
                  <select
                    aria-label="Seleccionar salida configurada"
                    value={assocOutputId}
                    onChange={(e) => setAssocOutputId(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                  >
                    {configuredOutputs.map((o) => {
                      const ot = outputTypes.find((t) => t.id === o.outputTypeId);
                      const isCompatibleFam =
                        ot &&
                        (associateModalFormat.supportedFamilies || []).includes(
                          ot.family
                        );
                      return (
                        <option key={o.id} value={o.id}>
                          {isCompatibleFam ? '✓ ' : '⚠ '} [{ot?.family}] {o.code} (v
                          {o.version}) — {o.name} [{o.status}]
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 2. Tipo de transmisión */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    2. Tipo de transmisión *
                  </label>
                  <select
                    aria-label="Seleccionar tipo de transmisión"
                    value={assocTransmissionId}
                    onChange={(e) => setAssocTransmissionId(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    {transmissionTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} · {t.name} ({t.compatibleFamilies.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Canal de entrega */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    3. Canal de entrega *
                  </label>
                  <select
                    aria-label="Seleccionar canal de entrega"
                    value={assocChannelId}
                    onChange={(e) => setAssocChannelId(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    {deliveryChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Modalidad */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    4. Modalidad de envío *
                  </label>
                  <select
                    value={assocModality}
                    onChange={(e) =>
                      setAssocModality(
                        e.target.value as 'Inicial' | 'Corrección' | 'Reemplazo'
                      )
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="Inicial">Inicial (Envío ordinario)</option>
                    <option value="Corrección">Corrección</option>
                    <option value="Reemplazo">Reemplazo / Retransmisión</option>
                  </select>
                </div>

                {/* 5. Estado de la asociación */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    5. Estado de la asociación *
                  </label>
                  <select
                    aria-label="Seleccionar estado de la asociación"
                    value={assocStatus}
                    onChange={(e) =>
                      setAssocStatus(
                        e.target.value as
                          | 'Activa'
                          | 'Instalada sin activar'
                          | 'Borrador'
                      )
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-semibold"
                  >
                    <option value="Activa">
                      Activa (Habilitada para entrega operativa)
                    </option>
                    <option value="Instalada sin activar">
                      Instalada sin activar (En preparación / Pendiente clasificar)
                    </option>
                    <option value="Borrador">Borrador</option>
                  </select>
                </div>

                {/* 6. Vigencia desde */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Vigencia desde
                  </label>
                  <input
                    type="text"
                    value={assocValidFrom}
                    onChange={(e) => setAssocValidFrom(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                {/* 7. Prefijo de archivo */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Prefijo de archivo para este destino
                  </label>
                  <input
                    type="text"
                    value={assocPrefixOverride}
                    onChange={(e) => setAssocPrefixOverride(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Validation Diagnostic Feedback */}
              {assocValidation && assocValidation.blockers.length > 0 && (
                <div className="p-3 rounded bg-rose-50 border border-rose-300 text-rose-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>
                      No es posible registrar la asociación con estas condiciones:
                    </span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5">
                    {assocValidation.blockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {assocValidation &&
                assocValidation.blockers.length === 0 &&
                assocValidation.warnings.length > 0 && (
                  <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      {assocValidation.warnings.map((w, i) => (
                        <div key={i}>{w}</div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAssociateModalFormat(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    !assocValidation ||
                    !assocValidation.isValid ||
                    (assocStatus === 'Activa' && !assocValidation.canActivate)
                  }
                  className={`px-4 py-1.5 rounded font-bold ${
                    !assocValidation ||
                    !assocValidation.isValid ||
                    (assocStatus === 'Activa' && !assocValidation.canActivate)
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-[#1E4E8C] text-white hover:bg-[#163A69] cursor-pointer'
                  }`}
                >
                  Confirmar asociación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL 7: CLASSIFY APPLICABILITY BY ENTITY TYPE                               */}
      {/* ============================================================================ */}
      {classifyModalFormat && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-xl w-full overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">
                  Clasificar Aplicabilidad por Tipo de Entidad Reportante
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setClassifyModalFormat(null)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSaveClassification} className="p-4 space-y-4 text-xs">
              <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-950">
                <div className="font-bold">
                  Formato {classifyModalFormat.code || classifyModalFormat.internalCode} —{' '}
                  {classifyModalFormat.name} (
                  {classifyModalFormat.country || classifyModalFormat.jurisdiction})
                </div>
                <p className="text-[11px] mt-1">
                  Seleccione los tipos de entidad supervisada o contribuyente a los cuales aplica este formato. Un formato sin clasificar no se asume universal.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Tipos de entidad aplicables en{' '}
                  {classifyModalFormat.country || classifyModalFormat.jurisdiction}:
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded p-2.5 bg-slate-50">
                  {entityTypes
                    .filter(
                      (et) =>
                        et.country ===
                        (classifyModalFormat.country ||
                          classifyModalFormat.jurisdiction)
                    )
                    .map((et) => (
                      <label
                        key={et.id}
                        className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={classSelectedTypes.includes(et.name)}
                          onChange={() =>
                            setClassSelectedTypes((prev) =>
                              prev.includes(et.name)
                                ? prev.filter((x) => x !== et.name)
                                : [...prev, et.name]
                            )
                          }
                          className="rounded border-slate-300 text-[#1E4E8C]"
                        />
                        <span>{et.name}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Sustento / Observación de clasificación institucional:
                </label>
                <textarea
                  rows={2}
                  value={classNotes}
                  onChange={(e) => setClassNotes(e.target.value)}
                  placeholder="Ej. Clasificado según anexo técnico o circular aplicable..."
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setClassifyModalFormat(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#1E4E8C] text-white font-bold hover:bg-[#163A69] cursor-pointer"
                >
                  Guardar clasificación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL 8: TOTALiA® CONTEXTUAL ASSISTANCE FOR FORMAT LIFECYCLE                 */}
      {/* ============================================================================ */}
      {totaliaModalFormat && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-indigo-200 rounded-md shadow-xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 bg-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h3 className="text-sm font-bold">
                  Asistencia Contextual TOTALiA® — Administración y Consulta de Formatos
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTotaliaModalFormat(null)}
                className="text-xs text-indigo-200 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            {/* Tabs inside TOTALiA Modal */}
            <div className="bg-indigo-50/80 border-b border-indigo-200 px-4 py-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setTotaliaTab('reuse')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  totaliaTab === 'reuse'
                    ? 'bg-indigo-900 text-white'
                    : 'bg-white text-indigo-900 border border-indigo-200'
                }`}
              >
                1. Salidas reutilizables
              </button>
              <button
                type="button"
                onClick={() => setTotaliaTab('prepare')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  totaliaTab === 'prepare'
                    ? 'bg-indigo-900 text-white'
                    : 'bg-white text-indigo-900 border border-indigo-200'
                }`}
              >
                2. Preparar formato y detectar duplicados
              </button>
              <button
                type="button"
                onClick={() => setTotaliaTab('classify')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  totaliaTab === 'classify'
                    ? 'bg-indigo-900 text-white'
                    : 'bg-white text-indigo-900 border border-indigo-200'
                }`}
              >
                3. Proponer clasificación con evidencia
              </button>
              <button
                type="button"
                onClick={() => setTotaliaTab('versions')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  totaliaTab === 'versions'
                    ? 'bg-indigo-900 text-white'
                    : 'bg-white text-indigo-900 border border-indigo-200'
                }`}
              >
                4. Comparar versiones e impacto
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="font-bold text-slate-700">
                  Formato analizado por TOTALiA®:
                </span>
                <select
                  value={totaliaModalFormat.id}
                  onChange={(e) => {
                    const found = regulatoryFormats.find(
                      (f) => f.id === e.target.value
                    );
                    if (found) setTotaliaModalFormat(found);
                  }}
                  className="border border-slate-300 rounded px-2.5 py-1 bg-white font-semibold text-slate-900"
                >
                  {regulatoryFormats.map((f) => (
                    <option key={f.id} value={f.id}>
                      [{f.country || f.jurisdiction} · {f.regulator}]{' '}
                      {f.code || f.internalCode} — {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {totaliaTab === 'reuse' &&
                (() => {
                  const rec = generateTotaliaFormatRecommendations({
                    format: totaliaModalFormat,
                    configuredOutputs,
                    outputTypes,
                    transmissionTypes,
                  });
                  return (
                    <div className="space-y-3">
                      <div className="p-3 rounded bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-1">
                        <div className="font-bold">{rec.explanation}</div>
                        <ul className="list-disc list-inside text-[11px] mt-1">
                          {rec.requirementsSummary.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <div className="font-bold text-slate-800">
                          Salidas configuradas candidatas para reutilización o asociación:
                        </div>
                        {rec.reusableOutputs.length === 0 ? (
                          <div className="p-3 rounded bg-slate-50 border border-slate-200 text-slate-600">
                            No existen salidas con la familia técnica requerida. Puede iniciar una nueva salida desde el diseñador conservando este formato como destino.
                          </div>
                        ) : (
                          rec.reusableOutputs.map((s) => (
                            <div
                              key={s.output.id}
                              className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                            >
                              <div>
                                <div className="font-bold text-slate-900">
                                  <span className="font-mono text-[#1E4E8C]">
                                    {s.output.code} (v{s.output.version})
                                  </span>{' '}
                                  — {s.output.name} [{s.output.status}]
                                </div>
                                <div className="text-[11px] text-slate-600 mt-0.5">
                                  {s.matchReason} (Puntaje: {s.matchScore}%)
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const fmt = totaliaModalFormat;
                                  setTotaliaModalFormat(null);
                                  handleOpenAssociateModal(fmt);
                                  setAssocOutputId(s.output.id);
                                }}
                                className="px-2.5 py-1 rounded bg-[#1E4E8C] text-white text-[11px] font-bold hover:bg-[#163A69] shrink-0 cursor-pointer"
                              >
                                Asociar esta salida
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}

              {totaliaTab === 'prepare' && (
                <div className="space-y-3">
                  <div className="p-3 rounded bg-indigo-50 border border-indigo-200 text-indigo-950">
                    <div className="font-bold mb-1">
                      Asistente para preparar un nuevo formato desde descripción o documento técnico
                    </div>
                    <p className="text-[11px]">
                      Pegue el título o extracto del instructivo regulatorio (SFC, DIAN, Fogafín, UIAF o SBS Perú). TOTALiA® verificará si ya existe un formato similar en el catálogo y preparará el formulario de alta como borrador sin publicar automáticamente.
                    </p>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Ej. Instructivo Fogafín Formato de Depósitos Individuales FDI trimestral para establecimientos bancarios..."
                    value={totaliaDraftText}
                    onChange={(e) => setTotaliaDraftText(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2.5"
                  />
                  {totaliaDraftText.trim() && (
                    <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-800">
                        Verificación de duplicados en catálogo para: “
                        {totaliaDraftText.slice(0, 60)}”
                      </div>
                      {(() => {
                        const dupRes = checkFormatDuplicateCandidates(
                          regulatoryFormats,
                          {
                            jurisdiction:
                              selectedCountry === 'ALL'
                                ? 'Colombia'
                                : selectedCountry,
                            name: totaliaDraftText,
                            code: totaliaDraftText.match(/\b\d{3,4}\b/)?.[0],
                          }
                        );
                        return dupRes.duplicates.length > 0 ? (
                          <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-200">
                            <strong>Posibles formatos existentes detectados:</strong>
                            <ul className="list-disc list-inside mt-1">
                              {dupRes.duplicates.map((d, i) => (
                                <li key={i}>{d.reason}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-800">
                            ✓ No se detectaron duplicados exactos en el catálogo actual.
                          </div>
                        );
                      })()}
                      {canManageCatalog && (
                        <button
                          type="button"
                          onClick={() => {
                            const txt = totaliaDraftText;
                            setTotaliaModalFormat(null);
                            handleOpenAddFormatModal();
                            setAddFmtName(txt.slice(0, 90));
                            setAddFmtDescription(txt);
                          }}
                          className="px-3 py-1.5 rounded bg-emerald-700 text-white font-bold cursor-pointer"
                        >
                          Prellenar formulario “Agregar formato” en Borrador
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {totaliaTab === 'classify' && (
                <div className="space-y-3">
                  <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                    <div className="font-bold">
                      Propuesta de clasificación asistida con evidencia (requiere aprobación del usuario)
                    </div>
                    <p className="text-[11px]">
                      TOTALiA® nunca aplica cambios de clasificación sin confirmación explícita. Para el formato{' '}
                      <strong>
                        {totaliaModalFormat.code || totaliaModalFormat.internalCode}{' '}
                        — {totaliaModalFormat.name}
                      </strong>
                      :
                    </p>
                    <p className="text-[11px] mt-1">
                      <strong>Evidencia normativa registrada:</strong>{' '}
                      {totaliaModalFormat.obligation} ({totaliaModalFormat.provenanceRef}).
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded bg-slate-50 border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-900">
                        Estado actual: {totaliaModalFormat.classificationStatus}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Tipos actuales:{' '}
                        {totaliaModalFormat.applicableEntityTypes.length > 0
                          ? totaliaModalFormat.applicableEntityTypes.join(', ')
                          : 'Ninguno asignado aún'}
                      </div>
                    </div>
                    {canManageCatalog && (
                      <button
                        type="button"
                        onClick={() => {
                          const fmt = totaliaModalFormat;
                          setTotaliaModalFormat(null);
                          handleOpenClassifyModal(fmt);
                        }}
                        className="px-3 py-1.5 rounded bg-[#1E4E8C] text-white font-bold cursor-pointer"
                      >
                        Revisar y aprobar clasificación
                      </button>
                    )}
                  </div>
                </div>
              )}

              {totaliaTab === 'versions' && (
                <div className="space-y-3">
                  <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="font-bold text-slate-900">
                      Análisis de impacto de edición, versionamiento o desactivación
                    </div>
                    <p className="text-[11px] text-slate-600">
                      • <strong>Asociaciones vinculadas a este formato:</strong>{' '}
                      {getFormatAssociations(totaliaModalFormat.id).length}{' '}
                      asociación(es).
                    </p>
                    <p className="text-[11px] text-slate-600">
                      • <strong>Regla de protección:</strong> Si edita la versión (
                      {totaliaModalFormat.normativeVersion}), vigencia (
                      {totaliaModalFormat.specificationValidity?.validFrom}) o familias técnicas (
                      {(totaliaModalFormat.supportedFamilies || []).join(', ')}), el sistema registrará una nueva entrada en el historial de versiones y conservará intactas las salidas configuradas publicadas hasta que el responsable confirme su actualización.
                    </p>
                    <p className="text-[11px] text-slate-600">
                      • <strong>Eliminación vs Desactivación:</strong>{' '}
                      {
                        evaluateFormatDependencies({
                          format: totaliaModalFormat,
                          associations,
                          executionRuns,
                        }).explanation
                      }
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setTotaliaModalFormat(null)}
                  className="px-3.5 py-1.5 rounded bg-slate-800 text-white font-semibold cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
