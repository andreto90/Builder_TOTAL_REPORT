import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  FileCode2,
  FileText,
  GitBranch,
  Link2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useConfigurator } from '../context/ConfiguratorContext';
import {
  ConfiguredOutput,
  LifecycleStatus,
  StructureField,
  TechnicalFamily,
} from '../domain/types';
import { HelpTooltip } from './HelpTooltip';
import { generateAndDownloadWordManual } from '../utils/generateWordManual';

export const DashboardCatalogView: React.FC = () => {
  const {
    outputTypes,
    configuredOutputs,
    regulatoryFormats,
    associations,
    totaliaSuggestions,
    globalEntity,
    activeUserRole,
    openOutputInBuilder,
    openAssociationForOutput,
    createNewRevisionFromOutput,
    duplicateOutputIndependently,
    deleteConfiguredOutput,
    saveConfiguredOutput,
    setActiveModule,
    exportDomainJson,
    resetDemoData,
  } = useConfigurator();

  const [searchQuery, setSearchQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [regulatorFilter, setRegulatorFilter] = useState<string>('ALL');

  // Modal: Create New Output
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('Reporte Regulatorio de Cartera');
  const [newCode, setNewCode] = useState<string>('SAL-CARTERA-01');
  const [newDescription, setNewDescription] = useState<string>(
    'Salida regulatoria configurada para entrega de operaciones del periodo.'
  );
  const [newOutputTypeId, setNewOutputTypeId] = useState<string>('TYPE-CSV-01');
  const [newRegulator, setNewRegulator] = useState<string>('SFC / Ente Supervisor');
  const [newStarterMode, setNewStarterMode] = useState<'single' | 'five'>('single');

  // Modal: Create New Revision
  const [revisionTarget, setRevisionTarget] = useState<ConfiguredOutput | null>(null);
  const [revisionJustification, setRevisionJustification] = useState<string>(
    'Ajuste de estructura requerido por actualización de circular.'
  );

  // Modal: Duplicate Output
  const [duplicateTarget, setDuplicateTarget] = useState<ConfiguredOutput | null>(null);
  const [duplicateCode, setDuplicateCode] = useState<string>('');
  const [duplicateName, setDuplicateName] = useState<string>('');

  // Modal: Delete Draft Confirmation
  const [deleteTarget, setDeleteTarget] = useState<ConfiguredOutput | null>(null);

  const uniqueRegulators = useMemo(() => {
    const set = new Set<string>();
    configuredOutputs.forEach((o) => set.add(o.regulator));
    return Array.from(set);
  }, [configuredOutputs]);

  const filteredOutputs = useMemo(() => {
    return configuredOutputs.filter((item) => {
      const outType = outputTypes.find((t) => t.id === item.outputTypeId);
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.regulator.toLowerCase().includes(q) ||
        item.jurisdiction.toLowerCase().includes(q);

      const matchesFamily = familyFilter === 'ALL' || outType?.family === familyFilter;
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchesRegulator = regulatorFilter === 'ALL' || item.regulator === regulatorFilter;

      return matchesQuery && matchesFamily && matchesStatus && matchesRegulator;
    });
  }, [
    configuredOutputs,
    outputTypes,
    searchQuery,
    familyFilter,
    statusFilter,
    regulatorFilter,
  ]);

  const publishedCount = configuredOutputs.filter((o) => o.status === 'Publicada').length;
  const editableCount = configuredOutputs.filter(
    (o) => o.status === 'Borrador' || o.status === 'En revisión'
  ).length;
  const activeAssociationsCount = associations.filter((a) => a.status === 'Activa').length;
  const pendingAssociationsCount = associations.filter((a) => a.status !== 'Activa').length;
  const pendingSuggestionsCount = totaliaSuggestions.filter(
    (s) => s.status === 'Pendiente de revisión'
  ).length;

  const buildStarterFields = (
    family: TechnicalFamily,
    mode: 'single' | 'five'
  ): StructureField[] => {
    if (mode === 'single') {
      return [
        {
          id: `FLD-${Date.now()}-1`,
          technicalName: 'id_obligacion',
          label: 'ID Obligación',
          description: 'Identificador único de la operación reportada',
          recordSection: 'Detalle',
          order: 1,
          dataType: 'Texto',
          physicalType: 'VARCHAR(12)',
          length: 12,
          lengthUnit: 'Caracteres',
          required: true,
          nullable: false,
          startPosition: 1,
          formatMask: '',
          defaultValue: '',
          paddingChar: family === 'TXT' ? '0' : 'Ninguno',
          alignment: family === 'TXT' ? 'Derecha' : 'Izquierda',
          overflowRule: 'Bloquear con error',
          protectionClass: 'Parametrizable',
          evidenceState: 'Sustento explícito',
          evidenceSourceRef: 'Definido por usuario',
          xmlNodeKind: 'Elemento',
          avroLogicalType: 'string',
          mapping: {
            transformationKind: 'Directo',
            sourceContractId: 'DC-CARTERA-01',
            sourceField: 'id_obligacion',
            expression: 'id_obligacion',
            isParameterizedPoint: false,
            emptyTreatment: 'Error bloqueante',
            mappingStatus: 'Confirmado por usuario',
          },
        },
      ];
    }

    return [
      {
        id: `FLD-${Date.now()}-1`,
        technicalName: 'fecha_corte',
        label: 'Fecha de Corte',
        description: 'Fecha de corte del periodo reportado',
        recordSection: 'Detalle',
        order: 1,
        dataType: 'Fecha',
        physicalType: 'DATE',
        length: 10,
        lengthUnit: 'Caracteres',
        required: true,
        nullable: false,
        startPosition: 1,
        formatMask: 'dd-MM-yyyy',
        defaultValue: '',
        paddingChar: family === 'TXT' ? ' ' : 'Ninguno',
        alignment: 'Izquierda',
        overflowRule: 'Bloquear con error',
        protectionClass: 'Parametrizable',
        evidenceState: 'Sustento explícito',
        evidenceSourceRef: 'Instructivo Regulatorio',
        xmlNodeKind: 'Elemento',
        avroLogicalType: 'int (date)',
        mapping: {
          transformationKind: 'Máscara fecha/número',
          sourceContractId: 'DC-CARTERA-01',
          sourceField: 'fecha_corte',
          expression: 'dd-MM-yyyy',
          isParameterizedPoint: false,
          emptyTreatment: 'Error bloqueante',
          mappingStatus: 'Confirmado por usuario',
        },
      },
      {
        id: `FLD-${Date.now()}-2`,
        technicalName: 'id_obligacion',
        label: 'ID Obligación',
        description: 'Identificador único del contrato u obligación',
        recordSection: 'Detalle',
        order: 2,
        dataType: 'Texto',
        physicalType: 'VARCHAR(6)',
        length: 6,
        lengthUnit: 'Caracteres',
        required: true,
        nullable: false,
        startPosition: 11,
        formatMask: '',
        defaultValue: '',
        paddingChar: '0',
        alignment: 'Derecha',
        overflowRule: 'Bloquear con error',
        protectionClass: 'Parametrizable',
        evidenceState: 'Sustento explícito',
        evidenceSourceRef: 'Instructivo Regulatorio',
        xmlNodeKind: 'Atributo',
        avroLogicalType: 'string',
        mapping: {
          transformationKind: 'Directo',
          sourceContractId: 'DC-CARTERA-01',
          sourceField: 'id_obligacion',
          expression: 'id_obligacion',
          isParameterizedPoint: false,
          emptyTreatment: 'Error bloqueante',
          mappingStatus: 'Confirmado por usuario',
        },
      },
      {
        id: `FLD-${Date.now()}-3`,
        technicalName: 'nombre_cliente',
        label: 'Nombre o Razón Social',
        description: 'Nombre completo del titular de la obligación',
        recordSection: 'Detalle',
        order: 3,
        dataType: 'Texto',
        physicalType: 'VARCHAR(50)',
        length: 50,
        lengthUnit: 'Caracteres',
        required: true,
        nullable: false,
        startPosition: 17,
        formatMask: '',
        defaultValue: '',
        paddingChar: family === 'TXT' ? ' ' : 'Ninguno',
        alignment: 'Izquierda',
        overflowRule: 'Bloquear con error',
        protectionClass: 'Parametrizable',
        evidenceState: 'Sustento explícito',
        evidenceSourceRef: 'Instructivo Regulatorio',
        xmlNodeKind: 'Elemento',
        avroLogicalType: 'string',
        mapping: {
          transformationKind: 'Concatenación tipada',
          sourceContractId: 'DC-CARTERA-01',
          sourceField: 'nombre',
          expression: "nombre + ' ' + apellido_1",
          isParameterizedPoint: false,
          emptyTreatment: 'Error bloqueante',
          mappingStatus: 'Confirmado por usuario',
        },
      },
      {
        id: `FLD-${Date.now()}-4`,
        technicalName: 'saldo',
        label: 'Saldo al Corte',
        description: 'Saldo capital en moneda local con 2 decimales',
        recordSection: 'Detalle',
        order: 4,
        dataType: 'Decimal',
        physicalType: 'DECIMAL(16,2)',
        length: 16,
        lengthUnit: 'Caracteres',
        precision: 16,
        scale: 2,
        required: true,
        nullable: false,
        startPosition: 67,
        formatMask: '0.00',
        defaultValue: '0.00',
        paddingChar: family === 'TXT' ? '0' : 'Ninguno',
        alignment: 'Derecha',
        overflowRule: 'Bloquear con error',
        protectionClass: 'Parametrizable',
        evidenceState: 'Sustento explícito',
        evidenceSourceRef: 'Instructivo Regulatorio',
        xmlNodeKind: 'Elemento',
        avroLogicalType: 'bytes (decimal 16,2)',
        mapping: {
          transformationKind: 'Directo',
          sourceContractId: 'DC-CARTERA-01',
          sourceField: 'saldo',
          expression: 'saldo',
          isParameterizedPoint: false,
          emptyTreatment: 'Error bloqueante',
          mappingStatus: 'Confirmado por usuario',
        },
      },
      {
        id: `FLD-${Date.now()}-5`,
        technicalName: 'estado_operacion',
        label: 'Estado de la Operación',
        description: 'Estado crediticio de la operación al corte',
        recordSection: 'Detalle',
        order: 5,
        dataType: 'Catálogo',
        physicalType: 'VARCHAR(12)',
        length: 12,
        lengthUnit: 'Caracteres',
        required: true,
        nullable: false,
        startPosition: 83,
        formatMask: '',
        defaultValue: 'VIGENTE',
        paddingChar: family === 'TXT' ? ' ' : 'Ninguno',
        alignment: 'Izquierda',
        overflowRule: 'Bloquear con error',
        protectionClass: 'Parametrizable',
        evidenceState: 'Sustento explícito',
        evidenceSourceRef: 'Instructivo Regulatorio',
        xmlNodeKind: 'Elemento',
        avroLogicalType: 'string',
        mapping: {
          transformationKind: 'Directo',
          sourceContractId: 'DC-CARTERA-01',
          sourceField: 'estado_homologado',
          expression: 'estado_homologado',
          isParameterizedPoint: false,
          emptyTreatment: 'Valor predeterminado',
          mappingStatus: 'Confirmado por usuario',
        },
      },
    ];
  };

  const handleCreateNewOutput = (e: React.FormEvent) => {
    e.preventDefault();
    const outType = outputTypes.find((t) => t.id === newOutputTypeId) || outputTypes[0];
    const cleanCode = newCode.trim().toUpperCase() || `SAL-${Date.now().toString().slice(-4)}`;
    const cleanName = newName.trim() || 'Nueva Salida Regulatoria';
    const fields = buildStarterFields(outType.family, newStarterMode);

    const extMap: Record<TechnicalFamily, string> = {
      CSV: 'csv',
      TXT: 'txt',
      XML: 'xml',
      AVRO: 'avro',
      XBRL: 'xbrl',
      PDF: 'pdf',
      XLSX: 'xlsx',
    };

    const created: ConfiguredOutput = {
      id: `OUT-${Date.now().toString(36).toUpperCase()}`,
      code: cleanCode,
      name: cleanName,
      purpose: 'Entrega regulatoria configurada desde el asistente',
      jurisdiction: 'Colombia',
      regulator: newRegulator.trim() || 'SFC / Ente Supervisor',
      outputTypeId: outType.id,
      description:
        newDescription.trim() ||
        'Salida configurada desde el asistente visual de TÓTAL REPORT®.',
      responsibleUser: activeUserRole,
      validFrom: '2026-11-01',
      validTo: 'Abierta',
      version: '1.0',
      status: 'Borrador',
      derivationType: 'Original',
      updatedAt: '2026-11-09',
      fingerprint: `SHA256:${cleanCode}-V10`,
      composition: {
        fileNamePattern: `{entidad}_${cleanCode}_{periodo}_v{version}`,
        extension: extMap[outType.family],
        encoding: 'UTF-8',
        delimiter:
          outType.family === 'CSV'
            ? ';'
            : outType.family === 'TXT'
            ? 'Ancho fijo'
            : 'N/A',
        decimalSeparator: ',',
        includeHeader: outType.family === 'CSV' || outType.family === 'TXT',
        includeControlTotals: false,
        includeFooter: outType.family === 'TXT',
        packaging: 'Sin empaquetar',
        maxPackageBytes: 52428800,
        emptyDatasetPolicy: 'Producir vacío válido',
        packageMembers: [
          {
            id: `PKG-${Date.now()}`,
            role: 'Principal',
            cardinality: '1..1 (Obligatorio)',
            outputDefinitionId: cleanCode,
            outputVersion: '1.0',
            fileNamePattern: `{entidad}_${cleanCode}_{periodo}_v{version}.${extMap[outType.family]}`,
            includeInRegulatoryDelivery: true,
            allowRoleMappingOverride: true,
          },
        ],
      },
      dataContractId: 'DC-CARTERA-01',
      fields,
      validationRules: [
        {
          id: `VR-${Date.now()}-1`,
          code: 'VAL-EST-01',
          name: 'Verificación de longitud y obligatoriedad de campos',
          layer: 'Diseño y estructura',
          targetFieldOrRole: 'Todos los campos',
          conditionExpression: 'ALL_REQUIRED_PRESENT() AND NO_FIELD_OVERFLOW()',
          severity: 'Bloqueante',
          isNormativeProtected: false,
          owner: 'Política de salida y entrega',
          diagnosticMessage:
            'Existen campos obligatorios vacíos o valores que exceden la longitud configurada.',
          enabled: true,
        },
      ],
      defaultDeliveryChannelId: 'CHAN-MANUAL-01',
      signatureServiceRef: 'KMS-INST-01',
      encryptionPolicy: 'Sin cifrado adicional (TLS canal)',
      sourceDocIds: ['DOC-SFC-01'],
      versionHistory: [
        {
          version: '1.0',
          status: 'Borrador',
          createdAt: '2026-11-09 09:00',
          createdBy: activeUserRole,
          justification: 'Creación inicial desde Salidas configuradas.',
          changesSummary: ['Creación inicial de estructura'],
          fingerprint: `SHA256:${cleanCode}-V10`,
          derivationKind: 'Creación inicial',
        },
      ],
    };

    saveConfiguredOutput(created);
    setShowCreateModal(false);
    openOutputInBuilder(created.id, 1);
  };

  const renderStatusBadge = (status: LifecycleStatus) => {
    const styles: Record<LifecycleStatus, string> = {
      Publicada: 'bg-emerald-50 text-emerald-900 border-emerald-300',
      Aprobada: 'bg-blue-50 text-blue-900 border-blue-300',
      'En revisión': 'bg-amber-50 text-amber-900 border-amber-300',
      Borrador: 'bg-slate-100 text-slate-800 border-slate-300',
      Descontinuada: 'bg-rose-50 text-rose-900 border-rose-300',
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${styles[status]}`}
      >
        {status}
      </span>
    );
  };

  const handleExportJson = () => {
    const content = exportDomainJson();
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `respaldo_total_report_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Main Header with Primary Call-To-Action */}
      <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#1E4E8C]">
            A. Salidas configuradas · Pantalla Principal
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
            <span>Salidas Regulatorias Configuradas</span>
            <HelpTooltip
              title="¿Qué es una Salida Configurada?"
              description="Es la definición versionada de un archivo regulatorio (estructura de campos, origen de información, validaciones y nombre de archivo). Una misma salida configurada puede asociarse por referencia a múltiples formatos regulatorios sin duplicarse."
            />
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Consulte las salidas existentes, su tipo de archivo, versión y formatos asociados, o cree una nueva salida paso a paso con el asistente visual.
          </p>
        </div>

        <div className="flex flex-wrap items-center xl:justify-end gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const response = await fetch('/Manual_Usuario_Builder_Salidas_Regulatorias.pdf');
                if (!response.ok) throw new Error('Network response was not ok');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Manual_Usuario_Builder_Salidas_Regulatorias.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              } catch (e) {
                const a = document.createElement('a');
                a.href = '/Manual_Usuario_Builder_Salidas_Regulatorias.pdf';
                a.download = 'Manual_Usuario_Builder_Salidas_Regulatorias.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-emerald-50 text-emerald-950 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
            title="Descargar Manual de Usuario en PDF"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-700" />
            Descargar Manual
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const response = await fetch('/Propuesta_Reg_Builder_Especificacion_Desarrollo_v1_3.pdf');
                if (!response.ok) throw new Error('Network response was not ok');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Propuesta_Reg_Builder_Especificacion_Desarrollo_v1_3.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              } catch (e) {
                const a = document.createElement('a');
                a.href = '/Propuesta_Reg_Builder_Especificacion_Desarrollo_v1_3.pdf';
                a.download = 'Propuesta_Reg_Builder_Especificacion_Desarrollo_v1_3.pdf';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-blue-50 text-blue-950 border border-blue-300 hover:bg-blue-100 transition-colors cursor-pointer"
            title="Descargar Propuesta de Diseño y Arquitectura para Desarrollo en PDF"
          >
            <FileText className="w-3.5 h-3.5 text-blue-700" />
            Propuesta de Diseño
          </button>
          <button
            type="button"
            onClick={resetDemoData}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded text-xs font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            Restaurar demo
          </button>
          {pendingSuggestionsCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveModule('governance')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-amber-50 text-amber-950 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              Cambios normativos TOTALiA® ({pendingSuggestionsCount})
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded text-xs font-bold bg-[#1E4E8C] text-white hover:bg-[#163A69] shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Crear nueva salida
          </button>
        </div>
      </div>

      {/* 4 Clean Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-md p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center">
              Total salidas configuradas
              <HelpTooltip
                title="Total salidas configuradas"
                description="Suma de todas las versiones de salidas registradas en el catálogo (incluyendo publicadas, aprobadas, en revisión y borradores)."
              />
            </span>
            <FileCode2 className="w-4 h-4 text-[#1E4E8C]" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {configuredOutputs.length}
            </span>
            <span className="text-[11px] text-slate-600">en catálogo</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center">
              Salidas publicadas (vigentes)
              <HelpTooltip
                title="Salidas publicadas"
                description="Versiones certificadas e inmutables listas para ser asociadas a formatos regulatorios. No admiten edición directa; para cambiarlas se usa 'Crear revisión'."
              />
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-800">
              {publishedCount}
            </span>
            <span className="text-[11px] text-slate-600">protegidas contra edición directa</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center">
              En borrador o revisión
              <HelpTooltip
                title="En borrador o revisión"
                description="Salidas que se encuentran abiertas a edición o revisión funcional en el Diseñador de salidas (7 pasos) antes de su aprobación y publicación."
              />
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-amber-800">
              {editableCount}
            </span>
            <span className="text-[11px] text-slate-600">editables en el diseñador</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-md p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center">
              Asociaciones con formatos
              <HelpTooltip
                align="right"
                title="Asociaciones con formatos"
                description={`Muestra las asociaciones activas (${activeAssociationsCount}) y pendientes de activación (${pendingAssociationsCount}) distribuidas entre los ${regulatoryFormats.length} formatos regulatorios del catálogo.`}
              />
            </span>
            <Link2 className="w-4 h-4 text-[#1E4E8C]" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {activeAssociationsCount}
            </span>
            <span className="text-[11px] text-slate-600">
              activas ({pendingAssociationsCount} instalada(s) sin activar)
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-md p-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, código o entidad reguladora..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#1E4E8C]"
            />
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Filtrar por Tipo de Archivo"
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-[#1E4E8C]"
            >
              <option value="ALL">Todos los tipos de archivo</option>
              <option value="CSV">CSV (Delimitado)</option>
              <option value="TXT">TXT (Ancho fijo)</option>
              <option value="XML">XML (Jerárquico)</option>
              <option value="AVRO">AVRO (Esquema tipado)</option>
              <option value="XBRL">XBRL (Taxonómico)</option>
              <option value="PDF">PDF (Documental)</option>
              <option value="XLSX">XLSX (Hoja de cálculo)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Filtrar por Estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-[#1E4E8C]"
            >
              <option value="ALL">Todos los estados</option>
              <option value="Publicada">Publicada</option>
              <option value="Aprobada">Aprobada</option>
              <option value="En revisión">En revisión</option>
              <option value="Borrador">Borrador</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filtrar por Entidad Reguladora"
              value={regulatorFilter}
              onChange={(e) => setRegulatorFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-[#1E4E8C]"
            >
              <option value="ALL">Todas las entidades supervisoras</option>
              {uniqueRegulators.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table of Configured Outputs */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Listado de Salidas Configuradas ({filteredOutputs.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Las salidas en estado <strong>Borrador</strong> o <strong>En revisión</strong> se editan directamente. Las salidas <strong>Publicadas</strong> se abren en modo consulta y se actualizan mediante <strong>Crear revisión</strong>.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <strong>Crear revisión</strong>
              <HelpTooltip
                align="right"
                title="Acción: Crear revisión"
                description="Crea un borrador vinculado a la salida actual (incrementando su versión, ej. v1.4 -> v1.5), conservando intacta la versión publicada que consumen los formatos actuales."
              />
            </span>
            <span className="inline-flex items-center gap-1">
              <strong>Duplicar</strong>
              <HelpTooltip
                align="right"
                title="Acción: Duplicar"
                description="Crea una salida independiente con otro código (en v1.0 Borrador), sin vínculo de versión con la salida original."
              />
            </span>
            <span className="inline-flex items-center gap-1">
              <strong>Asociar</strong>
              <HelpTooltip
                align="right"
                title="Acción: Asociar"
                description="Vincula una versión de la salida con un formato regulatorio, modalidad de envío y canal de entrega en la pantalla D (Formatos y asociaciones)."
              />
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Salida Configurada</th>
                <th className="py-2.5 px-3">Tipo de Archivo</th>
                <th className="py-2.5 px-3">Versión y Estado</th>
                <th className="py-2.5 px-3">Estructura</th>
                <th className="py-2.5 px-3">Formatos Regulatorios Asociados</th>
                <th className="py-2.5 px-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredOutputs.map((item) => {
                const outType = outputTypes.find((t) => t.id === item.outputTypeId);
                const linkedAssocs = associations.filter(
                  (a) => a.configuredOutputId === item.id || a.configuredOutputId === item.baseOutputId
                );
                const isEditable =
                  item.status === 'Borrador' || item.status === 'En revisión';

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/90 transition-colors align-top"
                  >
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#1E4E8C] tabular-nums">
                          {item.code}
                        </span>
                        {item.derivationType !== 'Original' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-medium">
                            {item.derivationType}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-slate-900 mt-0.5">{item.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {item.regulator} · {item.jurisdiction}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-900 border border-slate-300">
                        {outType?.family || 'CSV'}
                      </span>
                      <div className="text-[11px] text-slate-600 mt-1">
                        {outType?.name}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          v{item.version}
                        </span>
                        {renderStatusBadge(item.status)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                        Vigencia: {item.validFrom}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-mono font-semibold text-slate-800 tabular-nums">
                        {item.fields.length} campo(s)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {item.validationRules.length} validación(es)
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {linkedAssocs.length > 0 ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {linkedAssocs.map((a) => {
                              const fmt = regulatoryFormats.find((f) => f.id === a.formatId);
                              return (
                                <span
                                  key={a.id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                                    a.status === 'Activa'
                                      ? 'bg-blue-50 text-[#1E4E8C] border-blue-200'
                                      : 'bg-amber-50 text-amber-900 border-amber-300'
                                  }`}
                                  title={`${fmt?.name || ''} · Modalidad ${a.modality} (${a.environment}) · Estado: ${a.status}`}
                                >
                                  {fmt?.code || a.formatId} (v{a.configuredOutputVersion}
                                  {a.status !== 'Activa' ? ` · ${a.status}` : ''})
                                </span>
                              );
                            })}
                          </div>
                          {linkedAssocs.length > 1 && (
                            <div className="text-[10px] font-semibold text-emerald-800">
                              Reutilizada en {linkedAssocs.length} asociaciones sin duplicar
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Sin formatos asociados
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3.5 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openOutputInBuilder(item.id, 1)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                            isEditable
                              ? 'bg-[#1E4E8C] text-white hover:bg-[#163A69]'
                              : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                          }`}
                          title={
                            isEditable
                              ? 'Editar esta salida en el Diseñador de 7 pasos'
                              : 'Consultar configuración en modo lectura (versión protegida)'
                          }
                        >
                          {isEditable ? (
                            <>
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              Consultar
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openAssociationForOutput(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-300 bg-blue-50 text-[#1E4E8C] hover:bg-blue-100 text-xs font-semibold cursor-pointer"
                          title="Asociar: vincula una versión de la salida con un formato regulatorio"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          Asociar
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRevisionTarget(item);
                            setRevisionJustification(
                              `Nueva revisión de ${item.code} para ajustes de estructura o mapeo.`
                            );
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium cursor-pointer"
                          title="Crear revisión: crea un borrador vinculado a la salida actual, conservando la versión publicada"
                        >
                          <GitBranch className="w-3.5 h-3.5 text-[#1E4E8C]" />
                          Crear revisión
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDuplicateTarget(item);
                            setDuplicateCode(`${item.code}-COPIA`);
                            setDuplicateName(`${item.name} (Copia)`);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium cursor-pointer"
                          title="Duplicar: crea una salida independiente con otro código"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Duplicar
                        </button>

                        {item.status === 'Borrador' && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-medium cursor-pointer"
                            title="Eliminar este borrador (solo disponible si no tiene asociaciones)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredOutputs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    No se encontraron salidas configuradas con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Create New Output */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-4 py-3 bg-[#0F1F38] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-300" />
                <h3 className="text-sm font-bold">Crear nueva salida regulatoria</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCreateNewOutput} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Nombre de la salida *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Reporte Mensual de Cartera de Crédito"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Código identificador *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="Ej. SAL-CARTERA-01"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Entidad reguladora *
                  </label>
                  <input
                    type="text"
                    required
                    value={newRegulator}
                    onChange={(e) => setNewRegulator(e.target.value)}
                    placeholder="Ej. SFC / SBS / CNBV"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Tipo de archivo (Tipo de salida reutilizable) *
                </label>
                <select
                  aria-label="Seleccionar tipo de archivo para la nueva salida"
                  value={newOutputTypeId}
                  onChange={(e) => setNewOutputTypeId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-medium"
                >
                  {outputTypes.map((ot) => (
                    <option key={ot.id} value={ot.id}>
                      {ot.family} — {ot.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Descripción funcional
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Punto de partida para los campos
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`p-2.5 rounded border cursor-pointer flex items-start gap-2 ${
                      newStarterMode === 'single'
                        ? 'border-[#1E4E8C] bg-blue-50/60 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="starterMode"
                      checked={newStarterMode === 'single'}
                      onChange={() => setNewStarterMode('single')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold">Estructura inicial limpia</div>
                      <div className="text-[11px] text-slate-500">
                        Inicia con 1 campo base para que agregue sus propios campos paso a paso.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-2.5 rounded border cursor-pointer flex items-start gap-2 ${
                      newStarterMode === 'five'
                        ? 'border-[#1E4E8C] bg-blue-50/60 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="starterMode"
                      checked={newStarterMode === 'five'}
                      onChange={() => setNewStarterMode('five')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold">Plantilla de 5 campos</div>
                      <div className="text-[11px] text-slate-500">
                        Incluye 5 campos regulatorios típicos (Fecha, ID, Tipo Doc, Nombre, Saldo).
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#1E4E8C] text-white font-semibold hover:bg-[#163A69] cursor-pointer"
                >
                  Crear y abrir en el Diseñador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Revision */}
      {revisionTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-4 py-3 bg-[#0F1F38] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Crear nueva revisión de {revisionTarget.code} (v{revisionTarget.version})
              </h3>
              <button
                type="button"
                onClick={() => setRevisionTarget(null)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                La versión actual <strong>v{revisionTarget.version}</strong> permanecerá intacta para los formatos que ya la utilizan. Se creará una nueva versión en estado <strong>Borrador</strong> que podrá modificar libremente.
              </p>
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Motivo o justificación de la nueva revisión *
                </label>
                <textarea
                  rows={3}
                  value={revisionJustification}
                  onChange={(e) => setRevisionJustification(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRevisionTarget(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const created = createNewRevisionFromOutput(
                      revisionTarget.id,
                      revisionJustification
                    );
                    setRevisionTarget(null);
                    if (created) {
                      openOutputInBuilder(created.id, 1);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded bg-[#1E4E8C] text-white font-semibold hover:bg-[#163A69] cursor-pointer"
                >
                  Crear revisión y editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Duplicate Output */}
      {duplicateTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-4 py-3 bg-[#0F1F38] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Duplicar salida como configuración independiente</h3>
              <button
                type="button"
                onClick={() => setDuplicateTarget(null)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                Se creará una copia independiente en versión <strong>v1.0 (Borrador)</strong> a partir de <strong>{duplicateTarget.code}</strong>.
              </p>
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Nuevo código identificador *
                </label>
                <input
                  type="text"
                  value={duplicateCode}
                  onChange={(e) => setDuplicateCode(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Nombre de la nueva salida *
                </label>
                <input
                  type="text"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDuplicateTarget(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const copy = duplicateOutputIndependently(
                      duplicateTarget.id,
                      duplicateCode,
                      duplicateName
                    );
                    setDuplicateTarget(null);
                    if (copy) {
                      openOutputInBuilder(copy.id, 1);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded bg-[#1E4E8C] text-white font-semibold hover:bg-[#163A69] cursor-pointer"
                >
                  Duplicar y abrir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Confirm Delete Draft */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-4 py-3 bg-rose-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Confirmar eliminación de borrador</h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-xs text-rose-200 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-700">
                ¿Está seguro de que desea eliminar la salida en borrador{' '}
                <strong className="font-mono">{deleteTarget.code}</strong> ({deleteTarget.name})? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteConfiguredOutput(deleteTarget.id);
                    setDeleteTarget(null);
                  }}
                  className="px-3.5 py-1.5 rounded bg-rose-700 text-white font-semibold hover:bg-rose-800 cursor-pointer"
                >
                  Sí, eliminar borrador
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
