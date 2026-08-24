# Omarchy Typing Test

A local-first Omarchy 4 typing test by LeoMoon Studios with English and Parsi
passages, timed tests, detailed error analysis, and history.

## Preview

**Typing test**

![English typing test in progress](preview.png)

**Statistics popout**

![Typing test statistics popout](preview1.png)

**Detailed results**

![Completed typing test results and coaching](preview2.png)

**Progress**

![Typing progress charts](preview3.png)

**History**

![Typing test history](preview4.png)

## Features

- Omarchy bar widget with latest WPM, personal best, accuracy, and test count
- Centered, keyboard-focused typing panel
- Stationary typing pages that replace only after the displayed page is complete
- English and Parsi input with correct LTR/RTL presentation
- 1, 3, 5, and 10 minute presets plus custom durations
- Adaptive English and Parsi practice based on recent difficult characters
- Local coaching summaries with practical next-test recommendations
- Progress charts for WPM, accuracy, consistency, errors, and character trends
- 400 bundled passages: 200 English and 200 Parsi
- Gross WPM, net WPM, literal WPM, accuracy, and consistency
- Corrected/uncorrected errors and difficult-character analysis
- Targeted practice using difficult characters from previous tests
- Local JSON/JSONL settings and history
- UTF-8 `.txt` passage imports
- Bundled Vazirmatn font for consistent English and Parsi rendering
- No accounts, telemetry, or network requests

## Test Content

| Language | Categories |
| --- | --- |
| English | Common, Literature, Programming, Numbers & punctuation, Difficult-character practice, Imported, Mixed |
| Parsi | Common, Formal, Literature, Numbers & punctuation, Difficult-character practice, Imported, Mixed |

Standard tests support Easy, Medium, Hard, and Mixed difficulty levels.

## Requirements

- Omarchy 4
- The standard `omarchy-shell` packages included with Omarchy

## Install

Once this repository is published, install it with:

```bash
omarchy plugin add https://github.com/leomoon-studios/omarchy-typing-test.git --enable
```

Omarchy installs the repository into:

```text
~/.config/omarchy/plugins/leomoon-studios.omarchy-typing-test/
```

The widget defaults to the right section of the bar. It can be moved with the
normal Omarchy bar controls.

## Use

Click the outlined WPM badge in the Omarchy bar. The popout shows quick statistics
and actions for starting a test, viewing progress or history, and opening settings.
Tests run inside a larger centered overlay.

The popout is keyboard navigable: use the arrow keys to select an action,
`Enter` or `Space` to open it, and `Escape` to close the popout.

Setup, History, Progress, and Settings are also keyboard navigable. Arrow keys
move between controls, `Enter` or `Space` activates the focused control, and
all confirmation dialogs support arrow selection, `Enter`/`Space`, and `Escape`.
Inside History, `Up`/`Down` moves through results and `Delete` opens the delete
confirmation. Focused controls and result cards use the active theme cursor.

Choose **Adaptive Practice** on Setup to build a test around recent difficult
characters. Adaptive analysis is kept separate for English and Parsi and unlocks
after three tests in that language when a character has enough useful history.
Completed tests include a short local coaching summary, while Progress shows
language-specific trends without sending history anywhere.

Keyboard controls during a test:

- Start typing: begin the timer
- `Backspace`: correct the previous character
- `Tab`: open restart confirmation after typing has begun
- `Left`/`Right` (or `Up`/`Down`): select Cancel or Restart in the confirmation
- `Enter`/`Space`: activate the selected confirmation action
- `Escape`: close, with confirmation after typing has begun

The centered panel can also be opened directly:

```bash
omarchy-shell shell summon leomoon-studios.omarchy-typing-test '{"view":"setup"}'
```

Supported views are `setup`, `progress`, `history`, and `settings`.

## Local Data

```text
~/.config/leomoon-studios.typing-test/settings.json
~/.config/leomoon-studios.typing-test/settings-recovery.json
~/.local/share/leomoon-studios.typing-test/history.jsonl
~/.local/share/leomoon-studios.typing-test/history-backup.jsonl
~/.local/share/leomoon-studios.typing-test/history-recovery.jsonl
~/.local/share/leomoon-studios.typing-test/custom-texts/
```

`XDG_CONFIG_HOME` and `XDG_DATA_HOME` are honored when set. Full passages and
free-form typed input are not stored in history. Recovery files are created only
when malformed data is found. The latest history snapshot before deleting one or
all results is kept in `history-backup.jsonl`. Storage failures are shown in the
plugin instead of being silently ignored.

## Removal

Unload the plugin and remove its installed checkout:

```bash
omarchy plugin remove leomoon-studios.omarchy-typing-test --yes
```

Omarchy intentionally leaves the plugin's settings, history, and imported
texts in place so they remain available after a reinstall. To permanently
remove that data too:

```bash
rm -rf ~/.config/leomoon-studios.typing-test
rm -rf ~/.local/share/leomoon-studios.typing-test
```

## Import Text

Open Settings, choose a language and collection name, then select a UTF-8
`.txt` file. Blank lines separate passages. Imports are limited to 10 MiB and
symbolic links are rejected.

## Bundled font

Vazirmatn Regular v33.003 is bundled and used throughout the bar widget,
statistics popover, centered panel, controls, results, and typing surface. It
does not depend on a system-installed Parsi font.

Vazirmatn is distributed under the SIL Open Font License 1.1. Its unmodified
license and author list are included in `assets/fonts/`.

## Development

Validate the plugin manifest and entry points:

```bash
omarchy plugin validate .
```

Lint QML against the installed Omarchy shell modules:

```bash
qmllint -I /usr/share/omarchy/shell \
  BarWidget.qml StatsPopover.qml DataStore.qml PassageLibrary.qml \
  TypingTestPanel.qml components/*.qml
```

Run logic and corpus tests:

```bash
node tests/run-tests.mjs
```

See [SPEC.md](SPEC.md) for the full product and technical specification.

## Licensing

The plugin source is MIT licensed. The bundled passage corpus is dedicated
under CC0 1.0; see [texts/SOURCES.md](texts/SOURCES.md). Vazirmatn retains its
SIL Open Font License 1.1 terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
