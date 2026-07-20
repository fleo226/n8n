import { ref, watch, type Ref } from 'vue';
import type { InstanceAiModelCredential } from '@n8n/api-types';
import { useInstanceCredentialEditor } from './useInstanceCredentialEditor';

/**
 * Shared state for the instance-credential dialogs: hydrates the selected
 * credential when the dialog opens, and holds/reopens it around the standard
 * credential modal so unsaved edits survive the round trip.
 */
export function useInstanceCredentialDialog(options: {
	open: Ref<boolean>;
	/** The credential currently persisted for this dialog's use. */
	current: () => string;
	/** Restore edits from the persisted value when the dialog opens fresh. */
	hydrate: () => void;
	/** Instance credentials available for this use, refreshed after the modal closes. */
	credentials: () => InstanceAiModelCredential[];
	refresh: () => Promise<void>;
	/** Apply a credential created in the modal (defaults to selecting it). */
	onCreated?: (credential: InstanceAiModelCredential) => void;
}) {
	const { open } = options;
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
			credentialId.value = options.current();
			options.hydrate();
		},
		{ immediate: true },
	);

	const { createCredential, editCredential } = useInstanceCredentialEditor({
		credentials: options.credentials,
		refresh: options.refresh,
		onClosed: (created) => {
			if (created) {
				if (options.onCreated) options.onCreated(created);
				else credentialId.value = created.id;
			}
			open.value = true;
		},
	});

	function holdForCredentialModal() {
		skipNextHydrate = true;
		open.value = false;
	}

	function openCreate(credentialType: string) {
		holdForCredentialModal();
		createCredential(credentialType);
	}

	function openEdit() {
		if (!credentialId.value) return;
		holdForCredentialModal();
		editCredential(credentialId.value);
	}

	return { credentialId, openCreate, openEdit };
}
