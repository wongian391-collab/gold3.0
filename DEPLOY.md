# Deploy Gold Analyst

## Recommended

Deploy as a Docker-backed web service on Render.

Render docs:
- https://render.com/docs/web-services

## Files already prepared

- `Dockerfile`
- `render.yaml`
- `server.py` binds to `PORT`
- `/health` endpoint for health checks

## Notes

- Public mode no longer silently falls back to generated mock prices.
- Cross-asset correlations use aligned daily returns from Yahoo chart feeds for DXY, silver futures, S&P 500, and UST 10Y.
- Sentiment can fall back to market-derived text if the live news feed is unavailable.

## Local run

```bash
python3 server.py
```
