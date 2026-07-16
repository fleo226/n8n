<script lang="ts" setup>
import { onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from '@n8n/i18n';
import { N8nHeading, N8nLoading } from '@n8n/design-system';
import PageViewLayout from '@/app/components/layouts/PageViewLayout.vue';
import { useDocumentTitle } from '@/app/composables/useDocumentTitle';
import { useToast } from '@/app/composables/useToast';

import WorkflowReviewRequestsDisclaimer from '../components/WorkflowReviewRequestsDisclaimer.vue';
import WorkflowReviewRequestsSidebar from '../components/WorkflowReviewRequestsSidebar.vue';
import WorkflowReviewRequestDetailPlaceholder from '../components/WorkflowReviewRequestDetailPlaceholder.vue';
import { useWorkflowReviewRequestsStore } from '../workflowReviewRequests.store';

const store = useWorkflowReviewRequestsStore();
const {
	probeSettled,
	showSidebar,
	selectedItem,
	items,
	activeState,
	selectedId,
	loading,
	loadingMore,
	hasMore,
	isEmpty,
} = storeToRefs(store);

const i18n = useI18n();
const documentTitle = useDocumentTitle();
const { showError } = useToast();

documentTitle.set(i18n.baseText('workflowReviews.page.title'));

onMounted(async () => {
	try {
		await store.probeInbox();
	} catch (error) {
		showError(error, i18n.baseText('workflowReviews.error.load'));
	}
});

onUnmounted(() => {
	store.reset();
});
</script>

<template>
	<PageViewLayout data-test-id="workflow-review-requests-view">
		<div :class="$style.content">
			<WorkflowReviewRequestsSidebar
				v-if="showSidebar"
				:items="items"
				:active-state="activeState"
				:selected-id="selectedId"
				:loading="loading"
				:loading-more="loadingMore"
				:has-more="hasMore"
				:is-empty="isEmpty"
				@select="store.selectItem"
				@update:active-state="store.setActiveState"
				@load-more="store.loadMore"
			/>

			<div :class="$style.main">
				<div :class="$style.columnTitle">
					<N8nHeading
						v-if="showSidebar && selectedItem"
						bold
						tag="h2"
						size="xlarge"
						data-test-id="workflow-review-request-title"
					>
						{{ selectedItem.title }}
					</N8nHeading>
					<N8nHeading
						v-else-if="!showSidebar"
						bold
						tag="h2"
						size="xlarge"
						data-test-id="workflow-reviews-page-title"
					>
						{{ i18n.baseText('workflowReviews.page.title') }}
					</N8nHeading>
				</div>

				<div :class="$style.mainBody">
					<N8nLoading v-if="!probeSettled" :loading="true" :rows="3" />
					<WorkflowReviewRequestDetailPlaceholder v-else-if="selectedItem" />
					<WorkflowReviewRequestsDisclaimer v-else />
				</div>
			</div>
		</div>
	</PageViewLayout>
</template>

<style lang="scss" module>
.content {
	display: flex;
	width: 100%;
	min-height: 0;
	height: 100%;
	overflow: hidden;
}

.main {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
	overflow: hidden;
	padding: 0 0 var(--spacing--md) var(--spacing--md);
}

.columnTitle {
	display: flex;
	align-items: center;
	min-height: var(--spacing--2xl);
	padding-bottom: var(--spacing--sm);
}

.mainBody {
	flex: 1;
	min-height: 0;
	overflow: auto;
}
</style>
