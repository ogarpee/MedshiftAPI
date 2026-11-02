"use client";

import { ChangeEvent, useState } from "react";
import { RequiredWorkerDocumentCategories, WorkerDocumentCategory } from "@medshift/shared-types";
import { apiFetch } from "./session-fetch";

export type WorkerDocumentRecord = {
  id: string;
  category: WorkerDocumentCategory;
  cloudinaryPublicId?: string;
  documentUrl?: string;
  resourceType?: string;
  deliveryType?: string;
  version?: number;
  format?: string;
  originalFilename?: string;
  bytes?: number;
  uploadedAt?: string;
  verificationStatus?: string;
  rejectionReason?: string;
};

type Props = {
  apiUrl: string;
  documents: WorkerDocumentRecord[];
  onChange: (documents: WorkerDocumentRecord[]) => void;
  onMessage: (message: string, tone: "success" | "error" | "info") => void;
};

const categoryLabels: Record<WorkerDocumentCategory, string> = {
  [WorkerDocumentCategory.GovernmentId]: "Government ID",
  [WorkerDocumentCategory.ProfessionalCertificate]: "Professional certificate or licence",
  [WorkerDocumentCategory.BackgroundCheck]: "Background-check document",
  [WorkerDocumentCategory.Other]: "Additional document"
};

export function WorkerDocumentsField({ apiUrl, documents, onChange, onMessage }: Props) {
  const [uploadingCategory, setUploadingCategory] = useState<WorkerDocumentCategory | null>(null);
  const [progress, setProgress] = useState(0);

  async function upload(category: WorkerDocumentCategory, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (documents.length >= 10 && !documents.some((document) => document.category === category && category !== WorkerDocumentCategory.Other)) {
      onMessage("A worker profile can contain at most 10 documents.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onMessage("Choose a PDF, JPG, PNG, or WEBP document under 10 MB.", "error");
      return;
    }

    setUploadingCategory(category);
    setProgress(0);
    try {
      const signResponse = await apiFetch(`${apiUrl}/uploads/worker-documents/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, fileName: file.name, mimeType: file.type, sizeBytes: file.size })
      });
      const signed = await readJson(signResponse);
      if (!signResponse.ok) throw new Error(apiMessage(signed, "Unable to prepare document upload."));
      const uploaded = await uploadToCloudinary(file, signed as SignedUpload, setProgress);
      const completeResponse = await apiFetch(`${apiUrl}/uploads/worker-documents/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          publicId: uploaded.public_id,
          resourceType: uploaded.resource_type,
          deliveryType: uploaded.type,
          version: uploaded.version,
          format: uploaded.format,
          bytes: uploaded.bytes,
          originalFilename: uploaded.original_filename || file.name,
          signature: uploaded.signature
        })
      });
      const completed = await readJson(completeResponse);
      if (!completeResponse.ok) throw new Error(apiMessage(completed, "Unable to verify document upload."));
      const replacementIndex = category === WorkerDocumentCategory.Other ? -1 : documents.findIndex((document) => document.category === category);
      const next = [...documents];
      if (replacementIndex >= 0) next.splice(replacementIndex, 1, completed as WorkerDocumentRecord);
      else next.push(completed as WorkerDocumentRecord);
      onChange(next);
      onMessage(`${categoryLabels[category]} uploaded securely.`, "success");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Document upload failed. Try again.", "error");
    } finally {
      setUploadingCategory(null);
      setProgress(0);
    }
  }

  async function viewDocument(document: WorkerDocumentRecord) {
    const response = await apiFetch(`${apiUrl}/uploads/worker-documents/${document.id}/access-url`);
    const result = await readJson(response);
    if (!response.ok || typeof (result as { url?: unknown }).url !== "string") {
      onMessage(apiMessage(result, "Unable to open this document."), "error");
      return;
    }
    window.open((result as { url: string }).url, "_blank", "noopener,noreferrer");
  }

  function renderUpload(category: WorkerDocumentCategory, required: boolean) {
    const document = documents.find((item) => item.category === category);
    const uploading = uploadingCategory === category;
    return (
      <article className="worker-document-card" key={category}>
        <div>
          <strong>{categoryLabels[category]}</strong>
          <span>{required ? "Required" : "Optional"}</span>
        </div>
        <p>{document?.originalFilename ?? "PDF, JPG, PNG, or WEBP · maximum 10 MB"}</p>
        {uploading ? <progress max="100" value={progress}>{progress}%</progress> : null}
        <div className="worker-document-actions">
          <label className="secondary-step-button">
            {uploading ? `Uploading ${progress}%` : document ? "Replace" : "Upload"}
            <input accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={Boolean(uploadingCategory)} hidden onChange={(event) => void upload(category, event)} type="file" />
          </label>
          {document ? <button type="button" onClick={() => void viewDocument(document)}>View</button> : null}
          {document ? <button type="button" onClick={() => onChange(documents.filter((item) => item.id !== document.id))}>Remove</button> : null}
        </div>
      </article>
    );
  }

  return (
    <div className="worker-documents-field">
      <div className="worker-document-grid">
        {RequiredWorkerDocumentCategories.map((category) => renderUpload(category, true))}
        {documents.filter((document) => document.category === WorkerDocumentCategory.Other).map((document) => (
          <article className="worker-document-card" key={document.id}>
            <div><strong>Additional document</strong><span>Optional</span></div>
            <p>{document.originalFilename ?? "Uploaded document"}</p>
            <div className="worker-document-actions">
              <button type="button" onClick={() => void viewDocument(document)}>View</button>
              <button type="button" onClick={() => onChange(documents.filter((item) => item.id !== document.id))}>Remove</button>
            </div>
          </article>
        ))}
      </div>
      {documents.length < 10 ? renderUpload(WorkerDocumentCategory.Other, false) : null}
    </div>
  );
}

type SignedUpload = {
  apiKey: string;
  deliveryType: string;
  folder: string;
  signature: string;
  timestamp: number;
  uploadPublicId: string;
  uploadUrl: string;
};

type CloudinaryResult = {
  public_id: string;
  resource_type: string;
  type: string;
  version: number;
  format: string;
  bytes: number;
  original_filename?: string;
  signature: string;
};

function uploadToCloudinary(file: File, signed: SignedUpload, onProgress: (value: number) => void) {
  return new Promise<CloudinaryResult>((resolve, reject) => {
    const data = new FormData();
    data.append("file", file);
    data.append("api_key", signed.apiKey);
    data.append("timestamp", String(signed.timestamp));
    data.append("signature", signed.signature);
    data.append("folder", signed.folder);
    data.append("public_id", signed.uploadPublicId);
    data.append("type", signed.deliveryType);
    const request = new XMLHttpRequest();
    request.open("POST", signed.uploadUrl);
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
    request.onerror = () => reject(new Error("Cloudinary upload failed. Try again."));
    request.onload = () => {
      const result = JSON.parse(request.responseText || "{}") as CloudinaryResult & { error?: { message?: string } };
      if (request.status < 200 || request.status >= 300) reject(new Error(result.error?.message ?? "Cloudinary upload failed. Try again."));
      else resolve(result);
    };
    request.send(data);
  });
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return {}; }
}

function apiMessage(result: unknown, fallback: string) {
  if (result && typeof result === "object" && "message" in result) {
    const message = (result as { message?: string | string[] }).message;
    return Array.isArray(message) ? message.join(" ") : message ?? fallback;
  }
  return fallback;
}
