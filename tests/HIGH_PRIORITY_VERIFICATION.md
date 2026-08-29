# High-Priority Feature Verification

Verified on 2026-08-28 against Omarchy 4.0.1 and Qt 6.11.2.

## Automated coverage

| Area | English | Parsi | Important paths covered |
| --- | --- | --- | --- |
| Test formats | Pass | Pass | Timed compatibility, 10/25/50/100 words, passage completion, no countdown for completion formats, result metadata |
| Retry actions | Pass | Pass | Exact timed/word/passage reconstruction, duplicate passage IDs, fresh random selection, missing and partially missing imported-passage fallback |
| Analysis aggregates | Pass | Pass | Character, bigram, word, hesitation, and per-key timing aggregates; normalization; persistence limits; raw typed/timing input exclusion |
| Adaptive use | Pass | Pass | Character, bigram, word, and hesitation ranking; pattern-weighted passage selection; recent-passage avoidance |
| Keyboard heatmaps | Pass | Pass | Physical layouts, speed/opportunity/error aggregation, old-history fallback, individual key, hand, finger, and five-weakest-key actions |
| Progress and records | Pass | Pass | Language, format, duration/word count, mode, category, difficulty, range, comparison labels, and scoped personal bests |

Run the complete logic, integration, persistence, UI-contract, and corpus suite:

```bash
node tests/run-tests.mjs
```

## Representative runtime sessions

`tests/run-high-priority-sessions.sh` launches the real QML `TestView` in an
isolated Quickshell instance. It does not read or modify the user's settings or
history. The following representative sessions must all complete:

1. English 10-word completion
   - Builds exactly 10 words.
   - Uses elapsed time rather than a countdown.
   - Emits a schema-v5 English word result with 100% accuracy.
2. Parsi passage completion
   - Preserves the complete Parsi passage and ZWNJ text handling.
   - Forces passage tests to standard mode.
   - Emits a schema-v5 Parsi passage result with no configured countdown.
3. English exact passage retry
   - Reconstructs the exact saved passage text and ID.
   - Does not show a fallback notice.
4. Missing Parsi imported-passage retry
   - Shows the missing-source notice.
   - Falls back to safe common-content settings.
   - Selects an existing Parsi passage without retaining the removed ID.

Run the session matrix:

```bash
tests/run-high-priority-sessions.sh
```

Success is reported as `HIGH_PRIORITY_SESSIONS_PASS checks=20`.

## Release checks

```bash
qmllint -I /usr/share/omarchy/shell \
  BarWidget.qml StatsPopover.qml DataStore.qml PassageLibrary.qml SafeFile.qml \
  TypingTestPanel.qml components/*.qml
omarchy plugin validate .
git diff --check
```
