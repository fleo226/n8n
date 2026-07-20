<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
	N8nButton,
	N8nDialog,
	N8nDialogFooter,
	N8nInputLabel,
	N8nOption,
	N8nSelect,
	N8nText,
} from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { useInstanceAiSettingsStore } from '../../instanceAiSettings.store';
import { useInstanceCredentialEditor } from '../../composables/useInstanceCredentialEditor';

const open = defineModel<boolean>('open', { required: true });

const i18n = useI18n();
const store = useInstanceAiSettingsStore();

const sandboxProvider = computed(() => store.settings?.sandboxProvider ?? 'n8n-sandbox');
const providerLabel = computed(() =>
	sandboxProvider.value === 'daytona' ? 'Daytona' : 'n8n Sandbox Service',
);
const credentialType = computed(() =>
	sandboxProvider.value === 'daytona' ? 'daytonaApi' : 'httpHeaderAuth',
);
const credentialField = computed(() =>
	sandboxProvider.value === 'daytona'
		? ('daytonaCredentialId' as const)
		: ('n8nSandboxCredentialId' as const),
);
const credentials = computed(() =>
	store.serviceCredentials.filter((credential) => credential.type === credentialType.value),
);

const credentialId = ref('');
// Set while the credential modal is open on top, so reopening restores unsaved edits.
let skipNextHydrate = false;

watch(
	open,
	(isOpen) => {
		if (!isOpen) return;
		if (skipNextHydrate) {
			skipNextHydrate = false;
			return;
		}
		credentialId.value = store.settings?.[credentialField.value] ?? '';
	},
	{ immediate: true },
);

const { createCredential, editCredential } = useInstanceCredentialEditor({
	credentials: () => credentials.value,
	refresh: async () => await store.refreshCredentials(),
	onClosed: (created) => {
		if (created) credentialId.value = created.id;
		open.value = true;
	},
});

function holdForCredentialModal() {
	skipNextHydrate = true;
	open.value = false;
}

function handleCreate() {
	holdForCredentialModal();
	createCredential(credentialType.value);
}

function handleEdit() {
	if (!credentialId.value) return;
	holdForCredentialModal();
	editCredential(credentialId.value);
}

const isChanged = computed(
	() => credentialId.value !== (store.settings?.[credentialField.value] ?? ''),
);

async function handleSave() {
	store.setField(credentialField.value, credentialId.value || null);
	await store.save();
	open.value = false;
}
</script>

<template>
	<N8nDialog
		v-model:open="open"
		size="small"
		:header="i18n.baseText('settings.n8nAgent.sandboxDialog.title')"
		:description="i18n.baseText('settings.n8nAgent.sandboxDialog.description')"
		data-test-id="n8n-agent-sandbox-dialog"
	>
		<div :class="$style.fields">
			<N8nInputLabel :label="i18n.baseText('settings.n8nAgent.sandboxDialog.provider')">
				<N8nText tag="p" :class="$style.providerValue" size="medium" color="text-dark">
					{{ providerLabel }}
				</N8nText>
				<N8nText tag="p" :class="$style.providerHint" size="small" color="text-light">
					{{ i18n.baseText('settings.n8nAgent.sandboxDialog.providerHint') }}
				</N8nText>
			</N8nInputLabel>

			<N8nInputLabel :label="i18n.baseText('settings.n8nAgent.sandboxCredential.label')">
				<div :class="$style.credentialControls">
					<N8nSelect
						:class="$style.credentialSelect"
						:model-value="credentialId"
						size="medium"
						:disabled="store.isSaving"
						:placeholder="i18n.baseText('settings.n8nAgent.sandboxCredential.placeholder')"
						data-test-id="n8n-agent-sandbox-credential-select"
						@update:model-value="credentialId = String($event ?? '')"
					>
						<N8nOption value="" :label="i18n.baseText('settings.n8nAgent.modelCredential.none')" />
						<N8nOption
							v-for="credential in credentials"
							:key="credential.id"
							:value="credential.id"
							:label="credential.name"
						/>
					</N8nSelect>

					<N8nButton
						v-if="credentialId"
						variant="outline"
						size="medium"
						:label="i18n.baseText('settings.n8nAgent.credentials.edit')"
						:disabled="store.isSaving"
						data-test-id="n8n-agent-sandbox-credential-edit"
						@click="handleEdit"
					/>

					<N8nButton
						variant="outline"
						size="medium"
						:label="i18n.baseText('settings.n8nAgent.modelCredential.createNew')"
						:disabled="store.isSaving"
						data-test-id="n8n-agent-sandbox-credential-create"
						@click="handleCreate"
					/>
				</div>
			</N8nInputLabel>
		</div>

		<N8nDialogFooter>
			<N8nButton
				variant="outline"
				size="medium"
				:label="i18n.baseText('generic.cancel')"
				@click="open = false"
			/>
			<N8nButton
				variant="solid"
				size="medium"
				:label="i18n.baseText('generic.save')"
				:disabled="store.isSaving || !isChanged"
				data-test-id="n8n-agent-sandbox-dialog-save"
				@click="handleSave"
			/>
		</N8nDialogFooter>
	</N8nDialog>
</template>

<style lang="scss" module>
.fields {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	margin: var(--spacing--sm) 0;
}

.credentialControls {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: var(--spacing--2xs);
}

.credentialSelect {
	flex: 1 1 100%;
	min-width: 0;
}

.providerValue {
	margin: 0;
}

.providerHint {
	margin: var(--spacing--4xs) 0 0;
}
</style>
