import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as workflowReviewRequestsApi from './workflowReviewRequests.api';
import { useWorkflowReviewRequestsStore } from './workflowReviewRequests.store';

vi.mock('./workflowReviewRequests.api');

describe('useWorkflowReviewRequestsStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.resetAllMocks();
	});

	it('probes summary and loads open reviews when hasAny is true', async () => {
		vi.mocked(workflowReviewRequestsApi.fetchWorkflowReviewRequestsSummary).mockResolvedValue({
			hasAny: true,
		});
		vi.mocked(workflowReviewRequestsApi.fetchWorkflowReviewRequests).mockResolvedValue({
			data: [
				{
					id: 'req-1',
					projectId: 'proj-1',
					title: 'Review',
					workflowName: 'My workflow',
					decision: 'pending',
					state: 'open',
					createdAt: '2024-01-01T00:00:00.000Z',
					updatedAt: '2024-01-01T00:00:00.000Z',
				},
			],
			nextCursor: null,
			hasMore: false,
		});

		const store = useWorkflowReviewRequestsStore();
		await store.probeInbox();

		expect(workflowReviewRequestsApi.fetchWorkflowReviewRequestsSummary).toHaveBeenCalledTimes(1);
		expect(store.hasAnyReviews).toBe(true);
		expect(store.probeSettled).toBe(true);
		expect(store.showSidebar).toBe(true);
		expect(store.items).toHaveLength(1);
	});

	it('skips list fetch when summary hasAny is false', async () => {
		vi.mocked(workflowReviewRequestsApi.fetchWorkflowReviewRequestsSummary).mockResolvedValue({
			hasAny: false,
		});

		const store = useWorkflowReviewRequestsStore();
		await store.probeInbox();

		expect(workflowReviewRequestsApi.fetchWorkflowReviewRequests).not.toHaveBeenCalled();
		expect(store.showSidebar).toBe(false);
	});

	it('refetches when switching tabs', async () => {
		vi.mocked(workflowReviewRequestsApi.fetchWorkflowReviewRequests).mockResolvedValue({
			data: [],
			nextCursor: null,
			hasMore: false,
		});

		const store = useWorkflowReviewRequestsStore();
		store.setActiveState('closed');

		expect(store.activeState).toBe('closed');
		expect(workflowReviewRequestsApi.fetchWorkflowReviewRequests).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ state: 'closed' }),
		);
	});

	it('ignores stale list responses', async () => {
		let resolveFirst!: (value: {
			data: [];
			nextCursor: null;
			hasMore: false;
		}) => void;
		const firstResponse = new Promise<{
			data: [];
			nextCursor: null;
			hasMore: false;
		}>((resolve) => {
			resolveFirst = resolve;
		});

		vi.mocked(workflowReviewRequestsApi.fetchWorkflowReviewRequests)
			.mockImplementationOnce(async () => await firstResponse)
			.mockResolvedValueOnce({
				data: [
					{
						id: 'req-2',
						projectId: 'proj-1',
						title: 'Newer',
						workflowName: null,
						decision: 'pending',
						state: 'closed',
						createdAt: '2024-01-02T00:00:00.000Z',
						updatedAt: '2024-01-02T00:00:00.000Z',
					},
				],
				nextCursor: null,
				hasMore: false,
			});

		const store = useWorkflowReviewRequestsStore();
		const firstFetch = store.fetchList({ reset: true });
		store.setActiveState('closed');
		await vi.waitFor(() => {
			expect(store.items).toEqual([expect.objectContaining({ id: 'req-2', title: 'Newer' })]);
		});

		resolveFirst({ data: [], nextCursor: null, hasMore: false });
		await firstFetch;

		expect(store.items).toEqual([expect.objectContaining({ id: 'req-2', title: 'Newer' })]);
	});
});
