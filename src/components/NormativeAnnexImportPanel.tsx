import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import {
  ACCEPTED_ANNEX_INPUT_ATTR,
  AppliedAnnexInterpretationResult,
  NormativeAnnexInterpretation,
  buildConfiguredOutputFromInterpretation,
  validateAnnexUploadFile,
} from '../domain/annexInterpreterTypes';
import { OutputType, RegulatoryFormat } from '../domain/types';
import { TotaliaBrandLockup } from './TotalReportLogo';

interface NormativeAnnexImportPanelProps {
  outputTypes: OutputType[];
  regulatoryFormats: RegulatoryFormat[];
  existingCodes: string[];
  responsibleUser: string;
  defaultContractId?: string;
  defaultChannelId?: string;
  fallbackJurisdiction?: string;
  fallbackRegulator?: string;
  onApplyInterpretation: (
    interpretation: NormativeAnnexInterpretation,
    applied: AppliedAnnexInterpretationResult
  ) => void;
  onClose?: () => void;
  compact?: boolean;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () =>
      reject(new Error('No fue posible leer el archivo seleccionado desde el navegador.'));
    reader.readAsDataURL(file);
  });
}

export const NormativeAnnexImportPanel: React.FC<NormativeAnnexImportPanelProps> = ({
  outputTypes,
  regulatoryFormats,
  existingCodes,
  responsibleUser,
  defaultContractId,
  defaultChannelId,
  fallbackJurisdiction,
  fallbackRegulator,
  onApplyInterpretation,
  onClose,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [userNotes, setUserNotes] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [interpretation, setInterpretation] =
    useState<NormativeAnnexInterpretation | null>(null);

  const previewApplied = useMemo(() => {
    if (!interpretation) return null;
    return buildConfiguredOutputFromInterpretation({
      interpretation,
      outputTypes,
      regulatoryFormats,
      existingCodes,
      responsibleUser,
      defaultContractId,
      defaultChannelId,
      fallbackJurisdiction,
      fallbackRegulator,
    });
  }, [
    interpretation,
    outputTypes,
    regulatoryFormats,
    existingCodes,
    responsibleUser,
    defaultContractId,
    defaultChannelId,
    fallbackJurisdiction,
    fallbackRegulator,
  ]);

  const handleSelectFile = (file: File | null | undefined) => {
    if (!file) return;
    setErrorMsg(null);
    const check = validateAnnexUploadFile(file.name, file.type, file.size);
    if (!check.ok) {
      setErrorMsg(check.error || 'Archivo no admitido.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setInterpretation(null);
  };

  const handleAnalyzeWithTotalia = async () => {
    if (!selectedFile) {
      setErrorMsg('Seleccione un anexo normativo antes de iniciar la interpretación.');
      return;
    }
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const base64Data = await readFileAsBase64(selectedFile);
      const response = await fetch('/api/totalia/interpret-annex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          base64Data,
          userNotes: userNotes.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error ||
            'TOTALiA® no pudo interpretar el anexo normativo en este momento.'
        );
      }
      setInterpretation(data as NormativeAnnexInterpretation);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error inesperado al interpretar el anexo normativo.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!interpretation || !previewApplied) return;
    onApplyInterpretation(interpretation, previewApplied);
  };

  const renderFileKindIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />;
    }
    if (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp')
    ) {
      return <ImageIcon className="w-4 h-4 text-sky-700 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-[#1E4E8C] shrink-0" />;
  };

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
      {/* Header with exact Application Logo for TOTALiA® */}
      <div className="px-4 py-3 bg-[#0F1F38] text-white flex items-center justify-between gap-3">
        <TotaliaBrandLockup
          title="Importación de anexo normativo con TOTALiA®"
          subtitle="Cargue PDF, Word (.docx/.doc), Excel (.xlsx/.xls) o imagen para sugerir la estructura completa"
          darkBg
          logoClassName="w-7 h-7 object-contain"
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar importador de anexo normativo"
            className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className={compact ? 'p-4 space-y-4 text-xs' : 'p-5 space-y-4 text-xs'}>
        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleSelectFile(e.dataTransfer.files?.[0]);
          }}
          className={`border-2 border-dashed rounded-md p-4 text-center transition-colors ${
            isDragging
              ? 'border-[#1E4E8C] bg-blue-50/70'
              : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_ANNEX_INPUT_ATTR}
            aria-label="Seleccionar archivo de anexo normativo"
            onChange={(e) => handleSelectFile(e.target.files?.[0])}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center text-[#1E4E8C]">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                Arrastre aquí el anexo normativo o circular técnica
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Formatos admitidos: PDF (.pdf), Word (.docx, .doc), Excel (.xlsx, .xls) e imágenes (.png, .jpg, .webp) · Máx. 15 MB
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-semibold cursor-pointer"
            >
              Seleccionar archivo
            </button>
          </div>
        </div>

        {/* Selected File Bar & Notes */}
        {selectedFile && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                {renderFileKindIcon(selectedFile.name)}
                <span className="font-semibold text-slate-900 truncate">
                  {selectedFile.name}
                </span>
                <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
                  ({Math.max(1, Math.round(selectedFile.size / 1024))} KB)
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setInterpretation(null);
                  setErrorMsg(null);
                }}
                className="text-[11px] text-slate-500 hover:text-rose-700 font-medium cursor-pointer"
              >
                Quitar archivo
              </button>
            </div>

            <div>
              <label
                htmlFor="annex-user-notes"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Contexto adicional para TOTALiA® (opcional)
              </label>
              <input
                id="annex-user-notes"
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Ej. Tomar únicamente la hoja 'Estructura Detalle' o aplicar para bancos en México..."
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#1E4E8C]"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={handleAnalyzeWithTotalia}
                className="px-4 py-2 rounded-md bg-[#1E4E8C] hover:bg-[#163A69] disabled:bg-slate-400 text-white font-semibold flex items-center gap-2 cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Interpretando anexo normativo con TOTALiA®...</span>
                  </>
                ) : interpretation ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Volver a interpretar documento</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-4 h-4" />
                    <span>Interpretar con TOTALiA®</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-md border border-rose-300 bg-rose-50 text-rose-900 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">No se pudo completar la operación</div>
              <p className="text-[11px] mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Interpretation Results */}
        {interpretation && previewApplied && (
          <div className="space-y-4 pt-2 border-t border-slate-200">
            {/* Summary + Metadata */}
            <div className="p-3.5 rounded-md border border-blue-200 bg-blue-50/50 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-[#0F1F38]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Propuesta generada por TOTALiA®</span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  Confianza de lectura: {interpretation.confidenceLevel}
                </span>
              </div>

              <p className="text-slate-700 leading-relaxed">{interpretation.summary}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="bg-white border border-slate-200 rounded p-2">
                  <div className="text-slate-500">Salida y archivo</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {previewApplied.draft.name}
                  </div>
                  <div className="font-mono text-slate-600 mt-0.5">
                    {interpretation.suggestedOutputConfig.recommendedFamily} ·{' '}
                    {previewApplied.draft.composition.encoding} · Delim:{' '}
                    {previewApplied.draft.composition.delimiter}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded p-2">
                  <div className="text-slate-500">País y entidad detectada</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {previewApplied.matchedCountry || 'Por confirmar'}
                  </div>
                  <div className="text-slate-600 mt-0.5 truncate">
                    {interpretation.detectedDocumentMeta.regulatorShortOrName ||
                      'Sin entidad explícita'}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded p-2">
                  <div className="text-slate-500">Formato y periodicidad</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {interpretation.detectedDocumentMeta.formatCode
                      ? `${interpretation.detectedDocumentMeta.formatCode} · `
                      : ''}
                    {interpretation.detectedDocumentMeta.periodicity}
                  </div>
                  <div className="font-mono text-slate-600 mt-0.5 truncate">
                    {previewApplied.draft.composition.fileNamePattern}
                  </div>
                </div>
              </div>
            </div>

            {/* CRITICAL: Explicitly reported UNINTERPRETED / AMBIGUOUS items */}
            <div
              className={`p-3.5 rounded-md border space-y-2 ${
                interpretation.uninterpretedItems.length > 0
                  ? 'border-amber-300 bg-amber-50/70'
                  : 'border-emerald-200 bg-emerald-50/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  {interpretation.uninterpretedItems.length > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  )}
                  <span>
                    {interpretation.uninterpretedItems.length > 0
                      ? `Aspectos no interpretados o pendientes de confirmación (${interpretation.uninterpretedItems.length})`
                      : 'Sin elementos ambiguos detectados en el anexo'}
                  </span>
                </div>
              </div>

              {interpretation.uninterpretedItems.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {interpretation.uninterpretedItems.map((item, idx) => (
                    <div
                      key={`${item.aspect}-${idx}`}
                      className="p-2.5 rounded bg-white border border-amber-200 text-[11px] space-y-0.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{item.aspect}</span>
                        <span className="font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-slate-700">{item.reason}</p>
                      <p className="text-slate-600 font-medium">
                        Acción recomendada: {item.recommendedAction}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-emerald-900">
                  Todos los parámetros de estructura, codificación y tipos de datos se leyeron explícitamente del documento.
                </p>
              )}
            </div>

            {/* Interpreted Fields Table Preview */}
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[11px] font-semibold text-slate-800">
                <span>
                  Estructura de campos sugerida ({previewApplied.draft.fields.length})
                </span>
                <span>
                  Validaciones detectadas: {previewApplied.draft.validationRules.length} ·
                  Formatos coincidentes: {previewApplied.matchedFormats.length}
                </span>
              </div>
              <div className="max-h-52 overflow-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-1.5 px-2.5 font-semibold">#</th>
                      <th className="py-1.5 px-2.5 font-semibold">Campo técnico / Etiqueta</th>
                      <th className="py-1.5 px-2.5 font-semibold">Tipo</th>
                      <th className="py-1.5 px-2.5 font-semibold text-right">Long.</th>
                      <th className="py-1.5 px-2.5 font-semibold">Oblig.</th>
                      <th className="py-1.5 px-2.5 font-semibold">Sustento en anexo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {previewApplied.draft.fields.map((fld, idx) => (
                      <tr key={fld.id}>
                        <td className="py-1.5 px-2.5 font-mono tabular-nums text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <div className="font-semibold text-slate-900">{fld.label}</div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {fld.technicalName}
                          </div>
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-700">
                          {fld.dataType}
                          {fld.scale !== undefined && fld.dataType === 'Decimal'
                            ? ` (${fld.precision || fld.length},${fld.scale})`
                            : ''}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono tabular-nums text-slate-800">
                          {fld.length}
                        </td>
                        <td className="py-1.5 px-2.5">
                          {fld.required ? 'Sí' : 'Opcional'}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-600 max-w-xs truncate">
                          {fld.evidenceSourceRef?.replace(/^TOTALiA® \([^)]+\): /, '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Apply CTA */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-slate-500">
                Podrá ajustar cualquier campo, parámetro técnico o asociación antes de guardar.
              </p>
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Aplicar configuración sugerida</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
