/* Gold Price Analyst — Frontend */

// ── State ─────────────────────────────────────────────────────────
const ALL_HISTORY_DAYS = 10000;
const DEFAULT_RANGE_KEY = '60d';
const RANGE_PRESETS = [
  { key: '1h', label: '1H', days: 1 },
  { key: '1d', label: '1D', days: 1 },
  { key: '1w', label: '1W', days: 7 },
  { key: '1mo', label: '1M', days: 30 },
  { key: '60d', label: '60D', days: 60 },
  { key: '3mo', label: '3M', days: 90 },
  { key: '6mo', label: '6M', days: 180 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: ALL_HISTORY_DAYS },
];
let rangeKey = RANGE_PRESETS.some(p => p.key === localStorage.getItem('gold_range'))
  ? localStorage.getItem('gold_range')
  : DEFAULT_RANGE_KEY;
let days = RANGE_PRESETS.find(p => p.key === rangeKey)?.days || 60;
const loaded = new Set();       // tracks "tab:range" combos already rendered
const _fetch = {};              // deduplicates in-flight / completed fetches
const DEMO_MODE = { enabled: false };
const ALLOW_MOCK_DATA = new URLSearchParams(window.location.search).get('demo') === '1';
const AUTO_REFRESH_MS = 60 * 1000;
let autoRefreshTimer = null;
let midnightRefreshTimer = null;
let currentLang = localStorage.getItem('gold_lang') || 'en';
let activeAnalysis = localStorage.getItem('gold_analysis_view') || 'gold';

const I18N = {
  en: {
    site_title: 'Gold Price Analyst',
    analysis_gold: 'Gold Price Analysis',
    analysis_stock: 'Stock Price Analysis',
    waiting_data: 'Waiting for data',
    current_price: 'Current Price',
    window_change: 'Window Change',
    period_high: 'Period High',
    period_low: 'Period Low',
    market_watch: 'Cross-Market Watch',
    market_watch_title: 'Gold context',
    stock_watch: 'US Stock Watch',
    stock_watch_title: 'CELC · QBTS · OUST · OKLO · TEM',
    stock_price_analysis: 'Stock Price Analysis',
    market_daily: value => `Daily ${value}`,
    market_window_move: value => `${windowLabel()} ${value}`,
    tab_patterns: 'Patterns',
    tab_sentiment: 'Sentiment',
    tab_backtest: 'Backtest',
    tab_markets: 'Markets',
    tab_risk: 'Risk',
    k_line_chart: 'K-line Chart',
    latest_price: 'Latest',
    daily: 'Daily',
    window: 'Window',
    refresh: 'Refresh',
    awaiting_data: 'Awaiting data',
    insufficient_data: 'Insufficient data',
    bollinger_position: 'Bollinger Position',
    ma_trend: 'MA Trend',
    buy_hold: 'Buy & Hold',
    baseline_return: 'Baseline return',
    trend_strategy: 'Trend Strategy',
    mean_reversion: 'Mean Reversion',
    breakout: 'Breakout',
    strategy: 'Strategy',
    total_return: 'Total Return',
    vs_bh: 'Vs B&H',
    max_drawdown: 'Max Drawdown',
    win_rate: 'Win Rate',
    trades: 'Trades',
    full_volatility: 'Full Volatility',
    volatility_30d: '30D Volatility',
    disclaimer: 'Live COMEX gold data is served through the local API, with fallback only if the upstream source is unavailable.',
    stock_disclaimer: 'US stock prices are served through the local API using market history from Yahoo Finance.',
    market_window: (days, date) => `GC=F · COMEX · ${windowLabel(days)} window · market date ${date}`,
    last_checked: value => `Last checked ${value}`,
    daily_prefix: value => `Daily: ${value}`,
    overbought: 'Overbought ↑',
    oversold: 'Oversold ↓',
    neutral: 'Neutral',
    bullish: 'Bullish ▲',
    bearish: 'Bearish ▼',
    near_upper: 'Near Upper ↑',
    near_lower: 'Near Lower ↓',
    mid_range: 'Mid-range',
    bullish_bias: 'Bullish bias ▲',
    bearish_bias: 'Bearish bias ▼',
    nearest_support: 'Nearest Support',
    nearest_resistance: 'Nearest Resistance',
    below_current: pct => `${pct}% below current price`,
    above_current: pct => `${pct}% above current price`,
    derived_market_action: 'Derived from live market action',
    articles_analysed: count => `${count} articles analysed`,
    sentiment_score: 'Sentiment Score',
    good: 'Good ✓',
    acceptable: 'Acceptable',
    poor: 'Poor ✗',
    left_tail: 'Left-tail risk ⚠',
    near_normal: 'Near-normal',
    fat_tails: 'Fat tails ⚠',
    var_amount: value => `≈ $${Number(value).toLocaleString()} / oz`,
    daily_return: 'Daily Return %',
    frequency: 'Frequency',
    volatility_pct: 'Volatility %',
    drawdown_pct: 'Drawdown %',
    correlation_unavailable: 'Cross-asset correlations are unavailable because comparison feeds could not be loaded.',
    actual_history_unavailable: 'Historical market series unavailable. Restart the local server so charts can use real market closes.',
    portfolio_value: 'Portfolio Value (start = 100)',
    pearson: 'Pearson Correlation',
    usd_per_oz: 'USD / oz',
  },
  zh: {
    site_title: '黄金分析仪表板',
    analysis_gold: '黄金价格分析',
    analysis_stock: '股票价格分析',
    waiting_data: '等待数据中',
    current_price: '当前金价',
    window_change: '区间变化',
    period_high: '区间高点',
    period_low: '区间低点',
    market_watch: '跨市场观察',
    market_watch_title: '黄金相关市场',
    stock_watch: '美股观察',
    stock_watch_title: 'CELC · QBTS · OUST · OKLO · TEM',
    stock_price_analysis: '股票价格分析',
    market_daily: value => `单日 ${value}`,
    market_window_move: value => `${windowLabel()} ${value}`,
    tab_patterns: '走势形态',
    tab_sentiment: '情绪分析',
    tab_backtest: '回测',
    tab_markets: '市场',
    tab_risk: '风险',
    k_line_chart: 'K线图',
    latest_price: '最新价',
    daily: '单日',
    window: '区间',
    refresh: '刷新',
    awaiting_data: '等待数据中',
    insufficient_data: '数据不足',
    bollinger_position: '布林带位置',
    ma_trend: '均线趋势',
    buy_hold: '买入持有',
    baseline_return: '基准收益',
    trend_strategy: '趋势策略',
    mean_reversion: '均值回归',
    breakout: '突破策略',
    strategy: '策略',
    total_return: '总收益',
    vs_bh: '相对买入持有',
    max_drawdown: '最大回撤',
    win_rate: '胜率',
    trades: '交易次数',
    full_volatility: '整体波动率',
    volatility_30d: '30日波动率',
    disclaimer: '实时 COMEX 黄金数据通过本地 API 提供；仅在上游数据源不可用时才会回退。',
    stock_disclaimer: '美股价格通过本地 API 提供，历史行情来自 Yahoo Finance。',
    market_window: (days, date) => `GC=F · COMEX · ${windowLabel(days)}区间 · 市场日期 ${date}`,
    last_checked: value => `上次检查 ${value}`,
    daily_prefix: value => `单日: ${value}`,
    overbought: '超买 ↑',
    oversold: '超卖 ↓',
    neutral: '中性',
    bullish: '看涨 ▲',
    bearish: '看跌 ▼',
    near_upper: '接近上轨 ↑',
    near_lower: '接近下轨 ↓',
    mid_range: '区间中部',
    bullish_bias: '偏多 ▲',
    bearish_bias: '偏空 ▼',
    nearest_support: '最近支撑位',
    nearest_resistance: '最近阻力位',
    below_current: pct => `低于现价 ${pct}%`,
    above_current: pct => `高于现价 ${pct}%`,
    derived_market_action: '根据实时市场走势推导',
    articles_analysed: count => `已分析 ${count} 篇文章`,
    sentiment_score: '情绪分数',
    good: '良好 ✓',
    acceptable: '可接受',
    poor: '偏弱 ✗',
    left_tail: '左尾风险 ⚠',
    near_normal: '接近常态',
    fat_tails: '厚尾风险 ⚠',
    var_amount: value => `约 $${Number(value).toLocaleString()} / 盎司`,
    daily_return: '日收益率 %',
    frequency: '频次',
    volatility_pct: '波动率 %',
    drawdown_pct: '回撤 %',
    correlation_unavailable: '由于对比数据源暂时无法加载，跨资产相关性暂不可用。',
    actual_history_unavailable: '历史市场序列暂不可用。请重启本地服务器，以便图表使用真实市场收盘价。',
    portfolio_value: '组合净值（起始 = 100）',
    pearson: '皮尔逊相关系数',
    usd_per_oz: '美元 / 盎司',
  },
};

function fmtLocalTime(iso) {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sma(values, period) {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / period;
  });
}

function stddev(values) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function ema(values, period) {
  const k = 2 / (period + 1);
  let prev = values[0];
  return values.map((value, index) => {
    if (index === 0) return value;
    prev = value * k + prev * (1 - k);
    return prev;
  });
}

function computeRSI(prices, period = 14) {
  const rsis = Array(prices.length).fill(null);
  if (prices.length <= period) return rsis;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const delta = prices[i] - prices[i - 1];
    gains += Math.max(delta, 0);
    losses += Math.max(-delta, 0);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsis[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const delta = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
    rsis[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsis;
}

function computeDrawdown(equity) {
  let peak = equity[0];
  return equity.map(v => {
    peak = Math.max(peak, v);
    return ((v - peak) / peak) * 100;
  });
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdev(values) {
  return Math.sqrt(mean(values.map(v => (v - mean(values)) ** 2)));
}

function todayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function buildMockData(windowDays) {
  const end = todayUtcDate();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - windowDays + 1);
  const dates = Array.from({ length: windowDays }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const prices = dates.map((_, i) => {
    const longTrend = 2580 + i * 1.25;
    const wave = Math.sin(i / 8) * 34 + Math.cos(i / 19) * 22;
    const pullback = i > windowDays * 0.78 ? -22 * Math.sin(i / 5) : 0;
    const lateMomentum = i > windowDays * 0.9 ? (i - windowDays * 0.9) * 1.8 : 0;
    return Number((longTrend + wave + pullback + lateMomentum).toFixed(2));
  });

  const returns = prices.slice(1).map((p, i) => ((p / prices[i]) - 1) * 100);
  const ma20 = sma(prices, 20);
  const ma50 = sma(prices, 50);
  const ma200 = sma(prices, 200);
  const rsi = computeRSI(prices, 14);
  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const macdSignal = ema(macdLine, 9);
  const macdHist = macdLine.map((v, i) => v - macdSignal[i]);
  const bbMid = sma(prices, 20);
  const bbUpper = prices.map((_, i) => {
    if (i < 19) return null;
    const slice = prices.slice(i - 19, i + 1);
    return bbMid[i] + stddev(slice) * 2;
  });
  const bbLower = prices.map((_, i) => {
    if (i < 19) return null;
    const slice = prices.slice(i - 19, i + 1);
    return bbMid[i] - stddev(slice) * 2;
  });

  const lastPrice = prices.at(-1);
  const nearestSupport = Math.round((lastPrice - 42) * 100) / 100;
  const nearestResistance = Math.round((lastPrice + 36) * 100) / 100;
  const lastRsi = rsi.at(-1) ?? 50;
  const lastMacd = macdLine.at(-1) ?? 0;
  const lastBbPct = bbUpper.at(-1) && bbLower.at(-1)
    ? ((lastPrice - bbLower.at(-1)) / (bbUpper.at(-1) - bbLower.at(-1))) * 100
    : 50;
  const maBull = (ma20.at(-1) ?? lastPrice) > (ma50.at(-1) ?? lastPrice);
  const macdBull = lastMacd > (macdSignal.at(-1) ?? 0);

  const bhEquity = [100];
  returns.forEach(ret => bhEquity.push(bhEquity.at(-1) * (1 + ret / 100)));
  const mkStrat = (name, multiplier, offset, trades) => {
    const equity = bhEquity.map((v, i) => Number((v * multiplier + Math.sin(i / 12 + offset) * 2.2).toFixed(2)));
    const totalReturn = ((equity.at(-1) / equity[0]) - 1) * 100;
    return {
      name,
      equity,
      total_return: totalReturn,
      vs_bh: totalReturn - (((bhEquity.at(-1) / bhEquity[0]) - 1) * 100),
      sharpe: 0.9 + multiplier * 0.45,
      max_drawdown: Math.abs(Math.min(...computeDrawdown(equity))),
      win_rate: 48 + multiplier * 9,
      n_trades: trades,
    };
  };

  const strategies = [
    mkStrat('Trend Rider', 1.05, 0, 18),
    mkStrat('Mean Reversion', 1.02, 1.2, 24),
    mkStrat('Breakout Pulse', 1.08, 2.1, 15),
  ];

  const avgRet = mean(returns);
  const stdRet = stdev(returns);
  const negReturns = returns.filter(v => v < 0);
  const downside = negReturns.length ? stdev(negReturns) : stdRet;
  const drawdown = computeDrawdown(prices);
  let peakIndex = 0;
  let troughIndex = 0;
  prices.forEach((price, i) => {
    if (price > prices[peakIndex]) peakIndex = i;
    if (drawdown[i] < drawdown[troughIndex]) troughIndex = i;
  });

  const volRoll = returns.map((_, i) => {
    if (i < 29) return null;
    return stdev(returns.slice(i - 29, i + 1)) * Math.sqrt(252);
  }).filter(v => v != null);
  const volDates = dates.slice(dates.length - volRoll.length);
  const corrSeriesA = returns.slice(0, returns.length - 1);
  const corrSeriesB = returns.slice(1);
  const corrBaseMeanA = mean(corrSeriesA);
  const corrBaseMeanB = mean(corrSeriesB);
  const corrNumerator = corrSeriesA.reduce((sum, v, i) => sum + (v - corrBaseMeanA) * (corrSeriesB[i] - corrBaseMeanB), 0);
  const corrDenominator = Math.sqrt(
    corrSeriesA.reduce((sum, v) => sum + (v - corrBaseMeanA) ** 2, 0) *
    corrSeriesB.reduce((sum, v) => sum + (v - corrBaseMeanB) ** 2, 0)
  );
  const pseudoCorr = corrDenominator ? corrNumerator / corrDenominator : 0;

  const sentimentArticles = [
    { title: 'Central bank buying keeps gold demand resilient', score: 0.62 },
    { title: 'Treasury yields stabilize as investors weigh inflation path', score: 0.12 },
    { title: 'ETF outflows trim short-term momentum in precious metals', score: -0.18 },
    { title: 'Dollar softness adds support for bullion prices', score: 0.44 },
    { title: 'Traders brace for rate-cut timing uncertainty', score: -0.06 },
    { title: 'Safe-haven demand returns after fresh macro jitters', score: 0.57 },
  ];
  const bullish = sentimentArticles.filter(a => a.score > 0.1).length;
  const bearish = sentimentArticles.filter(a => a.score < -0.1).length;
  const neutral = sentimentArticles.length - bullish - bearish;
  const sentimentAvg = mean(sentimentArticles.map(a => a.score));

  return {
    data: {
      dates,
      prices,
      ma20,
      ma50,
      ma200,
      rsi,
      macd_line: macdLine,
      macd_signal: macdSignal,
      macd_hist: macdHist,
      bb_upper: bbUpper,
      bb_lower: bbLower,
      signals: {
        rsi: lastRsi,
        rsi_available: lastRsi != null,
        macd_val: lastMacd,
        macd_bull: macdBull,
        bb_pct: lastBbPct,
        bb_available: bbUpper.at(-1) != null && bbLower.at(-1) != null,
        ma_bull: maBull,
        ma_available: ma20.at(-1) != null && ma50.at(-1) != null,
      },
      nearest_support: nearestSupport,
      nearest_resistance: nearestResistance,
      last_price: lastPrice,
      change: lastPrice - prices.at(-2),
      pct_change: ((lastPrice / prices.at(-2)) - 1) * 100,
      period_high: Math.max(...prices),
      period_low: Math.min(...prices),
      period_avg: mean(prices),
    },
    sentiment: {
      avg: sentimentAvg,
      label: sentimentAvg > 0.1 ? 'Bullish' : sentimentAvg < -0.1 ? 'Bearish' : 'Neutral',
      counts: [bullish, neutral, bearish],
      articles: sentimentArticles,
    },
    backtest: {
      dates,
      bh_return: ((bhEquity.at(-1) / bhEquity[0]) - 1) * 100,
      bh_equity: bhEquity.map(v => Number(v.toFixed(2))),
      strategies: strategies.map(s => ({
        ...s,
        equity: s.equity.map(v => Number(v.toFixed(2))),
      })),
    },
    risk: {
      sharpe: (avgRet / stdRet) * Math.sqrt(252),
      sortino: (avgRet / downside) * Math.sqrt(252),
      var95: Math.abs([...returns].sort((a, b) => a - b)[Math.max(0, Math.floor(returns.length * 0.05) - 1)]),
      var95_usd: Math.abs(lastPrice * ([...returns].sort((a, b) => a - b)[Math.max(0, Math.floor(returns.length * 0.05) - 1)] / 100)),
      max_dd: Math.abs(Math.min(...drawdown)),
      peak_date: dates[peakIndex],
      trough_date: dates[troughIndex],
      vol_full: stdRet * Math.sqrt(252),
      vol_30d: (volRoll.at(-1) ?? stdRet * Math.sqrt(252)),
      skewness: -0.42,
      kurtosis: 1.36,
      vol_dates: volDates,
      vol_roll: volRoll,
      returns,
      dd_dates: dates,
      drawdown,
      correlations: [
        { label: 'DXY', corr: Number((-0.42 - pseudoCorr * 0.2).toFixed(3)) },
        { label: 'Silver', corr: Number((0.68 + pseudoCorr * 0.15).toFixed(3)) },
        { label: 'S&P 500', corr: Number((0.18 + pseudoCorr * 0.1).toFixed(3)) },
        { label: 'Dow Jones', corr: Number((0.2 + pseudoCorr * 0.08).toFixed(3)) },
        { label: 'AUD/JPY', corr: Number((-0.16 + pseudoCorr * 0.06).toFixed(3)) },
        { label: 'WTI Crude', corr: Number((0.12 - pseudoCorr * 0.1).toFixed(3)) },
        { label: 'UST 10Y', corr: Number((-0.27 + pseudoCorr * 0.12).toFixed(3)) },
      ],
    },
    markets: {
      last_updated: new Date().toISOString(),
      fallback: true,
      assets: [
        mockMarketAsset('S&P 500', '^GSPC', 'index', 5200, 0.55, windowDays, 0),
        mockMarketAsset('Dow Jones', '^DJI', 'index', 39000, 4.1, windowDays, 1.4),
        mockMarketAsset('AUD/JPY', 'AUDJPY=X', 'JPY/AUD', 99, 0.012, windowDays, 2.2),
        mockMarketAsset('WTI Crude', 'CL=F', 'USD/bbl', 78, -0.18, windowDays, 3.0),
        mockMarketAsset('Silver', 'SI=F', 'USD/oz', 31, 0.36, windowDays, 3.8),
      ],
    },
    stocks: {
      last_updated: new Date().toISOString(),
      fallback: true,
      assets: [
        mockMarketAsset('CELC', 'CELC', 'USD', 14, 0.018, windowDays, 0.4),
        mockMarketAsset('QBTS', 'QBTS', 'USD', 7, 0.012, windowDays, 1.1),
        mockMarketAsset('OUST', 'OUST', 'USD', 12, 0.016, windowDays, 1.8),
        mockMarketAsset('OKLO', 'OKLO', 'USD', 45, 0.07, windowDays, 2.5),
        mockMarketAsset('TEM', 'TEM', 'USD', 65, 0.09, windowDays, 3.2),
      ],
    },
  };
}

function mockMarketAsset(label, symbol, unit, base, slope, windowDays, phase) {
  const end = todayUtcDate();
  const dates = Array.from({ length: windowDays }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - windowDays + i + 1);
    return d.toISOString().slice(0, 10);
  });
  const close = dates.map((_, i) => Number((base + slope * i + Math.sin(i / 13 + phase) * base * 0.018 + Math.cos(i / 27 + phase) * base * 0.01).toFixed(4)));
  const open = close.map((value, i) => Number((value - Math.sin(i / 5 + phase) * base * 0.004).toFixed(4)));
  const high = close.map((value, i) => Number((Math.max(value, open[i]) + base * 0.006).toFixed(4)));
  const low = close.map((value, i) => Number((Math.min(value, open[i]) - base * 0.006).toFixed(4)));
  const first = close[0];
  const prev = close.at(-2);
  const price = close.at(-1);
  return {
    label,
    symbol,
    unit,
    dates,
    open,
    high,
    low,
    close,
    price,
    daily_change: price - prev,
    daily_pct_change: ((price / prev) - 1) * 100,
    window_change: price - first,
    window_pct_change: ((price / first) - 1) * 100,
    market_date: todayUtcDate().toISOString().slice(0, 10),
    fallback: true,
  };
}

function getMockPayload(url) {
  const parsed = new URL(url, window.location.origin);
  const requestedRange = parsed.searchParams.get('range') || rangeKey;
  const windowDays = Math.max(2, RANGE_PRESETS.find(p => p.key === requestedRange)?.days || Number(parsed.searchParams.get('days') || days));
  const mock = buildMockData(windowDays);

  if (parsed.pathname === '/api/data') return mock.data;
  if (parsed.pathname === '/api/sentiment') return mock.sentiment;
  if (parsed.pathname === '/api/backtest') return mock.backtest;
  if (parsed.pathname === '/api/risk') return mock.risk;
  if (parsed.pathname === '/api/markets') return mock.markets;
  if (parsed.pathname === '/api/stocks') return mock.stocks;
  return { error: 'Unknown mock endpoint' };
}

function apiFetch(url) {
  // Return the same Promise for identical URLs so multiple callers share one request
  if (!_fetch[url]) {
    _fetch[url] = fetch(url)
      .then(async r => {
        const payload = await r.json().catch(() => null);
        if (!r.ok) {
          const err = new Error(payload?.error || `HTTP ${r.status}`);
          err.status = r.status;
          throw err;
        }
        return payload;
      })
      .catch(err => {
        const canUseFallback = ALLOW_MOCK_DATA ||
          err.status === 502 ||
          /too many requests|upstream fetch failed/i.test(err.message || '');

        if (canUseFallback) {
          DEMO_MODE.enabled = true;
          return {
            ...getMockPayload(url),
            fallback: true,
            upstream_error: err.message || 'Upstream data unavailable',
          };
        }
        return { error: err.message || 'Data fetch failed' };
      });
  }
  return _fetch[url];
}

function invalidateCache() {
  // Clear JS-level fetch cache so next refresh hits the server
  for (const k of Object.keys(_fetch)) delete _fetch[k];
}

// ── Plotly shared config ───────────────────────────────────────────
const PLY_CFG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'],
};

function plyLayout(overrides = {}) {
  return {
    paper_bgcolor: '#090c11',
    plot_bgcolor:  '#090c11',
    font:   { color: '#f4f5f7', family: 'SFMono-Regular, Roboto Mono, IBM Plex Mono, Consolas, monospace', size: 11 },
    margin: { l: 50, r: 20, t: 30, b: 40 },
    xaxis:  { gridcolor: '#242a33', linecolor: '#454b55', zeroline: false },
    yaxis:  { gridcolor: '#242a33', linecolor: '#454b55', zeroline: false },
    legend: {
      bgcolor: 'rgba(5, 6, 7, 0.82)',
      bordercolor: '#2b3038',
      borderwidth: 1,
      orientation: 'h',
      x: 0,
      y: 1.08,
    },
    ...overrides,
  };
}

// ── Formatters ────────────────────────────────────────────────────
const fmtN   = (n, d = 2) => n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUSD = n => '$' + fmtN(n);
const fmtPct = n => (n >= 0 ? '+' : '') + fmtN(n) + '%';
const sign   = n => n >= 0 ? 'bull' : 'bear';
const moveClass = n => n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
const rangePreset = (key = rangeKey) => RANGE_PRESETS.find(p => p.key === key) || RANGE_PRESETS.find(p => p.key === DEFAULT_RANGE_KEY);
const windowLabel = (value = rangeKey) => {
  if (typeof value === 'string') return rangePreset(value).label;
  return value >= ALL_HISTORY_DAYS ? 'All' : `${value}D`;
};
const apiUrl = path => `${path}?range=${encodeURIComponent(rangeKey)}`;
const fmtMarketPrice = asset => {
  if (asset.unit === 'index') return fmtN(asset.price);
  if (asset.unit === 'JPY/AUD') return `¥${fmtN(asset.price, 2)} / AUD`;
  if (asset.unit === 'USD/bbl') return `${fmtUSD(asset.price)} / bbl`;
  if (asset.unit === 'USD/oz') return `${fmtUSD(asset.price)} / oz`;
  return fmtUSD(asset.price);
};
const t = (key, ...args) => {
  const value = I18N[currentLang]?.[key] ?? I18N.en[key] ?? key;
  return typeof value === 'function' ? value(...args) : value;
};

// ── DOM helpers ───────────────────────────────────────────────────
const $id = id => document.getElementById(id);
const hasPlotly = () => typeof Plotly !== 'undefined' && typeof Plotly.newPlot === 'function';

function setMetric(id, value, signal = '', sigClass = '') {
  const el = $id(id);
  if (!el) return;
  const valueEl = el.querySelector('.metric-value');
  if (valueEl) valueEl.textContent = value;
  const sig = el.querySelector('.metric-signal');
  if (sig) { sig.textContent = signal; sig.className = 'metric-signal ' + sigClass; }
}

function showSpinner(id) {
  const el = $id(id);
  if (el) el.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
}

function setText(id, value) {
  const el = $id(id);
  if (el) el.textContent = value;
}

function setHTML(id, value) {
  const el = $id(id);
  if (el) el.innerHTML = value;
}

function applyTranslations() {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-Hans' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

function renderPlot(id, traces, layout) {
  const el = $id(id);
  if (!el || !hasPlotly()) return false;
  if (typeof Plotly.purge === 'function') Plotly.purge(el);
  el.replaceChildren();
  Plotly.newPlot(id, traces, layout, PLY_CFG).then(() => {
    window.requestAnimationFrame(() => {
      if (typeof Plotly.Plots?.resize === 'function') Plotly.Plots.resize(el);
    });
    window.setTimeout(() => {
      if (typeof Plotly.Plots?.resize === 'function') Plotly.Plots.resize(el);
    }, 60);
  });
  return true;
}

function buildClientSentimentFallback() {
  const prices = window.__goldData?.prices || [];
  const lastPrice = window.__goldData?.last_price;
  if (!prices.length || lastPrice == null) {
    return {
      avg: 0,
      label: 'Neutral',
      counts: [0, 3, 0],
      fallback: true,
      articles: [
        { title: 'Live sentiment feed unavailable; waiting for market context.', score: 0 },
        { title: 'Open the Patterns tab once to seed price-based fallback sentiment.', score: 0 },
        { title: 'Refresh will retry the news-backed sentiment source automatically.', score: 0 },
      ],
    };
  }

  const prevClose = prices.at(-2) ?? prices[0];
  const monthAgo = prices.at(-22) ?? prices[0];
  const quarterAgo = prices.at(-66) ?? prices[0];
  const dailyChange = prevClose ? ((lastPrice / prevClose) - 1) * 100 : 0;
  const monthlyChange = monthAgo ? ((lastPrice / monthAgo) - 1) * 100 : 0;
  const quarterlyChange = quarterAgo ? ((lastPrice / quarterAgo) - 1) * 100 : 0;
  const rsi = window.__goldData?.signals?.rsi ?? 50;
  const macdBull = !!window.__goldData?.signals?.macd_bull;
  const bbPct = window.__goldData?.signals?.bb_pct ?? 50;

  const articles = [
    {
      title: `Gold last closed at ${fmtUSD(lastPrice)}, with a daily move of ${fmtPct(dailyChange)}.`,
      score: Math.max(-1, Math.min(1, dailyChange / 2.5)),
    },
    {
      title: `Momentum sits at ${fmtPct(monthlyChange)} over 1 month and ${fmtPct(quarterlyChange)} over 3 months.`,
      score: Math.max(-1, Math.min(1, (monthlyChange * 0.6 + quarterlyChange * 0.4) / 12)),
    },
    {
      title: `Technicals show RSI ${fmtN(rsi, 1)}, MACD ${macdBull ? 'bullish' : 'bearish'}, Bollinger position ${fmtN(bbPct, 1)}%.`,
      score: Math.max(-1, Math.min(1, ((rsi - 50) / 30) + (macdBull ? 0.18 : -0.18))),
    },
  ];

  const avg = articles.reduce((sum, a) => sum + a.score, 0) / articles.length;
  const bullish = articles.filter(a => a.score > 0.1).length;
  const bearish = articles.filter(a => a.score < -0.1).length;
  const neutral = articles.length - bullish - bearish;

  return {
    avg,
    label: avg > 0.1 ? 'Bullish' : avg < -0.1 ? 'Bearish' : 'Neutral',
    counts: [bullish, neutral, bearish],
    fallback: true,
    articles,
  };
}

// ── Tab switching ─────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab);
    });
  });
}

function initLanguageSwitch() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentLang = btn.dataset.lang;
      localStorage.setItem('gold_lang', currentLang);
      applyTranslations();
      refreshAll();
    });
  });
}

function initAnalysisSwitch() {
  if (!['gold', 'stocks'].includes(activeAnalysis)) activeAnalysis = 'gold';
  document.querySelectorAll('.analysis-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activateAnalysis(btn.dataset.analysis);
    });
  });
  activateAnalysis(activeAnalysis);
}

function activateAnalysis(kind) {
  if (!['gold', 'stocks'].includes(kind)) kind = 'gold';
  activeAnalysis = kind;
  localStorage.setItem('gold_analysis_view', activeAnalysis);

  document.querySelectorAll('.analysis-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.analysis === activeAnalysis);
  });
  document.querySelectorAll('.analysis-view').forEach(view => {
    view.classList.toggle('active', view.id === `analysis-${activeAnalysis}`);
  });

  if (activeAnalysis === 'stocks') {
    loadStocks();
    loadStockCharts();
  } else {
    loadMarkets();
    const active = document.querySelector('.tab-btn.active')?.dataset.tab || 'patterns';
    loadTab(active);
  }
}

function loadTab(tab) {
  const key = tab + ':' + rangeKey;
  if (loaded.has(key)) return;
  loaded.add(key);
  ({ patterns: loadPatterns, sentiment: loadSentiment,
     backtest: loadBacktest, markets: loadMarketCharts, risk: loadRisk })[tab]?.();
}

function activateTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === 'tab-' + tab);
  });
  loadTab(tab);
}

function marketSlug(symbol) {
  return symbol.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

// ── Range controls ────────────────────────────────────────────────
function initControls() {
  const refreshBtn = $id('btn-refresh');

  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      rangeKey = btn.dataset.range;
      days = rangePreset(rangeKey).days;
      localStorage.setItem('gold_range', rangeKey);
      applyRangeButtons();
      refreshAll();
    });
  });
  applyRangeButtons();

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loaded.clear();
      refreshAll();
    });
  }
}

function applyRangeButtons() {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === rangeKey);
  });
}

function initStockControls() {
  const refreshBtn = $id('btn-stock-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshAll();
    });
  }
}

function refreshAll() {
  invalidateCache();
  loaded.clear();
  loadHeader();
  if (activeAnalysis === 'stocks') {
    loadStocks();
    loadStockCharts();
  } else {
    loadMarkets();
    const active = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (active) loadTab(active);
  }
}

async function openMarketSection(symbol) {
  const slug = symbol.includes('-') || /^[a-z0-9]+$/i.test(symbol) ? symbol.toLowerCase() : marketSlug(symbol);
  activateTab('markets');
  await loadMarketCharts();
  const target = $id(`market-section-${slug}`);
  if (target) {
    window.history.replaceState(null, '', `#market-${slug}`);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('market-section-focus');
    window.setTimeout(() => target.classList.remove('market-section-focus'), 1200);
  }
}

async function openStockSection(symbol) {
  const slug = marketSlug(symbol);
  activateAnalysis('stocks');
  await loadStockCharts();
  const target = $id(`stock-section-${slug}`);
  if (target) {
    window.history.replaceState(null, '', `#stock-${slug}`);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('market-section-focus');
    window.setTimeout(() => target.classList.remove('market-section-focus'), 1200);
  }
}

function scheduleMidnightRefresh() {
  if (midnightRefreshTimer) window.clearTimeout(midnightRefreshTimer);
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 5, 0);
  midnightRefreshTimer = window.setTimeout(() => {
    refreshAll();
    scheduleMidnightRefresh();
  }, nextMidnight.getTime() - now.getTime());
}

function initAutoRefresh() {
  if (autoRefreshTimer) window.clearInterval(autoRefreshTimer);
  autoRefreshTimer = window.setInterval(() => {
    if (!document.hidden) refreshAll();
  }, AUTO_REFRESH_MS);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshAll();
  });

  scheduleMidnightRefresh();
}

// ══════════════════════════════════════════════════════════════════
// HEADER
// ══════════════════════════════════════════════════════════════════
async function loadHeader() {
  try {
    const d = await apiFetch(apiUrl('/api/data'));
    if (d.error) throw new Error(d.error);

    setText('header-price', fmtUSD(d.last_price));
    const dailyChange = d.daily_change ?? d.change ?? 0;
    const dailyPctChange = d.daily_pct_change ?? d.pct_change ?? 0;
    const chEl = $id('header-change');
    const arrow = dailyChange >= 0 ? '▲' : '▼';
    if (chEl) {
      chEl.textContent = `${arrow} ${fmtUSD(Math.abs(dailyChange))} (${fmtPct(dailyPctChange)})`;
      chEl.className = 'ticker-change ' + moveClass(dailyChange);
    }
    setText('header-date', t('market_window', rangeKey, d.market_date || d.dates.at(-1)));
    setText('header-updated', t('last_checked', fmtLocalTime(d.last_updated)));

    setText('stat-price', fmtUSD(d.last_price));
    const chDelta = $id('stat-change');
    if (chDelta) {
      chDelta.textContent = t('daily_prefix', `${dailyChange >= 0 ? '▲' : '▼'} ${fmtPct(dailyPctChange)}`);
      chDelta.className = 'stat-delta ' + sign(dailyChange);
    }
    setText('stat-window-change', fmtUSD(d.change));
    const windowPct = $id('stat-window-pct');
    if (windowPct) {
      windowPct.textContent = `${d.change >= 0 ? '▲' : '▼'} ${fmtPct(d.pct_change)}`;
      windowPct.className = 'stat-delta ' + sign(d.change);
    }
    setText('stat-high', fmtUSD(d.period_high));
    setText('stat-low', fmtUSD(d.period_low));
  } catch (e) {
    console.error('header:', e);
    setText('header-price', 'Unavailable');
    const chEl = $id('header-change');
    if (chEl) {
      chEl.textContent = e.message || t('waiting_data');
      chEl.className = 'ticker-change flat';
    }
    setText('header-updated', t('waiting_data'));
  }
}

async function loadMarkets() {
  const grid = $id('market-grid');
  if (!grid) return;

  try {
    const d = await apiFetch(apiUrl('/api/markets'));
    if (d.error) throw new Error(d.error);
    const assets = Array.isArray(d.assets) ? d.assets : [];
    if (!assets.length) throw new Error('No market data returned');

    grid.innerHTML = assets.map(asset => {
      const dailyClass = moveClass(asset.daily_change);
      const windowClass = moveClass(asset.window_change);
      return `
        <button class="market-card market-card-link" type="button" data-market-symbol="${asset.symbol}">
          <div class="market-name">
            <span>${asset.label}</span>
            <span class="market-symbol">${asset.symbol}</span>
          </div>
          <div class="market-price">${fmtMarketPrice(asset)}</div>
          <div class="market-moves">
            <div class="market-move ${dailyClass}">${t('market_daily', fmtPct(asset.daily_pct_change))}</div>
            <div class="market-move ${windowClass}">${t('market_window_move', fmtPct(asset.window_pct_change))}</div>
          </div>
        </button>`;
    }).join('');

    grid.querySelectorAll('[data-market-symbol]').forEach(card => {
      card.addEventListener('click', () => openMarketSection(card.dataset.marketSymbol));
    });

    const suffix = d.fallback ? ` · ${t('derived_market_action')}` : '';
    setText('market-watch-updated', `${t('last_checked', fmtLocalTime(d.last_updated))}${suffix}`);
  } catch (e) {
    console.error('markets:', e);
    grid.innerHTML = `<article class="market-card loading">
      <div class="market-name">${t('awaiting_data')}</div>
      <div class="market-price">${e.message || t('waiting_data')}</div>
    </article>`;
    setText('market-watch-updated', t('waiting_data'));
  }
}

function hasActualMarketSeries(asset) {
  return (
    Array.isArray(asset.dates) &&
    Array.isArray(asset.open) &&
    Array.isArray(asset.high) &&
    Array.isArray(asset.low) &&
    Array.isArray(asset.close) &&
    asset.dates.length >= 10 &&
    asset.close.length >= 10 &&
    asset.open.length === asset.close.length &&
    asset.high.length === asset.close.length &&
    asset.low.length === asset.close.length
  );
}

async function loadMarketCharts() {
  const container = $id('market-sections');
  if (!container) return;

  try {
    const d = await apiFetch(apiUrl('/api/markets'));
    if (d.error) throw new Error(d.error);
    const rawAssets = Array.isArray(d.assets) ? d.assets : [];
    const assets = rawAssets.filter(hasActualMarketSeries);
    if (!assets.length) throw new Error('No market data returned');
    const missingCount = rawAssets.length - assets.length;
    const warning = missingCount > 0
      ? `<div class="market-warning">${t('actual_history_unavailable')}</div>`
      : '';

    container.innerHTML = warning + assets.map((asset, index) => `
      <section class="market-section" id="market-section-${marketSlug(asset.symbol)}">
        <div class="market-section-head">
          <div>
            <h2 class="market-section-title">${asset.label}</h2>
            <div class="market-section-sub">${asset.symbol} · ${t('k_line_chart')} · ${asset.market_date}</div>
          </div>
          <div class="market-section-stats">
            <div class="market-pill">
              <div class="market-pill-label">${t('latest_price')}</div>
              <div class="market-pill-value">${fmtMarketPrice(asset)}</div>
            </div>
            <div class="market-pill">
              <div class="market-pill-label">${t('daily')}</div>
              <div class="market-pill-value ${moveClass(asset.daily_change)}">${fmtPct(asset.daily_pct_change)}</div>
            </div>
            <div class="market-pill">
              <div class="market-pill-label">${windowLabel()}</div>
              <div class="market-pill-value ${moveClass(asset.window_change)}">${fmtPct(asset.window_pct_change)}</div>
            </div>
          </div>
        </div>
        <div class="market-k-chart" id="market-k-${index}"></div>
      </section>
    `).join('');

    assets.forEach((asset, index) => {
      const ma20 = sma(asset.close, 20);
      const ma50 = sma(asset.close, 50);
      const priceTrace = asset.close.length <= 900 ? {
          type: 'candlestick',
          x: asset.dates,
          name: asset.label,
          open: asset.open,
          high: asset.high,
          low: asset.low,
          close: asset.close,
          increasing: { line: { color: '#00c853', width: 1 }, fillcolor: 'rgba(34,197,94,0.35)' },
          decreasing: { line: { color: '#ff3b30', width: 1 }, fillcolor: 'rgba(239,68,68,0.35)' },
        } : {
          type: 'scattergl',
          mode: 'lines',
          x: asset.dates,
          y: asset.close,
          name: `${asset.label} close`,
          line: { color: '#ffbf00', width: 1.8 },
          connectgaps: false,
          hovertemplate: '%{x}<br>Close: %{y:.2f}<extra></extra>',
        };

      renderPlot(`market-k-${index}`, [
        priceTrace,
        {
          x: asset.dates,
          y: ma20,
          name: 'MA-20',
          line: { color: '#28a9ff', width: 1.2 },
        },
        {
          x: asset.dates,
          y: ma50,
          name: 'MA-50',
          line: { color: '#ff7a00', width: 1.2, dash: 'dash' },
        },
      ], plyLayout({
        height: 440,
        margin: { l: 58, r: 20, t: 18, b: 40 },
        xaxis: { gridcolor: '#242a33', linecolor: '#242a33', rangeslider: { visible: false } },
        yaxis: { title: asset.unit, gridcolor: '#242a33' },
      }));
    });
  } catch (e) {
    console.error('market charts:', e);
    container.innerHTML = `<div class="chart-box"><div class="spinner-wrap" style="color:#ff3b30">Error: ${e.message}</div></div>`;
  }
}

async function loadStocks() {
  const grid = $id('stock-grid');
  if (!grid) return;

  try {
    const d = await apiFetch(apiUrl('/api/stocks'));
    if (d.error) throw new Error(d.error);
    const assets = Array.isArray(d.assets) ? d.assets : [];
    if (!assets.length) throw new Error('No stock data returned');

    grid.innerHTML = assets.map(asset => {
      const dailyClass = moveClass(asset.daily_change);
      const windowClass = moveClass(asset.window_change);
      return `
        <button class="market-card market-card-link" type="button" data-stock-symbol="${asset.symbol}">
          <div class="market-name">
            <span>${asset.label}</span>
            <span class="market-symbol">${asset.symbol}</span>
          </div>
          <div class="market-price">${fmtMarketPrice(asset)}</div>
          <div class="market-moves">
            <div class="market-move ${dailyClass}">${t('market_daily', fmtPct(asset.daily_pct_change))}</div>
            <div class="market-move ${windowClass}">${t('market_window_move', fmtPct(asset.window_pct_change))}</div>
          </div>
        </button>`;
    }).join('');

    grid.querySelectorAll('[data-stock-symbol]').forEach(card => {
      card.addEventListener('click', () => openStockSection(card.dataset.stockSymbol));
    });

    const suffix = d.fallback ? ` · ${t('derived_market_action')}` : '';
    setText('stock-watch-updated', `${t('last_checked', fmtLocalTime(d.last_updated))}${suffix}`);
  } catch (e) {
    console.error('stocks:', e);
    grid.innerHTML = `<article class="market-card loading">
      <div class="market-name">${t('awaiting_data')}</div>
      <div class="market-price">${e.message || t('waiting_data')}</div>
    </article>`;
    setText('stock-watch-updated', t('waiting_data'));
  }
}

async function loadStockCharts() {
  const container = $id('stock-sections');
  if (!container) return;

  try {
    const d = await apiFetch(apiUrl('/api/stocks'));
    if (d.error) throw new Error(d.error);
    const rawAssets = Array.isArray(d.assets) ? d.assets : [];
    const assets = rawAssets.filter(hasActualMarketSeries);
    if (!assets.length) throw new Error('No stock data returned');
    const missingCount = rawAssets.length - assets.length;
    const warning = missingCount > 0
      ? `<div class="market-warning">${t('actual_history_unavailable')}</div>`
      : '';

    container.innerHTML = warning + assets.map((asset, index) => `
      <section class="market-section" id="stock-section-${marketSlug(asset.symbol)}">
        <div class="market-section-head">
          <div>
            <h2 class="market-section-title">${asset.label}</h2>
            <div class="market-section-sub">${asset.symbol} · ${t('k_line_chart')} · ${asset.market_date}</div>
          </div>
          <div class="market-section-stats">
            <div class="market-pill">
              <div class="market-pill-label">${t('latest_price')}</div>
              <div class="market-pill-value">${fmtMarketPrice(asset)}</div>
            </div>
            <div class="market-pill">
              <div class="market-pill-label">${t('daily')}</div>
              <div class="market-pill-value ${moveClass(asset.daily_change)}">${fmtPct(asset.daily_pct_change)}</div>
            </div>
            <div class="market-pill">
              <div class="market-pill-label">${windowLabel()}</div>
              <div class="market-pill-value ${moveClass(asset.window_change)}">${fmtPct(asset.window_pct_change)}</div>
            </div>
          </div>
        </div>
        <div class="market-k-chart" id="stock-k-${index}"></div>
      </section>
    `).join('');

    assets.forEach((asset, index) => {
      const ma20 = sma(asset.close, 20);
      const ma50 = sma(asset.close, 50);
      const priceTrace = asset.close.length <= 900 ? {
          type: 'candlestick',
          x: asset.dates,
          name: asset.label,
          open: asset.open,
          high: asset.high,
          low: asset.low,
          close: asset.close,
          increasing: { line: { color: '#00c853', width: 1 }, fillcolor: 'rgba(34,197,94,0.35)' },
          decreasing: { line: { color: '#ff3b30', width: 1 }, fillcolor: 'rgba(239,68,68,0.35)' },
        } : {
          type: 'scattergl',
          mode: 'lines',
          x: asset.dates,
          y: asset.close,
          name: `${asset.label} close`,
          line: { color: '#ffbf00', width: 1.8 },
          connectgaps: false,
          hovertemplate: '%{x}<br>Close: $%{y:.2f}<extra></extra>',
        };

      renderPlot(`stock-k-${index}`, [
        priceTrace,
        {
          x: asset.dates,
          y: ma20,
          name: 'MA-20',
          line: { color: '#28a9ff', width: 1.2 },
        },
        {
          x: asset.dates,
          y: ma50,
          name: 'MA-50',
          line: { color: '#ff7a00', width: 1.2, dash: 'dash' },
        },
      ], plyLayout({
        height: 440,
        margin: { l: 58, r: 20, t: 18, b: 40 },
        xaxis: { gridcolor: '#242a33', linecolor: '#242a33', rangeslider: { visible: false } },
        yaxis: { title: 'USD', gridcolor: '#242a33' },
      }));
    });
  } catch (e) {
    console.error('stock charts:', e);
    container.innerHTML = `<div class="chart-box"><div class="spinner-wrap" style="color:#ff3b30">Error: ${e.message}</div></div>`;
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTOR 1 · PATTERN RECOGNITION
// ══════════════════════════════════════════════════════════════════
async function loadPatterns() {
  if (!$id('patterns-chart')) return;
  // Kick off all other endpoints in the background so tab switches are instant
  apiFetch(apiUrl('/api/backtest'));
  apiFetch(apiUrl('/api/risk'));
  apiFetch('/api/sentiment');
  try {
    const d = await apiFetch(apiUrl('/api/data'));
    if (d.error) throw new Error(d.error);

    const { dates, prices, ma20, ma50, ma200, rsi,
            macd_line, macd_signal, macd_hist,
            bb_upper, bb_lower, signals,
            nearest_support, nearest_resistance, last_price } = d;

    window.__goldData = d;

    // Metric cards
    const rsiAvailable = signals.rsi_available !== false;
    const bbAvailable = signals.bb_available !== false;
    const maAvailable = signals.ma_available !== false;
    const rsiCls = signals.rsi > 70 ? 'bear' : signals.rsi < 30 ? 'bull' : '';
    if (rsiAvailable) {
      setMetric('m-rsi',  signals.rsi.toFixed(1),
        signals.rsi > 70 ? t('overbought') : signals.rsi < 30 ? t('oversold') : t('neutral'), rsiCls);
    } else {
      setMetric('m-rsi', '—', t('insufficient_data'), 'muted');
    }
    setMetric('m-macd', (signals.macd_val >= 0 ? '+' : '') + fmtN(signals.macd_val),
      signals.macd_bull ? t('bullish') : t('bearish'),
      signals.macd_bull ? 'bull' : 'bear');
    const bbCls = signals.bb_pct > 80 ? 'warn' : signals.bb_pct < 20 ? 'bull' : '';
    if (bbAvailable) {
      setMetric('m-bb', signals.bb_pct.toFixed(1) + '%',
        signals.bb_pct > 80 ? t('near_upper') : signals.bb_pct < 20 ? t('near_lower') : t('mid_range'), bbCls);
    } else {
      setMetric('m-bb', '—', t('insufficient_data'), 'muted');
    }
    if (maAvailable) {
      setMetric('m-ma',
        signals.ma_bull ? 'MA20 > MA50' : 'MA20 < MA50',
        signals.ma_bull ? t('bullish_bias') : t('bearish_bias'),
        signals.ma_bull ? 'bull' : 'bear');
    } else {
      setMetric('m-ma', '—', t('insufficient_data'), 'muted');
    }

    // Build chart traces — price row shares xaxis, RSI and MACD use yaxis2/3
    // Layout uses domain-based subplots so x-axis zooming syncs automatically
    const traces = [
      { x: dates, y: prices,   name: 'Gold',   line: { color: '#ffbf00', width: 2 }, yaxis: 'y' },
      { x: dates, y: ma20,     name: 'MA-20',  line: { color: '#28a9ff', width: 1.2, dash: 'dash' }, yaxis: 'y' },
      { x: dates, y: ma50,     name: 'MA-50',  line: { color: '#ff7a00', width: 1.2, dash: 'dash' }, yaxis: 'y' },
    ];

    if (ma200.some(v => v !== null)) {
      traces.push({ x: dates, y: ma200, name: 'MA-200',
        line: { color: '#b68cff', width: 1, dash: 'dot' }, yaxis: 'y' });
    }

    // Bollinger band fill (polygon between upper and lower)
    traces.push({
      x: [...dates, ...dates.slice().reverse()],
      y: [...bb_upper, ...bb_lower.slice().reverse()],
      fill: 'toself', fillcolor: 'rgba(167,139,250,0.07)',
      line: { color: 'transparent' }, name: 'Bollinger', yaxis: 'y',
    });
    traces.push({ x: dates, y: bb_upper, showlegend: false,
      line: { color: 'rgba(167,139,250,0.35)', width: 1 }, yaxis: 'y' });
    traces.push({ x: dates, y: bb_lower, showlegend: false,
      line: { color: 'rgba(167,139,250,0.35)', width: 1 }, yaxis: 'y' });

    // RSI (second subplot via yaxis2)
    traces.push({ x: dates, y: rsi, name: 'RSI',
      line: { color: '#00c853', width: 1.5 }, yaxis: 'y2', showlegend: false });

    // MACD (third subplot via yaxis3)
    traces.push({ x: dates, y: macd_line, name: 'MACD',
      line: { color: '#28a9ff', width: 1.2 }, yaxis: 'y3', showlegend: false });
    traces.push({ x: dates, y: macd_signal, name: 'Signal',
      line: { color: '#ff7a00', width: 1.2, dash: 'dash' }, yaxis: 'y3', showlegend: false });
    traces.push({
      type: 'bar', x: dates, y: macd_hist, yaxis: 'y3', showlegend: false,
      marker: { color: macd_hist.map(v => v == null ? '#8f99a8' : v >= 0 ? '#00c853' : '#ff5c52'), opacity: 0.6 },
    });

    const layout = plyLayout({
      height: 760,
      margin: { l: 58, r: 24, t: 38, b: 52 },
      xaxis:  { gridcolor: '#242a33', linecolor: '#242a33', zeroline: false, tickfont: { size: 10 } },
      yaxis:  { domain: [0.50, 1.00], title: t('usd_per_oz') },
      yaxis2: { domain: [0.27, 0.43], title: 'RSI', range: [0, 100] },
      yaxis3: { domain: [0.00, 0.17], title: 'MACD' },
      shapes: [
        { type: 'line', yref: 'y2', xref: 'paper', x0: 0, x1: 1, y0: 70, y1: 70,
          line: { color: '#ff3b30', dash: 'dash', width: 0.8 } },
        { type: 'line', yref: 'y2', xref: 'paper', x0: 0, x1: 1, y0: 30, y1: 30,
          line: { color: '#00c853', dash: 'dash', width: 0.8 } },
        { type: 'line', yref: 'y3', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0,
          line: { color: '#8f99a8', width: 0.6 } },
      ],
    });

    renderPlot('patterns-chart', traces, layout);

    // S/R levels
    const srEl = $id('sr-row');
    let html = '';
    if (nearest_support) {
      const pct = ((last_price - nearest_support) / last_price * 100).toFixed(1);
      html += `<div class="sr-card">
        <div class="sr-type">${t('nearest_support')}</div>
        <div class="sr-price">${fmtUSD(nearest_support)}</div>
        <div class="sr-dist">${t('below_current', pct)}</div>
      </div>`;
    }
    if (nearest_resistance) {
      const pct = ((nearest_resistance - last_price) / last_price * 100).toFixed(1);
      html += `<div class="sr-card">
        <div class="sr-type">${t('nearest_resistance')}</div>
        <div class="sr-price">${fmtUSD(nearest_resistance)}</div>
        <div class="sr-dist">${t('above_current', pct)}</div>
      </div>`;
    }
    if (srEl) srEl.innerHTML = html;

  } catch (e) {
    setHTML('patterns-chart', `<div class="spinner-wrap" style="color:#ff3b30">Error: ${e.message}</div>`);
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTOR 2 · SENTIMENT SCORING
// ══════════════════════════════════════════════════════════════════
async function loadSentiment() {
  if (!$id('sentiment-gauge')) return;
  try {
    let d = await apiFetch('/api/sentiment');
    if (d.error) d = buildClientSentimentFallback();
    if (!Array.isArray(d.articles) || !d.articles.length) d = buildClientSentimentFallback();

    const color = d.avg > 0.1 ? '#00c853' : d.avg < -0.1 ? '#ff3b30' : '#8f99a8';
    const sign  = d.avg >= 0 ? '+' : '';
    setHTML('sentiment-gauge', `
      <div class="gauge-score" style="color:${color}">${sign}${d.avg.toFixed(3)}</div>
      <div class="gauge-label" style="color:${color}">${d.label}</div>
      <div class="gauge-sub">${d.fallback ? t('derived_market_action') : t('articles_analysed', d.articles.length)}</div>`);

    // Donut
    renderPlot('sentiment-donut', [{
      type: 'pie',
      labels: ['Bullish', 'Neutral', 'Bearish'],
      values: d.counts,
      marker: { colors: ['#00c853', '#8f99a8', '#ff3b30'] },
      hole: 0.45, textinfo: 'label+percent',
    }], plyLayout({ height: 260, margin: { l: 10, r: 10, t: 10, b: 10 }, showlegend: false }));

    // Bar chart
    const labels = d.articles.map(a => a.title.length > 60 ? a.title.slice(0, 60) + '…' : a.title);
    const scores = d.articles.map(a => a.score);

    renderPlot('sentiment-bars', [{
      type: 'bar', x: scores, y: labels, orientation: 'h',
      marker: { color: scores.map(s => s > 0.1 ? '#00c853' : s < -0.1 ? '#ff3b30' : '#8f99a8') },
      text: scores.map(s => (s >= 0 ? '+' : '') + s.toFixed(2)),
      textposition: 'outside',
    }], plyLayout({
      height: Math.max(300, d.articles.length * 34),
      margin: { l: 20, r: 60, t: 30, b: 30 },
      xaxis: { title: t('sentiment_score'), range: [-1.2, 1.2], gridcolor: '#242a33' },
      yaxis: { autorange: 'reversed', tickfont: { size: 9 }, gridcolor: '#242a33' },
      shapes: [{
        type: 'line', x0: d.avg, x1: d.avg, y0: 0, y1: 1, yref: 'paper',
        line: { color: '#ffbf00', dash: 'dash', width: 1.5 },
      }],
    }));

  } catch (e) {
    setHTML('sentiment-gauge', `<div style="color:#ff3b30;font-size:12px">Error: ${e.message}</div>`);
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTOR 3 · STRATEGY BACKTESTING
// ══════════════════════════════════════════════════════════════════
async function loadBacktest() {
  if (!$id('backtest-chart')) return;
  try {
    const d = await apiFetch(apiUrl('/api/backtest'));
    if (d.error) throw new Error(d.error);

    // Metric cards
    const bhMetric = $id('m-bh')?.querySelector('.metric-value');
    if (bhMetric) bhMetric.textContent = fmtPct(d.bh_return);
    d.strategies.forEach((s, i) => {
      setMetric(`m-strat-${i}`, fmtPct(s.total_return),
        fmtPct(s.vs_bh) + ' vs B&H', sign(s.vs_bh));
    });

    // Equity curves
    const pal = ['#28a9ff', '#00c853', '#ff7a00'];
    const traces = [{
      x: d.dates, y: d.bh_equity,
      name: `Buy & Hold (${fmtPct(d.bh_return)})`,
      line: { color: '#8f99a8', dash: 'dash', width: 1.5 },
    }];
    d.strategies.forEach((s, i) => {
      traces.push({
        x: d.dates, y: s.equity,
        name: `${s.name} (${fmtPct(s.total_return)})`,
        line: { color: pal[i], width: 2 },
      });
    });

    renderPlot('backtest-chart', traces, plyLayout({
      height: 380,
      yaxis: { title: t('portfolio_value'), gridcolor: '#242a33' },
      shapes: [{
        type: 'line', x0: d.dates[0], x1: d.dates.at(-1), y0: 100, y1: 100,
        line: { color: '#f4f5f7', dash: 'dot', width: 0.5 },
      }],
    }));

    // Stats table
    setHTML('backtest-tbody', d.strategies.map(s => `
      <tr>
        <td>${s.name}</td>
        <td class="${sign(s.total_return)}">${fmtPct(s.total_return)}</td>
        <td class="${sign(s.vs_bh)}">${fmtPct(s.vs_bh)}</td>
        <td>${s.sharpe.toFixed(2)}</td>
        <td class="bear">${s.max_drawdown.toFixed(1)}%</td>
        <td>${s.win_rate.toFixed(1)}%</td>
        <td>${s.n_trades}</td>
      </tr>`).join(''));

  } catch (e) {
    setHTML('backtest-chart', `<div class="spinner-wrap" style="color:#ff3b30">Error: ${e.message}</div>`);
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTOR 4 · RISK ANALYSIS
// ══════════════════════════════════════════════════════════════════
async function loadRisk() {
  if (!$id('risk-vol-chart')) return;
  try {
    const d = await apiFetch(apiUrl('/api/risk'));
    if (d.error) throw new Error(d.error);

    // Metric cards
    const shCls = d.sharpe > 1 ? 'bull' : d.sharpe < 0.5 ? 'bear' : '';
    setMetric('m-sharpe', d.sharpe.toFixed(3),
      d.sharpe > 1 ? t('good') : d.sharpe > 0.5 ? t('acceptable') : t('poor'), shCls);
    setMetric('m-sortino', d.sortino.toFixed(3));
    setMetric('m-var95', d.var95.toFixed(2) + '%', t('var_amount', d.var95_usd), 'warn');
    setMetric('m-maxdd', d.max_dd.toFixed(1) + '%', `${d.peak_date} → ${d.trough_date}`, 'bear');
    setMetric('m-vol',   d.vol_full.toFixed(1) + '%');
    setMetric('m-vol30', d.vol_30d.toFixed(1)  + '%');
    setMetric('m-skew', d.skewness.toFixed(3),
      d.skewness < -0.5 ? t('left_tail') : t('near_normal'),
      d.skewness < -0.5 ? 'bear' : '');
    setMetric('m-kurt', d.kurtosis.toFixed(3),
      d.kurtosis > 1 ? t('fat_tails') : t('near_normal'),
      d.kurtosis > 1 ? 'warn' : '');

    // Rolling volatility
    renderPlot('risk-vol-chart', [{
      x: d.vol_dates, y: d.vol_roll,
      fill: 'tozeroy', fillcolor: 'rgba(249,115,22,0.13)',
      line: { color: '#ff7a00', width: 1.8 }, name: 'Vol',
    }], plyLayout({
      height: 260, showlegend: false,
      yaxis: { title: t('volatility_pct'), gridcolor: '#242a33' },
      margin: { l: 50, r: 20, t: 20, b: 40 },
    }));

    // Return distribution
    renderPlot('risk-dist-chart', [{
      type: 'histogram', x: d.returns, nbinsx: 40,
      marker: { color: '#28a9ff', opacity: 0.8 },
    }], plyLayout({
      height: 260, showlegend: false,
      xaxis: { title: t('daily_return'), gridcolor: '#242a33' },
      yaxis: { title: t('frequency'),      gridcolor: '#242a33' },
      margin: { l: 50, r: 20, t: 20, b: 40 },
      shapes: [{
        type: 'line', x0: -d.var95, x1: -d.var95, y0: 0, y1: 1, yref: 'paper',
        line: { color: '#ff3b30', dash: 'dash', width: 1.5 },
      }],
      annotations: [{
        x: -d.var95, y: 0.97, yref: 'paper', xanchor: 'right',
        text: `VaR 95%: ${d.var95.toFixed(2)}%`,
        showarrow: false, font: { color: '#ff3b30', size: 10 },
      }],
    }));

    // Drawdown
    renderPlot('risk-dd-chart', [{
      x: d.dd_dates, y: d.drawdown,
      fill: 'tozeroy', fillcolor: 'rgba(239,68,68,0.22)',
      line: { color: '#ff3b30', width: 1 },
    }], plyLayout({
      height: 220, showlegend: false,
      yaxis: { title: t('drawdown_pct'), gridcolor: '#242a33' },
      margin: { l: 50, r: 20, t: 20, b: 40 },
    }));

    // Correlations
    if (d.correlations.length) {
      renderPlot('risk-corr-chart', [{
        type: 'bar',
        x: d.correlations.map(c => c.label),
        y: d.correlations.map(c => c.corr),
        customdata: d.correlations.map(c => [c.symbol, c.observations]),
        marker: { color: d.correlations.map(c => c.corr > 0 ? '#00c853' : '#ff3b30') },
        text: d.correlations.map(c => (c.corr >= 0 ? '+' : '') + c.corr.toFixed(3)),
        textposition: 'outside',
        hovertemplate: '%{x}<br>%{customdata[0]}<br>Correlation: %{y:.3f}<br>Aligned days: %{customdata[1]}<extra></extra>',
      }], plyLayout({
        height: 280, showlegend: false,
        yaxis: { title: t('pearson'), range: [-1.15, 1.15], gridcolor: '#242a33' },
        margin: { l: 50, r: 20, t: 20, b: 50 },
        shapes: [{
          type: 'line', x0: -0.5, x1: d.correlations.length - 0.5,
          y0: 0, y1: 0, line: { color: '#8f99a8', width: 0.8 },
        }],
      }));
    } else {
      setHTML('risk-corr-chart', `<div class="spinner-wrap" style="color:var(--muted);font-size:12px">${t('correlation_unavailable')}</div>`);
    }

  } catch (e) {
    setHTML('risk-vol-chart', `<div class="spinner-wrap" style="color:#ff3b30">Error: ${e.message}</div>`);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────
function initGoldApp() {
  applyTranslations();
  initLanguageSwitch();
  initTabs();
  initControls();
  initStockControls();
  initAutoRefresh();
  initAnalysisSwitch();
  loadHeader();

  if (window.location.hash.startsWith('#market-')) {
    window.setTimeout(() => openMarketSection(window.location.hash.replace('#market-', '')), 250);
  } else if (window.location.hash.startsWith('#stock-')) {
    window.setTimeout(() => openStockSection(window.location.hash.replace('#stock-', '')), 250);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGoldApp, { once: true });
} else {
  initGoldApp();
}
