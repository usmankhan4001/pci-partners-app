export interface UploadStrategyResponse {
  method: "presigned" | "direct";
  uploadUrl: string;
  fields?: Record<string, string>;
  key: string;
  confirmRequired: boolean;
  confirmUrl?: string;
}

export interface DownloadStrategyResponse {
  method: "presigned" | "direct";
  url: string;
}

export interface UploadedFile {
  key: string;
  url: string;
}
