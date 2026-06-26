import {
  useStartFactorVerificationMutation,
  useCompleteFactorVerificationMutation,
  useDeleteAuthFactorMutation,
  type Identity,
} from "../../store/api/identityApi";
import TwoFactorSectionBase from "../../components/molecules/two-factor-section/TwoFactorSectionBase";

type TwoFactorSectionProps = {
  identity: Identity;
};

const TwoFactorSection = ({ identity }: TwoFactorSectionProps) => {
  const [startVerification, { isLoading: isStarting }] = useStartFactorVerificationMutation();
  const [completeVerification, { isLoading: isVerifying }] = useCompleteFactorVerificationMutation();
  const [disableFactor, { isLoading: isDisabling }] = useDeleteAuthFactorMutation();

  return (
    <TwoFactorSectionBase
      id={identity._id ?? ""}
      hasAuthFactor={!!identity.authFactor}
      entityLabel="identity"
      startVerification={startVerification}
      isStarting={isStarting}
      completeVerification={completeVerification}
      isVerifying={isVerifying}
      disableFactor={disableFactor}
      isDisabling={isDisabling}
    />
  );
};

export default TwoFactorSection;
