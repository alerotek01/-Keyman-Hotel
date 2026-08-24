# Powered by Alerotek — Footer Branding Pattern

A lightweight, non-intrusive footer attribution pattern for embedding Alerotek branding into client projects.

---

## Design Principles

1. **Subtle, not dominant** — the attribution should be visible but never compete with the client's brand
2. **Consistent** — same styling, same link, same position across every project
3. **Accessible** — meets contrast requirements, works in light and dark themes
4. **Zero dependencies** — pure Tailwind CSS, no components or libraries needed

---

## The Pattern

### HTML / JSX

```html
<a
  href="https://www.alerotek.co.ke/studio"
  target="_blank"
  rel="noopener noreferrer"
  class="text-[10px] sm:text-xs text-cream/30 hover:text-[#3B82F6] transition-colors"
>
  powered by <span class="font-semibold text-[#3B82F6]">Alerotek</span>
</a>
```

### How It Looks

```
© 2026 Client Name. All rights reserved.    powered by Alerotek
```

- `powered by` — muted text, blends into the footer
- **`Alerotek`** — brand blue (#3B82F6), semibold, stands out on hover

---

## Brand Color

| Token | Hex | Usage |
|---|---|---|
| Alerotek Blue | `#3B82F6` | Brand name text, hover state |

This matches Tailwind's `blue-500`. If the project uses a custom palette, add:

```js
// tailwind.config.js
colors: {
  alerotek: '#3B82F6',
}
```

Then reference as `text-alerotek` instead of `text-[#3B82F6]`.

---

## Placement Rules

| Rule | Detail |
|---|---|
| **Position** | Bottom-right of the footer, right-aligned |
| **Size** | `text-[10px]` on mobile, `text-xs` on desktop |
| **Opacity** | Default `text-cream/30` (very subtle) |
| **Hover** | Full opacity + brand blue color |
| **Link** | Always `https://www.alerotek.co.ke/studio` |
| **Target** | Always `_blank` with `noopener noreferrer` |

---

## Dark Footer (Recommended)

The pattern works best on dark backgrounds. Standard footer setup:

```jsx
<footer className="bg-charcoal text-cream/70">
  <div className="container py-12 px-4">
    {/* ... client content ... */}

    <div className="mt-8 pt-6 border-t border-cream/[0.06]
                    flex flex-col sm:flex-row justify-between items-center gap-3">
      {/* Client copyright — left */}
      <p className="text-[10px] sm:text-xs text-cream/30">
        © {year} Client Name. All rights reserved.
      </p>

      {/* Alerotek attribution — right */}
      <a
        href="https://www.alerotek.co.ke/studio"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] sm:text-xs text-cream/30 hover:text-[#3B82F6] transition-colors"
      >
        powered by <span className="font-semibold text-[#3B82F6]">Alerotek</span>
      </a>
    </div>
  </div>
</footer>
```

---

## Light Footer Variant

If the project has a light footer, adjust the colors:

```jsx
<a
  href="https://www.alerotek.co.ke/studio"
  target="_blank"
  rel="noopener noreferrer"
  className="text-[10px] sm:text-xs text-gray-400 hover:text-[#3B82F6] transition-colors"
>
  powered by <span className="font-semibold text-[#3B82F6]">Alerotek</span>
</a>
```

---

## Integration Checklist

When adding to a new project:

- [ ] Add the `<a>` tag at the bottom-right of the footer
- [ ] Link points to `https://www.alerotek.co.ke/studio`
- [ ] Brand name uses `#3B82F6` (Alerotek Blue)
- [ ] Responsive: `text-[10px]` → `text-xs`
- [ ] Hover state transitions to brand blue
- [ ] No logo image — text only (keeps it lightweight)
- [ ] `rel="noopener noreferrer"` on the link

---

## What NOT to Do

| ❌ Avoid | Why |
|---|---|
| Making it large or bold | Competes with client branding |
| Using a logo image | Adds load time, breaks on dark/light themes |
| Placing it above the fold | Attribution belongs in the footer |
| Adding animations | Distracts from the client's content |
| Using different colors per project | Keep brand color consistent |

---

*Designed by Alerotek Studio — [alerotek.co.ke/studio](https://www.alerotek.co.ke/studio)*
