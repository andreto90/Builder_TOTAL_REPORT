import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  FileCode2,
  Link2,
  Plus,
  Search,
  Sliders,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ConfiguredOutput,
  CsvParameters,
  FormatOutputAssociation,
  OutputType,
  OutputValidationRule,
  PdfParameters,
  ReceivingOrganismDefinition,
  RegulatoryFormat,
  StructureField,
  TechnicalFamily,
  TransmissionType,
  TxtParameters,
  XmlParameters,
} from '../domain/types';
import {
  NO_REGULATOR_LABEL,
  WizardFormatSelection,
  buildAutoOutputCode,
  buildAutoTechnicalName,
  buildQuickOutputDefaults,
  buildSmartStructureField,
  formatMatchesOrganism,
  getCompatibleTransmissionsForFormat,
  getSmartFieldDefaults,
  recalculateStructureFieldsForFamily,
  resolveDynamicFileName,
  validateAssociationContext,
} from '../domain/engine';
import {
  AMERICAS_AND_EUROPE_COUNTRIES,
  normalizeSearchText,
  resolveRegulatorsForCountry,
} from '../domain/jurisdictionsCatalog';
import {
  AppliedAnnexInterpretationResult,
  NormativeAnnexInterpretation,
} from '../domain/annexInterpreterTypes';
import { NormativeAnnexImportPanel } from './NormativeAnnexImportPanel';
import { SearchableSelector, SearchableSelectorOption } from './SearchableSelector';
import { TotalReportLogo } from './TotalReportLogo';

interface SimplifiedOutputWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  outputTypes: OutputType[];
  receivingOrganisms: ReceivingOrganismDefinition[];
  regulatoryFormats: RegulatoryFormat[];
  transmissionTypes: TransmissionType[];
  existingAssociations: FormatOutputAssociation[];
  existingCodes: string[];
  responsibleUser: string;
  globalEntity: string;
  globalPeriod: string;
  globalEnvironment?: 'QA' | 'Producción';
  defaultContractId?: string;
  defaultChannelId?: string;
  defaultContractName?: string;
  defaultChannelName?: string;
  onCreateOutput: (
    created: ConfiguredOutput,
    formatSelections: WizardFormatSelection[],
    openAdvancedBuilder: boolean
  ) => void;
}

const FAMILY_DESCRIPTIONS: Record<TechnicalFamily, string> = {
  CSV: 'Delimitado por carácter',
  TXT: 'Ancho fijo posicional',
  XML: 'Estructura jerárquica',
  AVRO: 'Esquema binario tipado',
  XBRL: 'Taxonomía financiera',
  PDF: 'Documento estructurado',
  XLSX: 'Hoja de cálculo tabular',
};

const CUSTOM_REGULATOR_SENTINEL = '__CUSTOM_REGULATOR__';

const WIZARD_STEPS = [
  { id: 1 as const, label: 'Definición inicial', detail: 'Nombre, archivo y entidad' },
  { id: 2 as const, label: 'Estructura de campos', detail: 'Plantilla y columnas' },
  { id: 3 as const, label: 'Asociar formatos', detail: 'Uno o más destinos' },
  { id: 4 as const, label: 'Revisión y creación', detail: 'Resumen y vínculos' },
];

export const SimplifiedOutputWizardModal: React.FC<SimplifiedOutputWizardModalProps> = ({
  isOpen,
  onClose,
  outputTypes,
  receivingOrganisms,
  regulatoryFormats,
  transmissionTypes,
  existingAssociations,
  existingCodes,
  responsibleUser,
  globalEntity,
  globalPeriod,
  globalEnvironment = 'QA',
  defaultContractId = 'DC-CARTERA-01',
  defaultChannelId = 'CHAN-MANUAL-01',
  defaultContractName = 'Cartera y Operaciones',
  defaultChannelName = 'Descarga controlada (Manual)',
  onCreateOutput,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState<string>('Reporte Regulatorio de Cartera');
  const [outputTypeId, setOutputTypeId] = useState<string>(outputTypes[0]?.id || 'TYPE-CSV-01');
  const [jurisdiction, setJurisdiction] =
    useState<ConfiguredOutput['jurisdiction']>('Colombia');
  const [countryRegionTab, setCountryRegionTab] = useState<'ALL' | 'América' | 'Europa'>('ALL');
  const [regulatorSelect, setRegulatorSelect] = useState<string>('');
  const [customRegulatorName, setCustomRegulatorName] = useState<string>('');
  const [starterMode, setStarterMode] = useState<'single' | 'five'>('five');
  const [fields, setFields] = useState<StructureField[]>([]);
  const [nameError, setNameError] = useState<string>('');

  // Quick field add bar state in Step 2
  const [quickLabel, setQuickLabel] = useState<string>('');
  const [quickDataType, setQuickDataType] = useState<StructureField['dataType']>('Texto');
  const [quickRequired, setQuickRequired] = useState<boolean>(true);

  // Step 3: Multi-format association state
  const [formatSelections, setFormatSelections] = useState<WizardFormatSelection[]>([]);
  const [formatSearch, setFormatSearch] = useState<string>('');
  const [formatScopeFilter, setFormatScopeFilter] = useState<'organism' | 'country' | 'all'>(
    'organism'
  );

  // TOTALiA® Normative Annex Import State
  const [showAnnexImporter, setShowAnnexImporter] = useState<boolean>(false);
  const [appliedInterpretation, setAppliedInterpretation] =
    useState<NormativeAnnexInterpretation | null>(null);
  const [appliedAiMeta, setAppliedAiMeta] = useState<{
    outputCode?: string;
    description?: string;
    composition?: Partial<ConfiguredOutput['composition']>;
    validationRules?: OutputValidationRule[];
    csvParamsOverride?: Partial<CsvParameters>;
    txtParamsOverride?: Partial<TxtParameters>;
    xmlParamsOverride?: Partial<XmlParameters>;
    pdfParamsOverride?: Partial<PdfParameters>;
    versionHistory?: ConfiguredOutput['versionHistory'];
  } | null>(null);

  const selectedOutputType = useMemo(
    () => outputTypes.find((t) => t.id === outputTypeId) || outputTypes[0],
    [outputTypes, outputTypeId]
  );

  const regulatorsForCountry = useMemo(
    () => resolveRegulatorsForCountry(jurisdiction, receivingOrganisms),
    [jurisdiction, receivingOrganisms]
  );

  const effectiveRegulator = useMemo(() => {
    if (regulatorSelect === NO_REGULATOR_LABEL) return NO_REGULATOR_LABEL;
    if (regulatorSelect === CUSTOM_REGULATOR_SENTINEL) {
      return customRegulatorName.trim() || NO_REGULATOR_LABEL;
    }
    return regulatorSelect || regulatorsForCountry[0]?.name || NO_REGULATOR_LABEL;
  }, [regulatorSelect, customRegulatorName, regulatorsForCountry]);

  const isCustomNoRegulator = effectiveRegulator === NO_REGULATOR_LABEL;

  const buildInitialFieldsForMode = (
    mode: 'single' | 'five',
    outType: OutputType
  ): StructureField[] => {
    const preview = buildQuickOutputDefaults({
      name: name || 'Nueva Salida',
      outputType: outType,
      existingCodes,
      starterMode: mode,
      responsibleUser,
      defaultContractId,
      defaultChannelId,
    });
    return preview.fields;
  };

  // Initialize fresh state whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    const defaultType = outputTypes[0];
    const initialCountryRegs = resolveRegulatorsForCountry('Colombia', receivingOrganisms);
    setStep(1);
    setName('Reporte Regulatorio de Cartera');
    setNameError('');
    setOutputTypeId(defaultType?.id || 'TYPE-CSV-01');
    setJurisdiction('Colombia');
    setCountryRegionTab('ALL');
    setRegulatorSelect(initialCountryRegs[0]?.name || NO_REGULATOR_LABEL);
    setCustomRegulatorName('');
    setStarterMode('five');
    setQuickLabel('');
    setQuickDataType('Texto');
    setQuickRequired(true);
    setFormatSelections([]);
    setFormatSearch('');
    setFormatScopeFilter('organism');
    setShowAnnexImporter(false);
    setAppliedInterpretation(null);
    setAppliedAiMeta(null);
    if (defaultType) {
      setFields(
        buildQuickOutputDefaults({
          name: 'Reporte Regulatorio de Cartera',
          outputType: defaultType,
          existingCodes,
          starterMode: 'five',
          responsibleUser,
          defaultContractId,
          defaultChannelId,
        }).fields
      );
    }
  }, [isOpen]);

  const autoCode = useMemo(() => {
    if (
      appliedAiMeta?.outputCode &&
      !existingCodes.some((c) => c.toUpperCase() === appliedAiMeta.outputCode?.toUpperCase())
    ) {
      return appliedAiMeta.outputCode;
    }
    return buildAutoOutputCode(name || 'Nueva Salida', existingCodes);
  }, [name, existingCodes, appliedAiMeta?.outputCode]);

  const resolvedFileNamePreview = useMemo(() => {
    const ext =
      selectedOutputType?.extension.replace(/^\./, '').toLowerCase() ||
      selectedOutputType?.family.toLowerCase() ||
      'csv';
    const pattern =
      appliedAiMeta?.composition?.fileNamePattern ||
      `{entidad}_${autoCode}_{periodo}_v{version}.${ext}`;
    return resolveDynamicFileName(pattern, {
      entidad: globalEntity || 'DEMO',
      formato: autoCode,
      periodo: globalPeriod || '2026-11',
      version: '1.0',
      consecutivo: '01',
    });
  }, [autoCode, selectedOutputType, globalEntity, globalPeriod, appliedAiMeta?.composition?.fileNamePattern]);

  // Draft snapshot used exclusively for real-time validation in Step 3
  const livePreviewOutput = useMemo<ConfiguredOutput | undefined>(() => {
    if (!selectedOutputType) return undefined;
    const base = buildQuickOutputDefaults({
      name: name.trim() || 'Nueva Salida Regulatoria',
      outputType: selectedOutputType,
      existingCodes,
      overrideCode: autoCode,
      regulator: effectiveRegulator,
      jurisdiction,
      starterMode,
      customFields: fields,
      responsibleUser,
      defaultContractId,
      defaultChannelId,
    });
    if (!appliedAiMeta) return base;
    return {
      ...base,
      description: appliedAiMeta.description || base.description,
      composition: {
        ...base.composition,
        ...(appliedAiMeta.composition || {}),
      },
      csvParamsOverride: appliedAiMeta.csvParamsOverride ?? base.csvParamsOverride,
      txtParamsOverride: appliedAiMeta.txtParamsOverride ?? base.txtParamsOverride,
      xmlParamsOverride: appliedAiMeta.xmlParamsOverride ?? base.xmlParamsOverride,
      pdfParamsOverride: appliedAiMeta.pdfParamsOverride ?? base.pdfParamsOverride,
      validationRules: appliedAiMeta.validationRules ?? base.validationRules,
    };
  }, [
    name,
    selectedOutputType,
    existingCodes,
    autoCode,
    effectiveRegulator,
    jurisdiction,
    starterMode,
    fields,
    responsibleUser,
    defaultContractId,
    defaultChannelId,
    appliedAiMeta,
  ]);

  // Candidate formats shown in Step 3
  const candidateFormats = useMemo(() => {
    const q = formatSearch.trim().toLowerCase();
    const canFilterByOrganism =
      formatScopeFilter === 'organism' &&
      !isCustomNoRegulator &&
      regulatorSelect !== CUSTOM_REGULATOR_SENTINEL &&
      jurisdiction !== 'Multirregulador';

    return regulatoryFormats.filter((fmt) => {
      if (fmt.lifecycleStatus === 'Inactivo') return false;
      const fmtCountry = fmt.country || fmt.jurisdiction;
      if (
        formatScopeFilter !== 'all' &&
        jurisdiction !== 'Multirregulador' &&
        fmtCountry !== jurisdiction
      ) {
        return false;
      }
      if (canFilterByOrganism && !formatMatchesOrganism(fmt, effectiveRegulator, receivingOrganisms)) {
        return false;
      }
      if (!q) return true;
      return (
        (fmt.code || '').toLowerCase().includes(q) ||
        (fmt.internalCode || '').toLowerCase().includes(q) ||
        fmt.name.toLowerCase().includes(q) ||
        fmt.regulator.toLowerCase().includes(q)
      );
    });
  }, [
    regulatoryFormats,
    jurisdiction,
    formatScopeFilter,
    isCustomNoRegulator,
    regulatorSelect,
    effectiveRegulator,
    receivingOrganisms,
    formatSearch,
  ]);

  const selectedOrganismShortLabel = useMemo(() => {
    const match = regulatorsForCountry.find((r) => r.name === regulatorSelect);
    return match?.shortName || regulatorSelect;
  }, [regulatorsForCountry, regulatorSelect]);

  // Options for Searchable Country Selector (América + Europa + Multirregulador)
  const countryOptions = useMemo<SearchableSelectorOption[]>(() => {
    const filtered = AMERICAS_AND_EUROPE_COUNTRIES.filter(
      (entry) => countryRegionTab === 'ALL' || entry.region === countryRegionTab
    );
    const list: SearchableSelectorOption[] = filtered.map((entry) => ({
      value: entry.country,
      label: entry.country,
      meta: `${entry.subregion} · ${entry.regulators.length} entidad(es)`,
      group: entry.region,
      keywords: `${entry.country} ${entry.region} ${entry.subregion} ${entry.regulators
        .map((r) => `${r.shortName} ${r.name}`)
        .join(' ')}`,
    }));

    if (countryRegionTab === 'ALL') {
      list.push({
        value: 'Multirregulador',
        label: 'Multirregulador (Alcance regional / global)',
        meta: 'Habilita entidades y formatos de América y Europa',
        group: 'Global',
        keywords: 'multirregulador global regional todos america europa',
      });
    }
    return list;
  }, [countryRegionTab]);

  const selectedCountryMeta = useMemo(() => {
    if (jurisdiction === 'Multirregulador') return 'Alcance regional / global';
    const match = AMERICAS_AND_EUROPE_COUNTRIES.find(
      (c) => normalizeSearchText(c.country) === normalizeSearchText(jurisdiction)
    );
    return match ? `${match.region} · ${match.subregion}` : 'Jurisdicción personalizada';
  }, [jurisdiction]);

  // Options for Searchable Regulatory Entity Selector
  const regulatorOptions = useMemo<SearchableSelectorOption[]>(() => {
    return regulatorsForCountry.map((reg) => {
      const displayLabel = normalizeSearchText(reg.name).startsWith(
        normalizeSearchText(reg.shortName)
      )
        ? reg.name
        : `${reg.shortName} — ${reg.name}`;
      return {
        value: reg.name,
        label: displayLabel,
        meta: reg.scope,
        group:
          jurisdiction === 'Multirregulador'
            ? 'Entidades de América y Europa'
            : `Entidades de control (${jurisdiction})`,
        keywords: `${reg.shortName} ${reg.name} ${reg.scope}`,
      };
    });
  }, [regulatorsForCountry, jurisdiction]);

  const regulatorDisplayLabel = useMemo(() => {
    if (regulatorSelect === NO_REGULATOR_LABEL) {
      return 'Sin entidad reguladora (Salida personalizada)';
    }
    if (regulatorSelect === CUSTOM_REGULATOR_SENTINEL) {
      return customRegulatorName.trim()
        ? `Personalizada: ${customRegulatorName.trim()}`
        : 'Otra entidad supervisora (especificar)';
    }
    const found = regulatorsForCountry.find((r) => r.name === regulatorSelect);
    if (!found) return regulatorSelect || NO_REGULATOR_LABEL;
    return normalizeSearchText(found.name).startsWith(normalizeSearchText(found.shortName))
      ? found.name
      : `${found.shortName} — ${found.name}`;
  }, [regulatorSelect, customRegulatorName, regulatorsForCountry]);

  if (!isOpen) return null;

  const handleJurisdictionChange = (nextJur: ConfiguredOutput['jurisdiction']) => {
    setJurisdiction(nextJur);
    const nextRegs = resolveRegulatorsForCountry(nextJur, receivingOrganisms);

    if (regulatorSelect !== NO_REGULATOR_LABEL && regulatorSelect !== CUSTOM_REGULATOR_SENTINEL) {
      const stillValid = nextRegs.some((r) => r.name === regulatorSelect);
      if (!stillValid) {
        setRegulatorSelect(nextRegs[0]?.name || NO_REGULATOR_LABEL);
      }
    }

    if (nextJur === 'Multirregulador' || regulatorSelect === NO_REGULATOR_LABEL) {
      setFormatScopeFilter('country');
    }

    // Prune any selected formats from another country when narrowing to a single country
    if (nextJur !== 'Multirregulador') {
      setFormatSelections((prev) =>
        prev.filter((sel) => {
          const fmt = regulatoryFormats.find((f) => f.id === sel.formatId);
          if (!fmt) return false;
          return (fmt.country || fmt.jurisdiction) === nextJur;
        })
      );
    }
  };

  const handleRegulatorSelectChange = (nextVal: string) => {
    setRegulatorSelect(nextVal);
    if (nextVal === NO_REGULATOR_LABEL || nextVal === CUSTOM_REGULATOR_SENTINEL) {
      setFormatScopeFilter('country');
    } else {
      setFormatScopeFilter('organism');
    }
  };

  const handleSelectOutputType = (nextType: OutputType) => {
    setOutputTypeId(nextType.id);
    setFields((prev) => recalculateStructureFieldsForFamily(prev, nextType.family));
  };

  const handleStarterModeChange = (nextMode: 'single' | 'five') => {
    setStarterMode(nextMode);
    if (selectedOutputType) {
      setFields(buildInitialFieldsForMode(nextMode, selectedOutputType));
    }
  };

  const handleQuickAddField = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedOutputType) return;
    const labelToUse = quickLabel.trim() || `Campo ${fields.length + 1}`;
    const newField = buildSmartStructureField({
      label: labelToUse,
      dataType: quickDataType,
      family: selectedOutputType.family,
      existingFields: fields,
      sourceContractId: defaultContractId,
      required: quickRequired,
    });
    setFields((prev) =>
      recalculateStructureFieldsForFamily([...prev, newField], selectedOutputType.family)
    );
    setQuickLabel('');
  };

  const handleUpdateModalField = (
    fieldId: string,
    patch: {
      label?: string;
      dataType?: StructureField['dataType'];
      length?: number;
      required?: boolean;
    }
  ) => {
    if (!selectedOutputType) return;
    setFields((prev) => {
      const updated = prev.map((f) => {
        if (f.id !== fieldId) return f;
        const next: StructureField = { ...f };
        if (typeof patch.label === 'string') {
          const prevAuto = buildAutoTechnicalName(f.label, []);
          const isAutoTech =
            /^campo_\d+$/.test(f.technicalName) ||
            f.technicalName === prevAuto ||
            f.technicalName.startsWith(`${prevAuto}_`);
          next.label = patch.label;
          if (isAutoTech && patch.label.trim().length > 0) {
            const others = prev.filter((o) => o.id !== f.id).map((o) => o.technicalName);
            next.technicalName = buildAutoTechnicalName(patch.label, others);
          }
        }
        if (patch.dataType && patch.dataType !== f.dataType) {
          const smart = getSmartFieldDefaults(patch.dataType, selectedOutputType.family);
          next.dataType = patch.dataType;
          next.length = smart.length;
          next.physicalType = smart.physicalType;
          next.precision = smart.precision;
          next.scale = smart.scale;
          next.alignment = smart.alignment;
          next.paddingChar = smart.paddingChar;
          next.formatMask = smart.formatMask;
          next.avroLogicalType = smart.avroLogicalType;
        }
        if (typeof patch.length === 'number') {
          next.length = Math.max(1, patch.length || 1);
        }
        if (typeof patch.required === 'boolean') {
          next.required = patch.required;
          next.nullable = !patch.required;
        }
        return next;
      });
      return recalculateStructureFieldsForFamily(updated, selectedOutputType.family);
    });
  };

  const handleMoveModalField = (index: number, direction: 'up' | 'down') => {
    if (!selectedOutputType) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    setFields((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return recalculateStructureFieldsForFamily(copy, selectedOutputType.family);
    });
  };

  const handleDeleteModalField = (fieldId: string) => {
    if (!selectedOutputType || fields.length <= 1) return;
    setFields((prev) =>
      recalculateStructureFieldsForFamily(
        prev.filter((f) => f.id !== fieldId),
        selectedOutputType.family
      )
    );
  };

  const toggleFormatSelection = (fmt: RegulatoryFormat) => {
    setFormatSelections((prev) => {
      const exists = prev.some((s) => s.formatId === fmt.id);
      if (exists) {
        return prev.filter((s) => s.formatId !== fmt.id);
      }
      const compatibleTrans = getCompatibleTransmissionsForFormat(
        fmt,
        transmissionTypes,
        selectedOutputType?.family
      );
      const defaultTransId = compatibleTrans[0]?.id || transmissionTypes[0]?.id || 'TX-ORDINARIO';
      const canDefaultActivate =
        fmt.classificationStatus !== 'Pendiente de clasificación' &&
        fmt.normativeAvailability !== 'Por entrar en vigencia' &&
        fmt.lifecycleStatus !== 'Borrador' &&
        fmt.lifecycleStatus !== 'Inactivo';
      return [
        ...prev,
        {
          formatId: fmt.id,
          transmissionTypeId: defaultTransId,
          modality: 'Inicial',
          proposedStatus: canDefaultActivate ? 'Borrador' : 'Instalada sin activar',
        },
      ];
    });
  };

  const updateFormatSelection = (
    formatId: string,
    patch: Partial<WizardFormatSelection>
  ) => {
    setFormatSelections((prev) =>
      prev.map((sel) => (sel.formatId === formatId ? { ...sel, ...patch } : sel))
    );
  };

  const handleApplyAnnexInterpretation = (
    interp: NormativeAnnexInterpretation,
    applied: AppliedAnnexInterpretationResult
  ) => {
    setAppliedInterpretation(interp);
    setAppliedAiMeta({
      outputCode: applied.draft.code,
      description: applied.draft.description,
      composition: applied.draft.composition,
      validationRules: applied.draft.validationRules,
      csvParamsOverride: applied.draft.csvParamsOverride,
      txtParamsOverride: applied.draft.txtParamsOverride,
      xmlParamsOverride: applied.draft.xmlParamsOverride,
      pdfParamsOverride: applied.draft.pdfParamsOverride,
      versionHistory: applied.draft.versionHistory,
    });

    setName(applied.draft.name);
    setNameError('');
    setOutputTypeId(applied.matchedOutputTypeId);
    setJurisdiction(applied.matchedCountry);
    setFields(applied.draft.fields);

    const countryRegs = resolveRegulatorsForCountry(applied.matchedCountry, receivingOrganisms);
    const normDetected = normalizeSearchText(applied.matchedRegulatorName);
    if (!applied.matchedRegulatorName || applied.matchedRegulatorName === NO_REGULATOR_LABEL) {
      setRegulatorSelect(NO_REGULATOR_LABEL);
      setCustomRegulatorName('');
    } else {
      const matchedReg = countryRegs.find((r) => {
        const nShort = normalizeSearchText(r.shortName);
        const nName = normalizeSearchText(r.name);
        return (
          nShort === normDetected ||
          nName === normDetected ||
          (normDetected.length >= 2 && (nName.includes(normDetected) || normDetected.includes(nShort)))
        );
      });
      if (matchedReg) {
        setRegulatorSelect(matchedReg.name);
        setCustomRegulatorName('');
      } else {
        setRegulatorSelect(CUSTOM_REGULATOR_SENTINEL);
        setCustomRegulatorName(applied.matchedRegulatorName);
      }
    }

    const outTypeForCompat =
      outputTypes.find((t) => t.id === applied.matchedOutputTypeId) || selectedOutputType;

    if (applied.matchedFormats.length > 0) {
      const autoSelections: WizardFormatSelection[] = applied.matchedFormats
        .slice(0, 2)
        .map((fmt) => {
          const compat = getCompatibleTransmissionsForFormat(
            fmt,
            transmissionTypes,
            outTypeForCompat?.family
          );
          const defaultTransId =
            compat[0]?.id || transmissionTypes[0]?.id || 'TX-ORDINARIO';
          const canDefaultActivate =
            fmt.classificationStatus !== 'Pendiente de clasificación' &&
            fmt.normativeAvailability !== 'Por entrar en vigencia' &&
            fmt.lifecycleStatus !== 'Borrador' &&
            fmt.lifecycleStatus !== 'Inactivo';
          return {
            formatId: fmt.id,
            transmissionTypeId: defaultTransId,
            modality: 'Inicial',
            proposedStatus: canDefaultActivate ? 'Borrador' : 'Instalada sin activar',
          };
        });
      setFormatSelections(autoSelections);
      setFormatScopeFilter('country');
    }

    setShowAnnexImporter(false);
  };

  const buildFinalDraft = (): ConfiguredOutput => {
    const today = new Date().toISOString().slice(0, 10);
    const base = buildQuickOutputDefaults({
      name: name.trim() || 'Nueva Salida Regulatoria',
      outputType: selectedOutputType,
      existingCodes,
      overrideCode: autoCode,
      regulator: effectiveRegulator,
      jurisdiction,
      starterMode,
      customFields: fields,
      responsibleUser,
      defaultContractId,
      defaultChannelId,
      nowDate: today,
      nowDateTime: `${today} 09:00`,
    });
    if (!appliedAiMeta) return base;
    return {
      ...base,
      description: appliedAiMeta.description || base.description,
      composition: {
        ...base.composition,
        ...(appliedAiMeta.composition || {}),
      },
      csvParamsOverride: appliedAiMeta.csvParamsOverride ?? base.csvParamsOverride,
      txtParamsOverride: appliedAiMeta.txtParamsOverride ?? base.txtParamsOverride,
      xmlParamsOverride: appliedAiMeta.xmlParamsOverride ?? base.xmlParamsOverride,
      pdfParamsOverride: appliedAiMeta.pdfParamsOverride ?? base.pdfParamsOverride,
      validationRules: appliedAiMeta.validationRules ?? base.validationRules,
      versionHistory: appliedAiMeta.versionHistory ?? base.versionHistory,
    };
  };

  const validateBeforeAdvance = (): boolean => {
    if (!name.trim()) {
      setNameError('Ingrese un nombre descriptivo para identificar la salida.');
      setStep(1);
      return false;
    }
    setNameError('');
    return true;
  };

  const handleGoNext = () => {
    if (!validateBeforeAdvance()) return;
    setStep((prev) => (prev < 4 ? ((prev + 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleGoPrev = () => {
    setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleOpenAdvancedOptions = () => {
    if (!validateBeforeAdvance()) return;
    const created = buildFinalDraft();
    onCreateOutput(created, formatSelections, true);
  };

  const handleFinishCreate = () => {
    if (!validateBeforeAdvance()) return;
    const created = buildFinalDraft();
    onCreateOutput(created, formatSelections, false);
  };

  const totalTxtLength = fields.reduce((acc, f) => acc + Math.max(1, f.length || 1), 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simplified-wizard-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Enterprise Header */}
        <div className="px-6 py-4 bg-[#0F1F38] text-white flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 id="simplified-wizard-title" className="text-base font-bold tracking-tight">
              Asistente de creación de salidas
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Configure lo esencial, defina su entidad o formato personalizado y vincule uno o más formatos de destino.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente"
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean 4-Step Horizontal Progress Navigation */}
        <nav
          aria-label="Pasos del asistente"
          className="bg-slate-50 border-b border-slate-200 px-6 grid grid-cols-2 sm:grid-cols-4 shrink-0"
        >
          {WIZARD_STEPS.map((s) => {
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.id === 1 || validateBeforeAdvance()) {
                    setStep(s.id);
                  }
                }}
                className={`py-3 px-2 flex items-center gap-2.5 text-left border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#1E4E8C] text-[#0F1F38]'
                    : isCompleted
                    ? 'border-transparent text-slate-700 hover:text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums shrink-0 ${
                    isActive
                      ? 'bg-[#1E4E8C] text-white'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.id}
                </span>
                <div className="min-w-0">
                  <div
                    className={`text-xs font-semibold truncate ${
                      isActive ? 'text-[#0F1F38]' : 'text-slate-700'
                    }`}
                  >
                    {s.label}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate hidden md:block">
                    {s.id === 3 && formatSelections.length > 0
                      ? `${formatSelections.length} seleccionado(s)`
                      : s.detail}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Scrollable Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* STEP 1: DEFINICIÓN INICIAL */}
          {step === 1 && (
            <div className="space-y-5">
              {/* TOTALiA® Normative Annex Importer Banner / Expandable Panel */}
              <div className="border border-blue-200 rounded-md bg-blue-50/45 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-[#0F1F38] flex items-center justify-center shrink-0 p-1">
                    <TotalReportLogo className="w-7 h-7 object-contain" alt="Logo TOTALiA®" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0F1F38]">
                      ¿Tiene un anexo normativo o circular técnica? Importe con TOTALiA®
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Cargue PDF, Word (.docx/.doc), Excel (.xlsx/.xls) o imágenes para prellenar estructura, validaciones e informar lo pendiente.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnnexImporter((prev) => !prev)}
                  className="px-3.5 py-2 rounded-md bg-[#1E4E8C] hover:bg-[#163A69] text-white font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{showAnnexImporter ? 'Ocultar importador' : 'Importar anexo normativo'}</span>
                </button>
              </div>

              {showAnnexImporter && (
                <NormativeAnnexImportPanel
                  compact
                  outputTypes={outputTypes}
                  regulatoryFormats={regulatoryFormats}
                  existingCodes={existingCodes}
                  responsibleUser={responsibleUser}
                  defaultContractId={defaultContractId}
                  defaultChannelId={defaultChannelId}
                  fallbackJurisdiction={jurisdiction}
                  fallbackRegulator={effectiveRegulator}
                  onApplyInterpretation={handleApplyAnnexInterpretation}
                  onClose={() => setShowAnnexImporter(false)}
                />
              )}

              {appliedInterpretation && (
                <div className="p-3 rounded-md border border-emerald-300 bg-emerald-50/70 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        Propuesta de TOTALiA® aplicada desde “{appliedInterpretation.sourceFileName}”:
                      </span>{' '}
                      {fields.length} campo(s) y {appliedAiMeta?.validationRules?.length || 0} validación(es) cargados.{' '}
                      {appliedInterpretation.uninterpretedItems.length > 0 ? (
                        <strong className="text-amber-900">
                          {appliedInterpretation.uninterpretedItems.length} aspecto(s) requieren revisión manual (visibles en Paso 4).
                        </strong>
                      ) : (
                        'Sin elementos ambiguos reportados.'
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAnnexImporter(true)}
                    className="font-semibold text-[#1E4E8C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Ver detalle del anexo
                  </button>
                </div>
              )}

              <div>
                <label
                  htmlFor="wizard-output-name"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Nombre funcional de la salida *
                </label>
                <input
                  id="wizard-output-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError && e.target.value.trim()) setNameError('');
                  }}
                  placeholder="Ej. Reporte Mensual de Cartera de Crédito"
                  className={`w-full border rounded-md px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E4E8C]/20 focus:border-[#1E4E8C] ${
                    nameError ? 'border-rose-500 bg-rose-50/40' : 'border-slate-300 bg-white'
                  }`}
                />
                {nameError ? (
                  <p className="mt-1.5 text-xs text-rose-700 font-medium">{nameError}</p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Código asignado automáticamente:{' '}
                    <span className="font-mono font-semibold text-slate-800">{autoCode}</span> ·
                    Versión inicial <span className="font-mono tabular-nums">1.0</span> · Estado Borrador
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Tipo de archivo de salida *
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Extensión, codificación y delimitador se ajustan automáticamente
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['CSV', 'TXT', 'XML', 'AVRO', 'XBRL', 'PDF', 'XLSX'] as TechnicalFamily[]).map(
                    (fam) => {
                      const ot = outputTypes.find((t) => t.family === fam);
                      if (!ot) return null;
                      const isSelected = selectedOutputType?.id === ot.id;
                      return (
                        <button
                          key={ot.id}
                          type="button"
                          onClick={() => handleSelectOutputType(ot)}
                          className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#1E4E8C] bg-blue-50/70 ring-1 ring-[#1E4E8C]'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-bold text-sm text-[#0F1F38]">
                              {ot.family}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              .{ot.extension}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-1 truncate">
                            {FAMILY_DESCRIPTIONS[fam]}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {ot.canGenerateRealFileInBrowser
                              ? 'Descarga directa'
                              : 'Definición de esquema'}
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="wizard-jurisdiction"
                    className="block text-xs font-semibold text-slate-800 mb-1.5"
                  >
                    Jurisdicción / País *
                  </label>
                  <SearchableSelector
                    id="wizard-jurisdiction"
                    label="Jurisdicción / País"
                    value={jurisdiction}
                    displayValue={jurisdiction}
                    displayMeta={selectedCountryMeta}
                    searchPlaceholder="Buscar país de América o Europa (o acrónimo)..."
                    searchAriaLabel="Buscar país de América o Europa"
                    dropdownDirection="up"
                    options={countryOptions}
                    filterTabs={[
                      { value: 'ALL', label: `Todos (${AMERICAS_AND_EUROPE_COUNTRIES.length + 1})` },
                      {
                        value: 'América',
                        label: `América (${
                          AMERICAS_AND_EUROPE_COUNTRIES.filter((c) => c.region === 'América').length
                        })`,
                      },
                      {
                        value: 'Europa',
                        label: `Europa (${
                          AMERICAS_AND_EUROPE_COUNTRIES.filter((c) => c.region === 'Europa').length
                        })`,
                      },
                    ]}
                    activeFilterTab={countryRegionTab}
                    onFilterTabChange={(t) =>
                      setCountryRegionTab(t as 'ALL' | 'América' | 'Europa')
                    }
                    onSelect={(val) => handleJurisdictionChange(val)}
                    emptyText="No se encontraron países en América o Europa con ese criterio."
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    América y Europa con búsqueda instantánea por país, región o sigla de entidad.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="wizard-regulator"
                    className="block text-xs font-semibold text-slate-800 mb-1.5"
                  >
                    Entidad reguladora / de control
                  </label>
                  <SearchableSelector
                    id="wizard-regulator"
                    label="Entidad reguladora / de control"
                    value={regulatorSelect}
                    displayValue={regulatorDisplayLabel}
                    searchPlaceholder="Buscar entidad de control por nombre o sigla..."
                    searchAriaLabel="Buscar entidad reguladora o de control"
                    dropdownDirection="up"
                    pinnedTopOptions={[
                      {
                        value: NO_REGULATOR_LABEL,
                        label: 'Sin entidad reguladora (Salida personalizada / Uso interno)',
                        meta: 'Formato propio o reporte gerencial sin ente regulador asignado',
                        keywords: 'sin entidad reguladora salida personalizada interna custom',
                      },
                    ]}
                    options={regulatorOptions}
                    pinnedBottomOptions={[
                      {
                        value: CUSTOM_REGULATOR_SENTINEL,
                        label: 'Otra entidad supervisora (especificar manualmente)...',
                        meta: 'Ingresar nombre personalizado de autoridad o receptor',
                        keywords: 'otra entidad manual especificar',
                      },
                    ]}
                    onSelect={(val) => handleRegulatorSelectChange(val)}
                    emptyText={`No hay entidades de control coincidentes para ${jurisdiction}.`}
                  />

                  {regulatorSelect === CUSTOM_REGULATOR_SENTINEL && (
                    <input
                      type="text"
                      aria-label="Nombre de entidad supervisora personalizada"
                      value={customRegulatorName}
                      onChange={(e) => setCustomRegulatorName(e.target.value)}
                      placeholder="Escriba el nombre de la entidad o receptor..."
                      className="mt-2 w-full border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:border-[#1E4E8C]"
                    />
                  )}

                  <p className="mt-1 text-[11px] text-slate-500">
                    {isCustomNoRegulator
                      ? 'Salida personalizada sin ente regulador; la vinculación a formatos en el paso 3 es opcional.'
                      : `${regulatorsForCountry.length} entidad(es) de control disponibles para ${jurisdiction}.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ESTRUCTURA DE CAMPOS */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Starter Template Choice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleStarterModeChange('five')}
                  className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                    starterMode === 'five'
                      ? 'border-[#1E4E8C] bg-blue-50/60 ring-1 ring-[#1E4E8C]'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-slate-900">
                    Plantilla estándar de 5 campos
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Fecha de Corte, ID Obligación, Nombre o Razón Social, Saldo al Corte y Estado.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleStarterModeChange('single')}
                  className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                    starterMode === 'single'
                      ? 'border-[#1E4E8C] bg-blue-50/60 ring-1 ring-[#1E4E8C]'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-slate-900">
                    Estructura inicial limpia (1 campo)
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Inicia únicamente con ID Obligación para agregar sus columnas a medida.
                  </div>
                </button>
              </div>

              {/* Quick Field Add Bar */}
              <form
                onSubmit={handleQuickAddField}
                className="p-3 rounded-md bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-2.5"
              >
                <input
                  type="text"
                  aria-label="Nombre del campo a agregar"
                  value={quickLabel}
                  onChange={(e) => setQuickLabel(e.target.value)}
                  placeholder="Agregar campo (ej. Saldo Capital en Mora)"
                  className="flex-1 min-w-[200px] border border-slate-300 rounded px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:border-[#1E4E8C]"
                />
                <select
                  aria-label="Tipo de dato del campo a agregar"
                  value={quickDataType}
                  onChange={(e) =>
                    setQuickDataType(e.target.value as StructureField['dataType'])
                  }
                  className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-medium"
                >
                  <option value="Texto">Texto</option>
                  <option value="Entero">Entero</option>
                  <option value="Decimal">Decimal</option>
                  <option value="Fecha">Fecha</option>
                  <option value="Booleano">Booleano</option>
                  <option value="Catálogo">Catálogo</option>
                </select>
                <label className="inline-flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer px-1">
                  <input
                    type="checkbox"
                    checked={quickRequired}
                    onChange={(e) => setQuickRequired(e.target.checked)}
                  />
                  <span>Obligatorio</span>
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#1E4E8C] hover:bg-[#163A69] text-white font-semibold whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar campo
                </button>
              </form>

              {/* High-Density Editable Fields Table */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                  <span>
                    <strong className="text-slate-900 tabular-nums">{fields.length}</strong>{' '}
                    campo(s) en la estructura ({selectedOutputType?.family})
                  </span>
                  {selectedOutputType?.family === 'TXT' && (
                    <span className="font-mono tabular-nums text-slate-700">
                      Longitud acumulada: <strong>{totalTxtLength}</strong> caracteres
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-2 px-3 w-10">#</th>
                        <th className="py-2 px-3">Nombre del campo</th>
                        <th className="py-2 px-3 w-32">Tipo</th>
                        <th className="py-2 px-3 w-24 text-right">Long.</th>
                        <th className="py-2 px-3 w-20 text-center">Oblig.</th>
                        <th className="py-2 px-3 w-28 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {fields.map((f, index) => {
                        const startPos = f.startPosition || 1;
                        const endPos = startPos + Math.max(1, f.length || 1) - 1;
                        return (
                          <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 font-mono font-semibold text-slate-500 tabular-nums">
                              {f.order}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                aria-label={`Nombre campo ${f.order}`}
                                value={f.label}
                                onChange={(e) =>
                                  handleUpdateModalField(f.id, { label: e.target.value })
                                }
                                className="w-full font-medium text-slate-900 bg-transparent border-b border-transparent focus:border-[#1E4E8C] focus:bg-white px-1 py-0.5 rounded focus:outline-none"
                              />
                              <div className="text-[10px] font-mono text-slate-500 px-1 tabular-nums">
                                {f.technicalName}
                                {selectedOutputType?.family === 'TXT' &&
                                  ` · Pos [${startPos}..${endPos}]`}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                aria-label={`Tipo campo ${f.order}`}
                                value={f.dataType}
                                onChange={(e) =>
                                  handleUpdateModalField(f.id, {
                                    dataType: e.target.value as StructureField['dataType'],
                                  })
                                }
                                className="w-full border border-slate-200 rounded px-2 py-1 bg-white text-slate-800"
                              >
                                <option value="Texto">Texto</option>
                                <option value="Entero">Entero</option>
                                <option value="Decimal">Decimal</option>
                                <option value="Fecha">Fecha</option>
                                <option value="Booleano">Booleano</option>
                                <option value="Catálogo">Catálogo</option>
                              </select>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min={1}
                                aria-label={`Longitud campo ${f.order}`}
                                value={f.length}
                                onChange={(e) =>
                                  handleUpdateModalField(f.id, {
                                    length: Number(e.target.value),
                                  })
                                }
                                className="w-16 border border-slate-200 rounded px-2 py-1 text-right font-mono tabular-nums text-slate-900"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                aria-label={`Obligatorio campo ${f.order}`}
                                checked={f.required}
                                onChange={(e) =>
                                  handleUpdateModalField(f.id, { required: e.target.checked })
                                }
                              />
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => handleMoveModalField(index, 'up')}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                                  title="Subir campo"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === fields.length - 1}
                                  onClick={() => handleMoveModalField(index, 'down')}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                                  title="Bajar campo"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={fields.length <= 1}
                                  onClick={() => handleDeleteModalField(f.id)}
                                  className="p-1 rounded hover:bg-rose-100 text-rose-700 disabled:opacity-30 cursor-pointer"
                                  title="Eliminar campo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ASOCIAR FORMATOS DE DESTINO (OPCIONAL / MULTI-SELECCIÓN) */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#1E4E8C]" />
                    <span>Asociación a uno o más formatos de destino (opcional)</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {isCustomNoRegulator
                      ? 'Esta salida está definida sin entidad reguladora (salida personalizada). Puede omitir este paso con Siguiente o vincular formatos existentes si planea reutilizarla.'
                      : 'Seleccione uno o más formatos regulatorios que utilizarán esta salida. Una misma salida puede asociarse a múltiples formatos compatibles sin duplicarse.'}
                  </p>
                </div>
                {formatSelections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormatSelections([])}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Limpiar selección ({formatSelections.length})
                  </button>
                )}
              </div>

              {/* Filter & Scope Bar */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    aria-label="Buscar formato por código, nombre u organismo"
                    value={formatSearch}
                    onChange={(e) => setFormatSearch(e.target.value)}
                    placeholder="Buscar formato por código, nombre u organismo..."
                    className="w-full border border-slate-300 rounded-md pl-8 pr-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:border-[#1E4E8C]"
                  />
                </div>

                {!isCustomNoRegulator &&
                  regulatorSelect !== CUSTOM_REGULATOR_SENTINEL &&
                  jurisdiction !== 'Multirregulador' && (
                    <div className="inline-flex rounded-md border border-slate-300 bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setFormatScopeFilter('organism')}
                        className={`px-3 py-1.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                          formatScopeFilter === 'organism'
                            ? 'bg-[#1E4E8C] text-white'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Solo {selectedOrganismShortLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormatScopeFilter('country')}
                        className={`px-3 py-1.5 text-[11px] font-semibold border-l border-slate-300 cursor-pointer whitespace-nowrap ${
                          formatScopeFilter === 'country'
                            ? 'bg-[#1E4E8C] text-white'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Todos en {jurisdiction}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormatScopeFilter('all')}
                        className={`px-3 py-1.5 text-[11px] font-semibold border-l border-slate-300 cursor-pointer whitespace-nowrap ${
                          formatScopeFilter === 'all'
                            ? 'bg-[#1E4E8C] text-white'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Todo el catálogo
                      </button>
                    </div>
                  )}

                <span className="text-[11px] text-slate-500 font-mono tabular-nums ml-auto">
                  {candidateFormats.length} disponible(s) ·{' '}
                  <strong className="text-[#1E4E8C]">{formatSelections.length}</strong>{' '}
                  asociado(s)
                </span>
              </div>

              {/* Selectable Formats List */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-200 bg-white">
                  {candidateFormats.length === 0 ? (
                    <div className="py-8 px-4 text-center text-slate-500 space-y-2">
                      <p className="font-medium text-slate-700">
                        No hay formatos de destino registrados en el catálogo para {jurisdiction}
                        {formatScopeFilter === 'organism' ? ` (${selectedOrganismShortLabel})` : ''}.
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
                        Puede continuar directamente al paso 4 para crear la salida personalizada o multirregulador, o ampliar la búsqueda al catálogo completo.
                      </p>
                      <div className="flex items-center justify-center gap-3 pt-1">
                        {formatScopeFilter === 'organism' && jurisdiction !== 'Multirregulador' && (
                          <button
                            type="button"
                            onClick={() => setFormatScopeFilter('country')}
                            className="text-[#1E4E8C] font-semibold hover:underline cursor-pointer"
                          >
                            Ver formatos de {jurisdiction}
                          </button>
                        )}
                        {formatScopeFilter !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setFormatScopeFilter('all')}
                            className="text-[#1E4E8C] font-semibold hover:underline cursor-pointer"
                          >
                            Ver todo el catálogo de formatos
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    candidateFormats.map((fmt) => {
                      const selection = formatSelections.find((s) => s.formatId === fmt.id);
                      const isChecked = Boolean(selection);
                      const displayCode = fmt.code || fmt.internalCode || fmt.id;
                      const compatibleTrans = getCompatibleTransmissionsForFormat(
                        fmt,
                        transmissionTypes,
                        selectedOutputType?.family
                      );
                      const activeTrans = compatibleTrans.find(
                        (t) => t.id === selection?.transmissionTypeId
                      );
                      const validation =
                        isChecked && selection && livePreviewOutput
                          ? validateAssociationContext({
                              format: fmt,
                              transmissionType: activeTrans,
                              configuredOutput: livePreviewOutput,
                              outputType: selectedOutputType,
                              country:
                                jurisdiction === 'Multirregulador'
                                  ? fmt.country || fmt.jurisdiction
                                  : jurisdiction,
                              existingAssociations,
                              proposedStatus: selection.proposedStatus,
                              proposedModality: selection.modality,
                              proposedEnvironment: globalEnvironment,
                              proposedValidFrom: fmt.specificationValidity?.validFrom,
                            })
                          : null;

                      const entityTypesText =
                        fmt.applicableEntityTypes.length > 0
                          ? `${fmt.applicableEntityTypes.slice(0, 2).join(', ')}${
                              fmt.applicableEntityTypes.length > 2
                                ? ` (+${fmt.applicableEntityTypes.length - 2})`
                                : ''
                            }`
                          : 'Pendiente de clasificación';

                      return (
                        <div
                          key={fmt.id}
                          className={`p-3 transition-colors ${
                            isChecked ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              id={`wizard-fmt-${fmt.id}`}
                              aria-label={`Seleccionar formato ${displayCode}`}
                              checked={isChecked}
                              onChange={() => toggleFormatSelection(fmt)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1E4E8C] focus:ring-[#1E4E8C] cursor-pointer"
                            />
                            <label
                              htmlFor={`wizard-fmt-${fmt.id}`}
                              className="flex-1 min-w-0 cursor-pointer"
                            >
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="font-mono font-bold text-[#1E4E8C] tabular-nums">
                                  {displayCode}
                                </span>
                                <span className="font-semibold text-slate-900">{fmt.name}</span>
                              </div>
                              <div className="text-[11px] text-slate-600 mt-0.5">
                                {fmt.regulator} · {fmt.country || fmt.jurisdiction} ·{' '}
                                {fmt.periodicity} · {fmt.normativeAvailability} · {entityTypesText}
                              </div>
                            </label>
                          </div>

                          {isChecked && selection && (
                            <div className="mt-2.5 ml-7 pt-2.5 border-t border-slate-200/80 space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                                    Tipo de transmisión
                                  </label>
                                  <select
                                    aria-label={`Tipo de transmisión para ${displayCode}`}
                                    value={selection.transmissionTypeId}
                                    onChange={(e) =>
                                      updateFormatSelection(fmt.id, {
                                        transmissionTypeId: e.target.value,
                                      })
                                    }
                                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white text-slate-900 text-[11px]"
                                  >
                                    {compatibleTrans.map((tr) => (
                                      <option key={tr.id} value={tr.id}>
                                        {tr.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                                    Modalidad
                                  </label>
                                  <select
                                    aria-label={`Modalidad para ${displayCode}`}
                                    value={selection.modality}
                                    onChange={(e) =>
                                      updateFormatSelection(fmt.id, {
                                        modality: e.target
                                          .value as WizardFormatSelection['modality'],
                                      })
                                    }
                                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white text-slate-900 text-[11px]"
                                  >
                                    <option value="Inicial">Inicial</option>
                                    <option value="Corrección">Corrección</option>
                                    <option value="Reemplazo">Reemplazo</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                                    Estado del vínculo ({globalEnvironment})
                                  </label>
                                  <select
                                    aria-label={`Estado asociación para ${displayCode}`}
                                    value={selection.proposedStatus}
                                    onChange={(e) =>
                                      updateFormatSelection(fmt.id, {
                                        proposedStatus: e.target
                                          .value as WizardFormatSelection['proposedStatus'],
                                      })
                                    }
                                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white text-slate-900 text-[11px]"
                                  >
                                    <option value="Borrador">Borrador</option>
                                    <option value="Instalada sin activar">
                                      Instalada sin activar
                                    </option>
                                    <option value="Activa">Activa</option>
                                  </select>
                                </div>
                              </div>

                              {validation && (
                                <div className="text-[11px]">
                                  {validation.blockers.length > 0 ? (
                                    <div className="flex items-start gap-1.5 text-rose-800 bg-rose-50 border border-rose-200 rounded px-2.5 py-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                      <span>{validation.blockers[0]}</span>
                                    </div>
                                  ) : validation.warnings.length > 0 ? (
                                    <div className="flex items-start gap-1.5 text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                      <span>{validation.warnings[0]}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                      <span>
                                        Vínculo compatible con familia {selectedOutputType?.family}{' '}
                                        ({globalEnvironment}).
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REVISIÓN Y CREACIÓN */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Summary of Auto-filled Configuration */}
                <div className="lg:col-span-6 border border-slate-200 rounded-md p-4 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <FileCode2 className="w-4 h-4 text-[#1E4E8C]" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Configuración automática aplicada
                    </h3>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                    <div className="col-span-2">
                      <dt className="text-[11px] text-slate-500">Nombre funcional</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">{name.trim()}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Código asignado</dt>
                      <dd className="font-mono font-bold text-slate-900 mt-0.5">{autoCode}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Versión y estado</dt>
                      <dd className="font-mono text-slate-900 mt-0.5 tabular-nums">
                        v1.0 · Borrador
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Tipo de archivo</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {selectedOutputType?.family} (.{selectedOutputType?.extension})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Codificación / Separador</dt>
                      <dd className="font-mono text-slate-900 mt-0.5">
                        {appliedAiMeta?.composition?.encoding ||
                          (selectedOutputType?.family === 'AVRO' ? 'Binario' : 'UTF-8')}{' '}
                        ·{' '}
                        {appliedAiMeta?.composition?.delimiter ||
                          (selectedOutputType?.family === 'CSV'
                            ? 'Punto y coma (;)'
                            : selectedOutputType?.family === 'TXT'
                            ? 'Ancho fijo'
                            : 'Estándar')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Jurisdicción y entidad</dt>
                      <dd className="text-slate-900 mt-0.5">
                        {jurisdiction} · {effectiveRegulator}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">Origen y validaciones</dt>
                      <dd
                        className="text-slate-900 mt-0.5 truncate"
                        title={`${defaultContractName} · ${defaultChannelName}`}
                      >
                        {defaultContractName} ·{' '}
                        {appliedAiMeta?.validationRules?.length
                          ? `${appliedAiMeta.validationRules.length} regla(s) normativa(s)`
                          : defaultChannelName}
                      </dd>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-100">
                      <dt className="text-[11px] text-slate-500">Nombre dinámico resultante</dt>
                      <dd className="font-mono font-semibold text-[#1E4E8C] mt-0.5 break-all">
                        {resolvedFileNamePreview}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Compact Preview of Defined Structure */}
                <div className="lg:col-span-6 border border-slate-200 rounded-md overflow-hidden flex flex-col">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Estructura de salida ({fields.length} campos)
                    </h3>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-[11px] font-semibold text-[#1E4E8C] hover:underline cursor-pointer"
                    >
                      Editar campos
                    </button>
                  </div>

                  <div className="overflow-y-auto max-h-60">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase">
                          <th className="py-1.5 px-3">#</th>
                          <th className="py-1.5 px-3">Campo</th>
                          <th className="py-1.5 px-3">Tipo</th>
                          <th className="py-1.5 px-3 text-right">Long.</th>
                          <th className="py-1.5 px-3 text-center">Oblig.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {fields.map((f) => (
                          <tr key={f.id}>
                            <td className="py-1.5 px-3 font-mono text-slate-500 tabular-nums">
                              {f.order}
                            </td>
                            <td className="py-1.5 px-3">
                              <div className="font-medium text-slate-900">{f.label}</div>
                              <div className="text-[10px] font-mono text-slate-500">
                                {f.technicalName}
                              </div>
                            </td>
                            <td className="py-1.5 px-3 text-slate-700">{f.dataType}</td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums text-slate-800">
                              {f.length}
                            </td>
                            <td className="py-1.5 px-3 text-center text-slate-700">
                              {f.required ? 'Sí' : 'No'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Destination Formats Association Review */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#1E4E8C]" />
                    <span>Formatos de destino a asociar ({formatSelections.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-[11px] font-semibold text-[#1E4E8C] hover:underline cursor-pointer"
                  >
                    Modificar formatos
                  </button>
                </div>

                {formatSelections.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-600 bg-white">
                    {isCustomNoRegulator
                      ? 'Salida personalizada sin formatos regulatorios vinculados inicialmente. Podrá asociarlos después desde el catálogo o D. Formatos y asociaciones.'
                      : 'No se seleccionaron formatos en este momento. Podrá asociarlos después desde el catálogo o desde D. Formatos y asociaciones.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase">
                          <th className="py-2 px-3.5">Formato</th>
                          <th className="py-2 px-3">Organismo · País</th>
                          <th className="py-2 px-3">Transmisión</th>
                          <th className="py-2 px-3">Modalidad</th>
                          <th className="py-2 px-3.5">Estado inicial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formatSelections.map((sel) => {
                          const fmt = regulatoryFormats.find((f) => f.id === sel.formatId);
                          const trans = transmissionTypes.find(
                            (t) => t.id === sel.transmissionTypeId
                          );
                          const code = fmt?.code || fmt?.internalCode || sel.formatId;
                          return (
                            <tr key={sel.formatId}>
                              <td className="py-2 px-3.5">
                                <span className="font-mono font-bold text-[#1E4E8C] mr-1.5 tabular-nums">
                                  {code}
                                </span>
                                <span className="font-medium text-slate-900">
                                  {fmt?.name || ''}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {fmt?.regulator} · {fmt?.country || fmt?.jurisdiction}
                              </td>
                              <td className="py-2 px-3 text-slate-700">{trans?.name || '—'}</td>
                              <td className="py-2 px-3 text-slate-700">{sel.modality}</td>
                              <td className="py-2 px-3.5 font-medium text-slate-800">
                                {sel.proposedStatus}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {appliedInterpretation && appliedInterpretation.uninterpretedItems.length > 0 && (
                <div className="border border-amber-300 bg-amber-50/75 rounded-md p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Aspectos del anexo “{appliedInterpretation.sourceFileName}” no interpretados o pendientes ({appliedInterpretation.uninterpretedItems.length})
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-800">
                    {appliedInterpretation.uninterpretedItems.map((item, idx) => (
                      <li key={`${item.aspect}-${idx}`} className="bg-white border border-amber-200 rounded p-2">
                        <span className="font-bold text-slate-900">{item.aspect}</span>{' '}
                        <span className="text-amber-800 font-semibold">[{item.category}]</span>:{' '}
                        {item.reason} — <span className="text-slate-600">{item.recommendedAction}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  ¿Requiere reglas de validación personalizadas, empaquetado ZIP, mapeo manual de fuentes cliente o edición XML/TXT avanzada?
                </span>
                <button
                  type="button"
                  onClick={handleOpenAdvancedOptions}
                  className="text-[#1E4E8C] font-semibold hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Continuar en Opciones avanzadas →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Enterprise Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenAdvancedOptions}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-[#1E4E8C]" />
            Opciones avanzadas
          </button>

          <div className="flex items-center gap-2.5 ml-auto">
            {step === 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoPrev}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleGoNext}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#1E4E8C] hover:bg-[#163A69] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Siguiente
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishCreate}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded bg-[#1E4E8C] hover:bg-[#163A69] text-white text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Crear salida
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
