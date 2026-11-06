# Flow Svelte Themes

Theme tokens in theme.flow.css, app.flow.css, named palettes with light and dark modes, palette proof, fonts and icons.

Sub-guide of `flow://guide/frontend-svelte`: read that entry guide first for the authoring loop.

## Themes And Palettes

The standard blocks present well without application CSS: a light theme in
the Convertigo blue, IBM Plex Sans or the system font, rounded bordered
surfaces with light shadows, and a dark mode. Keep that default and adjust it
with tokens in `theme.flow.css`: a primary color, a radius or a font moves
every block. `flow://lib/lib_flow_frontbuilder_svelte/frontend-design` lists
the tokens, the application blocks and the visual checklist. `app.flow.css`
is for what no block expresses (an illustration, a hero, a one-off layout),
never for rebuilding buttons, navigation, tables or badges with classes.

Use semantic layout properties for structure, the source-backed
`theme.flow.css` for tokens and the free-form `app.flow.css` plus explicit
`class` names for the remaining visual rules. A visual value computed from state (an angle,
a width, a position) goes to the common `style` property as a CSS custom
property that `app.flow.css` consumes, never to one class per value. Bind it
on the element it moves, with one named variable, so that its node shows what
drives it, and keep the CSS rule generic:
`<Text $$id="secondHand" class="hand" style={"--angle:" + page.second * 6 + "deg"} />`
with `.hand { transform: rotate(var(--angle)); }`. Do not set variables on a
parent for its children to read: the tree no longer tells which state moves
which element.
Palette and display mode are independent:

- Define each named palette in `theme.flow.css` under `@layer flow.theme`
  with `:root[data-flow-palette="name"]`, and its dark values with the same
  selector plus `[data-flow-theme="dark"]`.
- `ThemePaletteControl` is the standard style selector (it reads
  `@theme.options`); omit it when only one palette exists.
- `DisplayModeControl` is the standard Light/Dark/System control and owns its
  persistence: the page is light until the user chooses, System follows the
  device. Use `ThemeSwitch` and `BrowserPreference` only for a custom
  presentation.
- Consume semantic values in `app.flow.css` with `var(--flow-color-background)`,
  `var(--flow-color-surface)`, `var(--flow-color-text)`,
  `var(--flow-color-primary)` and related tokens; hard-coded colors are for
  artwork and local effects only.

```css
@layer flow.theme {
  :root {
    --c8o-radius-lg: 10px;
    --c8o-font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
  }
  :root[data-flow-palette="ocean"] {
    --flow-color-background: #eff6ff;
    --flow-color-primary: #0369a1;
  }
  :root[data-flow-palette="ocean"][data-flow-theme="dark"] {
    --flow-color-background: #082f49;
    --flow-color-primary: #38bdf8;
  }
}

.page {
  background: var(--flow-color-background);
  color: var(--flow-color-text);
}
```

`code-check` warns with `FLOW_THEME_TOKENS_UNUSED` (many literal colors, no
semantic token) and `FLOW_THEME_PRIVATE_TOKENS`. Test every named palette in
light and dark mode: browser proof must observe `data-flow-palette`,
`data-flow-theme`, a changed computed token, a visible change and restoration
after reload. A tree with only `Themes > Default` means no named palette was
authored.

Custom fonts are project sources in `_flow/fonts/<provider>/<family>/`
(`font.json` with its license, plus `*.woff2`). A theme token such as
`--c8o-font-family: "Inter", system-ui, sans-serif;` naming a carried family
makes generation embed the files. No tool downloads fonts yet. Icons are SVG
sources under `_flow/icons/iconify/<set>/` (see
`flow://guide/custom-blocks`).
