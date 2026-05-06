/* Gold Price Analyst — Frontend */

// ── State ─────────────────────────────────────────────────────────
let days     = 180;
const loaded = new Set();       // tracks "tab:days" combos already rendered
const _fetch = {};              // deduplicates in-flight / completed fetches
const DEMO_MODE = { enabled: false };
const ALLOW_MOCK_DATA = new URLSearchParams(window.location.search).get('demo') === '1';
const AUTO_REFRESH_MS = 60 * 1000;
let autoRefreshTimer = null;
let midnightRefreshTimer = null;
let currentLang = localStorage.getItem('gold_lang') || 'en';

const I18N = {
  en: {
    site_title: 'Gold Price Analyst',
    waiting_data: 'Waiting for data',
    current_price: 'Current Price',
    window_change: 'Window Change',
    period_high: 'Period High',
    period_low: 'Period Low',
    tab_patterns: 'Patterns',
    tab_sentiment: 'Sentiment',
    tab_backtest: 'Backtest',
    tab_risk: 'Risk',
    window: 'Window',
    refresh: 'Refresh',
    awaiting_data: 'Awaiting data',
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
    market_window: (days, date) => `GC=F · COMEX · ${days}d window · market date ${date}`,
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
    portfolio_value: 'Portfolio Value (start = 100)',
    pearson: 'Pearson Correlation',
    usd_per_oz: 'USD / oz',
  },
  zh: {
    site_title: '黄金分析仪表板',
    waiting_data: '等待数据中',
    current_price: '当前金价',
    window_change: '区间变化',
    period_high: '区间高点',
    period_low: '区间低点',
    tab_patterns: '走势形态',
    tab_sentiment: '情绪分析',
    tab_backtest: '回测',
    tab_risk: '风险',
    window: '区间',
    refresh: '刷新',
    awaiting_data: '等待数据中',
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
    market_window: (days, date) => `GC=F · COMEX · ${days}天区间 · 市场日期 ${date}`,
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
        macd_val: lastMacd,
        macd_bull: macdBull,
        bb_pct: lastBbPct,
        ma_bull: maBull,
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
        { label: 'UST 10Y', corr: Number((-0.27 + pseudoCorr * 0.12).toFixed(3)) },
      ],
    },
  };
}

function getMockPayload(url) {
  const parsed = new URL(url, window.location.origin);
  const windowDays = Number(parsed.searchParams.get('days') || days);
  const mock = buildMockData(windowDays);

  if (parsed.pathname === '/api/data') return mock.data;
  if (parsed.pathname === '/api/sentiment') return mock.sentiment;
  if (parsed.pathname === '/api/backtest') return mock.backtest;
  if (parsed.pathname === '/api/risk') return mock.risk;
  return { error: 'Unknown mock endpoint' };
}

function apiFetch(url) {
  // Return the same Promise for identical URLs so multiple callers share one request
  if (!_fetch[url]) {
    _fetch[url] = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .catch(err => {
        if (ALLOW_MOCK_DATA) {
          DEMO_MODE.enabled = true;
          return getMockPayload(url);
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
    paper_bgcolor: '#1e293b',
    plot_bgcolor:  '#1e293b',
    font:   { color: '#f1f5f9', family: '-apple-system, sans-serif', size: 11 },
    margin: { l: 50, r: 20, t: 30, b: 40 },
    xaxis:  { gridcolor: '#334155', linecolor: '#334155', zeroline: false },
    yaxis:  { gridcolor: '#334155', linecolor: '#334155', zeroline: false },
    legend: { bgcolor: 'transparent', borderwidth: 0, orientation: 'h', x: 0, y: 1.08 },
    ...overrides,
  };
}

// ── Formatters ────────────────────────────────────────────────────
const fmtN   = (n, d = 2) => n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUSD = n => '$' + fmtN(n);
const fmtPct = n => (n >= 0 ? '+' : '') + fmtN(n) + '%';
const sign   = n => n >= 0 ? 'bull' : 'bear';
const moveClass = n => n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
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
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $id('tab-' + btn.dataset.tab)?.classList.add('active');
      loadTab(btn.dataset.tab);
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

function loadTab(tab) {
  const key = tab + ':' + days;
  if (loaded.has(key)) return;
  loaded.add(key);
  ({ patterns: loadPatterns, sentiment: loadSentiment,
     backtest: loadBacktest, risk: loadRisk })[tab]?.();
}

// ── Slider ────────────────────────────────────────────────────────
function initControls() {
  const slider = $id('days-slider');
  const dLabel = $id('days-label');
  const refreshBtn = $id('btn-refresh');

  if (slider && dLabel) {
    dLabel.textContent = slider.value + 'd';
    slider.addEventListener('input', () => { dLabel.textContent = slider.value + 'd'; });
    slider.addEventListener('change', () => {
      days = parseInt(slider.value, 10);
      refreshAll();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loaded.clear();
      refreshAll();
    });
  }
}

function refreshAll() {
  invalidateCache();
  loaded.clear();
  loadHeader();
  const active = document.querySelector('.tab-btn.active')?.dataset.tab;
  if (active) loadTab(active);
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
    const d = await apiFetch(`/api/data?days=${days}`);
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
    setText('header-date', t('market_window', days, d.market_date || d.dates.at(-1)));
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

// ══════════════════════════════════════════════════════════════════
// SECTOR 1 · PATTERN RECOGNITION
// ══════════════════════════════════════════════════════════════════
async function loadPatterns() {
  if (!$id('patterns-chart')) return;
  // Kick off all other endpoints in the background so tab switches are instant
  apiFetch(`/api/backtest?days=${days}`);
  apiFetch(`/api/risk?days=${days}`);
  apiFetch('/api/sentiment');
  try {
    const d = await apiFetch(`/api/data?days=${days}`);
    if (d.error) throw new Error(d.error);

    const { dates, prices, ma20, ma50, ma200, rsi,
            macd_line, macd_signal, macd_hist,
            bb_upper, bb_lower, signals,
            nearest_support, nearest_resistance, last_price } = d;

    window.__goldData = d;

    // Metric cards
    const rsiCls = signals.rsi > 70 ? 'bear' : signals.rsi < 30 ? 'bull' : '';
    setMetric('m-rsi',  signals.rsi.toFixed(1),
      signals.rsi > 70 ? t('overbought') : signals.rsi < 30 ? t('oversold') : t('neutral'), rsiCls);
    setMetric('m-macd', (signals.macd_val >= 0 ? '+' : '') + fmtN(signals.macd_val),
      signals.macd_bull ? t('bullish') : t('bearish'),
      signals.macd_bull ? 'bull' : 'bear');
    const bbCls = signals.bb_pct > 80 ? 'warn' : signals.bb_pct < 20 ? 'bull' : '';
    setMetric('m-bb', signals.bb_pct.toFixed(1) + '%',
      signals.bb_pct > 80 ? t('near_upper') : signals.bb_pct < 20 ? t('near_lower') : t('mid_range'), bbCls);
    setMetric('m-ma',
      signals.ma_bull ? 'MA20 > MA50' : 'MA20 < MA50',
      signals.ma_bull ? t('bullish_bias') : t('bearish_bias'),
      signals.ma_bull ? 'bull' : 'bear');

    // Build chart traces — price row shares xaxis, RSI and MACD use yaxis2/3
    // Layout uses domain-based subplots so x-axis zooming syncs automatically
    const traces = [
      { x: dates, y: prices,   name: 'Gold',   line: { color: '#FFD700', width: 2 }, yaxis: 'y' },
      { x: dates, y: ma20,     name: 'MA-20',  line: { color: '#60A5FA', width: 1.2, dash: 'dash' }, yaxis: 'y' },
      { x: dates, y: ma50,     name: 'MA-50',  line: { color: '#F97316', width: 1.2, dash: 'dash' }, yaxis: 'y' },
    ];

    if (ma200.some(v => v !== null)) {
      traces.push({ x: dates, y: ma200, name: 'MA-200',
        line: { color: '#A78BFA', width: 1, dash: 'dot' }, yaxis: 'y' });
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
      line: { color: '#34D399', width: 1.5 }, yaxis: 'y2', showlegend: false });

    // MACD (third subplot via yaxis3)
    traces.push({ x: dates, y: macd_line, name: 'MACD',
      line: { color: '#60A5FA', width: 1.2 }, yaxis: 'y3', showlegend: false });
    traces.push({ x: dates, y: macd_signal, name: 'Signal',
      line: { color: '#F97316', width: 1.2, dash: 'dash' }, yaxis: 'y3', showlegend: false });
    traces.push({
      type: 'bar', x: dates, y: macd_hist, yaxis: 'y3', showlegend: false,
      marker: { color: macd_hist.map(v => v == null ? '#94a3b8' : v >= 0 ? '#34D399' : '#F87171'), opacity: 0.6 },
    });

    const layout = plyLayout({
      height: 760,
      margin: { l: 58, r: 24, t: 38, b: 52 },
      xaxis:  { gridcolor: '#334155', linecolor: '#334155', zeroline: false, tickfont: { size: 10 } },
      yaxis:  { domain: [0.50, 1.00], title: t('usd_per_oz') },
      yaxis2: { domain: [0.27, 0.43], title: 'RSI', range: [0, 100] },
      yaxis3: { domain: [0.00, 0.17], title: 'MACD' },
      shapes: [
        { type: 'line', yref: 'y2', xref: 'paper', x0: 0, x1: 1, y0: 70, y1: 70,
          line: { color: '#ef4444', dash: 'dash', width: 0.8 } },
        { type: 'line', yref: 'y2', xref: 'paper', x0: 0, x1: 1, y0: 30, y1: 30,
          line: { color: '#22c55e', dash: 'dash', width: 0.8 } },
        { type: 'line', yref: 'y3', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0,
          line: { color: '#94a3b8', width: 0.6 } },
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
    setHTML('patterns-chart', `<div class="spinner-wrap" style="color:#ef4444">Error: ${e.message}</div>`);
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

    const color = d.avg > 0.1 ? '#22c55e' : d.avg < -0.1 ? '#ef4444' : '#94a3b8';
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
      marker: { colors: ['#22c55e', '#94a3b8', '#ef4444'] },
      hole: 0.45, textinfo: 'label+percent',
    }], plyLayout({ height: 260, margin: { l: 10, r: 10, t: 10, b: 10 }, showlegend: false }));

    // Bar chart
    const labels = d.articles.map(a => a.title.length > 60 ? a.title.slice(0, 60) + '…' : a.title);
    const scores = d.articles.map(a => a.score);

    renderPlot('sentiment-bars', [{
      type: 'bar', x: scores, y: labels, orientation: 'h',
      marker: { color: scores.map(s => s > 0.1 ? '#22c55e' : s < -0.1 ? '#ef4444' : '#94a3b8') },
      text: scores.map(s => (s >= 0 ? '+' : '') + s.toFixed(2)),
      textposition: 'outside',
    }], plyLayout({
      height: Math.max(300, d.articles.length * 34),
      margin: { l: 20, r: 60, t: 30, b: 30 },
      xaxis: { title: t('sentiment_score'), range: [-1.2, 1.2], gridcolor: '#334155' },
      yaxis: { autorange: 'reversed', tickfont: { size: 9 }, gridcolor: '#334155' },
      shapes: [{
        type: 'line', x0: d.avg, x1: d.avg, y0: 0, y1: 1, yref: 'paper',
        line: { color: '#FFD700', dash: 'dash', width: 1.5 },
      }],
    }));

  } catch (e) {
    setHTML('sentiment-gauge', `<div style="color:#ef4444;font-size:12px">Error: ${e.message}</div>`);
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTOR 3 · STRATEGY BACKTESTING
// ══════════════════════════════════════════════════════════════════
async function loadBacktest() {
  if (!$id('backtest-chart')) return;
  try {
    const d = await apiFetch(`/api/backtest?days=${days}`);
    if (d.error) throw new Error(d.error);

    // Metric cards
    const bhMetric = $id('m-bh')?.querySelector('.metric-value');
    if (bhMetric) bhMetric.textContent = fmtPct(d.bh_return);
    d.strategies.forEach((s, i) => {
      setMetric(`m-strat-${i}`, fmtPct(s.total_return),
        fmtPct(s.vs_bh) + ' vs B&H', sign(s.vs_bh));
    });

    // Equity curves
    const pal = ['#60A5FA', '#34D399', '#F97316'];
    const traces = [{
      x: d.dates, y: d.bh_equity,
      name: `Buy & Hold (${fmtPct(d.bh_return)})`,
      line: { color: '#94a3b8', dash: 'dash', width: 1.5 },
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
      yaxis: { title: t('portfolio_value'), gridcolor: '#334155' },
      shapes: [{
        type: 'line', x0: d.dates[0], x1: d.dates.at(-1), y0: 100, y1: 100,
        line: { color: '#ffffff', dash: 'dot', width: 0.5 },
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
    setHTML('backtest-chart', `<div class="spinner-wrap" style="color:#ef4444">Error: ${e.message}</div>`);
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTOR 4 · RISK ANALYSIS
// ══════════════════════════════════════════════════════════════════
async function loadRisk() {
  if (!$id('risk-vol-chart')) return;
  try {
    const d = await apiFetch(`/api/risk?days=${days}`);
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
      line: { color: '#F97316', width: 1.8 }, name: 'Vol',
    }], plyLayout({
      height: 260, showlegend: false,
      yaxis: { title: t('volatility_pct'), gridcolor: '#334155' },
      margin: { l: 50, r: 20, t: 20, b: 40 },
    }));

    // Return distribution
    renderPlot('risk-dist-chart', [{
      type: 'histogram', x: d.returns, nbinsx: 40,
      marker: { color: '#3b82f6', opacity: 0.8 },
    }], plyLayout({
      height: 260, showlegend: false,
      xaxis: { title: t('daily_return'), gridcolor: '#334155' },
      yaxis: { title: t('frequency'),      gridcolor: '#334155' },
      margin: { l: 50, r: 20, t: 20, b: 40 },
      shapes: [{
        type: 'line', x0: -d.var95, x1: -d.var95, y0: 0, y1: 1, yref: 'paper',
        line: { color: '#ef4444', dash: 'dash', width: 1.5 },
      }],
      annotations: [{
        x: -d.var95, y: 0.97, yref: 'paper', xanchor: 'right',
        text: `VaR 95%: ${d.var95.toFixed(2)}%`,
        showarrow: false, font: { color: '#ef4444', size: 10 },
      }],
    }));

    // Drawdown
    renderPlot('risk-dd-chart', [{
      x: d.dd_dates, y: d.drawdown,
      fill: 'tozeroy', fillcolor: 'rgba(239,68,68,0.22)',
      line: { color: '#ef4444', width: 1 },
    }], plyLayout({
      height: 220, showlegend: false,
      yaxis: { title: t('drawdown_pct'), gridcolor: '#334155' },
      margin: { l: 50, r: 20, t: 20, b: 40 },
    }));

    // Correlations
    if (d.correlations.length) {
      renderPlot('risk-corr-chart', [{
        type: 'bar',
        x: d.correlations.map(c => c.label),
        y: d.correlations.map(c => c.corr),
        customdata: d.correlations.map(c => [c.symbol, c.observations]),
        marker: { color: d.correlations.map(c => c.corr > 0 ? '#22c55e' : '#ef4444') },
        text: d.correlations.map(c => (c.corr >= 0 ? '+' : '') + c.corr.toFixed(3)),
        textposition: 'outside',
        hovertemplate: '%{x}<br>%{customdata[0]}<br>Correlation: %{y:.3f}<br>Aligned days: %{customdata[1]}<extra></extra>',
      }], plyLayout({
        height: 280, showlegend: false,
        yaxis: { title: t('pearson'), range: [-1.15, 1.15], gridcolor: '#334155' },
        margin: { l: 50, r: 20, t: 20, b: 50 },
        shapes: [{
          type: 'line', x0: -0.5, x1: d.correlations.length - 0.5,
          y0: 0, y1: 0, line: { color: '#94a3b8', width: 0.8 },
        }],
      }));
    } else {
      setHTML('risk-corr-chart', `<div class="spinner-wrap" style="color:var(--muted);font-size:12px">${t('correlation_unavailable')}</div>`);
    }

  } catch (e) {
    setHTML('risk-vol-chart', `<div class="spinner-wrap" style="color:#ef4444">Error: ${e.message}</div>`);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────
function initGoldApp() {
  applyTranslations();
  initLanguageSwitch();
  initTabs();
  initControls();
  initAutoRefresh();
  loadHeader();
  loadTab(document.querySelector('.tab-btn.active')?.dataset.tab || 'patterns');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGoldApp, { once: true });
} else {
  initGoldApp();
}
