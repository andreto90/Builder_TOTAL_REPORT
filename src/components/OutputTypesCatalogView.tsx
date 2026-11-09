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
  Save,
  Sliders,
} from 'lucide-react';
import { useConfigurator } from '../context/ConfiguratorContext';
import { OutputType, TechnicalFamily } from '../domain/types';
import { HelpTooltip } from './HelpTooltip';

export const OutputTypesCatalogView: React.FC = () => {
  const {
    outputTypes,
    configuredOutputs,
    saveOutputType,
    openOutputInBuilder,
    activeUserRole,
  } = useConfigurator();

  const [selectedTypeId, setSelectedTypeId] = useState<string>(outputTypes[0]?.id || 'TYPE-CSV-01');
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
      mimeType:
        newFamily === 'CSV'
          ? 'text/csv;charset=utf-8'
          : newFamily === 'XML' || newFamily === 'XBRL'
          ? 'application/xml;charset=utf-8'
          : 'text/plain;charset=utf-8',
      serializationEngine: `Motor ${newFamily} Estándar`,
      engineVersion: 'v1.0.0',
      engineHash: `SHA256:${Date.now().toString(16).toUpperCase()}`,
      characterEncoding: newFamily === 'AVRO' ? 'Binario' : 'UTF-8',
      supportStatus:
        newFamily === 'XLSX'
          ? 'Candidata por certificar'
          : isReal
          ? 'Instalada y certificada'
          : 'Simulada conceptual',
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
      status: newFamily === 'XLSX' ? 'En evaluación' : 'Activo',
      version: '1.0',
      updatedAt: new Date().toISOString().slice(0, 10),
      updatedBy: activeUserRole,
    };

    saveOutputType(created);
    setSelectedTypeId(created.id);
    setShowNewTypeModal(false);
  };

  const handleUpdateSelectedType = (updater: (current: OutputType) => OutputType) => {
    const next = updater(selectedType);
    saveOutputType(next);
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
          <h1 className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
            <span>Tipos de Archivo Soportados (Capacidades Reutilizables)</span>
            <HelpTooltip
              title="¿Qué es un Tipo de Salida?"
              description="Es la capacidad técnica reutilizable que define cómo se construye una familia de archivo (CSV, TXT, XML, AVRO, XBRL, PDF o XLSX). Varias salidas regulatorias comparten un mismo Tipo de Salida sin necesidad de programar un adaptador nuevo por cada formato."
            />
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Administra los parámetros base de serialización para CSV, TXT, XML, AVRO, XBRL, PDF y XLSX. Distingue qué formatos generan archivos físicos descargables en el navegador y cuáles ejecutan validación de esquema para generación en servidor.
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
                        : ot.supportStatus === 'Candidata por certificar'
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {hasPhysicalGenerator
                      ? 'Generador de archivo activo'
                      : ot.supportStatus === 'Candidata por certificar'
                      ? 'Candidato en evaluación'
                      : 'Validación de esquema (Servidor)'}
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
                  Generación y descarga real disponible en navegador
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-950 text-xs font-semibold">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  Solo validación de esquema en navegador (Binario en servidor)
                </span>
              )}
            </div>
          </div>

          {/* Functional Capabilities Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1">
              <span>Alcance operativo real en esta versión</span>
              <HelpTooltip
                title="Alcance de ejecución por tipo de archivo"
                description="Indica con transparencia qué parte del proceso se ejecuta directamente en el navegador y qué parte requiere el Worker de servidor en un despliegue productivo."
              />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] font-semibold text-slate-500 flex items-center">
                  Codificación predeterminada
                  <HelpTooltip
                    title="Codificación de caracteres"
                    description="UTF-8 soporta tildes y caracteres multibyte (Ñ). ISO-8859-1 emplea 1 byte por carácter latino. Binario aplica a contenedores serializados como Avro OCF."
                  />
                </div>
                <div className="mt-1">
                  <select
                    aria-label="Codificación predeterminada del tipo de salida"
                    value={selectedType.characterEncoding}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        characterEncoding: e.target.value as OutputType['characterEncoding'],
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono font-bold text-slate-900"
                  >
                    <option value="UTF-8">UTF-8</option>
                    <option value="UTF-8 con BOM">UTF-8 con BOM</option>
                    <option value="ISO-8859-1">ISO-8859-1 (Latin-1)</option>
                    <option value="ASCII">ASCII</option>
                    <option value="Binario">Binario</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] font-semibold text-slate-500">
                  Extensión y tipo MIME
                </div>
                <div className="font-mono font-bold text-slate-900 mt-1.5">
                  {selectedType.extension} ({selectedType.mimeType})
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] font-semibold text-slate-500">
                  Validación ejecutada en navegador
                </div>
                <div className="font-semibold text-slate-900 mt-1">
                  {selectedType.family === 'XML'
                    ? 'Estructura XML bien formada, atributos, tipos y reglas (XSD externo en servidor)'
                    : selectedType.family === 'TXT'
                    ? 'Posiciones sin solapamientos ni huecos, longitud en caracteres/bytes y reglas'
                    : selectedType.family === 'CSV'
                    ? 'Escapado RFC 4180, tipos, longitudes, separador decimal y reglas'
                    : `Validación de esquema lógico ${selectedType.family}, tipos y reglas`}
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] font-semibold text-slate-500">
                  Descarga de archivo físico de prueba
                </div>
                <div className="font-semibold text-slate-900 mt-1">
                  {selectedType.canGenerateRealFileInBrowser
                    ? `Habilitada — Descarga directa de archivo ${selectedType.extension}`
                    : `No disponible en navegador — Requiere ${selectedType.serializationEngine} en servidor`}
                </div>
              </div>
            </div>
          </div>

          {/* Family-Specific Configurable Parameters */}
          <div className="p-3.5 rounded border border-blue-200 bg-blue-50/40 space-y-3 text-xs">
            <div className="font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#1E4E8C]" />
                Parámetros técnicos predeterminados de la familia {selectedType.family}
              </span>
              <span className="text-[11px] text-[#1E4E8C] font-normal">
                Se heredan al crear nuevas salidas de este tipo
              </span>
            </div>

            {selectedType.family === 'CSV' && selectedType.csvParams && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Delimitador por defecto
                  </label>
                  <select
                    value={selectedType.csvParams.delimiter}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        csvParams: {
                          ...curr.csvParams!,
                          delimiter: e.target.value as ';' | ',' | '|' | '\t',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                  >
                    <option value=";">Punto y coma (;)</option>
                    <option value=",">Coma (,)</option>
                    <option value="|">Barra vertical (|)</option>
                    <option value={'\t'}>Tabulador (TAB)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Carácter de comillas
                  </label>
                  <select
                    value={selectedType.csvParams.quoteChar}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        csvParams: {
                          ...curr.csvParams!,
                          quoteChar: e.target.value as '"' | "'" | 'Ninguno',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                  >
                    <option value={'"'}>Comilla doble (&quot;)</option>
                    <option value={"'"}>Comilla simple (&apos;)</option>
                    <option value="Ninguno">Sin comillas</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fin de línea
                  </label>
                  <select
                    value={selectedType.csvParams.lineEnding}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        csvParams: {
                          ...curr.csvParams!,
                          lineEnding: e.target.value as 'CRLF' | 'LF',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                  >
                    <option value="CRLF">CRLF (Windows \r\n)</option>
                    <option value="LF">LF (Unix \n)</option>
                  </select>
                </div>
              </div>
            )}

            {selectedType.family === 'TXT' && selectedType.txtParams && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Modo posicional
                  </label>
                  <select
                    value={selectedType.txtParams.mode}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        txtParams: {
                          ...curr.txtParams!,
                          mode: e.target.value as 'Ancho fijo' | 'Delimitado' | 'Múltiples tipos de registro',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    <option value="Ancho fijo">Ancho fijo</option>
                    <option value="Delimitado">Delimitado</option>
                    <option value="Múltiples tipos de registro">Múltiples tipos de registro</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center">
                    Unidad de posición/longitud
                    <HelpTooltip
                      title="Caracteres vs Bytes UTF-8"
                      description="Define si las posiciones de columna se cuentan por caracteres visibles o por bytes UTF-8 (donde letras como Ñ o tildes ocupan 2 bytes)."
                    />
                  </label>
                  <select
                    value={selectedType.txtParams.lengthUnit}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        txtParams: {
                          ...curr.txtParams!,
                          lengthUnit: e.target.value as 'Caracteres' | 'Bytes',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    <option value="Caracteres">Caracteres</option>
                    <option value="Bytes">Bytes (UTF-8)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Relleno predeterminado
                  </label>
                  <select
                    value={selectedType.txtParams.defaultPaddingChar}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        txtParams: {
                          ...curr.txtParams!,
                          defaultPaddingChar: e.target.value as ' ' | '0',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                  >
                    <option value=" ">Espacio (&apos; &apos;)</option>
                    <option value="0">Cero (&apos;0&apos;)</option>
                  </select>
                </div>
              </div>
            )}

            {selectedType.family === 'XML' && selectedType.xmlParams && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Elemento raíz XML
                  </label>
                  <input
                    type="text"
                    value={selectedType.xmlParams.rootElement}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        xmlParams: {
                          ...curr.xmlParams!,
                          rootElement: e.target.value,
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Referencia esquema XSD
                  </label>
                  <input
                    type="text"
                    value={selectedType.xmlParams.xsdSchemaRef}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        xmlParams: {
                          ...curr.xmlParams!,
                          xsdSchemaRef: e.target.value,
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Manejo de nodos vacíos
                  </label>
                  <select
                    value={selectedType.xmlParams.emptyElementHandling}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        xmlParams: {
                          ...curr.xmlParams!,
                          emptyElementHandling: e.target.value as
                            | 'Omitir nodo'
                            | 'Etiqueta vacía'
                            | 'xsi:nil="true"',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    <option value='xsi:nil="true"'>xsi:nil=&quot;true&quot;</option>
                    <option value="Omitir nodo">Omitir nodo</option>
                    <option value="Etiqueta vacía">Etiqueta vacía</option>
                  </select>
                </div>
              </div>
            )}

            {selectedType.family === 'AVRO' && selectedType.avroParams && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Namespace Avro
                  </label>
                  <input
                    type="text"
                    value={selectedType.avroParams.namespace}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        avroParams: {
                          ...curr.avroParams!,
                          namespace: e.target.value,
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Compresión OCF (Codec)
                  </label>
                  <select
                    value={selectedType.avroParams.codec}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        avroParams: {
                          ...curr.avroParams!,
                          codec: e.target.value as 'null' | 'deflate' | 'snappy' | 'zstandard',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                  >
                    <option value="deflate">deflate</option>
                    <option value="snappy">snappy</option>
                    <option value="zstandard">zstandard</option>
                    <option value="null">null (sin compresión)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Compatibilidad de esquema
                  </label>
                  <select
                    value={selectedType.avroParams.schemaCompatibility}
                    onChange={(e) =>
                      handleUpdateSelectedType((curr) => ({
                        ...curr,
                        avroParams: {
                          ...curr.avroParams!,
                          schemaCompatibility: e.target.value as
                            | 'BACKWARD'
                            | 'FORWARD'
                            | 'FULL'
                            | 'NONE',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono"
                  >
                    <option value="BACKWARD">BACKWARD</option>
                    <option value="FORWARD">FORWARD</option>
                    <option value="FULL">FULL</option>
                    <option value="NONE">NONE</option>
                  </select>
                </div>
              </div>
            )}

            {(selectedType.family === 'XBRL' ||
              selectedType.family === 'PDF' ||
              selectedType.family === 'XLSX') && (
              <div className="text-[11px] text-slate-700">
                Los parámetros específicos de esta familia ({selectedType.family}) se configuran en el Paso 1 del Diseñador de salidas al seleccionar una salida de este tipo.
              </div>
            )}
          </div>

          {/* Specific Family Restrictions */}
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
                <strong>Estado de certificación:</strong>{' '}
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
                    <option value="XLSX">XLSX (Candidato)</option>
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#1E4E8C] text-white font-semibold hover:bg-[#163A69] cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
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
