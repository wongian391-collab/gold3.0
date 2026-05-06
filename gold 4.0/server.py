#!/usr/bin/env python3
import json
import math
import os
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8080"))
ROOT = Path(__file__).resolve().parent
CACHE_TTL_SECONDS = 60
USER_AGENT = "GoldPriceAnalyst/1.0"
NEWS_FEED = "https://news.google.com/rss/search?q=gold+price&hl=en-US&gl=US&ceid=US:en"
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range_days}d&interval=1d&includePrePost=false&events=div%2Csplits"
CORRELATION_ASSETS = [
  {"label": "DXY", "symbol": "DX-Y.NYB"},
  {"label": "Silver", "symbol": "SI=F"},
  {"label": "S&P 500", "symbol": "^GSPC"},
  {"label": "UST 10Y", "symbol": "^TNX"},
]

_CACHE = {}


def cache_get(key):
  entry = _CACHE.get(key)
  if not entry:
    return None
  if time.time() - entry["ts"] > CACHE_TTL_SECONDS:
    return None
  return entry["value"]


def cache_set(key, value):
  _CACHE[key] = {"ts": time.time(), "value": value}
  return value


def fetch_json(url):
  req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
  with urllib.request.urlopen(req, timeout=15) as resp:
    return json.loads(resp.read().decode("utf-8"))


def fetch_text(url):
  req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/xml,text/xml,text/plain"})
  with urllib.request.urlopen(req, timeout=15) as resp:
    return resp.read().decode("utf-8")


def mean(values):
  return sum(values) / len(values) if values else 0.0


def stdev(values):
  if len(values) < 2:
    return 0.0
  return statistics.pstdev(values)


def sma(values, period):
  out = []
  for i in range(len(values)):
    if i < period - 1:
      out.append(None)
      continue
    window = values[i - period + 1:i + 1]
    out.append(sum(window) / period)
  return out


def ema(values, period):
  if not values:
    return []
  k = 2 / (period + 1)
  out = [values[0]]
  prev = values[0]
  for value in values[1:]:
    prev = value * k + prev * (1 - k)
    out.append(prev)
  return out


def compute_rsi(prices, period=14):
  if len(prices) <= period:
    return [None] * len(prices)

  gains = []
  losses = []
  for i in range(1, period + 1):
    delta = prices[i] - prices[i - 1]
    gains.append(max(delta, 0))
    losses.append(max(-delta, 0))

  avg_gain = sum(gains) / period
  avg_loss = sum(losses) / period
  out = [None] * len(prices)
  out[period] = 100 if avg_loss == 0 else 100 - 100 / (1 + avg_gain / avg_loss)

  for i in range(period + 1, len(prices)):
    delta = prices[i] - prices[i - 1]
    avg_gain = (avg_gain * (period - 1) + max(delta, 0)) / period
    avg_loss = (avg_loss * (period - 1) + max(-delta, 0)) / period
    out[i] = 100 if avg_loss == 0 else 100 - 100 / (1 + avg_gain / avg_loss)

  return out


def bollinger(prices, period=20, std_mult=2):
  mid = sma(prices, period)
  upper = []
  lower = []
  for i in range(len(prices)):
    if i < period - 1:
      upper.append(None)
      lower.append(None)
      continue
    window = prices[i - period + 1:i + 1]
    sigma = statistics.pstdev(window) if len(window) > 1 else 0
    upper.append(mid[i] + sigma * std_mult)
    lower.append(mid[i] - sigma * std_mult)
  return upper, lower


def compute_drawdown(equity):
  if not equity:
    return []
  peak = equity[0]
  out = []
  for value in equity:
    peak = max(peak, value)
    out.append(((value - peak) / peak) * 100)
  return out


def annualized_sharpe(returns):
  sigma = stdev(returns)
  if sigma == 0:
    return 0.0
  return mean(returns) / sigma * math.sqrt(252)


def annualized_sortino(returns):
  downside = [r for r in returns if r < 0]
  sigma = stdev(downside) if downside else 0.0
  if sigma == 0:
    return 0.0
  return mean(returns) / sigma * math.sqrt(252)


def pearson_corr(a_values, b_values):
  if len(a_values) < 2 or len(a_values) != len(b_values):
    return None
  a_mean = mean(a_values)
  b_mean = mean(b_values)
  numerator = sum((a - a_mean) * (b - b_mean) for a, b in zip(a_values, b_values))
  a_var = sum((a - a_mean) ** 2 for a in a_values)
  b_var = sum((b - b_mean) ** 2 for b in b_values)
  denominator = math.sqrt(a_var * b_var)
  if denominator == 0:
    return None
  return numerator / denominator


def daily_returns_by_date(rows):
  out = {}
  for i in range(1, len(rows)):
    prev_close = rows[i - 1]["close"]
    close = rows[i]["close"]
    if prev_close:
      out[rows[i]["date"]] = ((close / prev_close) - 1) * 100
  return out


def chart_history(symbol, required_days, normalize_scaled_gold=False):
  key = f"history:{symbol}:{required_days}"
  cached = cache_get(key)
  if cached is not None:
    return cached

  range_days = max(required_days + 260, 450)
  encoded_symbol = urllib.parse.quote(symbol, safe="")
  payload = fetch_json(YAHOO_CHART.format(symbol=encoded_symbol, range_days=range_days))
  result = payload["chart"]["result"][0]
  quote = result["indicators"]["quote"][0]
  timestamps = result.get("timestamp", [])
  closes = quote.get("close", [])
  highs = quote.get("high", [])
  lows = quote.get("low", [])
  opens = quote.get("open", [])
  volumes = quote.get("volume", [])

  rows = []
  for idx, ts in enumerate(timestamps):
    close = closes[idx]
    if close is None:
      continue
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    rows.append({
      "date": dt.strftime("%Y-%m-%d"),
      "close": float(close),
      "open": float(opens[idx]) if opens[idx] is not None else float(close),
      "high": float(highs[idx]) if highs[idx] is not None else float(close),
      "low": float(lows[idx]) if lows[idx] is not None else float(close),
      "volume": int(volumes[idx]) if volumes[idx] is not None else 0,
    })

  if len(rows) < max(required_days, 30):
    raise ValueError(f"Not enough historical data returned for {symbol}")

  median_close = statistics.median(row["close"] for row in rows)
  if normalize_scaled_gold and median_close < 100:
    for row in rows:
      row["close"] *= 100
      row["open"] *= 100
      row["high"] *= 100
      row["low"] *= 100

  return cache_set(key, rows)


def price_history(required_days):
  history = chart_history("GC=F", required_days, normalize_scaled_gold=True)
  if len(history) < max(required_days, 210):
    raise ValueError("Not enough historical price data returned")
  return history


def nearest_levels(prices, last_price):
  recent = prices[-90:] if len(prices) >= 90 else prices
  supports = []
  resistances = []

  for i in range(2, len(recent) - 2):
    window = recent[i - 2:i + 3]
    price = recent[i]
    if price == min(window) and price < last_price:
      supports.append(price)
    if price == max(window) and price > last_price:
      resistances.append(price)

  nearest_support = max(supports) if supports else min(recent)
  nearest_resistance = min(resistances) if resistances else max(recent)
  return round(nearest_support, 2), round(nearest_resistance, 2)


def build_data_payload(days):
  history = price_history(days)
  prices_all = [row["close"] for row in history]
  dates_all = [row["date"] for row in history]
  latest_row = history[-1]

  ma20_all = sma(prices_all, 20)
  ma50_all = sma(prices_all, 50)
  ma200_all = sma(prices_all, 200)
  rsi_all = compute_rsi(prices_all, 14)
  ema12 = ema(prices_all, 12)
  ema26 = ema(prices_all, 26)
  macd_line_all = [a - b for a, b in zip(ema12, ema26)]
  macd_signal_all = ema(macd_line_all, 9)
  macd_hist_all = [a - b for a, b in zip(macd_line_all, macd_signal_all)]
  bb_upper_all, bb_lower_all = bollinger(prices_all, 20, 2)

  dates = dates_all[-days:]
  prices = prices_all[-days:]
  ma20 = ma20_all[-days:]
  ma50 = ma50_all[-days:]
  ma200 = ma200_all[-days:]
  rsi = rsi_all[-days:]
  macd_line = macd_line_all[-days:]
  macd_signal = macd_signal_all[-days:]
  macd_hist = macd_hist_all[-days:]
  bb_upper = bb_upper_all[-days:]
  bb_lower = bb_lower_all[-days:]

  last_price = prices_all[-1]
  prev_close = prices_all[-2]
  first_price = prices[0]
  nearest_support, nearest_resistance = nearest_levels(prices_all, last_price)
  bb_pct = 50.0
  if bb_upper_all[-1] is not None and bb_lower_all[-1] is not None and bb_upper_all[-1] != bb_lower_all[-1]:
    bb_pct = ((last_price - bb_lower_all[-1]) / (bb_upper_all[-1] - bb_lower_all[-1])) * 100

  return {
    "dates": dates,
    "prices": prices,
    "ma20": ma20,
    "ma50": ma50,
    "ma200": ma200,
    "rsi": rsi,
    "macd_line": macd_line,
    "macd_signal": macd_signal,
    "macd_hist": macd_hist,
    "bb_upper": bb_upper,
    "bb_lower": bb_lower,
    "signals": {
      "rsi": rsi_all[-1] or 50.0,
      "macd_val": macd_line_all[-1],
      "macd_bull": macd_line_all[-1] > macd_signal_all[-1],
      "bb_pct": bb_pct,
      "ma_bull": (ma20_all[-1] or last_price) > (ma50_all[-1] or last_price),
    },
    "nearest_support": nearest_support,
    "nearest_resistance": nearest_resistance,
    "last_price": last_price,
    "change": last_price - first_price,
    "pct_change": ((last_price / first_price) - 1) * 100,
    "daily_change": last_price - prev_close,
    "daily_pct_change": ((last_price / prev_close) - 1) * 100,
    "last_updated": datetime.now(timezone.utc).isoformat(),
    "market_date": latest_row["date"],
    "period_high": max(prices),
    "period_low": min(prices),
    "period_avg": mean(prices),
  }


def build_backtest_payload(days):
  data = build_data_payload(days)
  dates = data["dates"]
  prices = data["prices"]
  ma20 = data["ma20"]
  ma50 = data["ma50"]
  rsi = data["rsi"]
  returns = [0.0]
  for i in range(1, len(prices)):
    returns.append((prices[i] / prices[i - 1]) - 1)

  def run_strategy(name, signal_fn):
    equity = [100.0]
    positions = [0]
    trades = 0
    in_trade = False
    daily = [0.0]

    for i in range(1, len(prices)):
      position = signal_fn(i, positions[-1])
      if position == 1 and not in_trade:
        trades += 1
        in_trade = True
      elif position == 0 and in_trade:
        in_trade = False

      positions.append(position)
      strat_ret = returns[i] * positions[-2]
      daily.append(strat_ret)
      equity.append(equity[-1] * (1 + strat_ret))

    dd = compute_drawdown(equity)
    active_days = [r for r, p in zip(daily[1:], positions[1:]) if p == 1]
    win_rate = (sum(1 for r in active_days if r > 0) / len(active_days) * 100) if active_days else 0.0
    total_return = ((equity[-1] / equity[0]) - 1) * 100
    return {
      "name": name,
      "equity": [round(v, 2) for v in equity],
      "total_return": total_return,
      "sharpe": annualized_sharpe(daily[1:]),
      "max_drawdown": abs(min(dd)) if dd else 0.0,
      "win_rate": win_rate,
      "n_trades": trades,
    }

  def trend_signal(i, prev_pos):
    if ma20[i] is None or ma50[i] is None:
      return 0
    return 1 if prices[i] > ma50[i] and ma20[i] > ma50[i] else 0

  def mean_reversion_signal(i, prev_pos):
    if rsi[i] is None:
      return prev_pos
    if prev_pos == 0 and rsi[i] < 35:
      return 1
    if prev_pos == 1 and rsi[i] > 55:
      return 0
    return prev_pos

  def breakout_signal(i, prev_pos):
    if i < 20 or ma20[i] is None:
      return prev_pos
    breakout = prices[i] > max(prices[i - 20:i])
    stop = prices[i] < ma20[i]
    if prev_pos == 0 and breakout:
      return 1
    if prev_pos == 1 and stop:
      return 0
    return prev_pos

  strategies = [
    run_strategy("Trend Rider", trend_signal),
    run_strategy("Mean Reversion", mean_reversion_signal),
    run_strategy("Breakout Pulse", breakout_signal),
  ]

  bh_equity = [100.0]
  for ret in returns[1:]:
    bh_equity.append(bh_equity[-1] * (1 + ret))
  bh_return = ((bh_equity[-1] / bh_equity[0]) - 1) * 100

  for strat in strategies:
    strat["vs_bh"] = strat["total_return"] - bh_return

  return {
    "dates": dates,
    "bh_return": bh_return,
    "bh_equity": [round(v, 2) for v in bh_equity],
    "strategies": strategies,
  }


def build_cross_asset_correlations(gold_dates, gold_prices, days):
  gold_rows = [
    {"date": date, "close": close}
    for date, close in zip(gold_dates, gold_prices)
  ]
  gold_returns = daily_returns_by_date(gold_rows)
  correlations = []
  min_observations = max(20, min(45, days // 3))

  for asset in CORRELATION_ASSETS:
    try:
      rows = chart_history(asset["symbol"], days)
      asset_returns = daily_returns_by_date(rows)
      shared_dates = sorted(set(gold_returns) & set(asset_returns))
      if len(shared_dates) < min_observations:
        continue

      gold_aligned = [gold_returns[date] for date in shared_dates]
      asset_aligned = [asset_returns[date] for date in shared_dates]
      corr = pearson_corr(gold_aligned, asset_aligned)
      if corr is None:
        continue

      correlations.append({
        "label": asset["label"],
        "symbol": asset["symbol"],
        "corr": round(corr, 3),
        "observations": len(shared_dates),
      })
    except Exception as exc:
      print(f"[correlation] {asset['symbol']} skipped: {exc}")

  return correlations


def build_risk_payload(days):
  data = build_data_payload(days)
  prices = data["prices"]
  dates = data["dates"]
  returns = [((prices[i] / prices[i - 1]) - 1) * 100 for i in range(1, len(prices))]
  drawdown = compute_drawdown(prices)
  rolling = []
  for i in range(len(returns)):
    if i < 29:
      continue
    rolling.append(stdev(returns[i - 29:i + 1]) * math.sqrt(252))

  sorted_returns = sorted(returns)
  var_index = max(0, math.floor(len(sorted_returns) * 0.05) - 1)
  var95 = abs(sorted_returns[var_index]) if sorted_returns else 0.0

  peak_idx = max(range(len(prices)), key=lambda i: prices[i])
  trough_idx = min(range(len(drawdown)), key=lambda i: drawdown[i])
  avg_ret = mean(returns)
  sigma = stdev(returns)
  m3 = mean([(r - avg_ret) ** 3 for r in returns]) if returns else 0.0
  m4 = mean([(r - avg_ret) ** 4 for r in returns]) if returns else 0.0
  skewness = (m3 / (sigma ** 3)) if sigma else 0.0
  kurtosis = (m4 / (sigma ** 4) - 3) if sigma else 0.0

  return {
    "sharpe": annualized_sharpe(returns),
    "sortino": annualized_sortino(returns),
    "var95": var95,
    "var95_usd": abs(data["last_price"] * (var95 / 100)),
    "max_dd": abs(min(drawdown)) if drawdown else 0.0,
    "peak_date": dates[peak_idx],
    "trough_date": dates[trough_idx],
    "vol_full": sigma * math.sqrt(252),
    "vol_30d": rolling[-1] if rolling else sigma * math.sqrt(252),
    "skewness": skewness,
    "kurtosis": kurtosis,
    "vol_dates": dates[-len(rolling):] if rolling else [],
    "vol_roll": rolling,
    "returns": returns,
    "dd_dates": dates,
    "drawdown": drawdown,
    "correlations": build_cross_asset_correlations(dates, prices, days),
  }


def score_headline(title):
  title_l = title.lower()
  bullish_words = ["rise", "rises", "gain", "gains", "up", "surge", "bull", "record", "support", "safe-haven", "demand"]
  bearish_words = ["fall", "falls", "drop", "drops", "down", "slump", "bear", "pressure", "selloff", "retreat", "loss"]
  score = 0.0
  for word in bullish_words:
    if word in title_l:
      score += 0.22
  for word in bearish_words:
    if word in title_l:
      score -= 0.22
  return max(-1.0, min(1.0, score))


def build_sentiment_fallback():
  data = build_data_payload(180)
  prices = data["prices"]
  last_price = data["last_price"]
  prev_close = prices[-2]
  month_ago = prices[-22] if len(prices) >= 22 else prices[0]
  quarter_ago = prices[-66] if len(prices) >= 66 else prices[0]
  rsi = data["signals"]["rsi"]
  macd_bull = data["signals"]["macd_bull"]
  bb_pct = data["signals"]["bb_pct"]

  monthly_change = ((last_price / month_ago) - 1) * 100 if month_ago else 0.0
  quarter_change = ((last_price / quarter_ago) - 1) * 100 if quarter_ago else 0.0
  daily_change = ((last_price / prev_close) - 1) * 100 if prev_close else 0.0

  articles = [
    {
      "title": f"Gold last closed at ${last_price:,.2f}, with a daily move of {daily_change:+.2f}%",
      "score": max(-1.0, min(1.0, daily_change / 2.5)),
      "published": datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT"),
      "source": "Market-derived",
    },
    {
      "title": f"1-month momentum stands at {monthly_change:+.2f}% and 3-month momentum at {quarter_change:+.2f}%",
      "score": max(-1.0, min(1.0, (monthly_change * 0.6 + quarter_change * 0.4) / 12)),
      "published": datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT"),
      "source": "Market-derived",
    },
    {
      "title": f"Technical picture shows RSI {rsi:.1f}, MACD {'bullish' if macd_bull else 'bearish'}, Bollinger position {bb_pct:.1f}%",
      "score": max(-1.0, min(1.0, ((rsi - 50) / 30) + (0.18 if macd_bull else -0.18))),
      "published": datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT"),
      "source": "Market-derived",
    },
  ]

  scores = [a["score"] for a in articles]
  avg = mean(scores)
  bullish = sum(1 for s in scores if s > 0.1)
  bearish = sum(1 for s in scores if s < -0.1)
  neutral = len(scores) - bullish - bearish

  return {
    "avg": avg,
    "label": "Bullish" if avg > 0.1 else "Bearish" if avg < -0.1 else "Neutral",
    "counts": [bullish, neutral, bearish],
    "articles": articles,
    "fallback": True,
  }


def build_sentiment_payload():
  cached = cache_get("sentiment")
  if cached is not None:
    return cached

  articles = []
  try:
    xml_text = fetch_text(NEWS_FEED)
    root = ET.fromstring(xml_text)
    items = root.findall(".//item")[:8]
    for item in items:
      title = (item.findtext("title") or "").strip()
      pub = (item.findtext("pubDate") or "").strip()
      source = ""
      source_el = item.find("source")
      if source_el is not None and source_el.text:
        source = source_el.text.strip()
      score = score_headline(title)
      articles.append({
        "title": title,
        "score": score,
        "published": pub,
        "source": source,
      })
  except Exception:
    articles = []

  if not articles:
    payload = build_sentiment_fallback()
    return cache_set("sentiment", payload)

  scores = [a["score"] for a in articles]
  avg = mean(scores)
  bullish = sum(1 for s in scores if s > 0.1)
  bearish = sum(1 for s in scores if s < -0.1)
  neutral = len(scores) - bullish - bearish

  payload = {
    "avg": avg,
    "label": "Bullish" if avg > 0.1 else "Bearish" if avg < -0.1 else "Neutral",
    "counts": [bullish, neutral, bearish],
    "articles": articles,
    "fallback": False,
  }
  return cache_set("sentiment", payload)


class AppHandler(SimpleHTTPRequestHandler):
  def __init__(self, *args, **kwargs):
    super().__init__(*args, directory=str(ROOT), **kwargs)

  def do_GET(self):
    parsed = urllib.parse.urlparse(self.path)
    if parsed.path == "/health":
      self.send_json({"ok": True, "service": "gold-analyst"})
      return
    if parsed.path.startswith("/api/"):
      self.handle_api(parsed)
      return
    if parsed.path == "/":
      self.path = "/index.html"
    return super().do_GET()

  def end_headers(self):
    self.send_header("X-Content-Type-Options", "nosniff")
    self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
    self.send_header("X-Frame-Options", "DENY")
    self.send_header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    super().end_headers()

  def handle_api(self, parsed):
    params = urllib.parse.parse_qs(parsed.query)
    try:
      days = int(params.get("days", ["180"])[0])
    except (TypeError, ValueError):
      self.send_json({"error": "days must be an integer between 60 and 365"}, status=400)
      return
    days = max(60, min(days, 365))

    try:
      if parsed.path == "/api/data":
        payload = build_data_payload(days)
      elif parsed.path == "/api/backtest":
        payload = build_backtest_payload(days)
      elif parsed.path == "/api/risk":
        payload = build_risk_payload(days)
      elif parsed.path == "/api/sentiment":
        payload = build_sentiment_payload()
      else:
        self.send_json({"error": "Not found"}, status=404)
        return
      self.send_json(payload)
    except urllib.error.URLError as exc:
      self.send_json({"error": f"Upstream fetch failed: {exc.reason}"}, status=502)
    except Exception as exc:
      self.send_json({"error": str(exc)}, status=500)

  def send_json(self, payload, status=200):
    body = json.dumps(payload).encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Content-Length", str(len(body)))
    self.send_header("Cache-Control", "no-store")
    self.end_headers()
    self.wfile.write(body)

  def log_message(self, fmt, *args):
    print(f"[server] {self.address_string()} - {fmt % args}")


def main():
  os.chdir(ROOT)
  server = ThreadingHTTPServer((HOST, PORT), AppHandler)
  print(f"Serving Gold Price Analyst on http://localhost:{PORT}")
  server.serve_forever()


if __name__ == "__main__":
  main()
