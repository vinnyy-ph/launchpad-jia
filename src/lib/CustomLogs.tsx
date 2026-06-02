import { api } from "./utils/apiClient";

export const customLog = (data: any) => {
  api.post("/api/custom-log", {
    data: data,
  }).catch((error) => {
    console.error("Error logging custom log:", error);
  });
};
