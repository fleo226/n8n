<script lang="ts" setup>
import type { WorkflowReviewRequestSummaryDto, WorkflowReviewRequestState } from '@n8n/api-types';
import { computed, ref, watch } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nCard, N8nHeading, N8nLoading, N8nTabs, N8nText } from '@n8n/design-system';
import { useIntersectionObserver } from '@/app/composables/useIntersectionObserver';

const props = defineProps<{
	items: WorkflowReviewRequestSummaryDto[];
	activeState: WorkflowReviewRequestState;
	selectedId: string | null;
	loading: boolean;
	loadingMore: boolean;
	hasMore: boolean;
	isEmpty: boolean;
}>();

const emit = defineEmits<{
	select: [id: string];
	'update:activeState': [state: WorkflowReviewRequestState];
	loadMore: [];
}>();

const i18n = useI18n();
const listRef = ref<HTMLElement | null>(null);
const loadMoreSentinel = ref<HTMLElement | null>(null);

const tabOptions = computed(() => [
	{ label: i18n.baseText('workflowReviews.sidebar.tabs.open'), value: 'open' as const },
	{ label: i18n.baseText('workflowReviews.sidebar.tabs.closed'), value: 'closed' as const },
]);

const { observe: observeForLoadMore } = useIntersectionObserver({
	root: listRef,
	threshold: 0.01,
	onIntersect: () => emit('loadMore'),
});

watch(
	[loadMoreSentinel, () => props.hasMore, () => props.loadingMore, () => props.items.length],
	([sentinel, hasMore, loadingMore]) => {
		if (sentinel && hasMore && !loadingMore) {
			observeForLoadMore(sentinel);
		}
	},
	{ immediate: true, flush: 'post' },
);

function onTabChange(value: string | number | boolean) {
	emit('update:activeState', String(value) as WorkflowReviewRequestState);
}
</script>

<template>
	<aside :class="$style.sidebar" data-test-id="workflow-reviews-sidebar">
		<div :class="$style.columnTitle">
			<N8nHeading bold tag="h2" size="xlarge" data-test-id="workflow-reviews-page-title">
				{{ i18n.baseText('workflowReviews.page.title') }}
			</N8nHeading>
		</div>
		<div :class="$style.header">
			<N8nTabs
				:model-value="activeState"
				:options="tabOptions"
				variant="modern"
				data-test-id="workflow-reviews-tabs"
				@update:model-value="onTabChange"
			/>
		</div>

		<div ref="listRef" :class="$style.list">
			<N8nLoading v-if="loading" :loading="true" :rows="4" />
			<template v-else>
				<N8nText
					v-if="isEmpty"
					color="text-light"
					size="small"
					data-test-id="workflow-reviews-empty"
				>
					{{ i18n.baseText('workflowReviews.sidebar.empty') }}
				</N8nText>
				<N8nCard
					v-for="item in items"
					:key="item.id"
					:class="[$style.card, selectedId === item.id ? $style.cardSelected : '']"
					data-test-id="workflow-review-request-row"
					@click="emit('select', item.id)"
				>
					<div :class="$style.cardContent">
						<N8nText bold tag="h3" :class="$style.cardTitle">
							{{ item.title }}
						</N8nText>
					</div>
				</N8nCard>
				<div v-if="loadingMore" :class="$style.loadingMore">
					<N8nLoading :loading="true" :rows="1" />
				</div>
				<div ref="loadMoreSentinel" :class="$style.sentinel" />
			</template>
		</div>
	</aside>
</template>

<style lang="scss" module>
.sidebar {
	display: flex;
	flex-direction: column;
	flex: 0 0 35%;
	min-width: 12rem;
	height: 100%;
	border-right: var(--border-width) solid var(--color--foreground--tint-1);
}

.columnTitle {
	display: flex;
	align-items: center;
	min-height: var(--spacing--2xl);
	padding: 0 var(--spacing--md) var(--spacing--sm) 0;
}

.header {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	padding: 0 var(--spacing--md) var(--spacing--md) 0;
}

.list {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: var(--spacing--2xs);
	overflow-y: auto;
	padding: 0 var(--spacing--md) var(--spacing--md) 0;
}

.card {
	cursor: pointer;
	padding: 0;
	align-items: stretch;
	transition: background-color 0.3s ease;

	&:hover:not(.cardSelected) {
		background-color: var(--color--background--light-2);
	}
}

.cardSelected {
	background-color: var(--background--active);
}

.cardContent {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: var(--spacing--2xs);
	min-width: 0;
	width: 100%;
	padding: var(--spacing--sm);
}

.cardTitle {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	width: 100%;
	font-size: var(--font-size--sm);
}

.loadingMore {
	padding: var(--spacing--sm);
}

.sentinel {
	height: 1px;
}
</style>
