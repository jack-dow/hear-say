# Document Folders / Collections

**Status: Done** — implemented as tags-as-folders.

Documents have a `tags: string[]` field. The home page shows folder filter pills and a tag edit dialog per document.

## What was built
- `tags` field on `documents` schema
- `setDocumentTags` mutation in `documents.ts`
- Folder filter strip on home page (All + one pill per unique tag)
- Tag badges on each document card
- Tag edit dialog (hover → tag icon → dialog with checkboxes + new folder input)
