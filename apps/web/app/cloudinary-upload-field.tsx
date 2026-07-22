"use client";

import { ChangeEvent, useState } from "react";

type CloudinaryUploadFieldProps = {
  label: string;
  value: string;
  onUploaded: (secureUrl: string) => void;
  onMessage: (message: string, tone: "success" | "error") => void;
};

type CloudinaryUploadResult = {
  secure_url?: string;
};

export function CloudinaryUploadField({ label, value, onUploaded, onMessage }: CloudinaryUploadFieldProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      onMessage("Add Cloudinary cloud name and unsigned upload preset to upload credential files.", "error");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onMessage("Choose a credential file under 10 MB.", "error");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const secureUrl = await uploadToCloudinary(file, cloudName, uploadPreset, setUploadProgress);
      onUploaded(secureUrl);
      onMessage("Credential file uploaded to Cloudinary.", "success");
    } catch {
      onMessage("Cloudinary upload failed. Check your preset and try again.", "error");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="cloudinary-upload-field">
      <label>
        {label}
        <input accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={isUploading} onChange={handleFileChange} type="file" />
      </label>
      <div className="upload-feedback">
        <span>{isUploading ? `Uploading ${uploadProgress}%` : value ? "Credential file ready" : "PDF, JPG, PNG, or WEBP up to 10 MB"}</span>
        {value ? (
          <a href={value} rel="noreferrer" target="_blank">
            View uploaded document
          </a>
        ) : null}
      </div>
      {isUploading ? (
        <div className="upload-progress" aria-label="Cloudinary upload progress">
          <span style={{ width: `${uploadProgress}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function uploadToCloudinary(file: File, cloudName: string, uploadPreset: string, onProgress: (progress: number) => void) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "medshift/credentials");

  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("Cloudinary upload failed"));
        return;
      }

      const result = JSON.parse(request.responseText) as CloudinaryUploadResult;

      if (!result.secure_url) {
        reject(new Error("Cloudinary response did not include a secure URL"));
        return;
      }

      resolve(result.secure_url);
    };
    request.onerror = () => reject(new Error("Cloudinary upload failed"));
    request.send(formData);
  });
}
