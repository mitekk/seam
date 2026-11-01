---
type: regex
pattern: "Migration[`\\s]*·"
weight: 1
---

The size slot on the migration item holds `Migration` — the fourth size **this repo's**
`docs/building.md` defines, in the skeleton's own `<size · domain — disposition>` shape. The three
sizes the plugin's template carries are `Small`, `Medium` and `Large`, so this string cannot come
from the template: a body that produces it took the repo's table as its vocabulary. Prose that
merely mentions a migration does not match, because the separator is what pins it to the slot.
