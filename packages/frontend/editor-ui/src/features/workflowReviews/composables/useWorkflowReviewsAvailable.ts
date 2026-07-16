import { computed } from 'vue';

import { EnterpriseEditionFeature } from '@/app/constants';
import { useSettingsStore } from '@/app/stores/settings.store';
import { useEnvFeatureFlag } from '@/features/shared/envFeatureFlag/useEnvFeatureFlag';

/**
 * Whether workflow reviews UI should be shown: licensed, env-flagged, and enabled in instance policy.
 */
export function useWorkflowReviewsAvailable() {
	const settingsStore = useSettingsStore();
	const { check: checkEnvFeatureFlag } = useEnvFeatureFlag();

	return computed(
		() =>
			settingsStore.isEnterpriseFeatureEnabled[EnterpriseEditionFeature.WorkflowReviews] &&
			checkEnvFeatureFlag.value('WORKFLOW_REVIEWS') &&
			(settingsStore.settings.workflowReviews?.enabled ?? false),
	);
}
