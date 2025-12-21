import type { TZkpLoginUser } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import { useOutletContext } from 'react-router-dom';
import type { TLoginLayoutContext } from '~/common';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import { useAuthContext } from '~/hooks/AuthContext';
import { useZkpLoginUserMutation } from '~/data-provider';
import { getLoginError } from '~/utils';
import { useLocalize } from '~/hooks';
import ZkpLoginForm from './ZkpLoginForm';

function Login() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { error, setError } = useAuthContext();
  const { startupConfig } = useOutletContext<TLoginLayoutContext>();

  // ZKP Login mutation
  const zkpLoginMutation = useZkpLoginUserMutation({
    onSuccess: () => {
      // Use full page reload to properly initialize auth state
      window.location.href = '/c/new';
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'ZKP authentication failed';
      setError(errorMessage);
      showToast({
        message: errorMessage,
        status: 'error',
      });
    },
  });

  const handleZkpLogin = (data: TZkpLoginUser) => {
    setError(undefined);
    zkpLoginMutation.mutate(data);
  };

  return (
    <>
      {error != null && <ErrorMessage>{localize(getLoginError(error))}</ErrorMessage>}
      <ZkpLoginForm
        onSubmit={handleZkpLogin}
        startupConfig={startupConfig}
        isSubmitting={zkpLoginMutation.isLoading}
      />
    </>
  );
}

export default Login;
