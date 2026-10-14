# GERMANY-DATA — figures for the seed and the defaults (research 2026-10-14)

**Convention:**
- In the app every amount is **net, without the 19% VAT** (CONTRACTS §1).
- `(est.)` marks an estimate. Everything else has a source next to it.
- **Nuance for SOLUTION.md:** a developer (Bauträger) sells a new house VAT-exempt (§4 Nr. 9a UStG, Grunderwerbsteuer is charged instead). So it cannot reclaim the VAT it pays on construction (§15 Abs. 2 UStG), and its real costs are **gross**. We keep net figures as a simplifying assumption. A net/gross toggle is in "next steps".

---

## 1. Location and plot: **Taucha** (Landkreis Nordsachsen, Saxony, 04425), 10 km north-east of Leipzig

**Why Taucha:**
- It has the S-Bahn and several current development plans (B-Plans) for detached houses (Nr. 48, 49, 55, 59).
- Land prices are moderate: Bodenrichtwert **171 €/m²** (range 44–429, as of 01.01.2024).
  Sources: https://www.bodenrichtwerte-deutschland.de/bodenrichtwert/sachsen/taucha, https://www.landkreis-nordsachsen.de/landratsamt/aktuelles/nachrichten/artikel/neue-bodenrichtwerte-fuer-nordsachsen-ermittelt
- Asking prices average 293 €/m²: https://www.aktuelle-grundstueckspreise.de/deutschland/sachsen/nordsachsen/taucha
- For comparison: Markkleeberg 412 €/m², Markranstädt ~110–114 €/m².

### Plot (seed)

| Item | Value | Source |
|---|---|---|
| Plot | 520 m², approx. **26 × 20 m**, new estate under B-Plan Nr. 55 "Gartenstadt", fully developed ("voll erschlossen") | https://gartenstadt-taucha.de/ |
| Price | 260 €/m² → **135,200 €** | (est.) between Bodenrichtwert and asking price |
| Grunderwerbsteuer (Saxony) | 5.5 % → **7,436 €** | https://viarealis.de/grunderwerbsteuer-sachsen-2026-was-kaeufer-in-dresden-beim-immobilienkauf-an-kaufnebenkosten-wirklich-einplanen-muessen/ |
| Notary | ~1.5 % → 2,028 € | same |
| Land registry (Grundbuch) | ~0.5 % → 676 € | same |
| Broker (if used) | 3.57 % gross. § 656c BGB does not apply to undeveloped land | https://immobilien-rosenberg-leipzig.de/maklerprovision-sachsen-wer-zahlt-wie-viel/ |

### Utility connections (seed)

| Type (UtilityType) | Status | Cost € net | Note |
|---|---|---|---|
| POWER | AT_BOUNDARY | 2,300 | Range 2,000–4,000. https://www.deutschland-rechner.de/hausanschluss-kosten-rechner |
| WATER | AT_BOUNDARY | 3,000 | Range 2,000–5,000. https://handwerksguide.de/blog/hausanschluss-kosten/ |
| SEWER (+ STORMWATER) | AT_BOUNDARY | 3,500 | Range 3,000–8,000. Till drains poorly, so plan a cistern or throttled discharge (est.) |
| TELECOM (fibre) | IN_STREET | 700 | Range 0–2,000 |
| GAS | IN_STREET | 0 | Not connected: heat pump. A gas connection would cost 1,000–3,000 |
| DISTRICT_HEATING | NOT_AVAILABLE | — | |
| Multi-utility wall entry | — | 600 (est.) | |
| Temporary site power and water | — | 900 (est.) | |
| **Total** | | **11,000** | The development charge is 0 because the plot is sold fully developed. Otherwise 520 × 25 = 13,000 (est.) |

### Soil and B-Plan (seed)

- **Geology:**
  - Saale-age glacial till (Geschiebelehm/-mergel) over meltwater sands. In Gartenstadt the till is 0–1.6 m thick and **no perched water** was found.
  - Groundwater is ~7 m below ground.
  - Sources: https://www.taucha.de/dokumente/b-plaene-neu/rechtskraeftige-bebauungsplaene/bebauungsplan-nr-55-gartenstadt/bp55-gartenstadt-begruendung-anlage6-bodenuntersuchung-ehem-kim-gelaende.pdf?cid=1dv, https://www.taucha.de/dokumente/b-plaene-neu/rechtskraeftige-bebauungsplaene/bebauungsplan-nr-49-an-den-alten-gaertnereien/begruendung-zum-bebauungsplan-nr.-49.pdf?cid=8p4
- **Soil class:** old DIN 18300 class 4 ("mittelschwer lösbar"), geotechnical category GK2 (est.). Soil survey **1,500 €**: https://hausbaujournal.com/grundstueck/bodengutachten/
- **B-Plan:**
  - General residential area (WA), **GRZ 0.4**, GFZ 0.8 (est.), **max. II full storeys**, detached houses only.
  - Hipped/pyramid or gabled roof, 18–45° (est.). Eaves height ≤ 6.5 m (est.). Building line ≥ 3 m (est.).
  - Source: http://docplayer.org/145644906-Stadt-taucha-landkreis-nordsachsen-textliche-festsetzungen-zum-bebauungsplan-nr-48-partheblick.html

## 2. House: urban villa (Stadtvilla), 2 full storeys, **144 m²**, family of 4, KfW EH55, heat pump

**Prototype** (to re-draw as rectangles): Town & Country "Stadtvilla Flair 145", 9.5 × 9.5 m, 144.43 m², pyramid roof. https://massivhaus-euskirchen.tc.de/ueber-uns/stadtvilla-flair-145

**Our variant:**
- Outer dimensions **10.0 × 9.0 m** (`footprintWidthCm 1000`, `footprintDepthCm 900`), pyramid roof at 22°, no basement.
- Walls: sand-lime brick 17.5 cm + 18 cm EPS insulation system (WDVS).
- Gross floor area 180 m².
- On the 26 × 20 m plot the house sits **4.0 m from the street and 8.0 m from the left boundary** (`siteOffsetXcm 800`, `siteOffsetYcm 400`). Site coverage: 90 m² house + ~40 m² carport/paths ≤ 208 m² allowed by GRZ.

Inner area of the shell: 10.00 × 9.00 m outside minus walls of 35.5 cm (sand-lime brick 17.5 + EPS 18) ≈ **929 × 829 cm**. The rooms are rectangles **without interior wall thickness** inside a 920 × 820 cm frame (x,y,w,h in cm, origin at the house's top-left inner corner). They are checked: no overlaps and within bounds.

| Floor | Room (code) | kind | x,y,w,h (cm) | m² |
|---|---|---|---|---|
| 0 | Living + dining `GF-LIV` | living | 0,0,560,590 | 33.04 |
| 0 | Kitchen `GF-KIT` | kitchen | 560,0,360,280 | 10.08 |
| 0 | Study / guest `GF-STU` | office | 560,280,360,270 | 9.72 |
| 0 | Utility / technical `GF-UTL` | utility | 560,550,360,190 | 6.84 |
| 0 | Shower / WC `GF-WC` | bath | 0,590,250,200 | 5.00 |
| 0 | Hall + stairs `GF-HAL` | hall | 250,590,310,230 | 7.13 |
| | **GF total** | | | **71.81** |
| 1 | Master bedroom `UF-MBR` | bedroom | 0,0,450,340 | 15.30 |
| 1 | Dressing `UF-DRS` | storage | 0,340,200,200 | 4.00 |
| 1 | Child 1 `UF-CH1` | bedroom | 450,0,470,270 | 12.69 |
| 1 | Child 2 `UF-CH2` | bedroom | 450,270,470,270 | 12.69 |
| 1 | Landing + stairs `UF-GAL` | hall | 200,340,250,300 | 7.50 |
| 1 | Bathroom `UF-BTH` | bath | 450,540,470,230 | 10.81 |
| 1 | Storage `UF-STO` | storage | 0,540,200,150 | 3.00 |
| 1 | Home office nook `UF-HOB` | office | 0,690,450,130 | 5.85 |
| | **UF total** | | | **71.84** |
| | **Living area (Σ rooms)** | | | **143.65 ≈ 144** |

Block 08 may fine-tune the rectangles if it keeps the checks (no overlaps, within 920 × 820). The living area in the UI is **always computed** as Σ rooms.
Heating and ventilation: 7 kW air-to-water heat pump (monoblock) + underfloor heating + central ventilation with heat recovery.
KfW 297/298 "Klimafreundlicher Neubau": EH55 loan up to 100,000 €, available until 31.12.2026. https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Klimafreundlicher-Neubau-Wohngeb%C3%A4ude-(297-298)/

## 3. Construction costs (net, Saxony, 2026, subcontractor prices)

**Benchmarks:**
- BKI single-family house from 2,338 €/m² gross: https://baukostenplan.de/baukosten/bayern
- Destatis construction price index, Aug 2026: **+5.5 % year on year**. Shell +5.4, roofing +7.6, electrical +7.2, heating +5.2, WDVS +5.7. https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/10/PD26_360_61261.html
- Saxony is 10–20 % cheaper than Bavaria/Baden-Württemberg. **This house: ~2,040 €/m² net.**

| # | Trade → section (MATERIALS / CONSTRUCTION) | Quantity | Net € (materials + labour) | Source |
|---|---|---|---|---|
| 1 | Site setup + scaffolding → `site-setup` | lump sum, ~250 m² scaffold | 7,000 | (est.), scaffold 10–20 €/m² |
| 2 | Earthworks → `earthworks` | ~120 m³ | 9,000 | (est.) |
| 3 | Foundation slab with frost apron, XPS → `concrete` + `earthworks` | 90 m², ~32 m³ concrete | 22,000 | (est.) |
| 4 | Shell: walls, floor slab, ring beams → `concrete`/`masonry` + `shell` | 177 m² outer + 90 m² inner + 80 m² slab | 60,000 | (est.) |
| 5 | Roof structure (carpentry) → `roofing` + `roof` | ~120 m² | 16,000 | (est.) |
| 6 | Roofing + gutters and flashing → `roofing` + `roof` | 120 m² | 15,000 | https://greenox-group.de/preis-dachziegel/ |
| 7 | Windows + front door + 14 roller shutters → `windows-doors` + `windows-install` | 32 m² | 22,600 | https://energieheld.de/fenster/kosten |
| 8 | WDVS 18 cm EPS + render → `insulation-facade` + `facade` | ~196 m² | 23,500 | https://juba-bau.de/ratgeber-was-kostet-verputzen.html |
| 9 | Interior plaster → `drywall-plaster` + `plaster-screed` | ~420 m² | 8,000 | same |
| 10 | Anhydrite screed → `drywall-plaster` + `plaster-screed` | ~150 m² | 5,500 | https://estriche-otten.de/estrich-kosten-pro-qm/ |
| 11 | Electrical, RAL 2 stars → `electrical` + `electrical-install` | 144 m² | 17,000 | https://www.clean-invoice.com/wissen/allgemein/elektroinstallation-kosten |
| 12 | Plumbing / sanitary (2 bathrooms) → `plumbing` + `plumbing-install` | 2 | 18,000 | (est.) |
| 13 | Heat pump 7 kW + underfloor heating → `heating` + `heating-install` | 144 m² | 22,500 | https://www.alpha-innotec.com/de/ratgeber/wissensquelle-warmepumpe/warmepumpe-kosten |
| 14 | Ventilation with heat recovery → `heating` + `heating-install` | 144 m² | 9,000 | https://www.heizsparer.de/lueftungsanlage/kosten-einer-wohnraumlueftung |
| 15 | Drywall → `drywall-plaster` + `drywall` | ~90 m² | 6,500 | https://www.daibau.de/baukostenrechner/trockenbau |
| 16 | Flooring (parquet / vinyl) → `flooring-tiles` + `flooring-tiling` | ~105 m² | 7,000 | https://floor4all.de/blogs/ratgeber/parkett-kosten-preis-pro-m2 |
| 17 | Tiling → `flooring-tiles` + `flooring-tiling` | ~75 m² | 8,000 | https://profirechner.de/fliesenleger-kosten-rechner/ |
| 18 | Painting → `paint` + `painting` | ~570 m² | 5,500 | https://anyhelpnow.com/blog/waende-streichen-kosten-2025 |
| 19 | Timber stair → `windows-doors`* + `drywall`* (or a separate item in `shell`) | 1 | 6,500 | https://www.holztreppengazdzicki.de/ratgeber/treppen-kosten-2025-was-kostet-eine-neue-treppe |
| 20 | Interior doors → `windows-doors` + `windows-install` | 8 | 4,800 | (est.) |
| | **Total KG 300 + 400** | | **293,400** | **2,038 €/m²** |
| 21 | Outdoor works KG 500 → `exterior` + `outdoor` | | 22,000 | (est.) 15–40k |

**Materials vs labour split (est.):** the seed splits each trade into MATERIAL rows (MATERIALS category) and WORK rows (CONSTRUCTION category).
- Shell / concrete: 45 % / 55 %
- Windows / heat pump: 70 / 30
- Electrical / plumbing: 40 / 60
- Plaster / painting / tiling: 30 / 70
- Roofing: 50 / 50
- WDVS: 45 / 55

### Key materials

| Material | Unit price (net) | Quantity | Source |
|---|---|---|---|
| Ready-mix concrete C25/30 | 2025: 151–156 €/m³ (Manzke). **2026: 192.50 €/m³** (Heidelberg, TBG Lohr) | ~51 m³ (slab 22.5, apron 9, floor slab 16, ring beams 3) | https://www.manzke.com/wp-content/uploads/20250926_Manzke_Beton_Preisliste_2025.pdf, https://www.heidelbergmaterials.de/system/files/2025-12/Heidelberg%20Materials%20Preisliste_TBG_Lohr_Beton.pdf |
| Rebar B500B, cut and bent | ~1,250 €/t (est.). Wholesale 590–615 €/t | ~3.5 t | https://www.stahlpreise.eu/2025/11/aktuelle-betonstahlpreise-pro-tonne-1000-kg-november-2025.html |
| Sand-lime brick 17.5 | 25–35 €/m² (est.) | 177 + 90 m² | |
| Poroton Plan-T9-36.5 (alternative) | ~97 €/m² net | 177 m² | https://www.baustoffshop.de/poroton-planziegel-plan-t9-36-5-12-df.html |
| Concrete roof tiles | 10–25 €/m² | 120 m² | https://greenox-group.de/preis-dachziegel/ |
| EPS 032, 180 mm | ~15.5 €/m² net (≈100 €/m³ gross) | ~200 m² | https://www.baustoffhandel-witschel.de/wdvs-daemmplatte-eps-wlg-032.html |
| Mineral wool (top-floor ceiling) | 8–20 €/m² | ~85 m² | |
| Windows, 3-pane PVC | ~350 €/m² + fitting 60–150 €/m² | 32 m² | https://www.rekord-fenster.com/ratgeber/was-kosten-fenster-und-tueren/ |
| Cable NYM-J 3×1.5 | ~0.70 €/m net | ~1,200 m | https://www.hornbach.de/p/mantelleitung-nym-j-3x1-5-mm-100-m-grau/5042092/ |
| Socket, installed | 80–150 € | 60–80 | clean-invoice |
| Meter cabinet + distribution board | 2,500–3,500 € | 1 | clean-invoice |
| Heat pump Vaillant aroTHERM plus VWL 75/8.1 A | Street price **5,369 € net** (list 9,875 net). **Delivery 2–3 months** | 1 | https://www.heizungsdiscount24.de/waermepumpen/vaillant-arotherm-plus-vwl-7581-a-luft-wasser-waermepumpe-7-kw-monoblock-230-v.html |
| Screed | 20–35 €/m² gross, incl. laying | 150 m² | |
| Tiles | 10–50 €/m² | 75 m² | |

**Hourly labour rates (net, Saxony seed):** mason 48, electrician 52, plumbing/heating (SHK) 58, tiler 46, carpenter/roofer 52, painter/drywall 45, labourer 36 €/h. Source: https://www.repairai.de/ratgeber/handwerker-stundenlohn

## 4. Soft costs (net)

| Item → section | € | Source |
|---|---|---|
| Architect HOAI 2021 § 35, fee zone III, 300k eligible costs, base rate → `design` | **39,981**. Work stages (LPH): 1: 800 · 2: 2,799 · 3: 5,997 · 4: 1,199 · 5: 9,995 · 6: 3,998 · 7: 1,599 · 8: 12,794 · 9: 800 | https://dejure.org/gesetze/HOAI/35.html |
| Structural engineer → `engineering` | 3,500 | https://www.deutschland-rechner.de/baugenehmigung-kosten-rechner |
| Energy certificate / GEG compliance proof → `engineering` | 800 | same |
| KfW supervision + blower-door test → `engineering` | 2,000 + 500 (est.) | |
| Building permit, Saxony (5–7 ‰) → `permits` | 1,800 | https://hausbaujournal.com/hausbau/bauantrag/ |
| Surveyor → `surveys` (LAND) | 2,000 (est.) | |
| Soil survey → `surveys` (LAND) | 1,500 | |
| Builder's liability insurance + construction all-risk insurance → `insurance` | 100 + 600 | https://www.huk.de/haus-haftung-recht/haftpflichtversicherung/bauherrenhaftpflicht.html |
| **Contingency** → CONSTRUCTION `contingency` (a budget line with no items) | **29,340** (10 % of KG 300+400) | https://hausbaufirma.com/haus-bauen-kosten/ |

> CR-00 (already accounted for): `contingency` "Contingency reserve" is added to the CONSTRUCTION catalogue (CONTRACTS §4).

## 5. Company markup: **15 %** (`markupBps 1500`)

- Company overhead (AGK) 6–12 %. Risk + profit 1.5–8 %. Typical general-contractor markup 8–12.5 %. Developer margin 10–15 %.
- Sources: https://vergabescanner.de/blog/baukalkulation-zuschlaege-bgk-agk-wug/, https://bau.net/forum/neubau/15232.php
- We use 15 % = overhead 8 + risk 2 + profit 5 (est.). Site overhead is already a line item (`site-setup`), so it is not counted twice.
- In the app the markup is applied to the **whole approved budget**: `contractPrice = approved × 1.15` (the price for the client or the sale price). This is a simplification; record it in SOLUTION.md.

## 6. Marketing (Europe / Germany): sections and seed (net)

| Section | Line items | € | Source |
|---|---|---|---|
| `listings` Property portals | ImmoScout24 + Immowelt project packages, 4 months | 1,600 | https://privatverkaufen.de/ratgeber/immobilienanzeigen-kosten-portale/ |
| `paid-search` Paid search | Google Ads "Haus bauen Leipzig", "Neubau Taucha": 30 €/day × 90 days, CPC 2–6 € | 2,700 | https://ostend.digital/google-ads-kosten/ |
| `social` Social media ads | Meta/Instagram lead ads, ~1,000 €/month × 3, CPL 15–60 € | 3,000 | https://maklerstube.de/blog/leadgenerierung/meta-ads-immobilienmakler/ |
| `website-seo` Website & SEO | Landing page 2,500 + SEO/local listings 400 × 4 | 4,100 (est.) | |
| `visuals` Renders & virtual tours | 2–3 exterior renders, 360° tour | 2,500 | https://pure3d.de/kosten-fuer-3d-architekturvisualisierung/ |
| `print-signage` Print & site signage | Site sign (Bauschild) 3×2 m 2,000 + 250 brochures 900 + flyers 200 | 3,100 | https://www.bannerstop.com/bauschilder.html |
| `events` Show house & open days | 2 open days at 1,500 (a show-home park is not worth it for one house) | 3,000 (est.) | https://www.fertighaus.de/haeuser/musterhausparks/ |
| `sales-commission` Sales commission | Broker 3.57 % gross per side (§ 656c BGB). In the demo: 0 (sold directly) | 0 | |
| **Total** | | **~20,000** (≈3 % of the price) | |

## 7. Timeline and lead times (for dates in the seed)

A solid-masonry house takes 8–14 months. Sources: https://dus2b.de/blog/wie-lange-dauert-ein-hausbau/, https://pieno.at/bauzeitenplan-einfamilienhaus-dauer-phasen/

| Weeks from earthworks start | Work | Material lead time / order by |
|---|---|---|
| 1–2 | Earthworks | |
| 3–4 | Foundation slab (+28 days curing) | Concrete: order 3 days ahead |
| 5–10 | Walls GF, floor slab, walls UF | Precast slabs 3–4 weeks (est.) |
| 11–12 | Roof structure → topping-out ceremony | |
| 12–14 | Roofing | Roof tiles 3–6 weeks (est.) |
| 13–14 | Windows + front door | **Windows 12–16 weeks**, order at shell start. https://www.fensterblick.de/hausbau-wann-fenster-bestellen.html |
| 14–19 | First-fix electrical, plumbing, ventilation | **Heat pump 6–12 weeks** (Vaillant 2–3 months). https://www.enter.de/blog/lieferzeiten-waermepumpe |
| 15–20 | WDVS | |
| 18–21 | Drywall | |
| 19–21 | Interior plaster | |
| 22–23 | Screed, then 4–6 weeks drying | |
| 28–30 | Tiling | |
| 30–32 | Painting | |
| 31–33 | Flooring, stairs, doors | Stairs 6–10 weeks after measuring; doors 4–8 weeks (est.) |
| 33–35 | Second fix, heat pump commissioning, blower-door test | Grid connection 8–12 weeks after application (est.) |
| 34–38 | Outdoor works | |
| 38–39 | Handover (Abnahme) | |

**Seed schedule (CONSTRUCTION, WORK rows; the schedule has slipped against the template above, which is realistic):**

| Section | start → end | status at 2026-10-14 | Linked materials: delivery (`deliveryDate` / `deliveredDate`) |
|---|---|---|---|
| site-setup | 2026-06-01 → 2027-03-26 | PARTIAL | — |
| earthworks (+ slab) | 2026-06-01 → 2026-06-26 | DONE | concrete slab: delivered 2026-06-15; rebar: delivered 2026-06-10; XPS: delivered 2026-06-12 |
| shell | 2026-06-29 → 2026-08-28 | DONE | sand-lime brick: delivered 2026-06-26; floor-slab concrete: delivered 2026-07-27 |
| roof (carpentry) | 2026-08-31 → 2026-09-18 | DONE | roof timber: delivered 2026-08-28 |
| roof (roofing) | 2026-09-21 → 2026-10-16 | CONTRACTED | concrete roof tiles: delivered 2026-09-15 |
| windows-install | **2026-10-19** → 2026-10-30 | CONTRACTED | windows: expected **2026-10-28** (LATE_FOR_WORK 9 d); front door: expected 2026-10-16 |
| electrical-install (first fix) | 2026-10-12 → 2026-11-20 | PARTIAL | NYM-J cable: delivered 2026-10-08; distribution board: delivered 2026-10-09 |
| plumbing-install | 2026-10-12 → 2026-11-20 | CONTRACTED | pipes: delivered 2026-10-09 |
| heating-install | **2026-11-02** → 2026-11-27 | CONTRACTED | heat pump: expected **2026-11-20** (LATE_FOR_WORK 18 d); UFH pipes: expected 2026-10-29 |
| facade (ETICS) | 2026-10-26 → 2026-11-27 | PLANNED | EPS 032 180 mm: expected 2026-10-22 |
| drywall | 2026-11-23 → 2026-12-11 | PLANNED | gypsum boards: expected 2026-11-18 |
| plaster-screed | **2026-11-30** → 2026-12-18 | PLANNED | gypsum plaster: expected **2026-11-28** (AT_RISK, slack 2 d); anhydrite screed: expected 2026-11-26 |
| flooring-tiling | 2027-01-18 → 2027-02-12 | PLANNED | tiles: expected 2027-01-11; parquet: expected 2027-01-14 |
| painting | 2027-02-01 → 2027-02-19 | PLANNED | paint: expected 2027-01-27 |
| outdoor | 2027-03-01 → 2027-03-26 | PLANNED | paving stones: expected 2027-02-24 |
| stairs / interior doors (within windows-install, 2nd row) | 2027-02-15 → 2027-02-26 | PLANNED | stairs: expected 2027-02-10; doors: expected 2027-02-08 |

Marketing (SERVICE, MARKETING): website-seo 2026-09-01 → 2027-01-31; visuals 2026-10-01 → 2026-11-15; listings and paid-search 2026-11-01 → 2027-02-28; social 2026-11-15 → 2027-02-15; print-signage 2026-07-01 → 2027-03-31; events 2027-02-20 and 2027-03-13 (one-day events).

**Demo dates:**
- "Today" is 2026-10-14.
- Earthworks started **2026-06-01**, so 2026-10-14 is week ~20.
- Done: earthworks, slab, shell, roof structure.
- In progress: roofing is finishing, first-fix electrical and plumbing has started, windows are late (below).
- Planned demo conflicts, which block 03 must seed:
  1. **Windows**: installation starts 2026-10-19, but the windows are confirmed for delivery on 2026-10-28 → LATE_FOR_WORK by 9 days.
  2. **Heat pump**: installation of the heating starts 2026-11-02, but the heat pump arrives on 2026-11-20 → LATE_FOR_WORK by 18 days.
  3. **Plaster** is AT_RISK: delivery is 2 days before the work starts (slack 2 < 3).
- Planned overruns:
  - **Concrete** (2025 budget at 154 €/m³, 2026 price 192.50 €/m³) → forecast > approved.
  - **Electrical** (+7.2 % index plus extra sockets).
  - **Earthworks** (a till "nest" and extra soil removal, an addendum of +3,800).
  - The other lines are within budget, and contingency covers part of the overrun.

## 8. Fictional organisations (`Organization`, all addresses and contacts are fictional)

| slug | Name | City | role | Contact (contactRole) | Phone | Email |
|---|---|---|---|---|---|---|
| `parthe-bau` | Parthe-Bau Rohbau GmbH | Taucha | CONTRACTOR | Torsten Weickert (Site manager) | +49 34298 41207 | t.weickert@parthe-bau.example |
| `ltb-nord` | Leipziger Transportbeton Nord GmbH & Co. KG | Leipzig | SUPPLIER | Sabine Krahl (Dispatch) | +49 341 9284 110 | dispo@ltb-nord.example |
| `muehlberg-dach` | Holzbau & Bedachung Mühlberg | Eilenburg | CONTRACTOR | Jens Mühlberg (Owner) | +49 3423 75 0318 | info@muehlberg-dach.example |
| `fensterwerk-sachsen` | Fensterwerk Sachsen GmbH | Wurzen | SUPPLIER | Katrin Oehme (Key account) | +49 3425 88 4410 | k.oehme@fensterwerk-sachsen.example |
| `elektro-brauer` | Elektro Brauer & Söhne | Taucha | CONTRACTOR | Michael Brauer (Master electrician) | +49 34298 6630 | m.brauer@elektro-brauer.example |
| `waermekonzept-ns` | WärmeKonzept Nordsachsen GmbH | Leipzig | CONTRACTOR | Daniela Fiedler (Project manager) | +49 341 2470 655 | d.fiedler@waermekonzept-ns.example |
| `lindner-putz` | Putz & Estrich Lindner KG | Delitzsch | CONTRACTOR | Ronny Lindner (Managing director) | +49 34202 51 940 | r.lindner@lindner-putz.example |
| `rietzschke-baustoffe` | Baustoffhandel Rietzschke | Leipzig | SUPPLIER | Uwe Rietzschke (Sales) | +49 341 6018 220 | verkauf@rietzschke-baustoffe.example |
| `ib-poege` | Ingenieurbüro Statik Pöge | Leipzig | CONSULTANT | Dr. Anja Pöge (Structural engineer) | +49 341 3095 471 | a.poege@ib-poege.example |
| `vermessung-kuntze` | Vermessung Kuntze ÖbVI | Taucha | CONSULTANT | Frank Kuntze (Licensed surveyor) | +49 34298 3388 | f.kuntze@vermessung-kuntze.example |
| `architekten-sommer` | Sommer Architekten PartGmbB (est.) | Leipzig | CONSULTANT | Lena Sommer (Architect) | +49 341 5562 300 | l.sommer@sommer-architekten.example |
| `nordlicht-marketing` | Nordlicht Immobilienmarketing GmbH (est.) | Leipzig | AGENCY | Paul Hartig (Account manager) | +49 341 8890 120 | p.hartig@nordlicht-marketing.example |
| `heizungsgrosshandel-mitte` | Heizungsgroßhandel Mitte GmbH (est.) | Halle (Saale) | SUPPLIER | Ines Bauer (Sales) | +49 345 2200 410 | i.bauer@hgh-mitte.example |
| `stadt-taucha` | Stadt Taucha — Bauamt | Taucha | AUTHORITY | Building department | +49 34298 700 | bauamt@taucha.example |

## 9. Approved budget for the demo project (net) — exact per-line amounts (`approvedCents` = € × 100)

| Category | Lines (section: €) | Σ € |
|---|---|---|
| LAND | purchase 135,200 · acquisition-costs 10,140 · site-development 11,000 · surveys 3,500 | **159,840** |
| ARCHITECTURE | design 39,981 · engineering 6,800 · permits 1,800 · insurance 700 | **49,281** |
| MATERIALS | concrete 21,900 · masonry 15,000 · roofing 15,500 · windows-doors 23,730 · insulation-facade 10,575 · drywall-plaster 6,650 · electrical 6,800 · plumbing 7,200 · heating 21,150 · flooring-tiles 5,900 · paint 1,650 · exterior 8,800 | **144,855** |
| CONSTRUCTION | site-setup 7,000 · earthworks 21,100 · shell 33,000 · roof 15,500 · windows-install 10,170 · facade 12,925 · plaster-screed 9,450 · electrical-install 10,200 · plumbing-install 10,800 · heating-install 10,350 · drywall 3,900 · flooring-tiling 9,100 · painting 3,850 · outdoor 13,200 · contingency 29,340 | **199,885** |
| MARKETING | listings 1,600 · paid-search 2,700 · social 3,000 · website-seo 4,100 · visuals 2,500 · print-signage 3,100 · events 3,000 · sales-commission 0 | **20,000** |
| **Total approved (cost)** | | **= 573,861.00** |

Contract price at 15 %: **= 659,940.15 €** (exactly: 57,386,100 × 11,500 / 10,000 = 65,994,015 cents). Planned profit = 86,079.15 €.
How the trades were split into MATERIALS/CONSTRUCTION (shares from §3):
- Foundation slab: 45 % concrete / 55 % earthworks.
- Shell: 20 % concrete + 25 % masonry / 55 % shell.
- Stairs and interior doors: 70/30 into windows-doors / windows-install.
- Ventilation: 60/40 into heating / heating-install.
- Drywall: 40/60.
- Flooring: 50/50.
- Tiling: 30/70.
- Outdoor works: 40/60 into exterior / outdoor.
- Site setup and earthworks: 100 % work.

Other seed projects (for Analytics):
- `markranstaedt-bungalow`: completed 2025, ~110 m², land 112 €/m², small overrun.
- `markkleeberg-villa`: PLANNING, land 412 €/m², no actuals yet.
- `template-efh-144`: `isTemplate`, the demo's budget with everything PLANNED and no actuals or dates, for the wizard.
