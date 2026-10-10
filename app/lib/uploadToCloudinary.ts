import axios from "axios";

type SignedParams = {
  signature: string;
  apiKey: string;
  cloudName: string;
  timestamp: number;
  folder: string;
  transformation?: string;
};

export type CloudinaryUploadResult = {
  public_id: string;
  bytes: number;
  duration?: number;
};

// Uploads a file from the browser straight to Cloudinary, so large files
// never pass through our Vercel functions (which cap request bodies at 4.5MB).
export async function uploadToCloudinary(
  file: File,
  type: "video" | "image",
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const { data: params } = await axios.get<SignedParams>(
    "/api/sign-cloudinary-params",
    { params: { type } },
  );

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", params.apiKey);
  formData.append("timestamp", String(params.timestamp));
  formData.append("signature", params.signature);
  formData.append("folder", params.folder);
  if (params.transformation) {
    formData.append("transformation", params.transformation);
  }

  const { data } = await axios.post<CloudinaryUploadResult>(
    `https://api.cloudinary.com/v1_1/${params.cloudName}/${type}/upload`,
    formData,
    {
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    },
  );

  return data;
}
