import { AssetType, Holding } from '../types';

declare global {
  interface Window {
    XLSX: any;
  }
}

export interface ParseResult {
  success: boolean;
  holdings: Holding[];
  totalRowsProcessed: number;
  aggregatedCount: number;
  detectedSheetName?: string;
  errorMessage?: string;
}

// Valid market exchange suffixes commonly found in European & Global brokers (XTB, DEGIRO, IBKR)
export const VALID_MARKET_SUFFIXES = [
  '.DE', '.US', '.UK', '.LS', '.AS', '.PA', '.MI', '.MC', '.L', '.LN',
  '.TO', '.V', '.AX', '.HK', '.SW', '.BR', '.CO', '.ST', '.F', '.BE',
  '.HE', '.VI', '.IR', '.WA', '.PR', '.MX', '.SA', '-USD', '-EUR'
];

/**
 * Checks if a string consists entirely of digits or numeric transaction/ticket IDs
 * (e.g. "2729646008" or "100234")
 */
export function isNumericString(val: any): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim().replace(/[\s,\.\-_]/g, '');
  if (!str) return false;
  return /^\d+$/.test(str) || /^\d+e\+\d+$/i.test(String(val).trim());
}

/**
 * Validates whether a row is a genuine consolidated position row and NOT a sub-order or ticket ID
 */
export function isValidMainPositionRow(rawTicker: any, rawInstrument: any): boolean {
  const ticker = String(rawTicker || '').trim().toUpperCase();
  const instrument = String(rawInstrument || '').trim().toUpperCase();

  // 1. If ticker is empty, reject
  if (!ticker) return false;

  // 2. Reject if ticker is purely numeric (e.g. order ticket ID "2729646008")
  if (isNumericString(ticker)) return false;

  // 3. Reject if instrument/position is purely numeric
  if (isNumericString(instrument)) return false;

  // 4. Must contain at least one uppercase letter [A-Z]
  if (!/[A-Z]/.test(ticker)) return false;

  // 5. Valid if ends with a market suffix (.DE, .US, .UK, .LS, etc.)
  const hasMarketSuffix = VALID_MARKET_SUFFIXES.some((suffix) => ticker.endsWith(suffix));
  if (hasMarketSuffix) {
    return true;
  }

  // 6. Otherwise, check for standard valid textual tickers (e.g. AAPL, VOO, BTC-USD)
  const isStandardTicker = /^[A-Z0-9.\-_]{1,12}$/.test(ticker) && ticker.length >= 2;
  const isIgnoredKeyword = [
    'TOTAL', 'SUM', 'SUBTOTAL', 'ACCOUNT', 'GERAL', 'RESUMO', 'ORDEM',
    'ORDER', 'POSITION', 'POSICAO', 'INSTRUMENT', 'INSTRUMENTO', 'TICKER',
    'BUY', 'SELL', 'OPEN', 'CLOSE', 'CLOSED', 'PROFIT', 'LOSS', 'BALANCE'
  ].includes(ticker);

  if (isStandardTicker && !isIgnoredKeyword) {
    return true;
  }

  return false;
}

/**
 * Normalizes text removing accents, punctuation and excess whitespace
 */
function normalizeHeader(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Robust financial number parser supporting both EU (1.250,50) and US (1,250.50) formats,
 * currency symbols (€, $, USD, EUR), spaces and brackets for negative numbers.
 */
export function parseFinancialNumber(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (!val) return 0;

  let str = val.toString().trim();

  // Detect negative in parentheses: (123.45)
  const isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));

  // Strip all non-numeric characters except comma, dot, and minus
  str = str.replace(/[^0-9,.-]/g, '');

  // Handle both comma and dot cases
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  if (lastComma > lastDot) {
    // European style: dots as thousand separators, comma as decimal (e.g. 1.250,50)
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // US style: commas as thousand separators, dot as decimal (e.g. 1,250.50)
    str = str.replace(/,/g, '');
  } else if (lastComma !== -1 && lastDot === -1) {
    // Only comma present, e.g. 125,50
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
}

/**
 * Auto-detects asset category (etf, stock, crypto, cash)
 */
function detectAssetType(rawType: string, ticker: string, name: string): AssetType {
  const combined = `${rawType} ${ticker} ${name}`.toLowerCase();

  if (combined.includes('crypto') || combined.includes('btc') || combined.includes('eth') || combined.includes('sol') || ticker.includes('-USD')) {
    return 'crypto';
  }
  if (combined.includes('cash') || combined.includes('caixa') || combined.includes('eur-cash') || combined.includes('deposit') || combined.includes('fiat')) {
    return 'cash';
  }
  if (combined.includes('etf') || combined.includes('vanguard') || combined.includes('ishares') || combined.includes('invesco') || combined.includes('s&p 500') || combined.includes('ftse') || ticker.includes('VOO') || ticker.includes('VWCE') || ticker.includes('SPY')) {
    return 'etf';
  }
  return 'stock';
}

/**
 * Detects currency from text or raw values
 */
function detectCurrency(rowStr: string, defaultCurrency: 'EUR' | 'USD' = 'EUR'): 'EUR' | 'USD' {
  const upper = rowStr.toUpperCase();
  if (upper.includes('$') || upper.includes('USD')) {
    return 'USD';
  }
  if (upper.includes('€') || upper.includes('EUR')) {
    return 'EUR';
  }
  return defaultCurrency;
}

/**
 * Parses an Excel or CSV file buffer/array using SheetJS
 */
export async function parsePortfolioFile(file: File, baseCurrency: 'EUR' | 'USD' = 'EUR'): Promise<ParseResult> {
  const XLSX = window.XLSX;
  if (!XLSX) {
    return {
      success: false,
      holdings: [],
      totalRowsProcessed: 0,
      aggregatedCount: 0,
      errorMessage: 'Biblioteca SheetJS (XLSX) não encontrada. Verifique a ligação à internet.',
    };
  }

  try {
    const dataBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(dataBuffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        holdings: [],
        totalRowsProcessed: 0,
        aggregatedCount: 0,
        errorMessage: 'O ficheiro não contém nenhuma folha de cálculo legível.',
      };
    }

    // 1. Sheet Selection: prioritize "Open Positions" or "Posições Abertas"
    let targetSheetName = workbook.SheetNames[0];
    const preferredSheets = ['open positions', 'posicoes abertas', 'posições abertas', 'holdings', 'portfolio', 'ativos'];

    for (const sheet of workbook.SheetNames) {
      const normalized = sheet.toLowerCase().trim();
      if (preferredSheets.some(p => normalized.includes(p))) {
        targetSheetName = sheet;
        break;
      }
    }

    const worksheet = workbook.Sheets[targetSheetName];
    if (!worksheet) {
      return {
        success: false,
        holdings: [],
        totalRowsProcessed: 0,
        aggregatedCount: 0,
        errorMessage: `Não foi possível abrir a folha "${targetSheetName}".`,
      };
    }

    // Convert sheet to 2D array of rows
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return {
        success: false,
        holdings: [],
        totalRowsProcessed: 0,
        aggregatedCount: 0,
        errorMessage: 'A folha selecionada está vazia.',
      };
    }

    // 2. Identify the Header Row dynamically
    let headerRowIndex = -1;
    let colIndices = {
      ticker: -1,
      name: -1,
      quantity: -1,
      buyPrice: -1,
      type: -1,
      currency: -1,
      date: -1,
    };

    // Strict keyword separation: do not allow 'position' to match quantity, and prioritize explicit 'ticker'
    const tickerKeywords = ['ticker', 'symbol', 'simbolo', 'codnegociacao', 'codativo'];
    const nameKeywords = ['instrumentposition', 'instrument/position', 'instrument', 'positionname', 'name', 'nome', 'descricao', 'description', 'assetname', 'empresa'];
    const quantityKeywords = ['volume', 'quantity', 'shares', 'units', 'quantidade', 'qtd', 'cotas'];
    const priceKeywords = ['openprice', 'averageprice', 'avgprice', 'buyprice', 'costbasis', 'precomedio', 'precodeabertura', 'precomediodeabertura', 'precocompra', 'costprice'];
    const typeKeywords = ['category', 'type', 'tipo', 'classe', 'assettype', 'assetclass'];
    const currencyKeywords = ['currency', 'moeda', 'curr'];
    const dateKeywords = ['opentime', 'dataabertura', 'tempodeabertura', 'tempoabertura', 'datadeabertura', 'datahora', 'date', 'data', 'time', 'opened', 'horario', 'timestamp', 'tradedate', 'dataoperacao', 'datacompra', 'compra', 'open', 'orderdate'];

    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      const normalizedRow = row.map(cell => normalizeHeader(String(cell || '')));

      let foundTicker = -1;
      let foundQty = -1;
      let foundPrice = -1;

      normalizedRow.forEach((norm, c) => {
        if (!norm) return;
        if (tickerKeywords.some(k => norm.includes(k))) foundTicker = c;
        if (quantityKeywords.some(k => norm.includes(k))) foundQty = c;
        if (priceKeywords.some(k => norm.includes(k))) foundPrice = c;
      });

      // Valid header row if has at least ticker and (quantity or price)
      if (foundTicker !== -1 && (foundQty !== -1 || foundPrice !== -1)) {
        headerRowIndex = r;
        normalizedRow.forEach((norm, c) => {
          if (tickerKeywords.some(k => norm.includes(k)) && colIndices.ticker === -1) colIndices.ticker = c;
          if (nameKeywords.some(k => norm.includes(k)) && colIndices.name === -1) colIndices.name = c;
          if (quantityKeywords.some(k => norm.includes(k)) && colIndices.quantity === -1) colIndices.quantity = c;
          if (priceKeywords.some(k => norm.includes(k)) && colIndices.buyPrice === -1) colIndices.buyPrice = c;
          if (typeKeywords.some(k => norm.includes(k)) && colIndices.type === -1) colIndices.type = c;
          if (currencyKeywords.some(k => norm.includes(k)) && colIndices.currency === -1) colIndices.currency = c;
          if (dateKeywords.some(k => norm.includes(k)) && colIndices.date === -1) colIndices.date = c;
        });
        break;
      }
    }

    // Fallback if 'ticker' header wasn't found under strict ticker keywords: check if 'instrument' column contains ticker values
    if (headerRowIndex === -1 || colIndices.ticker === -1) {
      for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;
        const normalizedRow = row.map(cell => normalizeHeader(String(cell || '')));
        let foundCol = -1;
        let foundQty = -1;
        let foundPrice = -1;

        normalizedRow.forEach((norm, c) => {
          if (!norm) return;
          if (['instrument', 'instrumento', 'ativo', 'code', 'codigo'].some(k => norm.includes(k))) foundCol = c;
          if (quantityKeywords.some(k => norm.includes(k))) foundQty = c;
          if (priceKeywords.some(k => norm.includes(k))) foundPrice = c;
        });

        if (foundCol !== -1 && (foundQty !== -1 || foundPrice !== -1)) {
          headerRowIndex = r;
          colIndices.ticker = foundCol;
          colIndices.quantity = foundQty;
          colIndices.buyPrice = foundPrice;
          normalizedRow.forEach((norm, c) => {
            if (nameKeywords.some(k => norm.includes(k)) && c !== foundCol && colIndices.name === -1) colIndices.name = c;
            if (typeKeywords.some(k => norm.includes(k)) && colIndices.type === -1) colIndices.type = c;
            if (currencyKeywords.some(k => norm.includes(k)) && colIndices.currency === -1) colIndices.currency = c;
            if (dateKeywords.some(k => norm.includes(k)) && colIndices.date === -1) colIndices.date = c;
          });
          break;
        }
      }
    }


    if (headerRowIndex === -1 || colIndices.ticker === -1) {
      return {
        success: false,
        holdings: [],
        totalRowsProcessed: 0,
        aggregatedCount: 0,
        errorMessage: 'Não foram encontradas colunas de cabeçalho reconhecíveis (ex: Ticker, Volume, Preço Médio/Open Price).',
      };
    }

    // 3. Process Data Rows & Strict Filtering of Main Open Positions
    const aggregatedMap = new Map<string, {
      ticker: string;
      name: string;
      totalShares: number;
      totalCostBasis: number; // sum of (shares * price)
      rawType: string;
      currency: 'EUR' | 'USD';
      purchaseDate?: string;
    }>();

    let validRowsCount = 0;

    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawTicker = colIndices.ticker !== -1 ? row[colIndices.ticker] : '';
      const rawName = colIndices.name !== -1 ? row[colIndices.name] : '';

      // STRICT VALIDATION:
      // 1. Only import rows where Ticker ends with a valid market suffix (.DE, .US, .UK, .LS)
      //    OR is a valid text ticker symbol.
      // 2. Ignore any sub-order or ticket rows where Instrument/Position or Ticker is an ID number (e.g. 2729646008).
      if (!isValidMainPositionRow(rawTicker, rawName)) {
        continue;
      }

      const tickerStr = String(rawTicker).trim().toUpperCase();

      // Read Volume / Shares
      const rawQty = colIndices.quantity !== -1 ? row[colIndices.quantity] : 1;
      const shares = parseFinancialNumber(rawQty);
      if (shares <= 0) continue;

      // Read Open price / Average Buy Price
      const rawPrice = colIndices.buyPrice !== -1 ? row[colIndices.buyPrice] : 0;
      const buyPrice = Math.max(0.0001, parseFinancialNumber(rawPrice));

      // Read Instrument/Position Name from the main row (e.g. "Core S&P 500", "Alphabet", "Centrus Energy")
      const instrumentName = String(rawName || '').trim();
      const cleanName = instrumentName && !isNumericString(instrumentName) ? instrumentName : tickerStr;

      const rawType = colIndices.type !== -1 ? String(row[colIndices.type] || '').trim() : '';
      const rowText = row.join(' ');
      
      // Extract original purchase date/time from report
      let rowDateStr = '';
      const parseDateFromCell = (val: any): string => {
        if (!val) return '';
        if (val instanceof Date) {
          try {
            return val.toISOString().split('T')[0];
          } catch {
            return '';
          }
        }
        if (typeof val === 'number' && val > 25000 && val < 90000) {
          // Excel serial date code
          try {
            const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
            return dateObj.toISOString().split('T')[0];
          } catch {
            return '';
          }
        }
        const str = String(val).trim();
        // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        const dmy = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
        if (dmy) {
          const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
          return `${yr}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
        }
        // Match YYYY-MM-DD or YYYY/MM/DD
        const ymd = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
        if (ymd) {
          return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
        }
        return '';
      };

      if (colIndices.date !== -1 && row[colIndices.date]) {
        rowDateStr = parseDateFromCell(row[colIndices.date]);
      }

      // Fallback: if no date found yet, check other cells in row for a date format
      if (!rowDateStr) {
        for (let c = 0; c < row.length; c++) {
          if (c === colIndices.ticker || c === colIndices.name || c === colIndices.quantity || c === colIndices.buyPrice) {
            continue;
          }
          const dFound = parseDateFromCell(row[c]);
          if (dFound) {
            rowDateStr = dFound;
            break;
          }
        }
      }

      // Detect currency (prioritize USD for .US tickers, EUR for .DE / .LS)
      let currency = detectCurrency(rowText, baseCurrency);
      if (tickerStr.endsWith('.US')) {
        currency = 'USD';
      } else if (tickerStr.endsWith('.DE') || tickerStr.endsWith('.LS') || tickerStr.endsWith('.PA') || tickerStr.endsWith('.AS') || tickerStr.endsWith('.MI')) {
        currency = 'EUR';
      }

      validRowsCount++;

      // Aggregate if duplicate ticker exists in report
      const existing = aggregatedMap.get(tickerStr);
      if (existing) {
        existing.totalShares += shares;
        existing.totalCostBasis += (shares * buyPrice);
        if ((!existing.name || isNumericString(existing.name)) && cleanName) {
          existing.name = cleanName;
        }
        if (!existing.purchaseDate && rowDateStr) {
          existing.purchaseDate = rowDateStr;
        }
      } else {
        aggregatedMap.set(tickerStr, {
          ticker: tickerStr,
          name: cleanName,
          totalShares: shares,
          totalCostBasis: shares * buyPrice,
          rawType,
          currency,
          purchaseDate: rowDateStr,
        });
      }
    }

    if (aggregatedMap.size === 0) {
      return {
        success: false,
        holdings: [],
        totalRowsProcessed: validRowsCount,
        aggregatedCount: 0,
        errorMessage: 'Nenhuma posição com ticker válido e quantidade superior a 0 foi encontrada.',
      };
    }

    // Convert to Holding objects
    const resultHoldings: Holding[] = [];
    aggregatedMap.forEach((val) => {
      const avgPrice = val.totalShares > 0 ? (val.totalCostBasis / val.totalShares) : 0;
      const assetType = detectAssetType(val.rawType, val.ticker, val.name);

      resultHoldings.push({
        id: `imported_${val.ticker}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticker: val.ticker,
        name: val.name || val.ticker,
        shares: +val.totalShares.toFixed(4),
        buyPrice: +avgPrice.toFixed(2),
        currentPrice: +avgPrice.toFixed(2), // Initialized at cost, immediately updated by live quote engine
        change24h: 0,
        change24hPercent: 0,
        assetType,
        currency: val.currency,
        purchaseDate: val.purchaseDate || new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString(),
      });
    });


    return {
      success: true,
      holdings: resultHoldings,
      totalRowsProcessed: validRowsCount,
      aggregatedCount: resultHoldings.length,
      detectedSheetName: targetSheetName,
    };
  } catch (err: any) {
    console.error('Error parsing portfolio file:', err);
    return {
      success: false,
      holdings: [],
      totalRowsProcessed: 0,
      aggregatedCount: 0,
      errorMessage: `Erro ao processar o ficheiro: ${err?.message || 'Formato não suportado'}`,
    };
  }
}

/**
 * Generates and triggers download of a ready-to-use CSV template for brokers / getquin imports
 */
export function downloadSamplePortfolioFile(format: 'csv' | 'xlsx' = 'csv') {
  const sampleData = [
    ['Instrument/Position', 'Ticker', 'Volume', 'Open price', 'Category'],
    ['Core S&P 500', 'SXR8.DE', '0.5505', '704.93', 'ETF'],
    ['Alphabet Inc.', 'GOOGL.US', '0.1316', '340.11', 'STOCK'],
    ['Centrus Energy', 'LEU.US', '2.5000', '78.50', 'STOCK'],
    ['Apple Inc.', 'AAPL.US', '1.2000', '225.40', 'STOCK'],
  ];

  if (format === 'csv') {
    const csvContent = sampleData.map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_portfólio_getquin.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else if (window.XLSX) {
    const XLSX = window.XLSX;
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Open Positions');
    XLSX.writeFile(wb, 'modelo_portfólio_getquin.xlsx');
  }
}
