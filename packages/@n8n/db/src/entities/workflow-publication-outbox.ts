import { Column, Entity, Index, PrimaryGeneratedColumn } from '@n8n/typeorm';

import { WithTimestamps } from './abstract-entity';

export const WorkflowPublicationOutboxStatus = {
	Pending: 'pending',
	InProgress: 'in_progress',
	Completed: 'completed',
	PartialSuccess: 'partial_success',
	Failed: 'failed',
} as const;

export type WorkflowPublicationOutboxStatus =
	(typeof WorkflowPublicationOutboxStatus)[keyof typeof WorkflowPublicationOutboxStatus];

@Entity({ name: 'workflow_publication_outbox' })
@Index('IDX_workflow_publication_outbox_active_workflow_status', ['workflowId', 'status'], {
	unique: true,
	where: `status IN ('${WorkflowPublicationOutboxStatus.Pending}', '${WorkflowPublicationOutboxStatus.InProgress}')`,
})
export class WorkflowPublicationOutbox extends WithTimestamps {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: 'varchar', length: 36 })
	workflowId: string;

	/**
	 * Vestigial: records are pure "reconcile this workflow" markers — the applier
	 * derives the publish target from `workflow_entity.activeVersionId` at claim
	 * time. Written by no current code path (rows from older releases may carry
	 * values); the column is dropped in a follow-up release.
	 */
	@Column({ type: 'varchar', length: 36, nullable: true })
	publishedVersionId: string | null;

	@Column({ type: 'varchar', length: 20 })
	status: WorkflowPublicationOutboxStatus;

	@Column({ type: 'text', nullable: true })
	errorMessage: string | null;
}
