import {NextRequest, NextResponse} from "next/server";

import {auth} from '@clerk/nextjs/server';

import { v2 as cloudinary } from "cloudinary";

import { prisma } from "@/app/lib/prisma";

// The browser uploads the video straight to Cloudinary, then calls this
// route with the publicId so we can save it in the database.
export async function POST(request:NextRequest) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try{
        const body = await request.json();
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const description = typeof body.description === "string" ? body.description : "";
        const publicId = typeof body.publicId === "string" ? body.publicId : "";
        const originalSize = Number(body.originalSize ?? 0);

        if(!title){
            return NextResponse.json({error:"title is required"},{status:400})
        }
        if(!publicId.startsWith("video-upload/")){
            return NextResponse.json({error:"Invalid publicId"},{status:400})
        }
        if(!Number.isFinite(originalSize)){
            return NextResponse.json({error:"Invalid original size"},{status:400})
        }

        // Ask Cloudinary for the real size and duration instead of trusting the browser
        const resource = await cloudinary.api.resource(publicId,{
            resource_type:"video",
            media_metadata:true,
        })

        const video =await prisma.video.create({
            data:{
                title,
                description,
                publicId,
                originalSize:originalSize,
                compressedSize:String(resource.bytes),
                duration:resource.duration || 0,
            }

        })

        return NextResponse.json({publicId,videoId:video.id},{status:200})

    }catch (error){
        console.log("Upload video failed",error)
        return NextResponse.json({error:"Upload video failed"},{status:500})
    }
}
