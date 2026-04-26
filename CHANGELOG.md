# energy-flow-card-plus

## 0.2.1

### Patch Changes

- [#239](https://github.com/flixlix/flixlix-cards/pull/239) [`5d493fc`](https://github.com/flixlix/flixlix-cards/commit/5d493fc659d6cb8152fc944876d7e31017b25ce3) Thanks [@flixlix](https://github.com/flixlix)! - feat: add `collection_key` option to bind the card to a specific energy data collection, matching the behavior of Home Assistant's built-in Energy Distribution card. Useful when multiple energy dashboards exist and the card should follow a specific dashboard's selected period instead of the active one.

- [#227](https://github.com/flixlix/flixlix-cards/pull/227) [`b8ce9e2`](https://github.com/flixlix/flixlix-cards/commit/b8ce9e2a428b97a595ef4e3816f5a6f055678e49) Thanks [@flixlix](https://github.com/flixlix)! - refactor: kilo_threshold avoid redundancy in displayValue func

- [#226](https://github.com/flixlix/flixlix-cards/pull/226) [`44f66ae`](https://github.com/flixlix/flixlix-cards/commit/44f66ae8b0c4fd29c4af753bfa85d89516611284) Thanks [@flixlix](https://github.com/flixlix)! - get energy entity states for energy card

- [#239](https://github.com/flixlix/flixlix-cards/pull/239) [`5d493fc`](https://github.com/flixlix/flixlix-cards/commit/5d493fc659d6cb8152fc944876d7e31017b25ce3) Thanks [@flixlix](https://github.com/flixlix)! - feat: add energy collection_key config setting

- [#227](https://github.com/flixlix/flixlix-cards/pull/227) [`46c3785`](https://github.com/flixlix/flixlix-cards/commit/46c3785435d1188b2d780fd02da5b548e3148a9b) Thanks [@flixlix](https://github.com/flixlix)! - fix: get default config for correct energy entities instead of power

- [#227](https://github.com/flixlix/flixlix-cards/pull/227) [`e9181b2`](https://github.com/flixlix/flixlix-cards/commit/e9181b2cd8c88400d1283aa84d3c26bf1016696b) Thanks [@flixlix](https://github.com/flixlix)! - feat: allow megawatt and MWh units with threshold and decimals

- [#233](https://github.com/flixlix/flixlix-cards/pull/233) [`f1766aa`](https://github.com/flixlix/flixlix-cards/commit/f1766aa1f5cc06bfc24cdde0720f7284a4b31349) Thanks [@flixlix](https://github.com/flixlix)! - fix: home label incorrect translation in some languages.
  apply editor.home label for home component
- Updated dependencies [[`b8ce9e2`](https://github.com/flixlix/flixlix-cards/commit/b8ce9e2a428b97a595ef4e3816f5a6f055678e49), [`5d493fc`](https://github.com/flixlix/flixlix-cards/commit/5d493fc659d6cb8152fc944876d7e31017b25ce3), [`8894f43`](https://github.com/flixlix/flixlix-cards/commit/8894f435d4996a2d31efb03cd4228f3959170943), [`5d493fc`](https://github.com/flixlix/flixlix-cards/commit/5d493fc659d6cb8152fc944876d7e31017b25ce3), [`44f66ae`](https://github.com/flixlix/flixlix-cards/commit/44f66ae8b0c4fd29c4af753bfa85d89516611284), [`46c3785`](https://github.com/flixlix/flixlix-cards/commit/46c3785435d1188b2d780fd02da5b548e3148a9b), [`e9181b2`](https://github.com/flixlix/flixlix-cards/commit/e9181b2cd8c88400d1283aa84d3c26bf1016696b)]:
  - @flixlix-cards/shared@0.0.3

## 0.2.0-beta.1

### Patch Changes

- 71cac7d: fix home label not showing
- 06b53c1: fix circle color when no activity
- 71cac7d: clickable entities cursor true by default
- c26189b: fix support for older browsers by targeting es2020 in the final bundle
- 34aa17d: add energy_date_selection option
- 71cac7d: fix individual not showing correct decimals
- 71cac7d: fix home not clickable when action was defined
- Updated dependencies [06b53c1]
- Updated dependencies [71cac7d]
- Updated dependencies [34aa17d]
- Updated dependencies [71cac7d]
  - @flixlix-cards/shared@0.0.2
- rewrite with monorepo
