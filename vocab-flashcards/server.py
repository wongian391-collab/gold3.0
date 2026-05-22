#!/usr/bin/env python3
import json
import os
import tempfile
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8091"))
ROOT = Path(__file__).resolve().parent
STORE_PATH = ROOT / "vocab-domestic-store.json"
LOG_LIMIT = 500


def now_iso():
  return datetime.now(timezone.utc).isoformat()


def empty_store():
  return {"cards": [], "log": [], "savedAt": None}


def load_store():
  if not STORE_PATH.exists():
    return empty_store()
  try:
    with STORE_PATH.open("r", encoding="utf-8") as handle:
      payload = json.load(handle)
    return {
      "cards": payload.get("cards") if isinstance(payload.get("cards"), list) else [],
      "log": payload.get("log") if isinstance(payload.get("log"), list) else [],
      "savedAt": payload.get("savedAt"),
    }
  except (OSError, json.JSONDecodeError):
    return empty_store()


def save_store(store):
  fd, tmp_name = tempfile.mkstemp(prefix=".vocab-domestic-", suffix=".json", dir=str(ROOT))
  try:
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
      json.dump(store, handle, ensure_ascii=False, indent=2)
      handle.write("\n")
    os.replace(tmp_name, STORE_PATH)
  finally:
    if os.path.exists(tmp_name):
      os.unlink(tmp_name)


def normalize_cards(cards):
  out = []
  if not isinstance(cards, list):
    return out
  for card in cards:
    if not isinstance(card, dict):
      continue
    word = str(card.get("word", "")).strip()
    meaning = str(card.get("meaning", "")).strip()
    if not word or not meaning:
      continue
    out.append({
      "id": str(card.get("id") or f"card-{len(out)}-{now_iso()}"),
      "word": word,
      "meaning": meaning,
      "example": str(card.get("example", "")).strip(),
      "notes": str(card.get("notes", "")).strip(),
      "tags": card.get("tags") if isinstance(card.get("tags"), list) else [],
      "createdAt": str(card.get("createdAt") or now_iso()),
      "date": str(card.get("date") or now_iso()[:10]),
      "dueAt": str(card.get("dueAt") or now_iso()[:10]),
      "interval": card.get("interval") if isinstance(card.get("interval"), (int, float)) else 0,
      "ease": card.get("ease") if isinstance(card.get("ease"), (int, float)) else 2.5,
      "reviews": card.get("reviews") if isinstance(card.get("reviews"), int) else 0,
      "lastReviewed": card.get("lastReviewed") if card.get("lastReviewed") else None,
    })
  return sorted(out, key=lambda item: item["createdAt"], reverse=True)


def normalize_log(entries):
  out = []
  if not isinstance(entries, list):
    return out
  for index, entry in enumerate(entries):
    if not isinstance(entry, dict):
      continue
    saved_at = entry.get("savedAt")
    if not saved_at:
      continue
    clean = dict(entry)
    clean["id"] = str(clean.get("id") or f"log-{index}-{saved_at}")
    clean["app"] = str(clean.get("app") or "Vocab Vault")
    out.append(clean)
  out.sort(key=lambda item: str(item.get("savedAt", "")), reverse=True)
  return out[:LOG_LIMIT]


def merge_log(incoming, existing):
  by_id = {}
  for entry in normalize_log(existing) + normalize_log(incoming):
    by_id[entry["id"]] = entry
  return sorted(by_id.values(), key=lambda item: str(item.get("savedAt", "")), reverse=True)[:LOG_LIMIT]


def merge_cards(incoming, existing, action=None, details=None):
  incoming_cards = normalize_cards(incoming)
  existing_cards = normalize_cards(existing)

  if action == "delete" and isinstance(details, dict):
    deleted_id = details.get("cardId")
    if deleted_id:
      return [
        card for card in existing_cards
        if card["id"] != str(deleted_id)
      ]

  if not incoming_cards and existing_cards:
    return existing_cards

  by_id = {}
  for card in existing_cards + incoming_cards:
    by_id[card["id"]] = card

  return sorted(by_id.values(), key=lambda item: item["createdAt"], reverse=True)


class VocabHandler(SimpleHTTPRequestHandler):
  def __init__(self, *args, **kwargs):
    super().__init__(*args, directory=str(ROOT), **kwargs)

  def do_GET(self):
    parsed = urlparse(self.path)
    if parsed.path == "/api/domestic-store":
      self.send_json(load_store())
      return
    if parsed.path == "/health":
      self.send_json({"ok": True, "service": "vocab-vault"})
      return
    if parsed.path == "/":
      self.path = "/index.html"
    return super().do_GET()

  def do_POST(self):
    parsed = urlparse(self.path)
    if parsed.path != "/api/domestic-store":
      self.send_json({"error": "Not found"}, status=404)
      return

    try:
      length = int(self.headers.get("Content-Length", "0"))
      payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
    except (ValueError, json.JSONDecodeError):
      self.send_json({"error": "Invalid JSON"}, status=400)
      return

    existing = load_store()
    action = str(payload.get("action") or "autosave")
    details = payload.get("details") if isinstance(payload.get("details"), dict) else {}
    saved_at = str(payload.get("savedAt") or now_iso())
    store = {
      "cards": merge_cards(payload.get("cards"), existing.get("cards"), action, details),
      "log": merge_log(payload.get("log"), existing.get("log")),
      "savedAt": saved_at,
    }
    save_store(store)
    self.send_json(store)

  def send_json(self, payload, status=200):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Content-Length", str(len(body)))
    self.send_header("Cache-Control", "no-store")
    self.end_headers()
    self.wfile.write(body)

  def end_headers(self):
    self.send_header("X-Content-Type-Options", "nosniff")
    super().end_headers()


def main():
  os.chdir(ROOT)
  server = ThreadingHTTPServer((HOST, PORT), VocabHandler)
  print(f"Serving Vocab Vault on http://localhost:{PORT}")
  print(f"Domestic memory file: {STORE_PATH}")
  server.serve_forever()


if __name__ == "__main__":
  main()
