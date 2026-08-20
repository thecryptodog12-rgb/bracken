# @loxley/diagrams

Protocol diagrams that both the dashboard and the docs site render, so an explanation only has to be
correct once.

## Theming

The components carry no colours of their own. They read a `--lxd-*` vocabulary that the host maps
onto its own tokens, which is why the same diagram comes out in the dashboard's palette and in
Nextra's without either knowing about the other:

```css
/* in the host stylesheet */
.lxd {
  --lxd-ink: var(--ink);
  --lxd-ink-soft: var(--ink-3);
  --lxd-ink-faint: var(--ink-4);
  --lxd-surface: var(--paper-2);
  --lxd-rule: var(--rule);
  --lxd-accent: var(--accent-deep);
  --lxd-accent-bg: var(--accent-bg);
  --lxd-warn: var(--brass);
  --lxd-mono: var(--mono);
  --lxd-display: var(--display);
}
```

Wrap the diagram in an element with that class. Every fallback resolves to a readable neutral, so a
host that forgets a token degrades instead of vanishing.

## Accuracy

`E3_STAGES` mirrors `ILoxley.E3Stage`. The dashboard asserts the two match at compile time
(`src/stageCheck.ts`), so the picture cannot drift from the contract without the build failing.
