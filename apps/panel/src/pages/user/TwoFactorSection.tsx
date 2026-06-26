import {
  useStartUserFactorVerificationMutation,
  useCompleteUserFactorVerificationMutation,
  useDeleteUserAuthFactorMutation,
  type User,
} from "../../store/api/userApi";
import TwoFactorSectionBase from "../../components/molecules/two-factor-section/TwoFactorSectionBase";

type TwoFactorSectionProps = {
  user: User;
};

const TwoFactorSection = ({ user }: TwoFactorSectionProps) => {
  const [startVerification, { isLoading: isStarting }] = useStartUserFactorVerificationMutation();
  const [completeVerification, { isLoading: isVerifying }] = useCompleteUserFactorVerificationMutation();
  const [disableFactor, { isLoading: isDisabling }] = useDeleteUserAuthFactorMutation();

  return (
    <TwoFactorSectionBase
      id={user._id ?? ""}
      hasAuthFactor={!!user.authFactor}
      entityLabel="user"
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
