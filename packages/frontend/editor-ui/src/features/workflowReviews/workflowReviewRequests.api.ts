import type {
	ListWorkflowReviewRequestResponse,
	GetWorkflowReviewRequestSummaryResponse,
	WorkflowReviewRequestState,
} from '@n8n/api-types';
import type { IRestApiContext } from '@n8n/rest-api-client';
import { makeRestApiRequest } from '@n8n/rest-api-client';

export type FetchWorkflowReviewRequestsParams = {
	state?: WorkflowReviewRequestState;
	limit?: number;
	cursor?: string;
};

export async function fetchWorkflowReviewRequestsSummary(
	context: IRestApiContext,
): Promise<GetWorkflowReviewRequestSummaryResponse> {
	return await makeRestApiRequest(context, 'GET', '/workflow-review-requests/summary');
}

export async function fetchWorkflowReviewRequests(
	context: IRestApiContext,
	params: FetchWorkflowReviewRequestsParams,
): Promise<ListWorkflowReviewRequestResponse> {
	return await makeRestApiRequest(context, 'GET', '/workflow-review-requests', params);
}
