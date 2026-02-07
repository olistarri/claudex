import { DeviceAuthButton, type DeviceAuthConfig } from './DeviceAuthButton';

const OPENAI_CONFIG: DeviceAuthConfig = {
  deviceCodeEndpoint: '/integrations/openai/device-code',
  pollTokenEndpoint: '/integrations/openai/poll-token',
  buildPollBody: (resp) => ({ device_code: resp.device_code, user_code: resp.user_code }),
  buildResult: (pollResp) =>
    JSON.stringify({
      tokens: {
        access_token: pollResp.access_token,
        refresh_token: pollResp.refresh_token,
      },
    }),
  labels: {
    login: 'Login with OpenAI',
    connected: 'OpenAI connected',
    helperText: 'Requires a ChatGPT Pro/Plus subscription.',
    errorPrefix: 'OpenAI',
  },
};

interface OpenAIAuthButtonProps {
  value: string | null;
  onChange: (token: string | null) => void;
}

export const OpenAIAuthButton: React.FC<OpenAIAuthButtonProps> = ({ value, onChange }) => (
  <DeviceAuthButton value={value} onChange={onChange} config={OPENAI_CONFIG} />
);
