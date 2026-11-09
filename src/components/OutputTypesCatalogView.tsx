import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Database,
  Edit3,
  FileCode2,
  Layers,
  Lock,
  Plus,
  Sliders,
} from 'lucide-react';
import { useConfigurator } from '../context/ConfiguratorContext';
import { OutputType, TechnicalFamily } from '../domain/types';

export const OutputTypesCatalogView: React.FC = () => {
  const {
    outputTypes,
    configuredOutputs,
    saveOutputType,
    openOutputInBuilder,
    activeUserRole,
  } = useConfigurator();

  const [selectedTypeId, setSelectedTypeId] = useState<string>(outputTypes[0]?.id || 'OT-CSV-STD');
  const [showNewTypeModal, setShowNewTypeModal] = useState<boolean>(false);

  // New OutputType Form State
  const [newCode, setNewCode] = useState('TIPO-CSV-PERSONALIZADO');
  const [newName, setNewName] = useState('Archivo Plano Delimitado Especial');
  const [newFamily, setNewFamily] = useState<TechnicalFamily>('CSV');
  const [newCategory, setNewCategory] = useState<OutputType['category']>('Estructurado plano');
  const [newSummary, setNewSummary] = useState(
    'Capacidad técnica reutilizable para archivos delimitados con reglas de encabezado y control.'
  );

  const selectedType =
    outputTypes.find((t) => t.id === selectedTypeId) || outputTypes[0];

  const linkedOutputs = configuredOutputs.filter(
    (o) => o.outputTypeId === selectedType.id
  );

  const handleCreateOutputType = (e: React.FormEvent) => {
    e.preventDefault();
    const isReal =
      newFamily === 'CSV' || newFamily === 'TXT' || newFamily === 'XML';
    const created: OutputType = {
      id: `OT-${Date.now().toString(36).toUpperCase()}`,
      code: newCode.trim().toUpperCase(),
      name: newName.trim(),
      description: newSummary.trim(),
      category: newCategory,
      family: newFamily,
      extension: `.${newFamily.toLowerCase()}`,
      mimeType: 'text/plain;charset=utf-8',
      serializationEngine: `Motor ${newFamily} Estándar`,
      engineVersion: 'v1.0.0',
      engineHash: `SHA256:${Date.now().toString(16).toUpperCase()}`,
      characterEncoding: 'UTF-8',
      supportStatus: isReal ? 'Instalada y certificada' : 'Simulada conceptual',
      canGenerateRealFileInBrowser: isReal,
      capabilities: {
        importSchema: true,
        visualStructureBuilder: true,
        physicalPreview: true,
        artifactGeneration: isReal,
        schemaValidation: true,
      },
      compatibilityRestrictions: [
        'Reutilizable por múltiples salidas configuradas sin duplicar el tipo de archivo.',
      ],
      status: 'Activo',
      version: '1.0',
      updatedAt: '2026-11-09',
      updatedBy: activeUserRole,
    };

    saveOutputType(created);
    setSelectedTypeId(created.id);
    setShowNewTypeModal(false);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1E4E8C]">
            <Database className="w-4 h-4" />
            <span>B. Tipos de salida · Administración de Capacidades Técnicas</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Tipos de Archivo Soportados (Capacidades Reutilizables)
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Define las capacidades generales de cada familia de archivo (CSV, TXT, XML, AVRO, XBRL, PDF). Un mismo tipo de salida sirve como base para múltiples salidas regulatorias sin necesidad de crear un tipo nuevo por cada reporte.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewTypeModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-semibold bg-[#1E4E8C] text-white hover:bg-[#163A69] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar Tipo de Salida
          </button>
        </div>
      </div>

      {/* Main Split View: Left Catalog List + Right Technical Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left List of Reusable OutputTypes (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            Familias de archivo disponibles ({outputTypes.length})
          </div>
          {outputTypes.map((ot) => {
            const isSelected = ot.id === selectedType.id;
            const usageCount = configuredOutputs.filter(
              (o) => o.outputTypeId === ot.id
            ).length;
            const hasPhysicalGenerator = ot.canGenerateRealFileInBrowser;

            return (
              <div
                key={ot.id}
                onClick={() => setSelectedTypeId(ot.id)}
                className={`p-3.5 rounded-md border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white border-[#1E4E8C] ring-2 ring-[#1E4E8C]/15 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#0F1F38] text-white">
                        {ot.family}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#1E4E8C]">
                        {ot.code}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">{ot.name}</h3>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      hasPhysicalGenerator
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {hasPhysicalGenerator
                      ? 'Generador de archivo activo'
                      : 'Solo diseño de estructura'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{ot.description}</p>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Categoría: {ot.category}</span>
                  <span className="font-semibold text-slate-800 tabular-nums">
                    Usado en {usageCount} salida(s)
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Detailed Inspector (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-blue-100 text-[#1E4E8C]">
                  Familia {selectedType.family}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {selectedType.code} · v{selectedType.version}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedType.name}</h2>
              <p className="text-xs text-slate-600 mt-0.5">{selectedType.description}</p>
            </div>

            <div className="text-right">
              {selectedType.canGenerateRealFileInBrowser ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  Generación y descarga real disponible
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-950 text-xs font-semibold">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  Generación física no disponible en esta versión
                </span>
              )}
            </div>
          </div>

          {/* Functional Capabilities Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
              Capacidades habilitadas para el diseñador de salidas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] font-semibold text-slate-500">
                  Codificación predeterminada
                </div>
                <div className="font-mono font-bold text-slate-900 mt-1">
                  {selectedType.characterEncoding}
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] font-semibold text-slate-500">
                  Extensión y tipo MIME
                </div>
                <div className="font-mono font-bold text-slate-900 mt-1">
                  {selectedType.extension} ({selectedType.mimeType})
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] font-semibold text-slate-500">
                  Constructor visual y vista previa
                </div>
                <div className="font-semibold text-slate-900 mt-1">
                  {selectedType.capabilities.visualStructureBuilder
                    ? 'Habilitado (Edición visual + Vista previa)'
                    : 'No habilitado'}
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] font-semibold text-slate-500">
                  Descarga de archivo físico de prueba
                </div>
                <div className="font-semibold text-slate-900 mt-1">
                  {selectedType.canGenerateRealFileInBrowser
                    ? 'Disponible en navegador'
                    : 'No disponible en esta versión (solo esquema/estructura)'}
                </div>
              </div>
            </div>
          </div>

          {/* Specific Family Parameters */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#1E4E8C]" />
              Reglas y restricciones del tipo de archivo
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded p-3">
              {selectedType.compatibilityRestrictions.map((r, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#1E4E8C] font-bold">&bull;</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Configured Outputs currently reusing this OutputType */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1E4E8C]" />
              Salidas configuradas que utilizan este tipo de archivo ({linkedOutputs.length})
            </h3>
            {linkedOutputs.length === 0 ? (
              <div className="p-3 rounded border border-slate-200 bg-slate-50 text-xs text-slate-500">
                Ninguna salida configurada utiliza aún este tipo de archivo.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {linkedOutputs.map((out) => (
                  <div
                    key={out.id}
                    className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-[#1E4E8C]">
                        {out.code} (v{out.version})
                      </div>
                      <div className="text-xs text-slate-800 font-medium">{out.name}</div>
                      <div className="text-[11px] text-slate-500">Estado: {out.status}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openOutputInBuilder(out.id, 1)}
                      className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Edit3 className="w-3 h-3" />
                      Abrir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collapsible Advanced Technical Details for System Admins */}
          <details className="border border-slate-200 rounded bg-slate-50/70 p-3 text-xs">
            <summary className="font-semibold text-slate-700 cursor-pointer flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
                Detalles técnicos para el administrador de plataforma
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </summary>
            <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5 text-[11px] text-slate-600">
              <div>
                <strong>Componente serializador:</strong>{' '}
                <span className="font-mono text-slate-800">
                  {selectedType.serializationEngine} ({selectedType.engineVersion})
                </span>
              </div>
              <div>
                <strong>Referencia de versión técnica:</strong>{' '}
                <span className="font-mono text-slate-800">{selectedType.engineHash}</span>
              </div>
              <div>
                <strong>Estado de soporte:</strong>{' '}
                <span className="font-semibold text-slate-800">
                  {selectedType.supportStatus}
                </span>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* Modal: Register New Technical OutputType */}
      {showNewTypeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-4 py-3 bg-[#0F1F38] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Registrar Tipo de Salida Reutilizable</h3>
              <button
                type="button"
                onClick={() => setShowNewTypeModal(false)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <form onSubmit={handleCreateOutputType} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Código *</label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Familia *</label>
                  <select
                    value={newFamily}
                    onChange={(e) => setNewFamily(e.target.value as TechnicalFamily)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="CSV">CSV</option>
                    <option value="TXT">TXT</option>
                    <option value="XML">XML</option>
                    <option value="AVRO">AVRO</option>
                    <option value="XBRL">XBRL</option>
                    <option value="PDF">PDF</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoría *</label>
                  <select
                    value={newCategory}
                    onChange={(e) =>
                      setNewCategory(e.target.value as OutputType['category'])
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="Estructurado plano">Estructurado plano</option>
                    <option value="Jerárquico">Jerárquico</option>
                    <option value="Binario serializado">Binario serializado</option>
                    <option value="Taxonómico">Taxonómico</option>
                    <option value="Documental">Documental</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewTypeModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-[#1E4E8C] text-white font-semibold hover:bg-[#163A69] cursor-pointer"
                >
                  Guardar Tipo de Salida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
