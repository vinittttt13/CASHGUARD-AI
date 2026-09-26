# Self-hosted fonts

These `.woff2` files are vendored so the Next.js build never needs to reach
`fonts.googleapis.com` / `fonts.gstatic.com` — required for building or
running the app on an offline or restricted venue network.

Each file is the Latin-subset (`U+0000-00FF`) block extracted from Google
Fonts' `css2` API:

| File | Source family | Weight/style |
|---|---|---|
| `instrument-serif-400-normal.woff2` | Instrument Serif | 400 normal |
| `instrument-serif-400-italic.woff2` | Instrument Serif | 400 italic |
| `public-sans-variable.woff2` | Public Sans | variable, 100–900 |
| `fragment-mono-400.woff2` | Fragment Mono | 400 normal |

To refresh or add a weight, fetch the CSS and pull out the `U+0000-00FF`
`@font-face` block's URL, e.g.:

```bash
curl -sS -A "Mozilla/5.0" \
  "https://fonts.googleapis.com/css2?family=Public+Sans:wght@400&display=swap" \
  | grep -A2 "U+0000-00FF"
```

Only the Latin subset is vendored — extended Latin/Vietnamese/etc. glyphs
used by `next/font/google` are not included.
