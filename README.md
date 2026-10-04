# KBOS Gate Assignment

A lightweight KBOS Ground utility for assigning realistic parking locations.

## Design principles

- BVA KBOS SOP §4.2 is the fallback authority.
- A verified real-world gate may be entered explicitly and is labeled `Real-world`.
- Manual overrides take priority and are labeled `Manual override`.
- Gates already assigned in the browser are never re-used.
- Assignments persist with `localStorage` until released or cleared.
- Export produces a JSON snapshot of active assignments.
- The application deliberately does not fabricate a live-data result. A future real-world provider can be connected through the data layer without changing the assignment logic.

## BVA fallback rules encoded

Delta A1-A22; Air Canada/Jazz/PVL B1-B3; American B4-B22; Boutique B37; Southwest B31A-B35; United B23-B31; Aer Lingus shared C20/C21; Cape Air C27; Etihad shared C17; JetBlue C8-C36; TAP shared C17/C20; other international arrivals Terminal E; General Aviation Signature; FedEx South Cargo; other cargo North Cargo.

## GitHub Pages

This is a static site. Upload the repository contents and enable GitHub Pages from the repository's Settings → Pages using the main branch and `/root`.

## Important data note

Real-world gate data is intentionally not guessed. Public flight-status services may require API keys, paid access, or server-side requests. The current UI therefore supports a verified gate input and keeps the provider boundary explicit. A production live provider should return a gate plus source and timestamp; if it cannot verify a gate, the application should fall back to BVA SOP rather than inventing one.
