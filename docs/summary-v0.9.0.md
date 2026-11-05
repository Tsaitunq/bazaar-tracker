# Summary 0.9.0 (guide app, Blaze values)

Branch `feat/blaze-values`: docs first (`blaze-gaps.md`, `blaze-data.md`,
`plan-blaze-values.md`), then one small commit per step of the plan. Not pushed,
not merged. All tests run on fixtures, no live API.

## What changed

- `gamedata/stats.json`: `category` per stat, plus the Fear stat.
- `gamedata/pets.json`: Blaze (Legendary, Lv 100) with computed perks, and the
  pet item table (Crochet Tiger Plushie, +35 Attack Speed).
- `gamedata/attributes.json`: mob family on resistances and fortunes, notes for
  the damage attributes, Unlimited Fortitude as +0.2 % Defense per level, and
  `mcIcon` for the seven shards NEU has no head for.
- `optimizer-data.js`: Ancient and Glistening Intelligence, Coldfused Magic Find,
  reforge targets, Catacombs bonus, potato books, Crimson stars, Dominus per tier,
  the conditional enchant lines.
- `pieces.js` (new): stars, potato books and Bling Armor on a worn piece.
- `blaze.js`: `setBonusOf`, Ferocity in the damage formula.
- `guide/gear.js`: pet item, piece extras, set bonus, Chimera, accessories as a
  change since the measurement, conditional lines.
- `guide/totals.js`: Nether Embodiment after the sum, attribute families.
- Guide app: Blaze measures the Combat menu without Health Regen and Vitality,
  plus Speed and Magic Find; Power page has the gear options and the pet item.
- Seven Vanilla textures in `guide/img/mc/` for the shards without a head.

## Assumptions (marked, to confirm)

Order of the maths on a piece; Fuming books doubled by the pet; Crimson stars
count everywhere; Withered and Ancient count the Catacombs level outside
dungeons; attribute values linear per level; Dominus at ten full stacks.

## Not done

Cayenne, Habanero Tactics, Warden Brute Force and the damage attributes are
listed, not computed. Quazii, Typhoeus and the pillars have no mob type in the
wiki, so Smite and the Humanoid Ruler stay listed.
