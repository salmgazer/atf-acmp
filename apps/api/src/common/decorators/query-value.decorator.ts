import { Transform } from "class-transformer";

export function parseBoolean(value: unknown): unknown {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value;
}

// Read the original value because implicit conversion treats "false" as true.
export const StrictBoolean = () => Transform(({ obj, key }) => parseBoolean(obj[key]));
