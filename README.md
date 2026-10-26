# WeTrip Family

Coded React frontend for the FamilyWallet feature. Talks only to
`Family_Composite`'s `Family` REST API — never to `Family_Atomic`, never
directly to SMUtBank.

## Run the app

```
npm install
npm run dev
```

Fill in `.env.local` first (`VITE_FAMILY_API_KEY` = the `ApiKey` Site
Property from `Family_Composite`). The dev server proxies `/api/family/*` to
`WeTrip_Family_Composite/rest/Family` (see `vite.config.js`), so CORS never
comes up locally.

Before any screen works, you need a session. Visit `/family/dev-login` and
enter a demo customer's `CustomerId` + deposit `AccountId` — this writes a
stub token into `sessionStorage` that `ValidateSessionStub` (Task 12.4 Option
C) expects. Swap this for real WeTrip login later; nothing else in
`src/features/family` needs to change.

## Test the OutSystems setup

Plain Node scripts, no Postman needed — they replicate the build guide's
Task 10 and Task 20.3 test tables against your live endpoints.

```
cp .env.test.example .env.test   # fill in real values
npm run test:atomic               # Family_Atomic only, writes test rows
npm run test:composite            # Family_Composite + real SMUtBank calls
```

`test:composite` moves real sandbox money (TopUp, allowance, ChildSpend) and
creates a family link — only run it against demo accounts you're fine
mutating. It's safe to re-run (it reuses an existing link if one exists).
