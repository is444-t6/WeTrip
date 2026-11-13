---
version: alpha
name: YouTrip
description: >-
  The YouTrip Singapore marketing site: an electric purple travel-fintech
  identity built on deep aubergine surfaces, a single mint action colour, oversized
  outlined type and rounded, confident geometry.
colors:
  primary: '#531E8F'
  primary-container: '#6D37AC'
  primary-deep: '#3B2B66'
  ink: '#251B40'
  accent: '#10DBAC'
  accent-bright: '#17D9B1'
  accent-soft: '#77D7AF'
  mint-soft: '#DFFBF2'
  coral: '#EE8370'
  coral-soft: '#FDE9E4'
  violet: '#7041F2'
  surface: '#FFFFFF'
  on-primary: '#FFFFFF'
  text: '#3A3A3A'
  text-muted: '#6B6B6B'
  outline: '#D8CFE8'
  link: '#702D82'
typography:
  display-hero:
    fontFamily: Poppins
    fontSize: 160px
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: -0.03em
  display-hero-sm:
    fontFamily: Poppins
    fontSize: 96px
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: -0.02em
  h1:
    fontFamily: Poppins
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.01em
  h2:
    fontFamily: Poppins
    fontSize: 37px
    fontWeight: 700
    lineHeight: 45px
  h3:
    fontFamily: Poppins
    fontSize: 25px
    fontWeight: 700
    lineHeight: 40px
  h4:
    fontFamily: Poppins
    fontSize: 20px
    fontWeight: 700
    lineHeight: 30px
  eyebrow:
    fontFamily: Poppins
    fontSize: 18px
    fontWeight: 600
    lineHeight: 27px
  body-lg:
    fontFamily: Poppins
    fontSize: 16px
    fontWeight: 400
    lineHeight: 29.71px
  body:
    fontFamily: Poppins
    fontSize: 14px
    fontWeight: 400
    lineHeight: 25px
  caption:
    fontFamily: Poppins
    fontSize: 12px
    fontWeight: 400
    lineHeight: 22px
  nav:
    fontFamily: Poppins
    fontSize: 14px
    fontWeight: 500
    lineHeight: 21px
  button:
    fontFamily: Poppins
    fontSize: 16px
    fontWeight: 700
    lineHeight: 24px
  button-sm:
    fontFamily: Poppins
    fontSize: 14px
    fontWeight: 600
    lineHeight: 21px
  legal:
    fontFamily: Poppins
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.9
rounded:
  sm: 8px
  md: 16px
  tile: 20px
  card: 24px
  xl: 32px
  pill: 100px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 40px
  3xl: 48px
  4xl: 64px
  5xl: 80px
  6xl: 120px
components:
  header:
    backgroundColor: '{colors.primary-deep}'
    textColor: '{colors.on-primary}'
    typography: '{typography.nav}'
    height: 70px
    padding: '0px 40px'
  header-nav-link:
    backgroundColor: '{colors.primary-deep}'
    textColor: '{colors.on-primary}'
    typography: '{typography.nav}'
    padding: '8px 14px'
    rounded: '{rounded.pill}'
  header-signup:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button-sm}'
    rounded: '{rounded.pill}'
    padding: '4px 24px'
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button}'
    rounded: '{rounded.pill}'
    padding: '20px 40px'
    height: 58px
  button-primary-sm:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button-sm}'
    rounded: '{rounded.pill}'
    padding: '10px 24px'
    height: 41px
  button-outline:
    backgroundColor: '{colors.primary-container}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button-sm}'
    rounded: '{rounded.pill}'
    padding: '9px 22px'
  input-pill:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-muted}'
    typography: '{typography.body-lg}'
    rounded: '{rounded.pill}'
    padding: '13px 24px'
    height: 48px
  title-band:
    backgroundColor: '{colors.primary-container}'
    textColor: '{colors.on-primary}'
    typography: '{typography.h2}'
    padding: '40px'
  split-panel:
    backgroundColor: '{colors.primary-container}'
    textColor: '{colors.on-primary}'
    padding: '40px'
  feature-card:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    rounded: '{rounded.card}'
    padding: '32px'
  review-card:
    backgroundColor: '{colors.primary-container}'
    textColor: '{colors.on-primary}'
    rounded: '{rounded.card}'
    padding: '32px'
  partner-card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    rounded: '{rounded.tile}'
  faq-row:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.h4}'
    padding: '20px 0px'
  newsletter:
    backgroundColor: '{colors.violet}'
    textColor: '{colors.on-primary}'
    rounded: '{rounded.sm}'
    padding: '48px 0px'
  footer:
    backgroundColor: '{colors.primary-deep}'
    textColor: '{colors.on-primary}'
    typography: '{typography.body}'
    padding: '48px 0px'
  footer-legal:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.on-primary}'
    typography: '{typography.caption}'
    padding: '24px 0px'
  app-badge:
    backgroundColor: '{colors.primary-deep}'
    textColor: '{colors.on-primary}'
    rounded: '{rounded.md}'
    padding: '8px 14px'
  price-tag:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '6px 14px'
  partner-offer:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button-sm}'
    padding: '16px 12px'
  review-card-alt:
    backgroundColor: '{colors.coral}'
    textColor: '{colors.on-primary}'
    rounded: '{rounded.card}'
    padding: '32px'
  accent-chip:
    backgroundColor: '{colors.accent-soft}'
    textColor: '{colors.primary}'
    rounded: '{rounded.pill}'
    padding: '4px 12px'
  legal-body:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    typography: '{typography.legal}'
    padding: '40px 0px'
  legal-link:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.link}'
    typography: '{typography.legal}'
  app-shell:
    backgroundColor: '{colors.primary-deep}'
    textColor: '{colors.on-primary}'
    typography: '{typography.nav}'
    height: 72px
  app-card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.card}'
    padding: '26px'
  balance-hero:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    rounded: '{rounded.xl}'
    padding: '30px'
  form-field:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    typography: '{typography.body-lg}'
    rounded: '{rounded.md}'
    padding: '13px 16px'
  secondary-button:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary-container}'
    typography: '{typography.button-sm}'
    rounded: '{rounded.pill}'
    padding: '10px 22px'
  app-primary-button:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.primary-deep}'
    typography: '{typography.button}'
    rounded: '{rounded.pill}'
    padding: '12px 24px'
  status-chip-active:
    backgroundColor: '{colors.mint-soft}'
    textColor: '{colors.primary-deep}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '4px 12px'
  status-chip-alert:
    backgroundColor: '{colors.coral-soft}'
    textColor: '{colors.primary-deep}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '4px 12px'
---

## Overview

YouTrip's visual identity is **electric fintech optimism**: a deep, saturated
purple world lit by one high-voltage mint. The site reads like a travel poster
crossed with a product demo — enormous, tightly-set Poppins headlines, full-bleed
duotone photography, floating UI snapshots and chunky pill controls.

The tone is playful and direct ("best rates, it's our thing", "goodbye hidden
fees"), but the structure is disciplined: a 70px aubergine header, a centred
content column, full-bleed 50/50 split panels, and a single mint colour reserved
for every action. Surfaces alternate between `primary` (#531E8F) and
`primary-container` (#6D37AC); the deepest `primary-deep` (#3B2B66) anchors the
header and footer. Colour-blocked illustration halves use mint, coral or violet
with giant outlined words cropped by the panel edge.

The result must feel **big, rounded, flat and confident** — never glassy, never
gradient-heavy, never delicate.

## Colors

- **Primary (#531E8F)** — the brand's deep purple. Section backgrounds, cards and
  the page canvas on marketing pages.
- **Primary Container (#6D37AC)** — the "lit" purple used for split-panel copy
  halves, page-title bands and review cards. It sits one value above primary so
  text halves read as a distinct surface.
- **Primary Deep (#3B2B66)** — aubergine used for the fixed header, safety
  section, footer and dark photographic overlays.
- **Ink (#251B40)** — near-black purple for the footer legal strip.
- **Accent (#10DBAC)** — "YouTrip Mint". Every primary CTA, every arrow chevron,
  every active state. Never use it for large background fields except the
  illustration halves, where it may appear at full strength.
- **Accent Soft (#77D7AF)** — a softer mint used inside illustration assets and
  for low-emphasis accents.
- **Coral (#EE8370)** — the secondary illustration field. Used for alternating
  split panels, review cards, date chips and quote cards. Never a CTA.
- **Violet (#7041F2)** — newsletter band and community imagery background.
- **Surface (#FFFFFF)** — legal pages, partner cards, inputs and content cards.
- **Text (#3A3A3A)** — default body text on white.
- **Link (#702D82)** — inline links on light legal surfaces.
- **Outline (#D8CFE8)** — hairlines, table rules and quiet borders on light
  surfaces. On purple surfaces use white at 30–60% opacity instead.

Mint text on purple is reserved for emphasis and chevrons; body copy is always
white. White text on mint buttons is the established brand pattern — keep the
type bold (600–700) and at least 14px to preserve legibility.

## Typography

**Poppins** is the only brand typeface. Load weights 400, 500, 600, 700 and 800.
Open Sans is only a fallback for the WordPress legal template; do not introduce
it in new work.

- **Hero display** — Poppins 800 at 160px with `-0.03em` tracking. Set two short
  lines ("best" / "rates") then a 64px third line ("all day") in weight 700.
  Keep line-height below 1 so the block feels stacked and poster-like.
- **Section titles** — 37px/45px Poppins 700, usually followed by a mint chevron
  glyph (›) sitting on the baseline. Sentence case, never title case.
- **Card titles** — 25px/40px Poppins 700, white on purple.
- **Body** — 16px/29.7px Poppins 400. Marketing paragraphs are generously led and
  constrained to 32–36 characters per line inside split panels.
- **Eyebrow** — 18px Poppins 600; lowercase and unpunctuated.
- **Navigation / buttons** — 14–16px Poppins 500–700. Buttons are always
  lowercase in the marketing voice ("sign up for free"), sentence case in utility
  contexts ("Subscribe").
- **Legal** — 16px/1.9 Poppins 400 on white, with bold italic run-in headings.

Never use all-caps, decorative display faces, or more than one weight jump
within a single heading.

## Layout

- **Canvas** — 1440px design width. The primary header/content container is
  1140px wide with 40px gutters (content column lands at x=150–1290). Split
  panels are full-bleed 50/50 and ignore the container; their inner copy column
  is inset ~187px from the outer edge.
- **Header** — fixed 70px; logo left, "Personal | Business" beside it, primary nav
  right-aligned before the mint Sign up pill. On mobile the nav collapses to a
  hamburger and the logo shrinks to 98px.
- **Hero** — 550px tall on desktop. Copy occupies the left 42%; product artwork
  breaks the right edge. A mint sign-up panel (273px) follows directly beneath.
- **Split sections** — 550px tall, two equal columns. Alternate the copy side and
  the illustration colour (mint → coral → violet → mint → coral). The copy block
  is vertically centred and never wider than 360px.
- **Cards & grids** — 3-up feature columns with 40px gaps; 4-up partner grid with
  24px gaps; 2-up FAQ/security layouts with 32–40px gaps. Cards use 20–24px
  radii, not shadows.
- **Rhythm** — 80px vertical padding inside standard sections, 40px on cards,
  16–24px between heading and body. Sections butt directly against each other;
  no decorative separators.
- **Responsive** — stack split panels (image first, copy second for feature
  rows), collapse grids to 2-up at 1024px and 1-up at 640px. Hero headline drops
  to 96px / 28px, section titles to 28px, and the fixed header becomes 60px.

## Elevation & Depth

The system is deliberately **flat**. Depth comes from colour blocking and
photographic overlap, not shadows. Only three exceptions exist:

1. Floating price tags and app-store badges get a soft ambient shadow
   (`0 6px 18px rgba(0,0,0,.18)`).
2. The mobile menu and country dropdown use a single elevated panel shadow
   (`0 18px 40px rgba(20,10,40,.35)`).
3. Buttons may carry a faint glow on the dark header
   (`0 0 27px rgba(0,0,0,.12)`), matching the original Sign up pill.

Cards, inputs and sections never use borders plus shadows together. On light
surfaces, a 1px `outline` hairline is preferred over a shadow.

## Shapes

- **Pills everywhere** — buttons, inputs, chips, badges and nav hover states use
  `border-radius: 100px`. This is the strongest signature of the brand.
- **Cards** — 20–24px radius, no visible border on purple; on white use a 1px
  `outline` hairline.
- **Illustration panels** — square corners, full-bleed, with oversized outlined
  words cropped by the panel. Never round the outer edge of a split panel.
- **Icons** — thin 1.5–2px strokes, white; social icons live inside 40px circles.
- **Chevrons** — use the supplied mint arrow asset (or a bold `›` glyph) after
  section titles and in list rows. It should sit on the text baseline, never
  vertically centred.

## Components

- **Header** — fixed aubergine bar. Logo is white with the mint "u" check. Primary
  nav items are white 14px/500 with generous 14px gaps. "Personal" is mint and
  bold; "Business" is white. Sign up is a small mint pill with white 14px/600.
- **Primary button** — mint pill, white 16px/700, 20×40px padding. Hover deepens
  to `#0BC49A`; active translates down 1px. Arrow-led variants append the mint
  chevron asset.
- **Outline button** — transparent purple pill with a 1.5px white border, used
  for "redeem with Y-number" and app-store badges.
- **Inputs** — white pill, no border, 48px tall, grey placeholder. Sign-up phone
  fields are underline-only on the purple hero panel: 1px white 40% rule, white
  label, no box.
- **Section title** — centred 37px white heading followed by the mint chevron.
- **Split panel** — 50% solid copy field (#6D37AC or #531E8F) + 50% illustration
  field (mint/coral/violet with an outlined-word background and a centred 3D
  graphic). Copy: 37px title, 16px body, mint CTA.
- **Feature card** — dark-purple rounded card with a 3D icon, 25px white title and
  centred 16px body. No border.
- **Review card** — 24px-radius card alternating `primary-container` and coral,
  with a large white quote mark, 16px quote and 20px/700 attribution. Cards are
  laid out two-up and horizontally scrolled.
- **Partner card** — white card with a 24px radius, centred logo on a white field
  (min 140px tall) and a solid `primary` footer carrying the offer in 16px/700
  and an outline pill "redeem with Y-number".
- **FAQ row** — full-width white 16px/700 question with a chevron on the right,
  separated by 1px white 30% rules. Answers expand in place in 16px/29.7 body
  copy. Section background is primary.
- **Newsletter band** — violet full-bleed band, 28px/700 white heading with mint
  chevron, white pill input and mint submit pill. On the blog the same component
  becomes a centred photographic band with a 2-line intro.
- **Footer** — `primary-deep` with three columns: "need help?" + email, utility
  links, socials + app badges. Legal strip uses `ink` and 12px copy.
- **App badges** — outlined white 1.5px pills with Apple/Google glyphs, 140×41px.
- **Title band** - 150px `primary-container` strip with a centred 37px page title
  and mint chevron. Used on About, Perks, Community, Blog and legal pages.

### Application layer (WeTrip)

When the system is applied to product screens rather than marketing pages, the
same identity tightens into a working fintech UI:

- **App shell** - 72px `primary-deep` bar with the WeTrip wordmark, pill nav
  tabs (active tab is a mint pill with deep-purple text) and an outline Sign out.
  Home, Trips (SmartFX, the trip hub and Budget), Family and Pay share one pill
  rail; on mobile the rail wraps onto extra header rows rather than scrolling
  off-screen. Budget and Insurance are reached from a trip or Home. An Insurance
  pill appears only on the insurance screens, with a hover/focus submenu on
  desktop and a visible row on phones. Scan to Pay and My Payments switch with a
  tab strip inside the Pay screens.
- **Balance hero** - 28px-radius purple gradient card; 56px Poppins 800 amount,
  translucent chips for context, and one oversized outlined currency code
  (`SGD`, `JPY`) bleeding off the bottom-right corner.
- **Cards** - white 24px-radius surfaces on a warm lavender canvas (`#F6F1FB`),
  one hairline `outline` border and the ambient shadow only. No nested cards.
- **Forms** - 14px-radius fields on a barely-tinted surface, mint focus ring,
  labels in 13px Poppins 600. Primary submit is always a full-width mint pill.
- **Primary button labels** - marketing pages keep white labels on mint, but
  product screens use deep aubergine (`primary-deep`) labels on mint for a
  usable 8.97:1 contrast ratio. This is the one intentional label-colour
  exception, so a product screen never pairs small white type with mint.
- **Status** - mint-soft chips for active/success, coral-soft for over-budget and
  rejected, warm amber for pending. Never rely on colour alone; pair with a word.
- **Progress** - 10px pill track with a mint fill; switches to coral when a
  budget is exceeded.
- **Data** - tables stay inside white cards, use 13px/1.5 numerals and scroll
  horizontally on mobile rather than shrinking the type.

## Do's and Don'ts

**Do**

- Keep one mint action per view. Mint means "go".
- Set headlines tight, large and lowercase. Let them dominate the panel.
- Alternate purple copy fields with mint/coral/violet illustration fields.
- Crop outlined display words at panel edges for energy.
- Use real product photography and 3D UI snapshots rather than illustrations of
  generic phones.
- Preserve the fixed aubergine header and its 70px rhythm on every page.

**Don't**

- Don't introduce gradients beyond the supplied hero photographic gradients.
- Don't use mint for large text blocks or full-page backgrounds.
- Don't add drop shadows to cards, sections or inputs.
- Don't centre long paragraphs; centre only section titles and short intros.
- Don't use rounded corners on full-bleed split panels or title bands.
- Don't mix in a second typeface or use all-caps labels.
- Don't recolour marketing-site mint CTA text to purple for "contrast"; keep
  brand white and make the type bold and large instead. Product/app buttons are
  the documented exception: they use `primary-deep` labels for WCAG contrast.
