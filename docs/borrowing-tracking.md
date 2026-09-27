# Student borrowing tracking

Students borrow equipment directly from ECA. The system records the actual handover and subsequent returns. Only active administrators can use the workspace or access student borrowing information.

## Records and rules

A checkout requires a student full name (at least two characters), student ID, purpose (at least five characters), checkout date, expected return date, and at least one item with a positive whole quantity. Contact information and notes are optional. Checkout dates may be today or earlier; future reservations are not supported. The expected return date cannot precede checkout. Calendar dates and overdue checks use Asia/Manila.

Checkout accepts only active inventory in an active category, with GOOD or FAIR condition and sufficient available stock. It records all items or none, and locks inventory in consistent order. Two admins cannot borrow the same last unit.

The statuses are ACTIVE, RETURNED, and ARCHIVED. Overdue is a derived label for an active record whose expected return date has passed. There is no approval or pickup phase.

Each return may resolve a subset of the outstanding units. Quantities may be split into GOOD, FAIR, DAMAGED, and LOST for the same item. Good/fair units become available; damaged units await repair without marking the entire item damaged; lost units are removed from total stock. Every inspection creates an immutable return entry and inventory movement. The borrowing closes only when all its units are resolved.

The stock balance is `total = available + damaged + outstanding borrowed`. Reports show damaged units separately. Recording repaired units transfers them from damaged to available. Atomic stock edits preserve outstanding and damaged quantities and cannot deactivate equipment while units remain borrowed.

Admins may correct borrower information, purpose, contact information, notes, and due dates. Checkout quantities are immutable; historical inspections are not overwritten. Corrections and due-date extensions are audited. A lost unit is accounted for but is not counted as physically returned.

Borrowing headers, line items, and return entries have no client write privileges. Only the checked database RPCs can change them. Anonymous users and disabled historical accounts cannot read student borrowing records.

## Compatibility and upgrade

The forward migration retains existing IDs, transactions, and audit actors. Approved and borrowed requests already reduced stock, so they become ACTIVE without changing inventory. Returned records stay RETURNED. Other request statuses become ARCHIVED and cannot be edited or returned. Original request metadata is retained for historical context. Student IDs absent from old records remain missing and are visibly identified as legacy data; admins can supply a real ID for an existing active/completed borrowing.

Former committee identities become inactive ARCHIVED profiles; they are never promoted to admins. Committee tables, ownership policies, and request/committee RPCs are removed. Old administrator request URLs redirect to borrowing details so existing links continue to work.

Old DAMAGED return operations already removed units from total inventory. The migration preserves those historical balances instead of adding physical stock that may not exist. New damaged returns use the separate damaged-unit count. Review existing inconsistencies separately if stock was previously changed outside the normal workflow.

Apply the migration before serving the new frontend. The migration is tested with upgrade fixtures in a temporary PostgreSQL instance; the project database is not automatically modified by the code changes.

The subsequent application-table-permissions migration explicitly grants authenticated reads and the configuration writes used by the browser. It does not rely on Supabase's project-specific default grants. Anonymous clients have no table access; signed-in non-admins remain limited by RLS, and direct stock/borrowing/history edits remain unavailable. Admin item registration may append its initial inventory transaction and audit entry, with the actor constrained to the current user. The database tests exercise browser-style reads, joins, settings upserts, and allowed/denied writes with both closed and legacy default privileges.
