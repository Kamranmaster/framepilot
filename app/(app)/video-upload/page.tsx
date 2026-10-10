"use client";
import React,{useState} from "react";
import axios from 'axios'
import { uploadToCloudinary } from "@/app/lib/uploadToCloudinary";

function VideoUpload() {
  const [file,setFile]=useState<File|null>(null)
  const [title,setTitle]=useState("")
  const[description,setDescription]=useState("")
  const[isUplaoding,setIsUploading]=useState(false)
  const [Notification,setNotification]=useState<string|null>(null)
  const [progress,setProgress]=useState(0)


  const MAX_FILE_SIZE=70*1024*1024 // 70MB

  const handleSubmit=async (event:React.SubmitEvent<HTMLFormElement>)=>{
    event.preventDefault()
    setNotification(null)

    if(!file) return;

    if(file.size>MAX_FILE_SIZE){

      setNotification("File size exceeds the maximum limit of 70MB.");
      return;
    }

    setIsUploading(true)
    setProgress(0)

    try{
      const result=await uploadToCloudinary(file,"video",setProgress)

      const response=await axios.post("/api/video-upload",{
        title,
        description,
        publicId:result.public_id,
        originalSize:file.size,
      })

      if(response.status === 200){
        setNotification("Video uploaded successfully.");
      }


    }catch(error){
      console.log(error);
      setNotification("Failed to upload video.");
    }finally{
      setIsUploading(false);
    }


  }


  return (
    <div className="container mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold mb-4">Upload Video</h1>
      <form onSubmit={handleSubmit} className="card bg-base-100 shadow-md">
        <div className="card-body space-y-4">
        <div>
          <label className="label">
            <span className="label-text">Title</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input input-bordered w-full"
            required
          />
        </div>
        <div>
          <label className="label">
            <span className="label-text">Description</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="textarea textarea-bordered w-full"
          />
        </div>
        <div>
          <label className="label">
            <span className="label-text">Video File</span>
          </label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="file-input file-input-bordered w-full"
            required
          />

        </div>
        
        {isUplaoding && (
          <progress className="progress progress-primary w-full" value={progress} max={100}></progress>
        )}

        {Notification && (
          <div className="alert alert-info mt-2">
            {Notification}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isUplaoding}
        >
          {isUplaoding ? `Uploading... ${progress}%` : "Upload Video"}
        </button>
        </div>
      </form>
    </div>
  );
}

export default VideoUpload;
