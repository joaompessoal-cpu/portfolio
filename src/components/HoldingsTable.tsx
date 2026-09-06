import React, { useState } from 'react';
import { Holding, AssetType } from '../types';
import { formatCurrency, formatPercent, ASSET_TYPE_COLORS } from '../utils/formatters';
import { Search, Trash2, ArrowUpRight, ArrowDownRight, PlusCircle, Layers, ChevronRight } from 'lucide-react';

interface HoldingsTableProps {
  holdings: Holding[];
  currency: 'EUR' | 'USD';
  secondsSinceUpdate: number;
  onDeleteHolding: (id: string) => void;
  onAddTransactionClick: () => void;
  onSelectHolding: (holding: Holding) => void;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  holdings,
  currency,
  secondsSinceUpdate,
  onDeleteHolding,
  onAddTransactionClick,
  onSelectHolding,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | AssetType>('all');

  const filteredHoldings = holdings.filter((h) => {
    const matchesFilter = selectedFilter === 'all' || h.assetType === selectedFilter;
    const matchesSearch =
      h.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Ativos da Carteira
            </h2>
            <span className="text-xs text-slate-400 font-normal">
              ({filteredHoldings.length})
            </span>
          </div>
        </div>

        {/* Search and Category Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:w-44">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar ativo..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs overflow-x-auto no-scrollbar">
            {(['all', 'etf', 'stock', 'crypto', 'cash'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer text-[11px] uppercase whitespace-nowrap ${
                  selectedFilter === filter
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {filter === 'all' ? 'Todos' : filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredHoldings.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">Nenhum ativo encontrado.</p>
          <button
            onClick={onAddTransactionClick}
            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Adicionar Ativo
          </button>
        </div>
      ) : (
        <>
          {/* MOBILE LIST VIEW (iPhone Safari Touch Friendly) */}
          <div className="block md:hidden divide-y divide-slate-100 -mx-4">
            {filteredHoldings.map((holding) => {
              const totalPositionValue = holding.shares * holding.currentPrice;
              const totalCost = holding.shares * holding.buyPrice;
              const totalGain = totalPositionValue - totalCost;
              const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
              const isGainPos = totalGain >= 0;

              return (
                <div
                  key={holding.id}
                  onClick={() => onSelectHolding(holding)}
                  className="px-4 py-3 active:bg-slate-50 flex items-center justify-between gap-3 transition-colors cursor-pointer touch-manipulation"
                >
                  {/* Left: Ticker & Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 text-slate-800 border"
                      style={{
                        backgroundColor: '#f1f5f9',
                        borderColor: ASSET_TYPE_COLORS[holding.assetType] || '#cbd5e1',
                      }}
                    >
                      {holding.ticker.slice(0, 4)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {holding.ticker}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {holding.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {holding.shares} unid. • Preço: {formatCurrency(holding.currentPrice, currency)}
                      </div>
                    </div>
                  </div>

                  {/* Right: Value & Return */}
                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 font-mono">
                        {formatCurrency(totalPositionValue, currency)}
                      </div>
                      <div
                        className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${
                          isGainPos ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isGainPos ? '+' : ''}
                        {formatPercent(totalGainPercent)}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block overflow-x-auto flex-1 -mx-6 px-6">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-3 px-2">Ativo</th>
                  <th className="py-3 px-2 text-right">Qtd</th>
                  <th className="py-3 px-2 text-right">Custo Médio</th>
                  <th className="py-3 px-2 text-right">Cotação Atual</th>
                  <th className="py-3 px-2 text-right">Rendimento Total</th>
                  <th className="py-3 px-2 text-right">Variação 24h</th>
                  <th className="py-3 px-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHoldings.map((holding) => {
                  const totalPositionValue = holding.shares * holding.currentPrice;
                  const totalCost = holding.shares * holding.buyPrice;
                  const totalGain = totalPositionValue - totalCost;
                  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
                  const isGainPos = totalGain >= 0;
                  const is24hPos = holding.change24hPercent >= 0;

                  return (
                    <tr
                      key={holding.id}
                      onClick={() => onSelectHolding(holding)}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      title={`Clique para abrir detalhes e gráfico de ${holding.ticker}`}
                    >
                      {/* Ticker & Name */}
                      <td className="py-3.5 px-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="px-2 py-1 rounded-md text-xs font-mono font-bold tracking-tight text-slate-800 border"
                            style={{
                              backgroundColor: '#f8fafc',
                              borderColor: ASSET_TYPE_COLORS[holding.assetType] || '#94a3b8',
                              borderLeftWidth: '3px',
                            }}
                          >
                            {holding.ticker}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {holding.name}
                            </div>
                            <div className="text-[11px] text-slate-400 capitalize flex items-center gap-1">
                              <span>{holding.assetType}</span>
                              <span>•</span>
                              <span className="font-mono text-slate-600 font-medium">
                                {formatCurrency(totalPositionValue, currency)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Shares */}
                      <td className="py-3.5 px-2 text-right font-mono text-xs text-slate-700">
                        {holding.shares.toLocaleString('de-DE', { maximumFractionDigits: 4 })}
                      </td>

                      {/* Buy Price */}
                      <td className="py-3.5 px-2 text-right font-mono text-xs text-slate-600">
                        {formatCurrency(holding.buyPrice, currency)}
                      </td>

                      {/* Current Price */}
                      <td className="py-3.5 px-2 text-right font-mono text-xs font-bold text-slate-900">
                        {formatCurrency(holding.currentPrice, currency)}
                      </td>

                      {/* Total Return */}
                      <td className="py-3.5 px-2 text-right">
                        <div className={`text-xs font-bold font-mono ${isGainPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isGainPos ? '+' : ''}{formatCurrency(totalGain, currency)}
                        </div>
                        <div className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${isGainPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isGainPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {formatPercent(totalGainPercent)}
                        </div>
                      </td>

                      {/* 24h Change */}
                      <td className="py-3.5 px-2 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                            is24hPos
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-rose-50 text-rose-600 border border-rose-200'
                          }`}
                        >
                          {formatPercent(holding.change24hPercent)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onDeleteHolding(holding.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remover ativo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Footer Info & Action */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>{holdings.length} posições no portfólio</span>
        <button
          onClick={onAddTransactionClick}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" /> Adicionar Ativo
        </button>
      </div>
    </div>
  );
};
