# Passage Sources and Licensing

## Bundled corpus

All bundled passages were written for Omarchy Typing Test by LeoMoon Studios.
They are original material rather than excerpts copied from third-party books,
websites, or language datasets.

- Corpus edition: 2
- Source field: `LeoMoon Studios CC0 corpus v2`
- License: `CC0-1.0`
- Languages: English and Parsi
- Passage count: 200 English and 200 Parsi

To the extent possible under law, LeoMoon Studios has waived all copyright and
related or neighboring rights in the passage text under the
[Creative Commons CC0 1.0 Universal dedication](https://creativecommons.org/publicdomain/zero/1.0/).
The plugin source code remains under the repository's MIT license.

## Collections

| Language | Collection | Passages | Focus |
| --- | --- | ---: | --- |
| English | Common | 50 | Natural everyday prose |
| English | Literature | 50 | Original descriptive prose |
| English | Programming | 50 | Technical language, commands, paths, and code tokens |
| English | Numbers & punctuation | 50 | Dates, money, measurements, symbols, and URLs |
| Parsi | Common | 50 | Natural everyday prose and correct Parsi letter forms |
| Parsi | Formal | 50 | Administrative, academic, and professional prose |
| Parsi | Literature | 50 | Original descriptive prose |
| Parsi | Numbers & punctuation | 50 | Parsi digits, mixed script, measurements, symbols, and URLs |

Edition 2 replaces the earlier combinatorial sentence templates with 400
independently written passages. Automated corpus checks enforce stable IDs,
metadata, NFC normalization, category and language consistency, Parsi `ی` and
`ک`, balanced difficulty levels, punctuation spacing, and duplicate and
near-duplicate detection.

The corpus is stored as UTF-8 JSON Lines so that one malformed record can be
isolated without preventing the remaining collection from loading.

## External datasets

Mozilla Common Voice provides useful CC0 English and Parsi sentences, but its
dataset distribution documentation asks consumers not to rehost or reshare the
dataset. It is therefore not copied into this repository. Public-domain ebook
projects can be considered for a separately identified literature collection,
but their works must retain accurate per-work provenance rather than being
relabeled as CC0.

User-imported passages are not part of the bundled corpus and retain whatever
rights their users or original authors hold.
