import React, { useState, useRef } from 'react';
import { FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { parsePortfolioFile, downloadSamplePortfolioFile, ParseResult } from '../services/excelParser';
import { Holding } from '../types';

interface ExcelImportZoneProps {
  onImportSuccess: (importedHoldings: Holding[], mode: 'replace' | 'merge') => void;
  baseCurrency: 'EUR' | 'USD';
}

export const ExcelImportZone: React.FC<ExcelImportZoneProps> = ({
  onImportSuccess,
  baseCurrency,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = async (file: File) => {
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      setToastMessage({
        type: 'error',
        text: 'Formato não suportado. Por favor, envie um ficheiro .xlsx, .xls ou .csv.',
      });
      return;
    }

    setIsProcessing(true);
    setToastMessage(null);

    try {
      const result: ParseResult = await parsePortfolioFile(file, baseCurrency);

      if (result.success && result.holdings.length > 0) {
        onImportSuccess(result.holdings, importMode);
        setToastMessage({
          type: 'success',
          text: `Sucesso! ${result.aggregatedCount} posições consolidadas a partir de ${result.totalRowsProcessed} linhas.`,
        });
      } else {
        setToastMessage({
          type: 'error',
          text: result.errorMessage || 'Não foi possível extrair posições válidas deste ficheiro.',
        });
      }
    } catch (err: any) {
      setToastMessage({
        type: 'error',
        text: `Erro na leitura: ${err?.message || 'Ficheiro corrompido ou ilegível'}`,
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Accordion Toggle Bar */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer text-left touch-manipulation"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800">
              Importar Portfólio (Excel / XTB / Getquin)
            </span>
            <span className="text-[11px] text-slate-400 block sm:inline sm:ml-2">
              Suporta ficheiros .xlsx, .xls e .csv
            </span>
          </div>
        </div>
        <div className="text-slate-400 p-1">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="p-4 pt-1 border-t border-slate-100 flex flex-col gap-3">
          {/* Toast feedback */}
          {toastMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {toastMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{toastMessage.text}</span>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Mode Selector */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  importMode === 'replace'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Substituir Carteira
              </button>
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  importMode === 'merge'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Combinar Posições
              </button>
            </div>

            <button
              onClick={downloadSamplePortfolioFile}
              className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" /> Modelo Excel
            </button>
          </div>

          {/* Drag and drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-800">
                {isProcessing ? 'A processar ficheiro...' : 'Toque para selecionar ou arraste o ficheiro aqui'}
              </p>
              <p className="text-[11px] text-slate-400">
                Ficheiros exportados do Getquin ou XTB são detetados automaticamente
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
