import type { MigrationContext, ReversibleMigration } from '../migration-types';

/**
 * Outbox records are pure "reconcile this workflow" markers: the applier
 * derives the publish target from `workflow_entity.activeVersionId` at claim
 * time, so `publishedVersionId` is written by no current code path and read by
 * none. It is made nullable (not dropped) so instances still running the
 * previous release keep working during a rolling deploy; a follow-up migration
 * drops the column next release.
 *
 * `workflow_publication_outbox` has no incoming foreign keys, so the SQLite
 * table recreation behind `dropNotNull` cannot cascade into other tables.
 */
export class MakeOutboxPublishedVersionIdNullable1784564167057 implements ReversibleMigration {
	async up({ schemaBuilder: { dropNotNull } }: MigrationContext) {
		await dropNotNull('workflow_publication_outbox', 'publishedVersionId', {
			recreatesOnSqlite: true,
		});
	}

	async down(ctx: MigrationContext) {
		await this.backfillNullVersions(ctx);
		await ctx.schemaBuilder.addNotNull('workflow_publication_outbox', 'publishedVersionId', {
			recreatesOnSqlite: true,
		});
	}

	/**
	 * Rows written after `up()` carry NULL. Restore the value the previous
	 * release would have written: the workflow's `activeVersionId`, or the
	 * unpublish sentinel when the workflow is unpublished or gone.
	 */
	private async backfillNullVersions({ escape, runQuery }: MigrationContext) {
		const outbox = escape.tableName('workflow_publication_outbox');
		const workflow = escape.tableName('workflow_entity');

		await runQuery(
			`UPDATE ${outbox}
			 SET "publishedVersionId" = COALESCE(
				 (SELECT w."activeVersionId" FROM ${workflow} w WHERE w."id" = ${outbox}."workflowId"),
				 '__unpublish__'
			 )
			 WHERE "publishedVersionId" IS NULL`,
		);
	}
}
