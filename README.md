# KBOS Gate Assignment

A lightweight KBOS Ground utility for assigning realistic parking locations for BVA/ZBW operations.

## What it does

- Looks up a flight's real-world KBOS gate through FlightAware on demand.
- Keeps the FlightAware API key server-side in a Vercel serverless function.
- Uses the current BVA KBOS SOP parking rules when no verified live gate is available.
- Protects manual gate overrides from being overwritten by live lookup.
- Never reuses an actively assigned gate.
- Persists active assignments in the current browser with `localStorage`.
- Supports individual release, Clear All, and JSON export.
- Fails closed when live data is unavailable or does not contain a valid KBOS passenger gate.

## Gate-source priority

1. Manual override
2. Verified real-world FlightAware gate
3. BVA SOP fallback

Live data is never used to invent a gate. If FlightAware cannot provide a usable KBOS gate, use **Assign gate** to apply the BVA fallback rules.

## BVA fallback rules encoded

- Delta: A1-A22
- Air Canada / Jazz / PVL: B1-B3
- American: B4-B22
- Boutique Air: B37
- Southwest: B31A-B35
- United: B23-B31
- Aer Lingus: shared C20/C21
- Cape Air: C27
- Etihad: shared C17
- JetBlue: C8-C36
- TAP: shared C17/C20
- Other international arrivals: Terminal E
- General Aviation: Signature
- FedEx: South Cargo
- Other cargo: North Cargo

Republic Airways series are also handled:
- RPA3XXX -> United pool
- RPA4XXX -> American pool
- RPA5XXX -> Delta pool

## Live-data architecture

```
Browser
  |
  | GET /api/gate
  v
Vercel serverless function
  |
  | server-side API key
  v
FlightAware AeroAPI
  |
  v
Verified gate or no-gate result
```

The API key is never placed in browser JavaScript or committed to the repository.

Live lookup is on-demand only. The browser has a 10-second cooldown and a local safety guard to prevent accidental excessive clicking. There is no automatic polling.

## Production deployment

The production deployment is served through Vercel from the `main` branch.

Required Vercel environment variable:

```
FLIGHTAWARE_API_KEY
```

Set the variable for the Production environment in the Vercel project settings, then redeploy so the serverless function receives it.

Do not put the key in `app.js`, `index.html`, or any committed file.

## Development branches

- `main`: production
- `feature/live-gates`: live-data development branch
- `checkpoint/working-gate-engine`: frozen pre-live-gate checkpoint

Future changes should be developed on a feature branch, tested on a Vercel Preview deployment, and merged into `main) only after regression testing.

## Operational notes

This tool is a convenience utility, not a replacement for current BVA SOP, controller coordination, or other controlling information. When live data conflicts with current operational information, use the controlling operational source.

