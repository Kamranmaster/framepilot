"use client";
import React, { useState, useRef } from "react";
import { CldImage } from "next-cloudinary";

const socialFormats = {
  instagram: {
    post: { width: 1080, height: 1350, ratio: "4:5" },
    square: { width: 1080, height: 1080, ratio: "1:1" },
    story: { width: 1080, height: 1920, ratio: "9:16" },
    reel: { width: 1080, height: 1920, ratio: "9:16" },
  },

  facebook: {
    post: { width: 1200, height: 1500, ratio: "4:5" },
    story: { width: 1080, height: 1920, ratio: "9:16" },
  },

  linkedin: {
    post: { width: 1080, height: 1350, ratio: "4:5" },
    square: { width: 1200, height: 1200, ratio: "1:1" },
    landscape: { width: 1920, height: 1080, ratio: "16:9" },
  },

  tiktok: {
    video: { width: 1080, height: 1920, ratio: "9:16" },
  },

  youtube: {
    video: { width: 1920, height: 1080, ratio: "16:9" },
    shorts: { width: 1080, height: 1920, ratio: "9:16" },
  },

  twitter: {
    image: { width: 1600, height: 900, ratio: "16:9" },
  },
};

type UploadImageResponse = {
  publicId: string;
};

export default function SocialShare() {
  const [uploadedImage, setUploadImage] = useState<string | null>(null);

  const [selectedPlatform, setSelectedPlatform] =
    useState<keyof typeof socialFormats>("instagram");

  const [selectedType, setSelectedType] = useState("post");
  const [isUploading, setisUploading] = useState(false);

  const [isTransforming, setIsTransforming] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setisUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/image-upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload image");

      const data = (await response.json()) as UploadImageResponse;

      setIsTransforming(true);
      setUploadImage(data.publicId);
    } catch (err) {
      console.log(err);
      alert("Failed to upload image");
    } finally {
      setisUploading(false);
    }
  };

  const handleDownload = () => {
    if (!imageRef.current) return;

    fetch(imageRef.current.src)
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download =
          `${selectedPlatform}-${selectedType}`
            .replace(/\s+/g, "_")
            .toLowerCase() + ".png";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      });
  };

  const selectedDimensions = (
    socialFormats[selectedPlatform as keyof typeof socialFormats] as Record<
      string,
      { width: number; height: number; ratio: string }
    >
  )[selectedType];

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Social Media Image Creator
      </h1>

      <div className="card">
        <div className="card-body">
          <h2 className="card-title mb-4">Upload an Image</h2>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Choose an image file</span>
            </label>
            <input
              type="file"
              onChange={handleFileUpload}
              className="file-input file-input-bordered file-input-primary w-full"
            />
          </div>
          {isUploading && (
            <div className="mt-4">
              <progress className="progress progress-primary w-full"></progress>
            </div>
          )}

          {uploadedImage && (
            <div className="mt-6">
              <h2 className="card-title mb-4">Select Social Media Format</h2>
              <div className="form-control">
                <select
                  className="select select-bordered w-full"
                  value={`${selectedPlatform}-${selectedType}`}
                  onChange={(e) => {
                    const [platform, type] = e.target.value.split("-");
                    setIsTransforming(true);
                    setSelectedPlatform(platform as keyof typeof socialFormats);
                    setSelectedType(type);
                  }}
                >
                  {Object.keys(socialFormats).flatMap((platform) =>
                    Object.keys(
                      socialFormats[platform as keyof typeof socialFormats],
                    ).map((type) => (
                      <option
                        key={`${platform}-${type}`}
                        value={`${platform}-${type}`}
                      >
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}{" "}
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    )),
                  )}
                </select>
              </div>
              <div className="mt-6 relative">
                <h3 className="text-lg font-semibold mb-2">Preview:</h3>
                <div className="flex justify-center">
                  {isTransforming && (
                    <div className="absolute inset-0 flex items-center justify-center bg-base-100 bg-opacity-50 z-10">
                      <span className="loading loading-spinner loading-lg"></span>
                    </div>
                  )}
                  <CldImage
                    width={selectedDimensions.width}
                    height={selectedDimensions.height}
                    src={uploadedImage}
                    sizes="100vw"
                    alt="Uploaded image"
                    crop="fill"
                    aspectRatio={selectedDimensions.ratio}
                    gravity="auto"
                    onLoad={(event) => {
                      imageRef.current = event.currentTarget;
                      setIsTransforming(false);
                    }}
                  />
                </div>
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isTransforming}
                    className="btn btn-primary"
                  >
                    Download Image
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
