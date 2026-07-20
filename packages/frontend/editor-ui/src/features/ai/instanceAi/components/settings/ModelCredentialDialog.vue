<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
	N8nButton,
	N8nDialog,
	N8nDialogFooter,
	N8nDropdownMenu,
	N8nIcon,
	N8nInput,
	N8nInputLabel,
	N8nOption,
	N8nSelect,
	N8nText,
	type DropdownMenuItemProps,
} from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { INSTANCE_MODEL_CREDENTIAL_TYPES } from '../../constants';
import { useCredentialsStore } from '@/features/credentials/credentials.store';
import { useInstanceAiSettingsStore } from '../../instanceAiSettings.store';
import { useInstanceCredentialEditor } from '../../composables/useInstanceCredentialEditor';

const open = defineModel<boolean>('open', { required: true });

const i18n = useI18n();
const store = useInstanceAiSettingsStore();
const credentialsStore = useCredentialsStore();

const credentialId = ref('');
const modelName = ref('');
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
		credentialId.value = store.settings?.modelCredentialId ?? '';
		modelName.value = store.settings?.modelName ?? '';
	},
	{ immediate: true },
);

function credentialTypeLabel(type: string) {
	return credentialsStore.getCredentialTypeByName(type)?.displayName ?? type;
}

const createItems = computed<Array<DropdownMenuItemProps<string>>>(() =>
	INSTANCE_MODEL_CREDENTIAL_TYPES.map((type) => ({ id: type, label: credentialTypeLabel(type) })),
);

const credentialTypeById = (id: string) =>
	store.instanceModelCredentials.find((credential) => credential.id === id)?.type;

const { createCredential, editCredential } = useInstanceCredentialEditor({
	credentials: () => store.instanceModelCredentials,
	refresh: async () => await store.refreshInstanceModelCredentials(),
	onClosed: (created) => {
		if (created) selectCredential(created.id);
		open.value = true;
	},
});

function selectCredential(nextId: string) {
	const previousType = credentialId.value ? credentialTypeById(credentialId.value) : undefined;
	const nextType = nextId ? credentialTypeById(nextId) : undefined;
	if (nextType === undefined || previousType !== nextType) modelName.value = '';
	credentialId.value = nextId;
}

function holdForCredentialModal() {
	skipNextHydrate = true;
	open.value = false;
}

function handleCreate(credentialType: string) {
	holdForCredentialModal();
	createCredential(credentialType);
}

function handleEdit() {
	if (!credentialId.value) return;
	holdForCredentialModal();
	editCredential(credentialId.value);
}

const isComplete = computed(() => !credentialId.value || modelName.value.trim().length > 0);
const isChanged = computed(
	() =>
		credentialId.value !== (store.settings?.modelCredentialId ?? '') ||
		modelName.value.trim() !== (store.settings?.modelName ?? ''),
);

async function handleSave() {
	store.setField('modelCredentialId', credentialId.value || null);
	store.setField('modelName', credentialId.value ? modelName.value.trim() : null);
	await store.save();
	open.value = false;
}
</script>

<template>
	<N8nDialog
		v-model:open="open"
		size="small"
		:header="i18n.baseText('settings.n8nAgent.modelDialog.title')"
		:description="i18n.baseText('settings.n8nAgent.modelDialog.description')"
		data-test-id="n8n-agent-model-dialog"
	>
		<div :class="$style.fields">
			<N8nInputLabel :label="i18n.baseText('settings.n8nAgent.modelCredential.field')">
				<div :class="$style.credentialControls">
					<N8nSelect
						:class="$style.credentialSelect"
						:model-value="credentialId"
						size="medium"
						:disabled="store.isSaving"
						:placeholder="i18n.baseText('settings.n8nAgent.modelCredential.placeholder')"
						data-test-id="n8n-agent-model-credential-select"
						@update:model-value="selectCredential(String($event ?? ''))"
					>
						<N8nOption value="" :label="i18n.baseText('settings.n8nAgent.modelCredential.none')" />
						<N8nOption
							v-for="credential in store.instanceModelCredentials"
							:key="credential.id"
							:value="credential.id"
							:label="`${credential.name} · ${credentialTypeLabel(credential.type)}`"
						/>
					</N8nSelect>

					<N8nButton
						v-if="credentialId"
						variant="outline"
						size="medium"
						:label="i18n.baseText('settings.n8nAgent.credentials.edit')"
						:disabled="store.isSaving"
						data-test-id="n8n-agent-model-credential-edit"
						@click="handleEdit"
					/>

					<N8nDropdownMenu
						:items="createItems"
						placement="bottom-end"
						data-test-id="n8n-agent-model-credential-create"
						@select="handleCreate"
					>
						<template #trigger>
							<N8nButton variant="outline" size="medium" :disabled="store.isSaving">
								{{ i18n.baseText('settings.n8nAgent.modelCredential.createNew') }}
								<N8nIcon icon="chevron-down" size="small" />
							</N8nButton>
						</template>
					</N8nDropdownMenu>
				</div>
			</N8nInputLabel>

			<N8nInputLabel
				v-if="credentialId"
				:label="i18n.baseText('settings.n8nAgent.modelName.label')"
			>
				<N8nInput
					:model-value="modelName"
					size="medium"
					:disabled="store.isSaving"
					autocomplete="off"
					:spellcheck="false"
					:placeholder="i18n.baseText('settings.n8nAgent.modelName.placeholder')"
					data-test-id="n8n-agent-model-name-input"
					@update:model-value="modelName = String($event)"
				/>
			</N8nInputLabel>
		</div>

		<N8nText :class="$style.footnote" size="small" color="text-light" tag="p">
			{{ i18n.baseText('settings.n8nAgent.modelDialog.footnote') }}
		</N8nText>

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
				:disabled="store.isSaving || !isComplete || !isChanged"
				data-test-id="n8n-agent-model-dialog-save"
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
	margin-top: var(--spacing--sm);
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

.footnote {
	margin: var(--spacing--sm) 0 0;
}
</style>
