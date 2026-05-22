# Vocab Vault

A small offline vocabulary notebook with Anki-style flashcard review.

## Features

- Add daily vocabulary with meaning, example, notes, and tags.
- Review due cards with Again, Hard, Good, and Easy ratings.
- Cards are scheduled with a simple spaced-repetition interval.
- Browse by day, search the full deck, and filter by date.
- Export and import your deck as JSON.
- When served with `server.py`, cards are saved automatically to the shared local domestic memory file `vocab-domestic-store.json`.
- Browser `localStorage` is still used as a cache and fallback.
- Every add, delete, review, and import is also written automatically to a domestic log.

## Run

Run the domestic-memory server:

```bash
python3 server.py
```

Then open:

```text
http://localhost:8091
```

Use that same URL in any browser on this computer. They will share the same automatically saved deck.

If your words were created before this shared-memory server existed, open the browser that still shows them at `http://localhost:8091`, then press **Sync now** once. After that, other browsers will restore the same deck automatically.
