import type {
	CreateWorkflowReviewRequestDto,
	ListWorkflowReviewRequestQueryDto,
	ListWorkflowReviewRequestResponse,
	GetWorkflowReviewRequestSummaryResponse,
	WorkflowReviewRequestSummaryDto,
} from '@n8n/api-types';
import { LicenseState } from '@n8n/backend-common';
import {
	DbLock,
	DbLockService,
	SharedWorkflowRepository,
	WorkflowReviewRequestAuthorRepository,
	WorkflowReviewRequestRepository,
	WorkflowReviewRequestWorkflowRepository,
	type User,
	type WorkflowReviewRequest,
} from '@n8n/db';
import { Service } from '@n8n/di';

import { isWorkflowReviewsFeatureAvailable } from '@/constants/workflow-reviews';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { ConflictError } from '@/errors/response-errors/conflict.error';
import { ForbiddenError } from '@/errors/response-errors/forbidden.error';
import { NotFoundError } from '@/errors/response-errors/not-found.error';
import { ProjectService } from '@/services/project.service.ee';
import { WorkflowReviewPolicyService } from '@/services/workflow-review-policy.service';
import { WorkflowFinderService } from '@/workflows/workflow-finder.service';
import { WorkflowHistoryService } from '@/workflows/workflow-history/workflow-history.service';

const GLOBAL_OWNER_ROLE = 'global:owner';

@Service()
export class WorkflowReviewRequestService {
	constructor(
		private readonly workflowReviewPolicyService: WorkflowReviewPolicyService,
		private readonly workflowFinderService: WorkflowFinderService,
		private readonly workflowHistoryService: WorkflowHistoryService,
		private readonly sharedWorkflowRepository: SharedWorkflowRepository,
		private readonly workflowReviewRequestRepository: WorkflowReviewRequestRepository,
		private readonly workflowReviewRequestWorkflowRepository: WorkflowReviewRequestWorkflowRepository,
		private readonly workflowReviewRequestAuthorRepository: WorkflowReviewRequestAuthorRepository,
		private readonly projectService: ProjectService,
		private readonly licenseState: LicenseState,
		private readonly dbLockService: DbLockService,
	) {}

	async create(user: User, dto: CreateWorkflowReviewRequestDto): Promise<WorkflowReviewRequest> {
		await this.assertFeatureAvailable();

		const { workflowId, workflowVersionId } = dto.workflows[0];

		const workflow = await this.workflowFinderService.findWorkflowForUser(workflowId, user, [
			'workflow:publish',
		]);
		if (!workflow) {
			throw new NotFoundError('Could not find workflow');
		}

		if (workflow.isArchived) {
			throw new BadRequestError(
				`The workflow '${workflowId}' is archived and cannot be submitted for review`,
			);
		}

		const version = await this.workflowHistoryService.findVersion(workflowId, workflowVersionId);
		if (!version) {
			throw new BadRequestError(
				`Version '${workflowVersionId}' does not exist for workflow '${workflowId}'`,
			);
		}

		const project = await this.sharedWorkflowRepository.getWorkflowOwningProject(workflowId);
		if (!project) {
			throw new NotFoundError('Could not find workflow');
		}

		return await this.dbLockService.withLock(DbLock.WORKFLOW_REVIEW_REQUEST_CREATE, async (tx) => {
			const existing = await this.workflowReviewRequestRepository.findOpenRequestForWorkflow(
				workflowId,
				tx,
			);
			if (existing) {
				throw new ConflictError(
					'An open review request already exists for this workflow',
					'Sync the existing review request instead of creating a new one',
					{ workflowReviewRequestId: existing.id },
				);
			}

			const request = await this.workflowReviewRequestRepository.createRequest(
				{
					projectId: project.id,
					title: dto.title,
					description: dto.description ?? null,
					createdById: user.id,
				},
				tx,
			);

			await this.workflowReviewRequestWorkflowRepository.createWorkflowRow(
				{
					workflowReviewRequestId: request.id,
					workflowId,
					workflowVersionId,
				},
				tx,
			);

			await this.workflowReviewRequestAuthorRepository.addAuthor(
				{ workflowReviewRequestId: request.id, userId: user.id },
				tx,
			);

			return request;
		});
	}

	async listForUser(
		user: User,
		query: ListWorkflowReviewRequestQueryDto,
	): Promise<ListWorkflowReviewRequestResponse> {
		await this.assertFeatureAvailable();

		const projectIds = await this.resolveAccessibleProjectIds(user);
		const { limit } = query;
		const rows = await this.workflowReviewRequestRepository.findManyForInbox({
			projectIds: projectIds ?? undefined,
			state: query.state,
			limit: limit + 1,
			cursor: query.cursor,
		});

		const hasMore = rows.length > limit;
		const data = hasMore ? rows.slice(0, limit) : rows;
		const nextCursor = hasMore ? (data.at(-1)?.id ?? null) : null;
		const workflowNamesByRequestId =
			await this.workflowReviewRequestWorkflowRepository.findWorkflowNamesByRequestIds(
				data.map((row) => row.id),
			);

		return {
			data: data.map((row) => this.toSummaryDto(row, workflowNamesByRequestId.get(row.id) ?? null)),
			nextCursor,
			hasMore,
		};
	}

	async getSummaryForUser(user: User): Promise<GetWorkflowReviewRequestSummaryResponse> {
		await this.assertFeatureAvailable();

		const projectIds = await this.resolveAccessibleProjectIds(user);
		const hasAny = await this.workflowReviewRequestRepository.existsAnyForProjects(
			projectIds ?? undefined,
		);

		return { hasAny };
	}

	private async assertFeatureAvailable(): Promise<void> {
		if (!isWorkflowReviewsFeatureAvailable(this.licenseState.isWorkflowReviewsLicensed())) {
			throw new ForbiddenError('Workflow reviews are not available on this instance');
		}

		const policy = await this.workflowReviewPolicyService.get();
		if (!policy.enabled) {
			throw new ForbiddenError('Workflow reviews are disabled on this instance');
		}
	}

	/**
	 * Returns accessible project IDs, or `null` when the user can see all projects (instance owner).
	 */
	async resolveAccessibleProjectIds(user: User): Promise<string[] | null> {
		if (user.role?.slug === GLOBAL_OWNER_ROLE) {
			return null;
		}

		const [adminProjectIds, updateProjectIds, publishProjectIds] = await Promise.all([
			this.projectService.getProjectIdsWithScope(user, ['project:delete']),
			this.projectService.getProjectIdsWithScope(user, ['workflow:update']),
			this.projectService.getProjectIdsWithScope(user, ['workflow:publish']),
		]);

		return [...new Set([...adminProjectIds, ...updateProjectIds, ...publishProjectIds])];
	}

	private toSummaryDto(
		entity: WorkflowReviewRequest,
		workflowName: string | null,
	): WorkflowReviewRequestSummaryDto {
		return {
			id: entity.id,
			projectId: entity.projectId,
			title: entity.title,
			workflowName,
			decision: entity.decision,
			state: entity.state,
			createdAt: entity.createdAt.toISOString(),
			updatedAt: entity.updatedAt.toISOString(),
		};
	}
}
