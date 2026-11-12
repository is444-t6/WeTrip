# Product

## Platform

web

## Users

The primary user is a parent and child in the same household preparing for a trip. Both are first-class users, and screens branch by family role:

- The **parent** holds the bank account, creates the trip, locks rates, sets the budget and allowance, approves or rejects spending requests, and can freeze or restrict categories.
- The **child** travels with the wallet, sees the locked trip pot, spends from it, tracks the remaining budget, and asks for more when needed.

Only an accepted, `Active` family link connects the two. The current build has no solo-traveller path: every SmartFX trip belongs to an Active family link. Family budgets can be weekly or monthly, but the core journey remains a trip.

## Product Purpose

WeTrip is a family travel wallet. It lets a parent and child plan one trip together: lock a favourable exchange rate before departure, hold the travel money in the trip currency, set and track a budget, buy travel insurance, and pay by QR while abroad.

It exists as the IS444 Digital Banking Enterprise Architecture group project — a working prototype that demonstrates a fintech app disrupting a traditional bank on OutSystems and the SMU tBank APIs. Success for the product is a household completing the whole trip journey in one app without rate shock or budget surprises. Success for the course is a working demo and a clear composite/atomic architecture.

## Positioning

An all-in-one family travel wallet: the parent's control account and the child's spending account are the same product. WeTrip combines FX forward rate locks, shared trip budgets, travel insurance and Scan-to-Pay in one place.

The mechanism is the trip as the shared object. One SmartFX trip id ties the wallet, budget and payment history together, and insurance is matched to the same travel dates. A product that offers only a multi-currency wallet, or only parental controls, would need both the family account structure and the bank-side FX and deposit rails to match it.

## Operating Context

- The project brief is to build a fintech app that disrupts a traditional bank, with the backend on OutSystems, using SMUtBank APIs plus the team's own APIs, and a 10–15 slide deck with a live demo.
- The app is a mobile-web SPA. The demo path is a parent or child signing in with a demo customer id; authentication is a development stub, not a bank login.
- The backend is a set of OutSystems composites. The frontend calls only those composites and never the atomic services or SMUtBank directly. Data is sandbox money in demo accounts.
- The trip hub at `/trips/:tripId` is the join point across features: SmartFX owns the trip id, Budget reads the same id, and Insurance is matched by date overlap.
- Scan-to-Pay runs in a separate OutSystems environment and uses the phone camera, so it needs the HTTPS/LAN development path.

## Capabilities and Constraints

Implemented capabilities:

- **Home and access:** signed-out card, dev sign-in, role-aware home with available balance, family overview, trip wallets, recent payments and product entry points.
- **Family:** parent links a child, sets budget and allowance, tops up, approves or rejects requests, grants extra budget, freezes spending or restricts categories. The child sees a dashboard, spends, views insights, and asks for more.
- **SmartFX:** trip goals, live forward quotes, target rate and auto-lock, multiple locks per trip, child spending from the pot, and convert-back on close. Rates are foreign units per 1 SGD; supported currencies are USD, EUR, JPY, GBP and CHF; tenors are 1M, 3M, 6M and 1Y. Only a parent can own a trip, and only for an Active family link.
- **Budget:** category budgets, expenses, progress bars and alerts, and a ledger. Budgets are keyed by the SmartFX trip id; categories and sources are fixed in `src/features/budget/constants.js`.
- **Insurance:** plans, benefits, quote, traveller details, checkout and purchased policies. Insurance has no foreign key to a SmartFX trip, so the trip hub matches policies by date overlap.
- **Scan-to-Pay:** QR scanning, payment preview, PayNow and PayLater (BNPL), and payment history. Payments are user-triggered and never retried automatically.
- **Trip hub:** a read-only aggregation of the wallet, budget, insurance and payment state for one trip.

Constraints and explicitly undecided facts:

- This repository is the frontend only. The OutSystems backend source, database and site properties live outside it.
- The product is a sandbox prototype: no real customer onboarding, KYC, production authentication, real money or merchant-card rails.
- SmartFX's API key is currently sent but not enforced server-side. Header authentication is unavailable, so the key and session token travel as query/body parameters.
- Timer-driven SmartFX locks record the lock in WeTrip tables but do not book an FXForward contract. `OpenFXForwardContract` wiring is still blocked through the Model API.
- A family link must be accepted by the child before their balance is available; pending links are shown as pending.
- Budget currency is a fixed `SGD` placeholder until the trip currency is wired through.
- Not implemented in the current build: loyalty or miles, receipt scanning/OCR, bill splitting or peer transfers, card/merchant rails, and editing or removing fixed trip costs (they can be added, not changed; there is no "paid" flag, every fixed cost counts as spent). The Budget source list includes a receipt value, but no receipt capture flow exists.

## Brand Commitments

- The product name is **WeTrip**, with the lowercase wordmark `wetrip`.
- The existing logo is `public/wetrip_logo.svg`; the page title is "WeTrip - Family wallet & SmartFX" and the description is "one wallet for every adventure."
- User-facing copy is direct, warm and in sentence case. It greets the user by first name and explains money actions plainly rather than using banking jargon.
- The interface is deliberately styled after the YouTrip design system recorded in `docs/DESIGN.md`; that document is binding for UI work.
- There are no real customer logos, testimonials, press mentions or partner claims to reuse.

## Evidence on Hand

- A working React frontend with the routes and screens described above, plus Playwright suites for mocked and live flows.
- Screen recordings: `recordings/family-flow.webm` and `recordings/smartfx-flow.webm`.
- The OutSystems backend and its API contract, reachable in the team's OutSystems workspace.
- Course source material: `../.scratch/IS444 Project Idea.md`, `../.scratch/smartfx.md`, and `../.scratch/project-instructions.pptx` (the IS444 group assignment deck).
- Demo accounts and sandbox data configured through local environment variables.

Absent and not to be fabricated: real users, user research, testimonials, case studies, production traffic, pricing, revenue, market benchmarks, press coverage, or a real bank partnership.

## Product Principles

1. **The household is the unit.** Money, limits, approvals and visibility connect the parent and child; a feature that only works for one role is incomplete.
2. **Make trip cost predictable.** Rate locks and budgets exist so the family knows what the trip costs before departure and while travelling.
3. **Keep the whole trip in one place.** FX, budget, insurance and payments should meet at the trip, not feel like four unrelated products.
4. **Parent guardrails, child autonomy.** The parent sets the limits; the child spends without needing permission for every normal purchase.
5. **Prototype honestly.** Use sandbox data and declare what is not built; never invent customers, proof or production readiness.

## Accessibility & Inclusion

No formal accessibility standard has been confirmed. The current UI includes a skip link, a focused main landmark after navigation, semantic navigation, labelled icon buttons, and contrast-aware primary-button labels. Future work should preserve those basics. If a target is required, WCAG 2.1 AA is the sensible default, but it is not yet a confirmed product requirement.
