import {NextRequest, NextResponse} from "next/server";

import {auth} from '@clerk/nextjs/server';

import { v2 as cloudinary } from "cloudinary";

// Upload settings are decided here on the server, so the browser can only
// upload to these folders with these transformations.
const uploadPresets = {
    video: {
        folder: "video-upload",
        transformation: "f_mp4,q_auto",
    },
    image: {
        folder: "next-cloudinary-uploads",
    },
} as const;

export async function GET(request:NextRequest) {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = request.nextUrl.searchParams.get("type");
    if (type !== "video" && type !== "image") {
        return NextResponse.json({error:"Invalid upload type"},{status:400})
    }

    // cloudinary reads CLOUDINARY_URL from the environment
    const { api_key, api_secret, cloud_name } = cloudinary.config();
    if (!api_key || !api_secret || !cloud_name) {
        console.log("Cloudinary is not configured")
        return NextResponse.json({error:"Cloudinary is not configured"},{status:500})
    }

    const paramsToSign = {
        timestamp: Math.round(Date.now() / 1000),
        ...uploadPresets[type],
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, api_secret);

    return NextResponse.json({
        ...paramsToSign,
        signature,
        apiKey: api_key,
        cloudName: cloud_name,
    });
}
