import {NextRequest, NextResponse} from "next/server";

import {auth} from '@clerk/nextjs/server';

import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";

import { prisma } from "@/app/lib/prisma";



interface CloudinaryVideoUploadResult extends UploadApiResponse {
    duration?:number,
}

export async function POST(request:NextRequest) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try{
        const formData=await request.formData();
        const file=formData.get("file") as File |null;
        const title=formData.get("title") as string;
        const description = formData.get("description") as string;
        const originalSize = Number(formData.get("originalSize") ?? 0);
      
        if(!file){
            return NextResponse.json({error:"file not found"},{status:400})
        }
        if(!Number.isFinite(originalSize)){
            return NextResponse.json({error:"Invalid original size"},{status:400})
        }
        const bytes=await file.arrayBuffer();//that's not buffer actually need to convert buffer
        const buffer=Buffer.from(bytes)

        const result=await new Promise<CloudinaryVideoUploadResult>(
            (resolve,reject)=>{
                const uploadStream=cloudinary.uploader.upload_stream(
                    {
                        resource_type:"video",
                        folder:"video-upload",
                        transformation:[
                            {quality:"auto",fetch_format:"mp4"}

                        ]
                    },
                    (error,result)=>{
                        if(error) reject(error);
                        else if(result) resolve(result as CloudinaryVideoUploadResult);
                        else reject(new Error("Cloudinary upload returned no result"));
                    }
                )

                uploadStream.end(buffer)
            }
        )
        const video =await prisma.video.create({
            data:{
                title,
                description,
                publicId:result.public_id,
                originalSize:originalSize,
                compressedSize:String(result.bytes),
                duration:result.duration || 0,
            }

        })

        return NextResponse.json({publicId:result.public_id,videoId:video.id},{status:200})

    }catch (error){
        console.log("Upload video failed",error)
        return NextResponse.json({error:"Upload video failed"},{status:500})
    }finally{
        prisma.$disconnect()
    }
}
