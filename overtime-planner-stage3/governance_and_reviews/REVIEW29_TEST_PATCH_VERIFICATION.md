# Review 29 — Test patch verification

The reviewer-authored `review29_accepted_gate_regressions.cjs` runs unmodified accepted Gate B1/B2 suites against a selected unpacked project root. It is designed to exit nonzero if either accepted gate regresses. Expected on PR22: **RED** due to the independently reproduced B1 probe 8.2 and B2 scenario 2.1 failures. After implementation, require **GREEN** on both. Test invocation: `node review29_accepted_gate_regressions.cjs /path/to/unpacked/project`.

Both original suites were independently run on the previously supplied full PR21 package and passed, confirming PR22 changed runtime behavior rather than test definitions. Playwright/browser smoke was not revalidated in the current environment.
