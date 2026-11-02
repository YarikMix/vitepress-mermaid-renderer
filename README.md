> YarikMix maintenance fork of
> [sametcn99/vitepress-mermaid-renderer](https://github.com/sametcn99/vitepress-mermaid-renderer),
> based on 1.2.3 (MIT). Fixes SPA component disposal, late async mount
> callbacks, and serialized rendering across navigation/theme updates. Mermaid
> 11/12 support is unchanged. Built `dist/` is committed so consumers can pin a
> Git SHA without building this package during installation.

## Render result events (maintenance fork)

External viewers can use `static: true` and listen on an ancestor before
starting the renderer. Each `.mermaid-wrapper` dispatches the bubbling DOM event
`vitepress-mermaid:render-complete` with detail
`{ id: string; success: boolean; error?: unknown }`.

```ts
container.addEventListener('vitepress-mermaid:render-complete', (event) => {
  const { id, success, error } = (event as CustomEvent).detail;
  // On success, the SVG is already inside event.target (the diagram wrapper).
  // On failure, display an error; static mode has no built-in error panel.
});
```

Retries and theme changes emit further results for the same diagram. Results
from detached wrappers or a destroyed renderer are not delivered. Interactive
mode also emits these events; its controls remain unchanged.

# VitePress Mermaid Renderer

Transform static Mermaid diagrams into interactive visualizations in VitePress.
Enable smooth zooming, panning, fullscreen dialogs, and dynamic theme
adaptations.

_Stay up to date with new releases in the
[CHANGELOG](https://github.com/sametcn99/vitepress-mermaid-renderer/blob/main/CHANGELOG.md)._

## Key Features

- **Smooth Zooming:** Incrementally zoom in/out with reactive percentage
  readouts.
- **Intuitive Panning:** Drag to navigate and explore complex, multi-layered
  diagrams.
- **Single-Click Code Copy:** Extract raw Mermaid source code instantly.
- **Instant View Reset:** Restore zoom, pan, and transform coordinates to
  default in one click.
- **Flexible Fullscreen Modes:** Choose between native browser Fullscreen API or
  custom inline modal overlays.
- **Vibrant Adaptive Themes:** Smoothly matches Light/Dark mode transitions.
- **Static SVG Mode:** Render theme-aware diagrams without controls, navigation,
  fullscreen, or downloads.
- **High-Quality Downloads:** Export and download diagrams as SVG, PNG, or JPG.
- **Complete Customization:** Selectively toggle toolbar buttons per display
  mode (desktop, mobile, fullscreen).
- **Collapsible Toolbar:** Optionally collapse toolbar controls per diagram and
  per display mode.
- **i18n Support:** Easily localize all tooltips and states dynamically using
  VitePress locale data.

## Documentation & Examples

For full configuration guidelines, advanced security options, custom toolbar
settings, multilinguality (i18n) setups, and live sandbox demonstrations, please
visit official website:

**[vitepress-mermaid-renderer.vercel.app](https://vitepress-mermaid-renderer.vercel.app)**

---

## Contributing & Development

Please refer to
[CONTRIBUTING.md](https://github.com/sametcn99/vitepress-mermaid-renderer/blob/main/CONTRIBUTING.md)
for more details.

---

_If you found this project helpful, please consider giving it a star on
[GitHub](https://github.com/sametcn99/vitepress-mermaid-renderer)!_
