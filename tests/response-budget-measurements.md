# Flow MCP response budget measurements

Measured with `tests/response-budget.js` through the final MCP result, including `content` and `structuredContent`, not source file bytes. `resources/list` now serves pages of 20 entries with `nextCursor`; the test reads every page and checks each final envelope below 16,000 characters. This worktree has 92 measured guides, including workspace library guides. All changed core entry guides below are under 6,000 served characters; all new slash-path drawers are under 12,000.

## Entry summaries

| URI | Served characters |
| --- | ---: |
| `flow://guide/start` | 5717 |
| `flow://guide/multipage-entities` | 5458 |
| `flow://guide/entities` | 5379 |
| `flow://guide/fullstack-paperboard` | 4362 |
| `flow://guide/crud-business` | 3849 |
| `flow://guide/frontend-svelte` | 3319 |
| `flow://guide/entities-widgets` | 2528 |
| `flow://guide/authoring` | 2311 |
| `flow://guide/crud` | 2239 |
| `flow://guide/entities-model` | 2168 |
| `flow://guide/multipage-roles` | 2016 |
| `flow://guide/start-rules` | 1390 |
| `flow://guide/multipage-entities-pages` | 1213 |

## New thematic drawers

| URI | Served characters |
| --- | ---: |
| `flow://guide/entities/http` | 10606 |
| `flow://guide/multipage-entities/setup` | 8504 |
| `flow://guide/authoring/dialect` | 8360 |
| `flow://guide/crud/model` | 8206 |
| `flow://guide/fullstack-paperboard/path` | 7732 |
| `flow://guide/multipage-entities/pages` | 6823 |
| `flow://guide/crud-business/flows` | 6424 |
| `flow://guide/entities-widgets/snippets` | 5688 |
| `flow://guide/start-rules/tools` | 5467 |
| `flow://guide/entities-model/schema` | 5292 |
| `flow://guide/frontend-svelte/loop` | 5257 |
| `flow://guide/entities-model/format` | 4974 |
| `flow://guide/start-rules/workspace` | 4752 |
| `flow://guide/multipage-roles/pages` | 4723 |
| `flow://guide/multipage-entities/operations` | 4472 |
| `flow://guide/entities-widgets/stat` | 4288 |
| `flow://guide/multipage-roles/data` | 4255 |
| `flow://guide/crud-business/pages` | 4131 |
| `flow://guide/entities-model/unique` | 3995 |
| `flow://guide/multipage-roles/proof` | 3985 |
| `flow://guide/start-rules/design` | 3950 |
| `flow://guide/fullstack-paperboard/contract` | 3685 |
| `flow://guide/crud/lifecycle` | 3409 |
| `flow://guide/entities-widgets/table` | 3116 |
| `flow://guide/entities-widgets/view` | 3109 |
| `flow://guide/multipage-roles/policy` | 2823 |
| `flow://guide/entities-model/authoring` | 2665 |
| `flow://guide/multipage-entities/proof` | 2520 |
| `flow://guide/crud-business/csv` | 2448 |
| `flow://guide/authoring/expressions` | 2285 |
| `flow://guide/entities-model/lists` | 2230 |
| `flow://guide/entities-widgets/flows` | 1706 |
| `flow://guide/entities-widgets/form` | 1682 |
| `flow://guide/start/syntax` | 1637 |
| `flow://guide/frontend-svelte/limits` | 1140 |
| `flow://guide/crud-business/jobs` | 863 |

## Existing focused guides left as they are

These already cover one topic each, fit the 12,000-character drawer budget, and have direct topic links from the summaries. Splitting them again would add a read without clarifying the next task.

| URI | Served characters |
| --- | ---: |
| `flow://guide/entities-policy` | 11896 |
| `flow://guide/authoring-data` | 10653 |
| `flow://guide/frontend-svelte-sources` | 10567 |
| `flow://guide/search-and-edit` | 10116 |
| `flow://guide/frontend-svelte-data` | 9788 |
| `flow://guide/custom-blocks` | 9261 |
| `flow://guide/entities-actions` | 9241 |
| `flow://guide/frontend-svelte-layout` | 8935 |
| `flow://guide/fullsync` | 8242 |
| `flow://guide/multipage-entities-access` | 8062 |
| `flow://guide/frontend-svelte-routing` | 7847 |
| `flow://guide/frontend-svelte-actions` | 7688 |
| `flow://guide/entities-auth` | 6731 |
| `flow://guide/authoring-source` | 6637 |
| `flow://guide/authoring-collections` | 6468 |
| `flow://guide/crud-modes` | 6140 |

The following existing focused guides also stayed as they are because their served response is already below 6,000 characters:

| URI | Served characters |
| --- | ---: |
| `flow://guide/frontend-svelte-datatable` | 5935 |
| `flow://guide/frontend-svelte-forms` | 5721 |
| `flow://guide/frontend-svelte-proof` | 5522 |
| `flow://guide/portable-blocks` | 5110 |
| `flow://guide/tags` | 5063 |
| `flow://guide/rhino-block-api` | 4636 |
| `flow://guide/frontend-svelte-components` | 4442 |
| `flow://guide/authoring-blocks` | 4426 |
| `flow://guide/frontend-svelte-themes` | 4289 |
| `flow://guide/fullstack-paperboard-parallel` | 3971 |
| `flow://guide/samples` | 2656 |
| `flow://guide/tracing` | 1607 |
| `flow://guide/crud-business-reference` | 840 |
| `flow://guide/entities-widgets-reference` | 778 |
| `flow://guide/entities-model-reference` | 743 |

The workspace library guides are owned by other projects and were measured but left untouched; this worktree cannot change those libraries. Their larger topic guides remain under the existing 15,000-character response limit, although three exceed the new 12,000-character drawer target.

| Library guide | Served characters |
| --- | ---: |
| `flow://lib/lib_flow_crud_data/csv` | 13163 |
| `flow://lib/lib_flow_engine/backend-io` | 9339 |
| `flow://lib/lib_flow_engine/native-values` | 2865 |
| `flow://lib/lib_flow_engine/runtime-performance` | 10592 |
| `flow://lib/lib_flow_frontbuilder_svelte/frontend-actions` | 8664 |
| `flow://lib/lib_flow_frontbuilder_svelte/frontend-design` | 9443 |
| `flow://lib/lib_flow_sql/sql` | 12266 |
| `flow://lib/lib_flow_sql/sql-crud` | 7358 |
| `flow://lib/lib_flow_sql/sql-hsqldb` | 6987 |
| `flow://lib/lib_flow_sql/sql-named` | 11092 |
| `flow://lib/lib_flow_sql/sql-sample` | 7880 |
| `flow://lib/lib_flow_sql/sql-schema` | 12857 |

The prior `-reference` URIs remain short pointers to their new drawers.

## Witnesses

- `code-get` on a small entity-backed Page: 5,560 served characters. The `entityPages` hint is first and links to `entities-widgets/table`; that drawer is read through `flow-resource-get` and contains `EntityTable` and Toolbar guidance.
- `start`, `start-rules`, and `frontend-svelte` state that `browser_wait_for.time` is seconds, at most 30, with `2` and never `2000` in their first 6,000 characters.
- The test checks every cited slash-path drawer, each page of the resource list, `resources/read`, `flow-resource-get`, `flow-resource-search`, the summary and drawer limits, and all legacy guides below 15,000.
- `code-get` with a long source, `contractDetail:"full"`, and legacy `frontend-svelte-code-get` must each stay below 16,000 characters. Long sources are read by line ranges, or by `startChar` for a single long line; contract indexes retain every available tag and point to `contractBlocks` for exact details.
