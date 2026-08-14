---
title: Contributing
description: Run tests and contribute to ArchiSpark.
---

Thanks for considering a contribution to ArchiSpark!

## Tests

```bash
pnpm run -w test            # 500+ tests across all packages
pnpm run -w test:coverage   # ≥80% coverage required
pnpm --filter server build && pnpm --filter server test:e2e # Playwright, needs Docker — see development.md
```

## Code of Conduct

This project follows the guidelines in [CODE_OF_CONDUCT.md](https://github.com/archispark/archispark/blob/main/CODE_OF_CONDUCT.md).
