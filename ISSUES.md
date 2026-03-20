### [Chat Layout Over-Segmentation]
**Date:** 2026-03-18
**Symptom:** ???붾㈃??????몄뀡 ?꾩슜 ?⑤꼸???곕줈 怨좎젙?섍퀬, 硫붾え瑜??ы븿???ㅻⅨ ?붾㈃??移대뱶? ?뱀뀡??怨쇳븯寃??섎돇???곗뒪?ы넲 ?깅낫?????섏씠吏泥섎읆 蹂댁???
**Cause:** ??????곹깭? ???以??곹깭瑜?媛숈? 2?⑤꼸 援ъ“濡?泥섎━?덇퀬, 怨듭슜 移대뱶 ?ㅽ??쇱쓽 洹몃┝?먯? 寃쎄퀎媛 媛뺥빐 紐⑤뱺 ?붾㈃?먯꽌 遺꾨━媛먯씠 怨쇰룄?섍쾶 ?쒕윭?щ떎.
**Resolution:** ????꾩뿉??蹂몃Ц ?덉뿉 ?댁쟾 ???紐⑸줉留??몃씪?몄쑝濡?蹂댁뿬二쇨퀬, ???以묒뿉???곷떒 ?쒕∼?ㅼ슫?쇰줈 ?몄뀡 ?꾪솚 援ъ“瑜?諛붽엥?? 怨듭슜 移대뱶 ?ㅽ??쇱쓣 ???쏀븯寃?議곗젙?섍퀬 硫붾え ?붾㈃??醫뚯슦 2?⑤꼸 以묒떖?쇰줈 ?됲룊?섍쾶 ?ш뎄?깊뻽??

### [Phase 0 Readiness Count Drift]
**Date:** 2026-03-20
**Symptom:** `phase0:readiness` reported different totals depending on whether it was run directly or from `verify:strict`, and CI-facing markdown reports included mojibake labels.
**Cause:** The readiness script counted the nested `phase0:readiness` receipt entry from the strict gate, which created a self-referential total drift, and several labels still used non-ASCII strings that rendered inconsistently in PowerShell and GitHub summaries.
**Resolution:** Excluded the nested readiness receipt from check generation, normalized the report labels to ASCII, and regenerated the readiness and closeout outputs so direct and strict-gate runs now report the same stable totals.

### [Phase 0 CI Status Test Fixture on Windows]
**Date:** 2026-03-20
**Symptom:** Vitest integration tests for `report-phase0-ci-status.mjs` kept hitting the real `gh` CLI or failed auth unexpectedly instead of using a local test double.
**Cause:** On Windows, `execFileSync('gh', ...)` with `shell: false` is not reliably replaceable with a `.cmd` shim in PATH for this script-testing pattern, so the attempted PATH-based stub was brittle.
**Resolution:** Added a JSON fixture seam via `PHASE0_CI_STATUS_FIXTURE` and moved the script test to deterministic fixture-driven responses instead of PATH-based `gh` shims.

### [Phase 0 CI Observe Fixture Drift]
**Date:** 2026-03-20
**Symptom:** The new `run-phase0-ci-observe.mjs` integration test failed even after fixture mode was added, first because child scripts were resolved from the temporary app root, then because `ci-status` inferred git branch state from a non-repo fixture, and finally because the observe and status fixtures used different workflow shapes.
**Cause:** The orchestration script mixed `cwd`-relative child script paths with fixture-mode execution, did not always pass `--ref` through to downstream status refreshes, and the shared fixture contract between observe/status evolved independently.
**Resolution:** Resolved child scripts relative to the script file, passed the target branch explicitly into `report-phase0-ci-status.mjs`, and taught the status fixture loader to accept both `workflow` and `workflows` shapes so a single shared fixture can drive the full observe flow.
