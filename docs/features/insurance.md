# Insurance

Travel-insurance wizard: destination and dates → plan → travellers and quote → checkout → policy.

**Routes:** `/insurance/`, `/insurance/plans`, `/insurance/plan/$planId`, `/insurance/travellers`, `/insurance/checkout`, `/insurance/confirmation`, `/insurance/policies`.
**Service:** `WeTrip_Insurance_Composite` → `/api/insurance` → `/rest/InsuranceAPI`.
**Code:** `src/features/insurance/`.

## Screens

| Route                     | Screen             | Reads / writes                                                                      |
| ------------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| `/insurance/`             | `InsuranceHome`    | No API; validates destination, 2-letter code and dates; prefills from search params |
| `/insurance/plans`        | `InsurancePlans`   | `Plans`                                                                             |
| `/insurance/plan/$planId` | `PlanDetails`      | `Plans`, `Benefits?InsurancePlanId=`                                                |
| `/insurance/travellers`   | `TravellerDetails` | `Plans`, `Quote`, Family `GetChildren` (always loaded; used by the family picker)   |
| `/insurance/checkout`     | `Checkout`         | `Plans`, `Purchase`                                                                 |
| `/insurance/confirmation` | `Confirmation`     | No API; reads `sessionStorage`                                                      |
| `/insurance/policies`     | `MyInsurance`      | `MyInsurance`, `Plans`                                                              |

The routes are **ungated**: there is no `SignedOutCard` anywhere in this feature.

`/insurance/` accepts `?destination`, `?destinationCode`, `?startDate`, `?endDate`; `/insurance/travellers` requires `?planId=`. The destination values prefill the first step; the plan id selects the plan on the traveller screen.

## Backend contract

Bodies are PascalCase; responses are `decap`ed.

| Method | Endpoint                    | Purpose                                                                                                    |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| GET    | `Plans`                     | Plans and pricing; inactive plans are returned and shown as Unavailable                                    |
| GET    | `Benefits?InsurancePlanId=` | Benefits; several response envelopes are tolerated                                                         |
| POST   | `Quote`                     | `{InsurancePlanId, CoverageStart, CoverageEnd, TravellerCount}` → `{totalPremium, currencyCode, tripDays}` |
| POST   | `Purchase`                  | Charge the wallet and issue a policy                                                                       |
| GET    | `MyInsurance`               | Purchased policies and travellers                                                                          |

`Purchase` body: `InsurancePlanId`, `CoverageStart`, `CoverageEnd`, `DestinationCode`, `TripId`, `Travellers[]` of `{FullName, DateOfBirth, Email, NationalityCode}`.

It returns `paymentSuccess`, `paymentMessage`, `policyNumber`, `purchaseId`, `totalPremium`, `paymentFee`, `currencyCode`, `status`. A declined payment is a **200 response** with `paymentSuccess: false`, not a thrown error.

## Wizard state

State is split: the draft (plan, travellers, quote) lives in `sessionStorage`, while `/insurance/` and `/insurance/travellers` take URL search params for prefill and plan selection:

| Key                               | Contents                                                      |
| --------------------------------- | ------------------------------------------------------------- |
| `wetrip.insurance.trip`           | `{tripId?, destination, destinationCode, startDate, endDate}` |
| `wetrip.insurance.draft`          | plan, travellers, email, trip context, quote                  |
| `wetrip.insurance.purchaseResult` | last successful purchase, read by `/insurance/confirmation`   |

`TripId` is attached to a purchase only when the stored trip dates exactly equal the checkout dates (`tripIdFor`). Otherwise it is `0` and no trip page counts the policy as cover. `saveTrip` keeps a stored `tripId` across edits on `/insurance/` only while the dates still equal the stored ones.

## Query keys

| Key                                                 | Data                         |
| --------------------------------------------------- | ---------------------------- |
| `['insurance','plans']`                             | `Plans` (`staleTime: 5 min`) |
| `['insurance','plans', String(planId), 'benefits']` | `Benefits`                   |
| `['insurance','policies']`                          | `MyInsurance`                |

`Purchase` invalidates policies and the Family profile only when `paymentSuccess === true`.

## Rules

- Start date must be today or later; end date must be on/after the start.
- Traveller date of birth must be in the past (≤120 years); nationality is a 2-letter code; email is required.
- The preview quote is treated as the final premium; checkout shows that premium only. The bank fee and total wallet deduction appear after success on `/insurance/confirmation`, from the `Purchase` response; a missing fee counts as 0 in the total and shows as `-` in the fee row.
- A failed purchase stays on checkout with the bank message.
- Policies with no `TripId` are not matched to trips; they appear under My policies only.

## Files

Screens above plus `api.js`, `queries.js`, `storage.js`, `data.js`, `InsuranceLayout`, `Notice` (a no-op). `extractBenefits` and field-name candidate lists in `api.js` defend against inconsistent backend JSON.

## Tests

- `tests/insurance.spec.js` — destination → plans, validation, checkout quote, successful purchase refreshing the Family balance, failed payment, expired badge, child picker, fee fallback.

## Known issues

- No auth guard; browsing and checkout work signed out until `Purchase` fails server-side.
- `Benefits` has no stable shape; the client probes arrays and several envelope keys.
- `/insurance/confirmation` never re-fetches by purchase id, so clearing storage shows "Purchase not found".
- `TripId` matching is exact-string-date based; a timezone or formatting change drops the link.
- Cover prefill from a trip omits EUR because `COUNTRY_BY_CURRENCY` has no EUR entry.

Back to [architecture](../ARCHITECTURE.md) · [feature index](README.md)
