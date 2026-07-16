import {
	CreateWorkflowReviewRequestDto,
	type GetWorkflowReviewRequestSummaryResponse,
	type ListWorkflowReviewRequestResponse,
	ListWorkflowReviewRequestQueryDto,
} from '@n8n/api-types';
import { AuthenticatedRequest } from '@n8n/db';
import { Body, Get, Licensed, Post, Query, RestController } from '@n8n/decorators';
import type { Response } from 'express';

import { WorkflowReviewRequestService } from './workflow-review-request.service';

@RestController('/workflow-review-requests')
export class WorkflowReviewRequestsController {
	constructor(private readonly workflowReviewRequestService: WorkflowReviewRequestService) {}

	@Post('/')
	@Licensed('feat:workflowReviews')
	async create(
		req: AuthenticatedRequest,
		res: Response,
		@Body dto: CreateWorkflowReviewRequestDto,
	) {
		const request = await this.workflowReviewRequestService.create(req.user, dto);
		res.status(201);
		return request;
	}

	@Get('/')
	@Licensed('feat:workflowReviews')
	async list(
		req: AuthenticatedRequest,
		_res: Response,
		@Query query: ListWorkflowReviewRequestQueryDto,
	): Promise<ListWorkflowReviewRequestResponse> {
		return await this.workflowReviewRequestService.listForUser(req.user, query);
	}

	@Get('/summary')
	@Licensed('feat:workflowReviews')
	async getSummary(
		req: AuthenticatedRequest,
		_res: Response,
	): Promise<GetWorkflowReviewRequestSummaryResponse> {
		return await this.workflowReviewRequestService.getSummaryForUser(req.user);
	}
}
