---
title: Languages, Missing and ICU
description: Languages, Missing and ICU for Localisync applications.
sidebar:
  order: 6
---

The application explicitly selects a complete locale tag. Localisync does not infer language from browser settings or synthesize regional fallback links.

Resolution follows the verified manifest chain, then the bundled chain, then an explicit `defaultText`, then the key. `resolve()` exposes the actual message locale, source and fallback flag. `null` remains Missing. Publishing fallback does not overwrite stored translations.

ICU is compiled before activation. Supported expressions are named variables, `select`, cardinal `plural`, `selectordinal`, offsets, exact numeric selectors, nesting, apostrophe escaping and `#`. Every nonmissing value must match its named text/number contract. Numbers must be finite; missing, extra or wrongly typed parameters are errors.

```json
{
  "key": "basket",
  "format": "icu",
  "parameters": [{ "name": "count", "type": "number" }],
  "value": "{count, plural, one {# item} other {# items}}"
}
```

Cardinal/ordinal rules are generated from the same verified CLDR 48.2.1 source as Flutter. Number presentation uses cached `Intl.NumberFormat` instances. A fallback message is formatted using the language where it was found, not the requested language. Date/number format expressions and rich markup are not added by this SDK.

`setLocale()` prepares only the same active release and needed fallback chain; it does not check the channel for a new publication. Failed preparation preserves the current locale. Use `preparedLocales` to prepare additional synchronous server views ahead of requests. New code-generated methods require regeneration and an application build.
