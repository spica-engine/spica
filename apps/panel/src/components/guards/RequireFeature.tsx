import React from "react";
import {Navigate} from "react-router-dom";
import {useEngine} from "../../hooks/useEngine";
import {isFeatureAvailable, type EngineFeature} from "../../utils/engineFeatures";

interface RequireFeatureProps {
  feature: EngineFeature;
  children: React.ReactNode;
}

const RequireFeature: React.FC<RequireFeatureProps> = ({feature, children}) => {
  const engine = useEngine();

  if (engine === undefined) {
    return null;
  }

  if (!isFeatureAvailable(feature, engine)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RequireFeature;
