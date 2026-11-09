import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Layers,
  Link2,
  Plus,
  Power,
  Save,
  Search,
  ShieldAlert,
  Sliders,
  Trash2,
} from 'lucide-react';
import { useConfigurator } from '../context/ConfiguratorContext';
import { resolveFormatAssociation } from '../domain/engine';
import { FormatOutputAssociation } from '../domain/types';
import { HelpTooltip } from './HelpTooltip';

export const AssociationsMatrixView: React.FC = () => {
  const {
    associations,
    regulatoryFormats,
    transmissionTypes,
    configuredOutputs,
    outputTypes,
    deliveryChannels,
    daqueProfiles,
    globalEnvironment,
    globalPeriod,
    globalEntity,
    activeUserRole,
    preselectedAssocOutputId,
    setPreselectedAssocOutputId,
    saveAssociation,
    deleteAssociation,
    openOutputInBuilder,
    notify,
  } = useConfigurator();

  const [selectedFormatFilter, setSelectedFormatFilter] = useState<string>('ALL');
  const [selectedAssocId, setSelectedAssocId] = useState<string>(associations[0]?.id || '');
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<FormatOutputAssociation | null>(null);

  // Resolution Simulator state synced with global header selectors
  const [simFormatId, setSimFormatId] = useState<string>('FMT-DEMO-01');
  const [simTransId, setSimTransId] = useState<string>('TX-ORDINARIO');
  const [simModality, setSimModality] = useState<'Inicial' | 'Corrección' | 'Reemplazo'>('Inicial');
  const [simEnv, setSimEnv] = useState<'QA' | 'Producción'>(globalEnvironment);
  const [simPeriod, setSimPeriod] = useState<string>(globalPeriod);

  useEffect(() => {
    setSimEnv(globalEnvironment);
  }, [globalEnvironment]);

  useEffect(() => {
    setSimPeriod(globalPeriod);
  }, [globalPeriod]);

  // New Association Form State
  const [newCode, setNewCode] = useState<string>('ASO-NUEVA-01');
  const [newFormatId, setNewFormatId] = useState<string>('FMT-DEMO-01');
  const [newTransId, setNewTransId] = useState<string>('TX-ORDINARIO');
  const [newModality, setNewModality] = useState<'Inicial' | 'Corrección' | 'Reemplazo'>('Inicial');
  const [newOutputId, setNewOutputId] = useState<string>(
    configuredOutputs[0]?.id || 'OUT-CSV-DEMO-A'
  );
  const [newChannelId, setNewChannelId] = useState<string>('CHAN-MANUAL-01');
  const [newEnv, setNewEnv] = useState<'QA' | 'Producción'>(globalEnvironment);
  const [newStatus, setNewStatus] = useState<'Activa' | 'Instalada sin activar' | 'Borrador'>(
    'Activa'
  );
  const [newValidFrom, setNewValidFrom] = useState<string>('2026-01-01');
  const [newValidTo, setNewValidTo] = useState<string>('Abierta');
  const [newPrefixOverride, setNewPrefixOverride] = useState<string>('ENTREGA_REG');
  const [newIncludeSummary, setNewIncludeSummary] = useState<boolean>(true);

  // Editable overrides for selected association
  const [editPrefix, setEditPrefix] = useState<string>('');
  const [editZeroPolicy, setEditZeroPolicy] = useState<string>('');

  // Automatically open association modal when navigated from "Asociar" button on a specific output
  useEffect(() => {
    if (preselectedAssocOutputId) {
      const targetOut = configuredOutputs.find((o) => o.id === preselectedAssocOutputId);
      if (targetOut) {
        setNewOutputId(targetOut.id);
        setNewCode(`ASO-${targetOut.code}-${Date.now().toString().slice(-3)}`);
        setNewPrefixOverride(targetOut.code);
        setNewEnv(globalEnvironment);
        setShowNewModal(true);
      }
      setPreselectedAssocOutputId(null);
    }
  }, [preselectedAssocOutputId, configuredOutputs, setPreselectedAssocOutputId, globalEnvironment]);

  const filteredAssociations = useMemo(() => {
    return associations.filter((a) => {
      if (selectedFormatFilter !== 'ALL' && a.formatId !== selectedFormatFilter) return false;
      return true;
    });
  }, [associations, selectedFormatFilter]);

  const selectedAssoc = useMemo(
    () => associations.find((a) => a.id === selectedAssocId) || filteredAssociations[0] || null,
    [associations, selectedAssocId, filteredAssociations]
  );

  useEffect(() => {
    if (selectedAssoc) {
      setEditPrefix(selectedAssoc.parameterOverrides.fileNamePrefix || '');
      setEditZeroPolicy(selectedAssoc.parameterOverrides.zeroBalancePolicyOverride || '');
    }
  }, [selectedAssoc]);

  // Live compatibility check inside New Association Modal (Scenario 5)
  const modalCompatibilityDiagnostic = useMemo(() => {
    const out = configuredOutputs.find((o) => o.id === newOutputId);
    const trn = transmissionTypes.find((t) => t.id === newTransId);
    const outType = outputTypes.find((t) => t.id === out?.outputTypeId);
    const fmt = regulatoryFormats.find((f) => f.id === newFormatId);

    if (!out || !trn || !outType || !fmt) return null;

    if (!trn.compatibleFamilies.includes(outType.family)) {
      return {
        compatible: false,
        reason: `Asociación incompatible: El tipo de transmisión "${trn.name}" solo admite archivos (${trn.compatibleFamilies.join(
          ', '
        )}), pero la salida seleccionada "${out.code}" es de tipo ${outType.family}.`,
        howToFix: `Seleccione un tipo de transmisión compatible con ${outType.family} o elija otra salida configurada.`,
      };
    }

    const existingDuplicate = associations.find(
      (a) =>
        a.status === 'Activa' &&
        a.formatId === fmt.id &&
        a.transmissionTypeId === trn.id &&
        a.modality === newModality &&
        a.environment === newEnv
    );

    if (existingDuplicate && newStatus === 'Activa') {
      return {
        compatible: true,
        warning: `Atención: Ya existe una asociación activa (${existingDuplicate.code}) para el formato ${fmt.code}, modalidad ${newModality} en ${newEnv}. Si guarda otra asociación como "Activa" para la misma combinación, se detectará solapamiento de vigencias. Puede guardarla como "Instalada sin activar" si desea dejarla preparada sin conflicto.`,
      };
    }

    return { compatible: true };
  }, [
    configuredOutputs,
    newOutputId,
    transmissionTypes,
    newTransId,
    outputTypes,
    regulatoryFormats,
    newFormatId,
    associations,
    newModality,
    newEnv,
    newStatus,
  ]);

  // Resolution Simulator result
  const resolutionResult = useMemo(() => {
    return resolveFormatAssociation({
      associations,
      formatId: simFormatId,
      transmissionTypeId: simTransId,
      modality: simModality,
      environment: simEnv,
      cutoffPeriod: simPeriod,
    });
  }, [associations, simFormatId, simTransId, simModality, simEnv, simPeriod]);

  const handleCreateAssociation = (e: React.FormEvent) => {
    e.preventDefault();
    const fmt = regulatoryFormats.find((f) => f.id === newFormatId);
    const out = configuredOutputs.find((o) => o.id === newOutputId);
    const trn = transmissionTypes.find((t) => t.id === newTransId);
    const outType = outputTypes.find((t) => t.id === out?.outputTypeId);

    if (!fmt || !out || !trn || !outType) return;

    if (!trn.compatibleFamilies.includes(outType.family)) {
      notify(
        'error',
        `Asociación incompatible: El tipo de transmisión "${trn.name}" no admite archivos ${outType.family}. Corrija el tipo de transmisión o la salida seleccionada.`
      );
      return;
    }

    const created: FormatOutputAssociation = {
      id: `ASO-${Date.now().toString(36).toUpperCase()}`,
      code: newCode.trim() || `ASO-${Date.now().toString().slice(-4)}`,
      formatId: fmt.id,
      transmissionTypeId: trn.id,
      modality: newModality,
      configuredOutputId: out.id,
      configuredOutputVersion: out.version,
      deliveryChannelId: newChannelId,
      daqueProfileId: fmt.daqueProfileId,
      entityScope: globalEntity,
      environment: newEnv,
      validFrom: newValidFrom,
      validTo: newValidTo,
      status: newStatus,
      parameterOverrides: {
        fileNamePrefix: newPrefixOverride,
        includeSummaryFile: newIncludeSummary,
      },
      updatedAt: new Date().toISOString().slice(0, 10),
      updatedBy: activeUserRole,
    };

    saveAssociation(created);
    setSelectedAssocId(created.id);
    setShowNewModal(false);
  };

  const handleToggleAssociationStatus = (assoc: FormatOutputAssociation) => {
    const nextStatus: FormatOutputAssociation['status'] =
      assoc.status === 'Activa' ? 'Instalada sin activar' : 'Activa';

    if (nextStatus === 'Activa') {
      const conflicting = associations.find(
        (a) =>
          a.id !== assoc.id &&
          a.status === 'Activa' &&
          a.formatId === assoc.formatId &&
          a.transmissionTypeId === assoc.transmissionTypeId &&
          a.modality === assoc.modality &&
          a.environment === assoc.environment
      );
      if (conflicting) {
        notify(
          'warning',
          `Se activó ${assoc.code}, pero existe otra asociación activa (${conflicting.code}) para el mismo formato, modalidad y ambiente. Verifique el comprobador de vigencias.`
        );
      }
    }

    saveAssociation({
      ...assoc,
      status: nextStatus,
      updatedAt: new Date().toISOString().slice(0, 10),
      updatedBy: activeUserRole,
    });
  };

  const handleSaveSelectedOverrides = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssoc) return;
    saveAssociation({
      ...selectedAssoc,
      parameterOverrides: {
        ...selectedAssoc.parameterOverrides,
        fileNamePrefix: editPrefix.trim() || undefined,
        zeroBalancePolicyOverride: editZeroPolicy.trim() || undefined,
      },
      updatedAt: new Date().toISOString().slice(0, 10),
      updatedBy: activeUserRole,
    });
  };

  const handleSimulateOverlapConflict = () => {
    const duplicateOverlap: FormatOutputAssociation = {
      id: `ASO-OVERLAP-${Date.now().toString(36).toUpperCase()}`,
      code: 'ASO-SOLAPADA-CONFLICTO',
      formatId: simFormatId,
      transmissionTypeId: simTransId,
      modality: simModality,
      configuredOutputId: 'OUT-CSV-DEMO-A',
      configuredOutputVersion: '2.1',
      deliveryChannelId: 'CHAN-MANUAL-01',
      daqueProfileId: 'DAQUE-PROF-01',
      entityScope: globalEntity,
      environment: simEnv,
      validFrom: '2026-01-01',
      validTo: 'Abierta',
      status: 'Activa',
      parameterOverrides: {
        fileNamePrefix: 'SOLAPADO',
      },
      updatedAt: new Date().toISOString().slice(0, 10),
      updatedBy: activeUserRole,
    };
    saveAssociation(duplicateOverlap);
    notify(
      'warning',
      'Se agregó una asociación solapada de prueba. Observe cómo el comprobador detecta la ambigüedad y explica cómo corregirla.'
    );
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1E4E8C]">
            <Link2 className="w-4 h-4" />
            <span>D. Formatos y asociaciones · Reutilización de Salidas</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <span>Formatos Regulatorios y Asociación de Salidas</span>
            <HelpTooltip
              title="¿Qué es una asociación por referencia?"
              description="Vincula una versión específica de una salida configurada con un formato regulatorio, tipo de transmisión, modalidad, canal de entrega y ambiente."
              example="La salida DEMO-CE-01 (CSV) se reutiliza en los formatos DEMO-01 y DEMO-02 aplicando prefijos y perfiles DAQUE distintos sin duplicar la estructura de campos."
              consequence="Permite mantener una única definición técnica reutilizable para múltiples reportes regulatorios."
            />
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Asocie una misma salida configurada con uno o varios formatos regulatorios, versiones, tipos de transmisión y canales de entrega sin duplicar su estructura.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded text-xs font-bold bg-[#1E4E8C] text-white hover:bg-[#163A69] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Asociar salida a un formato
          </button>
        </div>
      </div>

      {/* Interactive Compatibility & Resolution Checker */}
      <div className="bg-white border border-slate-200 rounded-md p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#1E4E8C]" />
              <span>Comprobador de compatibilidad y vigencia de asociaciones</span>
              <HelpTooltip
                title="Regla de coincidencia única en ejecución"
                description="Para ejecutar o transmitir un reporte, el motor busca exactamente una (1) asociación en estado 'Activa' que coincida con el Formato, Tipo de transmisión, Modalidad, Ambiente y Periodo de corte."
                consequence="Si existen 0 asociaciones activas o más de 1 asociación activa solapada para la misma combinación, la generación se bloquea preventivamente."
              />
            </h2>
            <p className="text-xs text-slate-600">
              Verifique qué salida configurada, versión y canal se utilizan para cada formato y tipo de transmisión. Sincronizado con el periodo (<span className="font-mono font-semibold">{globalPeriod}</span>) y ambiente (<span className="font-semibold">{globalEnvironment}</span>) del encabezado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateOverlapConflict}
              className="px-2.5 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-medium transition-colors cursor-pointer"
            >
              Simular conflicto de vigencias
            </button>
            <HelpTooltip
              title="Prueba de detección de conflicto"
              description="Inserta temporalmente una segunda asociación activa para la misma llave regulatoria con el fin de demostrar cómo el configurador bloquea la ambigüedad y permite eliminar el duplicado."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Formato Regulatorio
            </label>
            <select
              aria-label="Formato Regulatorio Simulador"
              value={simFormatId}
              onChange={(e) => setSimFormatId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
            >
              {regulatoryFormats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Tipo de Transmisión
            </label>
            <select
              aria-label="Tipo de Transmisión Simulador"
              value={simTransId}
              onChange={(e) => setSimTransId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
            >
              {transmissionTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Modalidad
            </label>
            <select
              aria-label="Modalidad Simulador"
              value={simModality}
              onChange={(e) =>
                setSimModality(e.target.value as 'Inicial' | 'Corrección' | 'Reemplazo')
              }
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
            >
              <option value="Inicial">Inicial (Ordinario)</option>
              <option value="Corrección">Corrección</option>
              <option value="Reemplazo">Reemplazo / Retransmisión</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Ambiente
            </label>
            <select
              aria-label="Ambiente Simulador"
              value={simEnv}
              onChange={(e) => setSimEnv(e.target.value as 'QA' | 'Producción')}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
            >
              <option value="QA">QA</option>
              <option value="Producción">Producción</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Periodo de Corte
            </label>
            <input
              type="text"
              aria-label="Periodo de Corte Simulador"
              value={simPeriod}
              onChange={(e) => setSimPeriod(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white text-slate-900"
            />
          </div>
        </div>

        {/* Resolution Status Banner */}
        <div
          className={`mt-3 p-3 rounded border flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${
            resolutionResult.status === 'Coincidencia única'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/80 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {resolutionResult.status === 'Coincidencia única' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-bold">
                Resultado: {resolutionResult.status}
              </div>
              <p className="text-xs mt-0.5">{resolutionResult.diagnosticMessage}</p>
            </div>
          </div>

          {resolutionResult.matchingAssociations.length > 1 && (
            <div className="flex items-center gap-2 shrink-0">
              {resolutionResult.matchingAssociations
                .filter((m) => m.code === 'ASO-SOLAPADA-CONFLICTO')
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => deleteAssociation(m.id)}
                    className="px-2.5 py-1 rounded bg-rose-700 text-white text-xs font-semibold hover:bg-rose-800 cursor-pointer"
                  >
                    Eliminar asociación duplicada ({m.code})
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Split Grid: Left Matrix + Right Relationship Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Matrix of Associations (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md flex flex-col">
          <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Asociaciones configuradas ({filteredAssociations.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                Seleccione una fila para consultar los detalles, activar/desactivar o ajustar parámetros propios del formato.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600 font-medium">Filtrar formato:</label>
              <select
                aria-label="Filtrar asociaciones por formato"
                value={selectedFormatFilter}
                onChange={(e) => setSelectedFormatFilter(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1 text-xs bg-white text-slate-900"
              >
                <option value="ALL">Todos los formatos ({associations.length})</option>
                {regulatoryFormats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-2.5 px-3">Asociación / Formato</th>
                  <th className="py-2.5 px-3">Transmisión / Modalidad</th>
                  <th className="py-2.5 px-3">Salida Asociada</th>
                  <th className="py-2.5 px-3">Ambiente / Estado</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredAssociations.map((assoc) => {
                  const fmt = regulatoryFormats.find((f) => f.id === assoc.formatId);
                  const trn = transmissionTypes.find((t) => t.id === assoc.transmissionTypeId);
                  const out = configuredOutputs.find((o) => o.id === assoc.configuredOutputId);
                  const isSelected = selectedAssoc?.id === assoc.id;

                  const sharedCount = associations.filter(
                    (a) => a.configuredOutputId === assoc.configuredOutputId
                  ).length;

                  return (
                    <tr
                      key={assoc.id}
                      onClick={() => setSelectedAssocId(assoc.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {assoc.code}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {fmt?.code} — {fmt?.name}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{trn?.name}</div>
                        <div className="text-[11px] text-slate-500">Modalidad: {assoc.modality}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-semibold text-[#1E4E8C] tabular-nums">
                          {out?.code || assoc.configuredOutputId} (v{assoc.configuredOutputVersion})
                        </div>
                        {sharedCount > 1 && (
                          <span className="inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-900">
                            Reutilizada en {sharedCount} formatos
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{assoc.environment}</div>
                        <span
                          className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            assoc.status === 'Activa'
                              ? 'bg-emerald-100 text-emerald-900'
                              : assoc.status === 'Instalada sin activar'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {assoc.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAssociationStatus(assoc);
                            }}
                            aria-label={
                              assoc.status === 'Activa'
                                ? `Desactivar asociación ${assoc.code}`
                                : `Activar asociación ${assoc.code}`
                            }
                            className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer inline-flex items-center gap-1 ${
                              assoc.status === 'Activa'
                                ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            {assoc.status === 'Activa' ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openOutputInBuilder(assoc.configuredOutputId, 1);
                            }}
                            aria-label={`Ver salida ${out?.code || assoc.configuredOutputId} en el Diseñador`}
                            className="p-1 text-slate-600 hover:text-[#1E4E8C] rounded hover:bg-slate-100 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          {associations.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(assoc);
                              }}
                              aria-label={`Eliminar asociación ${assoc.code}`}
                              className="p-1 text-slate-500 hover:text-rose-700 rounded hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>

        {/* Right: Detailed Chain of Reference (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {selectedAssoc ? (
            (() => {
              const fmt = regulatoryFormats.find((f) => f.id === selectedAssoc.formatId);
              const trn = transmissionTypes.find((t) => t.id === selectedAssoc.transmissionTypeId);
              const out = configuredOutputs.find((o) => o.id === selectedAssoc.configuredOutputId);
              const outType = outputTypes.find((t) => t.id === out?.outputTypeId);
              const chn = deliveryChannels.find((c) => c.id === selectedAssoc.deliveryChannelId);
              const daque = daqueProfiles.find((d) => d.id === selectedAssoc.daqueProfileId);

              const siblingAssocs = associations.filter(
                (a) =>
                  a.configuredOutputId === selectedAssoc.configuredOutputId &&
                  a.id !== selectedAssoc.id
              );

              return (
                <>
                  <div className="bg-white border border-slate-200 rounded-md p-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E4E8C]">
                          Detalle de la Asociación Seleccionada
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                          {selectedAssoc.code} · Vigencia {selectedAssoc.validFrom} a{' '}
                          {selectedAssoc.validTo}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                            selectedAssoc.status === 'Activa'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {selectedAssoc.status}
                        </span>
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-800">
                          {selectedAssoc.environment}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-slate-500">
                            1. Formato Regulatorio y Transmisión
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-slate-700">
                            {fmt?.regulator}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {fmt?.code} — {fmt?.name}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Transmisión: <strong>{trn?.name}</strong> · Modalidad:{' '}
                          <strong>{selectedAssoc.modality}</strong> · Periodicidad: {fmt?.periodicity}
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <ArrowRight className="w-4 h-4 text-slate-400 rotate-90" />
                      </div>

                      <div className="p-2.5 rounded border border-blue-200 bg-blue-50/50">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-[#1E4E8C] flex items-center gap-1">
                            <span>2. Salida Configurada Asociada (Por Referencia)</span>
                            <HelpTooltip
                              title="Asociación por referencia"
                              description="La asociación apunta al identificador y versión de la salida configurada sin copiar sus campos. Si se crea una nueva revisión de la salida, cada formato decide cuándo adoptarla en el módulo E."
                            />
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#1E4E8C] tabular-nums">
                            v{selectedAssoc.configuredOutputVersion}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {out?.code} — {out?.name}
                        </div>
                        <div className="text-[11px] text-slate-700 mt-0.5">
                          Tipo de archivo: <strong>{outType?.family}</strong> ({outType?.name}) ·{' '}
                          {out?.fields.length || 0} campos
                        </div>

                        {siblingAssocs.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-blue-200/80 text-[11px] text-blue-950 flex items-start gap-1.5">
                            <GitBranch className="w-3.5 h-3.5 text-[#1E4E8C] shrink-0 mt-0.5" />
                            <div>
                              <strong>Salida reutilizada sin duplicar:</strong> También está asociada a{' '}
                              {siblingAssocs
                                .map((sa) => {
                                  const sFmt = regulatoryFormats.find((f) => f.id === sa.formatId);
                                  return `${sFmt?.code || sa.code} (${sa.code})`;
                                })
                                .join(', ')}
                              .
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-center">
                        <ArrowRight className="w-4 h-4 text-slate-400 rotate-90" />
                      </div>

                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-slate-500">
                            3. Canal de Entrega y Reglas del Formato
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-slate-700">
                            {chn?.protocol}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5">{chn?.name}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Perfil de reglas del formato: <strong>{daque?.code}</strong> ({daque?.name})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Parameterization Overrides per Association */}
                  <form
                    onSubmit={handleSaveSelectedOverrides}
                    className="bg-white border border-slate-200 rounded-md p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-[#1E4E8C]" />
                        <span>Parámetros propios de esta asociación (Sobrescrituras)</span>
                        <HelpTooltip
                          title="Parámetros propios por asociación"
                          description="Permiten personalizar el prefijo del archivo o la política de saldos en cero para este formato específico sin tener que clonar ni modificar la salida base."
                        />
                      </h3>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E4E8C] text-white text-[11px] font-semibold hover:bg-[#163A69] cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        Guardar parámetros
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-600 uppercase font-semibold mb-1">
                          Prefijo del archivo para este formato
                        </label>
                        <input
                          type="text"
                          aria-label="Prefijo del archivo de la asociación seleccionada"
                          value={editPrefix}
                          onChange={(e) => setEditPrefix(e.target.value)}
                          placeholder="Por defecto de la salida"
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-xs bg-white text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-600 uppercase font-semibold mb-1">
                          Nota / Regla específica del formato
                        </label>
                        <input
                          type="text"
                          aria-label="Regla específica de la asociación seleccionada"
                          value={editZeroPolicy}
                          onChange={(e) => setEditZeroPolicy(e.target.value)}
                          placeholder="Según perfil DAQUE del formato"
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  </form>
                </>
              );
            })()
          ) : (
            <div className="bg-white border border-slate-200 rounded-md p-6 text-center text-xs text-slate-500">
              Seleccione una asociación en la tabla para inspeccionar su detalle.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Associate Existing Configured Output with a Format */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-xl w-full overflow-hidden">
            <div className="px-4 py-3 bg-[#0F1F38] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold">
                  Asociar una salida configurada con un formato regulatorio
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCreateAssociation} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Código de la asociación *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ambiente *</label>
                  <select
                    value={newEnv}
                    onChange={(e) => setNewEnv(e.target.value as 'QA' | 'Producción')}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="QA">QA</option>
                    <option value="Producción">Producción</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Estado inicial *
                  </label>
                  <select
                    aria-label="Estado inicial de la asociación"
                    value={newStatus}
                    onChange={(e) =>
                      setNewStatus(
                        e.target.value as 'Activa' | 'Instalada sin activar' | 'Borrador'
                      )
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="Activa">Activa</option>
                    <option value="Instalada sin activar">Instalada sin activar</option>
                    <option value="Borrador">Borrador</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">
                    1. Formato regulatorio *
                  </label>
                  <select
                    aria-label="Seleccionar formato regulatorio para asociar"
                    value={newFormatId}
                    onChange={(e) => setNewFormatId(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    {regulatoryFormats.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.code} — {f.name} ({f.regulator})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">
                    2. Salida configurada que se reutilizará *
                  </label>
                  <select
                    aria-label="Seleccionar salida configurada para asociar"
                    value={newOutputId}
                    onChange={(e) => setNewOutputId(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                  >
                    {configuredOutputs.map((o) => {
                      const ot = outputTypes.find((t) => t.id === o.outputTypeId);
                      return (
                        <option key={o.id} value={o.id}>
                          [{ot?.family}] {o.code} (v{o.version}) — {o.name} [{o.status}]
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    3. Tipo de transmisión *
                  </label>
                  <select
                    aria-label="Seleccionar tipo de transmisión para asociar"
                    value={newTransId}
                    onChange={(e) => setNewTransId(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    {transmissionTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} · {t.name} (Admite: {t.compatibleFamilies.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Modalidad *</label>
                  <select
                    value={newModality}
                    onChange={(e) =>
                      setNewModality(e.target.value as 'Inicial' | 'Corrección' | 'Reemplazo')
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="Inicial">Inicial (Envío ordinario)</option>
                    <option value="Corrección">Corrección</option>
                    <option value="Reemplazo">Reemplazo / Retransmisión</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">
                    4. Canal de entrega *
                  </label>
                  <select
                    value={newChannelId}
                    onChange={(e) => setNewChannelId(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    {deliveryChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name} ({c.protocol})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vigencia desde
                  </label>
                  <input
                    type="text"
                    value={newValidFrom}
                    onChange={(e) => setNewValidFrom(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Prefijo de archivo para este formato
                  </label>
                  <input
                    type="text"
                    value={newPrefixOverride}
                    onChange={(e) => setNewPrefixOverride(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Compatibility Diagnostic inside Modal (Scenario 5) */}
              {modalCompatibilityDiagnostic && !modalCompatibilityDiagnostic.compatible && (
                <div className="p-3 rounded bg-rose-50 border border-rose-300 text-rose-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                    {modalCompatibilityDiagnostic.reason}
                  </div>
                  <div className="text-[11px]">
                    <strong>Cómo corregirlo:</strong> {modalCompatibilityDiagnostic.howToFix}
                  </div>
                </div>
              )}

              {modalCompatibilityDiagnostic?.warning && (
                <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>{modalCompatibilityDiagnostic.warning}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    modalCompatibilityDiagnostic !== null &&
                    !modalCompatibilityDiagnostic.compatible
                  }
                  className={`px-3.5 py-1.5 rounded font-semibold ${
                    modalCompatibilityDiagnostic && !modalCompatibilityDiagnostic.compatible
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-[#1E4E8C] text-white hover:bg-[#163A69] cursor-pointer'
                  }`}
                >
                  Guardar asociación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Association */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-4 py-3 bg-rose-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Confirmar eliminación de asociación</h3>
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
                ¿Está seguro de que desea eliminar la asociación{' '}
                <strong className="font-mono">{deleteTarget.code}</strong>? La salida configurada no será eliminada, solo se retirará su vínculo con este formato.
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
                    deleteAssociation(deleteTarget.id);
                    setDeleteTarget(null);
                  }}
                  className="px-3.5 py-1.5 rounded bg-rose-700 text-white font-semibold hover:bg-rose-800 cursor-pointer"
                >
                  Eliminar asociación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
