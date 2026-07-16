import { z } from 'zod';

import { Z } from '../../zod-class';

export const WorkflowReviewRequestState = {
	Open: 'open',
	Closed: 'closed',
} as const;

export type WorkflowReviewRequestState =
	(typeof WorkflowReviewRequestState)[keyof typeof WorkflowReviewRequestState];

export const workflowReviewRequestStateSchema = z.enum([
	WorkflowReviewRequestState.Open,
	WorkflowReviewRequestState.Closed,
]);

export const WorkflowReviewRequestDecision = {
	Pending: 'pending',
	ChangesRequested: 'changes_requested',
	Approved: 'approved',
} as const;

export type WorkflowReviewRequestDecision =
	(typeof WorkflowReviewRequestDecision)[keyof typeof WorkflowReviewRequestDecision];

export const workflowReviewRequestDecisionSchema = z.enum([
	WorkflowReviewRequestDecision.Pending,
	WorkflowReviewRequestDecision.ChangesRequested,
	WorkflowReviewRequestDecision.Approved,
]);

export interface WorkflowReviewRequestSummaryDto {
	id: string;
	projectId: string;
	title: string;
	workflowName: string | null;
	decision: WorkflowReviewRequestDecision;
	state: WorkflowReviewRequestState;
	createdAt: string;
	updatedAt: string;
}

export class ListWorkflowReviewRequestQueryDto extends Z.class({
	limit: z.coerce.number().int().min(1).max(100).default(15),
	cursor: z.string().min(1).max(36).optional(),
	state: workflowReviewRequestStateSchema.optional(),
}) {}

export interface ListWorkflowReviewRequestResponse {
	data: WorkflowReviewRequestSummaryDto[];
	nextCursor: string | null;
	hasMore: boolean;
}

export interface GetWorkflowReviewRequestSummaryResponse {
	hasAny: boolean;
}
