import { mockInstance } from '@n8n/backend-test-utils';
import { LicenseState } from '@n8n/backend-common';
import type { DbLockService, SharedWorkflowRepository, User, WorkflowReviewRequest } from '@n8n/db';
import {
	WorkflowReviewRequestAuthorRepository,
	WorkflowReviewRequestRepository,
	WorkflowReviewRequestWorkflowRepository,
} from '@n8n/db';
import { mock } from 'vitest-mock-extended';

import { ProjectService } from '@/services/project.service.ee';
import { WorkflowReviewPolicyService } from '@/services/workflow-review-policy.service';
import type { WorkflowFinderService } from '@/workflows/workflow-finder.service';
import type { WorkflowHistoryService } from '@/workflows/workflow-history/workflow-history.service';

import { WorkflowReviewRequestService } from '../workflow-review-request.service';

describe('WorkflowReviewRequestService list', () => {
	const workflowReviewPolicyService = mockInstance(WorkflowReviewPolicyService);
	const workflowFinderService = mock<WorkflowFinderService>();
	const workflowHistoryService = mock<WorkflowHistoryService>();
	const sharedWorkflowRepository = mock<SharedWorkflowRepository>();
	const workflowReviewRequestRepository = mockInstance(WorkflowReviewRequestRepository);
	const workflowReviewRequestWorkflowRepository = mockInstance(
		WorkflowReviewRequestWorkflowRepository,
	);
	const workflowReviewRequestAuthorRepository = mockInstance(WorkflowReviewRequestAuthorRepository);
	const projectService = mockInstance(ProjectService);
	const licenseState = mockInstance(LicenseState);
	const dbLockService = mock<DbLockService>();

	let service: WorkflowReviewRequestService;

	const user = mock<User>({ role: { slug: 'global:member' } });

	beforeEach(() => {
		vi.resetAllMocks();
		process.env.N8N_ENV_FEAT_WORKFLOW_REVIEWS = 'true';
		licenseState.isWorkflowReviewsLicensed.mockReturnValue(true);
		workflowReviewPolicyService.get.mockResolvedValue({ enabled: true });

		service = new WorkflowReviewRequestService(
			workflowReviewPolicyService,
			workflowFinderService,
			workflowHistoryService,
			sharedWorkflowRepository,
			workflowReviewRequestRepository,
			workflowReviewRequestWorkflowRepository,
			workflowReviewRequestAuthorRepository,
			projectService,
			licenseState,
			dbLockService,
		);
	});

	describe('listForUser', () => {
		function mockAccessibleProjects(projectIds: string[] = ['proj-1']) {
			projectService.getProjectIdsWithScope
				.mockResolvedValueOnce(projectIds)
				.mockResolvedValueOnce(projectIds)
				.mockResolvedValueOnce(projectIds);
		}

		it('returns paginated data with hasMore and nextCursor', async () => {
			mockAccessibleProjects();
			const rows = [
				mock<WorkflowReviewRequest>({
					id: 'req-2',
					projectId: 'proj-1',
					title: 'Second',
					decision: 'pending',
					state: 'open',
					createdAt: new Date('2024-01-02T00:00:00.000Z'),
					updatedAt: new Date('2024-01-02T00:00:00.000Z'),
				}),
				mock<WorkflowReviewRequest>({
					id: 'req-1',
					projectId: 'proj-1',
					title: 'First',
					decision: 'pending',
					state: 'open',
					createdAt: new Date('2024-01-01T00:00:00.000Z'),
					updatedAt: new Date('2024-01-01T00:00:00.000Z'),
				}),
			];
			workflowReviewRequestRepository.findManyForInbox.mockResolvedValue(rows);
			workflowReviewRequestWorkflowRepository.findWorkflowNamesByRequestIds.mockResolvedValue(
				new Map([['req-2', 'Linked workflow']]),
			);

			const result = await service.listForUser(user, { limit: 1 });

			expect(workflowReviewRequestRepository.findManyForInbox).toHaveBeenCalledWith({
				projectIds: ['proj-1'],
				state: undefined,
				limit: 2,
				cursor: undefined,
			});
			expect(result.data).toHaveLength(1);
			expect(result.data[0]?.workflowName).toBe('Linked workflow');
			expect(result.hasMore).toBe(true);
			expect(result.nextCursor).toBe('req-2');
		});
	});

	describe('resolveAccessibleProjectIds', () => {
		it('returns null for instance owner', async () => {
			const owner = mock<User>({ role: { slug: 'global:owner' } });

			expect(await service.resolveAccessibleProjectIds(owner)).toBeNull();
			expect(projectService.getProjectIdsWithScope).not.toHaveBeenCalled();
		});

		it('unions admin and editor project ids for members', async () => {
			projectService.getProjectIdsWithScope
				.mockResolvedValueOnce(['admin-proj'])
				.mockResolvedValueOnce(['editor-proj'])
				.mockResolvedValueOnce(['editor-proj']);

			expect(await service.resolveAccessibleProjectIds(user)).toEqual([
				'admin-proj',
				'editor-proj',
			]);
		});
	});
});
