---
id: 14
type: story
title: "`extract` e `render` — una istantanea, quattro file"
parent: epic-design-system-token-e-componenti-da-penpot
covers: [R2]
after: []
hitl: false
risk: low
tracker_id: "84"
remote: "https://github.com/AlessandroPaciello/page-builder/issues/84"
tracker_status: done
---

# `extract` e `render` — una istantanea, quattro file

## Description

Un'unica istantanea Penpot validata (live o `--snapshot`) produce `data/components/<comp>.json` e da lì `<Comp>.tsx`, test, story e barrel `@generated`, senza più `judgments/`, `bindings/`, `designs/`, `bases/` né la coppia fixture+ricetta.

## Requirements

Verify: Un layer fuori posto fa fallire `extract` nominando componente, cella e parte senza scrivere nulla, e `render --check --all` rigenera a diff zero accumulando i fallimenti per componente.

## References

- parent — _bmad-output/initiative-page-builder/tickets/epic-design-system-token-e-componenti-da-penpot/epic-design-system-token-e-componenti-da-penpot.md
