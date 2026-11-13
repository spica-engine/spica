import type {DataEngine} from "../../store/api/statusApi";

export function configurationForEngine<T extends Record<string, unknown>>(
  configuration: T,
  engine: DataEngine | undefined
): Partial<T> {
  if (engine !== "postgresql") return configuration;
  const {primaryField: _primaryField, ...rest} = configuration;
  return rest as Partial<T>;
}
