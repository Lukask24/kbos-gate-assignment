# KBOS Gate Assignment

BVA KBOS Ground parking assignment tool.

## Live gate data

The live-gate branch uses a server-side Vercel Function at `/api/gate`. The browser never receives the FlightAware API key.

FlightAware AeroAPI is the first provider. Its flight data can include actual gate and terminal assignments when available.

### Deploy

1. Import this GitHub repository into Vercel.
2. Set the project root to the repository root.
3. Add an environment variable named `FLIGHTAWARE_API_KEY`.
4. Store it as a Secret and enable it for Production.
5. Redeploy after saving the variable.
6. Open the Vercel deployment URL and test a current KBOS arrival and departure.

Do not put the API key in `app.js`, `index.html`, GitHub, or chat.

## Provider architecture

The backend is intentionally separated from the UI so additional verified providers can be added later without changing the gate-assignment engine. A provider should only return a gate when its source actually reports one. Otherwise the app uses the BVA SOP fallback.

## Safety against bad data

A live result is never treated as authoritative merely because a provider returned a flight. The result must be for KBOS in the requested direction and contain a non-empty gate. The assignment UI continues to enforce one active aircraft per gate.
