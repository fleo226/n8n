import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref } from 'vue';
import { fireEvent, waitFor } from '@testing-library/vue';
import { createTestingPinia } from '@pinia/testing';
import { setActivePinia } from 'pinia';
import { createComponentRenderer } from '@/__tests__/render';
import SettingsInstanceAiView from '../views/SettingsInstanceAiView.vue';
import ModelCredentialDialog from '../components/settings/ModelCredentialDialog.vue';
import { useInstanceAiSettingsStore } from '../instanceAiSettings.store';
import { useSettingsStore } from '@/app/stores/settings.store';
import { useCredentialsStore } from '@/features/credentials/credentials.store';
import type { FrontendModuleSettings } from '@n8n/api-types';
import type { ICredentialType } from 'n8n-workflow';

vi.mock('@n8n/i18n', async (importOriginal) => ({
	...(await importOriginal()),
	useI18n: () => ({
		baseText: (key: string) => key,
	}),
}));

vi.mock('@/app/composables/useDocumentTitle', () => ({
	useDocumentTitle: () => ({ set: vi.fn() }),
}));

vi.mock('@/app/stores/pushConnection.store', () => ({
	usePushConnectionStore: vi.fn().mockReturnValue({
		addEventListener: vi.fn(),
	}),
}));

vi.mock('../instanceAi.settings.api', () => ({
	fetchSettings: vi.fn().mockResolvedValue(null),
	updateSettings: vi.fn(),
	fetchPreferences: vi.fn().mockResolvedValue({
		credentialId: null,
		credentialType: null,
		credentialName: null,
		modelName: 'gpt-4',
		localGatewayDisabled: false,
	}),
	updatePreferences: vi.fn(),
	fetchModelCredentials: vi.fn().mockResolvedValue([]),
	fetchServiceCredentials: vi.fn().mockResolvedValue([]),
	fetchInstanceModelCredentials: vi.fn().mockResolvedValue([]),
}));

vi.mock('../instanceAi.api', () => ({
	createGatewayLink: vi.fn(),
	getGatewayStatus: vi.fn(),
}));

vi.mock('@/app/utils/rbac/permissions', () => ({
	hasPermission: vi.fn().mockReturnValue(true),
}));

const { mcpConnectionsExperimentMock, computerUseExperimentMock, browserUseExperimentMock } =
	vi.hoisted(() => ({
		mcpConnectionsExperimentMock: vi.fn(),
		browserUseExperimentMock: vi.fn(),
		computerUseExperimentMock: vi.fn(),
	}));

vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal()),
	useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/experiments/instanceAiMcpConnections', () => ({
	useInstanceAiMcpConnectionsExperiment: mcpConnectionsExperimentMock,
}));

vi.mock('@/experiments/instanceAiBrowserUse', () => ({
	useInstanceAiBrowserUseExperiment: browserUseExperimentMock,
}));

vi.mock('@/experiments/instanceAiComputerUse', () => ({
	useInstanceAiComputerUseExperiment: computerUseExperimentMock,
}));

const renderComponent = createComponentRenderer(SettingsInstanceAiView);
const renderModelDialog = createComponentRenderer(ModelCredentialDialog);

function setModuleSettings(
	settingsStore: ReturnType<typeof useSettingsStore>,
	instanceAi: FrontendModuleSettings['instance-ai'],
) {
	settingsStore.moduleSettings = { 'instance-ai': instanceAi };
}

const defaultModuleSettings: NonNullable<FrontendModuleSettings['instance-ai']> = {
	enabled: true,
	localGatewayDisabled: false,
	browserUseEnabled: true,
	proxyEnabled: false,
	cloudManaged: false,
	sandboxEnabled: true,
	workflowBuilderAvailable: true,
	sandboxUnavailableReason: null,
	runDebugEnabled: false,
};

describe('SettingsInstanceAiView', () => {
	let store: ReturnType<typeof useInstanceAiSettingsStore>;
	let settingsStore: ReturnType<typeof useSettingsStore>;

	beforeEach(() => {
		vi.clearAllMocks();
		mcpConnectionsExperimentMock.mockReturnValue({ isFeatureEnabled: ref(true) });
		browserUseExperimentMock.mockReturnValue({ isFeatureEnabled: ref(true) });
		computerUseExperimentMock.mockReturnValue({ isFeatureEnabled: ref(true) });
		const pinia = createTestingPinia({ stubActions: false });
		setActivePinia(pinia);
		useCredentialsStore().setCredentialTypes([
			{ name: 'openAiApi', displayName: 'OpenAI', properties: [] },
			{ name: 'anthropicApi', displayName: 'Anthropic', properties: [] },
		] satisfies ICredentialType[]);
		store = useInstanceAiSettingsStore();
		settingsStore = useSettingsStore();
		setModuleSettings(settingsStore, { ...defaultModuleSettings });
		store.$patch({
			settings: {
				enabled: true,
				permissions: {},
				mcpServers: '',
				mcpAccessEnabled: true,
				sandboxEnabled: false,
				sandboxProvider: 'n8n-sandbox',
				sandboxImage: '',
				sandboxTimeout: 60,
				daytonaCredentialId: null,
				n8nSandboxCredentialId: null,
				searchCredentialId: null,
				modelCredentialId: null,
				modelName: null,
				modelEnvConfigured: false,
				sandboxEnvConfigured: false,
				searchEnvConfigured: false,
				localGatewayDisabled: false,
			},
		});
	});

	describe('Model credential dialog', () => {
		it('stages a provider switch and only saves once a model name is committed', async () => {
			store.$patch({
				settings: {
					...store.settings!,
					modelCredentialId: 'openai-id',
					modelName: 'gpt-4o',
				},
				instanceModelCredentials: [
					{ id: 'openai-id', name: 'OpenAI', type: 'openAiApi', provider: 'openai' },
					{
						id: 'anthropic-id',
						name: 'Anthropic production',
						type: 'anthropicApi',
						provider: 'anthropic',
					},
				],
			});
			const save = vi.spyOn(store, 'save').mockResolvedValue();
			const { getByTestId, getByText } = renderModelDialog({ props: { open: true } });
			await nextTick();

			const select = getByTestId('n8n-agent-model-credential-select');
			await fireEvent.click(select.querySelector('input')!);
			await fireEvent.click(getByText('Anthropic production · Anthropic'));

			// Switching provider clears the model name, so saving is blocked until it is set.
			const saveButton = getByTestId('n8n-agent-model-dialog-save');
			expect(saveButton).toBeDisabled();
			expect(save).not.toHaveBeenCalled();

			const modelNameField = getByTestId('n8n-agent-model-name-input');
			const modelNameInput =
				modelNameField.tagName === 'INPUT'
					? (modelNameField as HTMLInputElement)
					: modelNameField.querySelector('input')!;
			await fireEvent.update(modelNameInput, 'claude-sonnet-4');
			await fireEvent.click(saveButton);

			expect(store.draft).toMatchObject({
				modelCredentialId: 'anthropic-id',
				modelName: 'claude-sonnet-4',
			});
			expect(save).toHaveBeenCalledOnce();
		});
	});

	describe('status row', () => {
		it('renders the enabled status action', () => {
			store.$patch({
				settings: {
					...store.settings!,
					modelCredentialId: 'openai-id',
					modelEnvConfigured: true,
					sandboxEnvConfigured: true,
				},
			});
			const { getByTestId, getByText } = renderComponent();
			expect(getByTestId('n8n-agent-status-menu')).toBeVisible();
			expect(getByText('settings.n8nAgent.status.enabled')).toBeVisible();
		});

		it('shows setup required while model or sandbox are unconfigured', () => {
			const { getByTestId, getByText } = renderComponent();
			expect(getByTestId('n8n-agent-status-menu')).toBeVisible();
			expect(getByText('settings.n8nAgent.status.setupRequired')).toBeVisible();
		});

		it('shows an enable button with dimmed sections when disabled but configured', () => {
			store.$patch({
				settings: { ...store.settings!, enabled: false, modelCredentialId: 'openai-id' },
			});
			setModuleSettings(settingsStore, { ...defaultModuleSettings, enabled: false });

			const { getByTestId, getByText, queryByTestId } = renderComponent();
			expect(getByTestId('n8n-agent-enable-button')).toBeVisible();
			expect(queryByTestId('n8n-agent-status-menu')).toBeNull();
			expect(getByText('settings.n8nAgent.permissions.title')).toBeVisible();
		});
	});

	describe('empty state', () => {
		it('shows the empty state when disabled and never configured', () => {
			store.$patch({ settings: { ...store.settings!, enabled: false } });
			setModuleSettings(settingsStore, { ...defaultModuleSettings, enabled: false });

			const { getByText, queryByText } = renderComponent();
			expect(getByText('settings.n8nAgent.empty.title')).toBeVisible();
			expect(queryByText('settings.n8nAgent.permissions.title')).toBeNull();
		});

		it('hides content when disabled via moduleSettings fallback', () => {
			store.$patch({ settings: null });
			setModuleSettings(settingsStore, { ...defaultModuleSettings, enabled: false });

			const { queryByText } = renderComponent();
			expect(queryByText('settings.n8nAgent.permissions.title')).toBeNull();
		});

		it('falls back to moduleSettings when store.settings is null', () => {
			store.$patch({ settings: null });
			setModuleSettings(settingsStore, { ...defaultModuleSettings, enabled: true });

			const { getByText } = renderComponent();
			expect(getByText('settings.n8nAgent.permissions.title')).toBeVisible();
		});
	});

	describe('credential rows', () => {
		it('shows add buttons when nothing is configured', () => {
			const { getByTestId } = renderComponent();
			expect(getByTestId('n8n-agent-model-add')).toBeVisible();
			expect(getByTestId('n8n-agent-sandbox-add')).toBeVisible();
			expect(getByTestId('n8n-agent-search-setup')).toBeVisible();
		});

		it('shows the configured model value once a credential pair is set', () => {
			store.$patch({
				settings: { ...store.settings!, modelCredentialId: 'openai-id', modelName: 'gpt-4o' },
				instanceModelCredentials: [
					{ id: 'openai-id', name: 'OpenAI', type: 'openAiApi', provider: 'openai' },
				],
			});

			const { getByText, queryByTestId } = renderComponent();
			expect(queryByTestId('n8n-agent-model-add')).toBeNull();
			expect(getByText('OpenAI · gpt-4o')).toBeVisible();
		});

		it('marks env-managed search instead of offering setup', () => {
			store.$patch({ settings: { ...store.settings!, searchEnvConfigured: true } });

			const { getByText, queryByTestId } = renderComponent();
			expect(queryByTestId('n8n-agent-search-setup')).toBeNull();
			expect(getByText('settings.n8nAgent.search.managedByEnv')).toBeVisible();
		});

		it('hides credential rows on managed deployments', () => {
			setModuleSettings(settingsStore, { ...defaultModuleSettings, proxyEnabled: true });

			const { queryByTestId } = renderComponent();
			expect(queryByTestId('n8n-agent-model-row')).toBeNull();
			expect(queryByTestId('n8n-agent-sandbox-row')).toBeNull();
			expect(queryByTestId('n8n-agent-search-row')).toBeNull();
		});
	});

	describe('Browser use settings', () => {
		it('shows the browser use toggle when the experiment is enabled', () => {
			const { getByTestId } = renderComponent();
			expect(getByTestId('n8n-agent-browser-use-toggle')).toBeVisible();
		});

		it('hides the browser use toggle when the experiment is disabled', () => {
			browserUseExperimentMock.mockReturnValue({ isFeatureEnabled: ref(false) });

			const { queryByTestId } = renderComponent();

			expect(queryByTestId('n8n-agent-browser-use-toggle')).toBeNull();
		});
	});

	describe('Computer use settings', () => {
		it('shows the computer use toggle when the experiment is enabled', () => {
			const { getByTestId } = renderComponent();
			expect(getByTestId('n8n-agent-computer-use-toggle')).toBeVisible();
		});

		it('hides the computer use toggle when the experiment is disabled', () => {
			computerUseExperimentMock.mockReturnValue({ isFeatureEnabled: ref(false) });

			const { queryByTestId } = renderComponent();

			expect(queryByTestId('n8n-agent-computer-use-toggle')).toBeNull();
		});
	});

	describe('MCP servers settings', () => {
		it('renders the MCP access toggle for admins', () => {
			const { getByTestId } = renderComponent();
			expect(getByTestId('n8n-agent-mcp-access-toggle')).toBeVisible();
		});

		it('persists a change to the MCP access toggle', async () => {
			const setField = vi.spyOn(store, 'setField');
			const save = vi.spyOn(store, 'save').mockResolvedValue();
			const { getByTestId } = renderComponent();

			await fireEvent.click(getByTestId('n8n-agent-mcp-access-toggle'));

			expect(setField).toHaveBeenCalledWith('mcpAccessEnabled', false);
			expect(save).toHaveBeenCalled();
		});

		it('shows the Execute MCP tools permission when the group is expanded', async () => {
			const { getByTestId, getByLabelText } = renderComponent();

			await fireEvent.click(getByLabelText('Toggle settings.n8nAgent.permissions.group.mcp'));

			await waitFor(() => expect(getByTestId('n8n-agent-permission-executeMcpTool')).toBeVisible());
		});

		it('locks the MCP permission group when MCP access is disabled', () => {
			store.$patch({ settings: { ...store.settings!, mcpAccessEnabled: false } });

			const { getByText, queryByTestId, queryByLabelText } = renderComponent();

			expect(getByText('settings.n8nAgent.permissions.group.mcpDisabled')).toBeVisible();
			expect(queryByLabelText('Toggle settings.n8nAgent.permissions.group.mcp')).toBeNull();
			expect(queryByTestId('n8n-agent-permission-executeMcpTool')).toBeNull();
		});

		it('hides the MCP settings card when the connections experiment is disabled', () => {
			mcpConnectionsExperimentMock.mockReturnValue({ isFeatureEnabled: ref(false) });

			const { queryByTestId } = renderComponent();

			expect(queryByTestId('n8n-agent-mcp-access-toggle')).toBeNull();
			expect(queryByTestId('n8n-agent-permission-group-mcp')).toBeNull();
		});
	});

	describe('Permissions groups', () => {
		it('renders a row per permission group', () => {
			const { getByTestId } = renderComponent();
			for (const group of ['workflows', 'folders', 'dataTables', 'credentials', 'system', 'web']) {
				expect(getByTestId(`n8n-agent-permission-group-${group}`)).toBeVisible();
			}
		});

		it('summarises non-default permissions as exceptions', () => {
			store.$patch({
				settings: {
					...store.settings!,
					permissions: { createWorkflow: 'always_allow', deleteWorkflow: 'blocked' },
				},
			});

			const { getByTestId } = renderComponent();
			expect(getByTestId('n8n-agent-permission-group-workflows').textContent).toContain(
				'settings.n8nAgent.permissions.group.exceptions',
			);
			expect(getByTestId('n8n-agent-permission-group-folders').textContent).toContain(
				'settings.n8nAgent.permissions.group.default',
			);
		});

		it('persists a permission change from an expanded group', async () => {
			const setPermission = vi.spyOn(store, 'setPermission');
			const save = vi.spyOn(store, 'save').mockResolvedValue();
			const { getByTestId, getByLabelText, getAllByText } = renderComponent();

			await fireEvent.click(getByLabelText('Toggle settings.n8nAgent.permissions.group.folders'));
			await waitFor(() => expect(getByTestId('n8n-agent-permission-createFolder')).toBeVisible());

			const select = getByTestId('n8n-agent-permission-createFolder');
			await fireEvent.click(select.querySelector('input')!);
			await fireEvent.click(getAllByText('settings.n8nAgent.permissions.alwaysAllow')[0]);

			expect(setPermission).toHaveBeenCalledWith('createFolder', 'always_allow');
			expect(save).toHaveBeenCalled();
		});
	});
});
