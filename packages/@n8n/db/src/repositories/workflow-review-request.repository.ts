import { Service } from '@n8n/di';
import type { EntityManager } from '@n8n/typeorm';
import { DataSource, Repository } from '@n8n/typeorm';

import { WorkflowReviewRequestWorkflow } from '../entities/workflow-review-request-workflow.ee';
import {
	WorkflowReviewRequest,
	type WorkflowReviewRequestDecision,
	type WorkflowReviewRequestState,
} from '../entities/workflow-review-request.ee';

export type FindManyForInboxOptions = {
	projectIds?: string[];
	state?: WorkflowReviewRequestState;
	limit: number;
	cursor?: string;
};

@Service()
export class WorkflowReviewRequestRepository extends Repository<WorkflowReviewRequest> {
	constructor(dataSource: DataSource) {
		super(WorkflowReviewRequest, dataSource.manager);
	}

	async createRequest(
		input: {
			id?: string;
			projectId: string;
			state?: WorkflowReviewRequestState;
			decision?: WorkflowReviewRequestDecision;
			title: string;
			description?: string | null;
			createdById: string | null;
			updatedById?: string | null;
		},
		trx?: EntityManager,
	): Promise<WorkflowReviewRequest> {
		const manager = trx ?? this.manager;
		const entity = this.create({
			id: input.id,
			projectId: input.projectId,
			state: input.state ?? 'open',
			decision: input.decision ?? 'pending',
			title: input.title,
			description: input.description ?? null,
			createdById: input.createdById,
			updatedById: input.updatedById ?? input.createdById,
			closedById: null,
			approvedAt: null,
		});

		return await manager.save(WorkflowReviewRequest, entity);
	}

	async findById(id: string): Promise<WorkflowReviewRequest | null> {
		return await this.findOne({ where: { id } });
	}

	async findOpenRequestForWorkflow(
		workflowId: string,
		trx?: EntityManager,
	): Promise<WorkflowReviewRequest | null> {
		const manager = trx ?? this.manager;
		const state: WorkflowReviewRequestState = 'open';

		return await manager
			.createQueryBuilder(WorkflowReviewRequest, 'request')
			.innerJoin(
				WorkflowReviewRequestWorkflow,
				'requestWorkflow',
				'requestWorkflow.workflowReviewRequestId = request.id',
			)
			.where('requestWorkflow.workflowId = :workflowId', { workflowId })
			.andWhere('request.state = :state', { state })
			.orderBy('request.createdAt', 'DESC')
			.getOne();
	}

	async findManyForInbox(options: FindManyForInboxOptions): Promise<WorkflowReviewRequest[]> {
		const { projectIds, state, limit, cursor } = options;

		if (projectIds !== undefined && projectIds.length === 0) {
			return [];
		}

		const queryBuilder = this.createQueryBuilder('review')
			.orderBy('review.createdAt', 'DESC')
			.addOrderBy('review.id', 'ASC');

		if (projectIds !== undefined) {
			queryBuilder.andWhere('review.projectId IN (:...projectIds)', { projectIds });
		}

		if (state !== undefined) {
			queryBuilder.andWhere('review.state = :state', { state });
		}

		if (cursor) {
			const cursorRow = await this.findOne({ where: { id: cursor } });
			if (!cursorRow) {
				return [];
			}

			queryBuilder.andWhere(
				'(review.createdAt < :createdAt OR (review.createdAt = :createdAt AND review.id > :id))',
				{ createdAt: cursorRow.createdAt, id: cursorRow.id },
			);
		}

		queryBuilder.take(limit);

		return await queryBuilder.getMany();
	}

	async existsAnyForProjects(projectIds?: string[]): Promise<boolean> {
		if (projectIds !== undefined && projectIds.length === 0) {
			return false;
		}

		const queryBuilder = this.createQueryBuilder('review').select('1');

		if (projectIds !== undefined) {
			queryBuilder.andWhere('review.projectId IN (:...projectIds)', { projectIds });
		}

		const row = await queryBuilder.limit(1).getRawOne();
		return row !== undefined;
	}
}
