import {NextRequest, NextResponse} from "next/server";

import {auth} from '@clerk/nextjs/server';

import { v2 as cloudinary } from "cloudinary";

interface CloudinaryUploadResult{
    public_id:string,
}

export async function POST(request:NextRequest) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try{
        const formData=await request.formData();
        const file=formData.get("file") as File |null;

        if(!file){
            return NextResponse.json({error:"file not found"},{status:400})
        }
        const bytes=await file.arrayBuffer();//that's not buffer actually need to convert buffer
        const buffer=Buffer.from(bytes)

        const result=await new Promise<CloudinaryUploadResult>(
            (resolve,reject)=>{
                const uploadStream=cloudinary.uploader.upload_stream(
                    {folder:"next-cloudinary-uploads"},
                    (error,result)=>{
                        if(error) reject(error);
                        else resolve(result as CloudinaryUploadResult);
                    }
                )

                uploadStream.end(buffer)
            }
        )
        return NextResponse.json({publicId:result.public_id},{status:200})

    }catch (error){
        console.log("Upload image failed",error)
        return NextResponse.json({error:"Upload image failed"},{status:500})
    }
}
