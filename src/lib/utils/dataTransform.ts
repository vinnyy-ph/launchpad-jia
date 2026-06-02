import { ObjectId } from "mongodb";

interface ThrowHttpErrorProps {
  message: string;
  status: number;
}

function throwHttpError({ message, status }: ThrowHttpErrorProps) {
  const error = new Error(message);
  (error as any).status = status;
  return error;
}

export function toIdString(value: unknown): string {
  if (value instanceof ObjectId) {
    return value.toHexString();
  }

  if (typeof value == "string" && ObjectId.isValid(value)) {
    return value;
  }

  throw throwHttpError({
    message: "Value is not an ObjectId or ObjectId string",
    status: 400,
  });
}

export function toObjectId(value: unknown): ObjectId {
  if (value instanceof ObjectId) {
    return value;
  }

  if (typeof value == "string" && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }

  throw throwHttpError({
    message: "Value is not an ObjectId or ObjectId string",
    status: 400,
  });
}
