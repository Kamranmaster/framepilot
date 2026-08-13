import { SignUp } from "@clerk/nextjs";
import { ImageIcon, LayersIcon, Share2Icon, UploadCloudIcon } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen bg-base-200">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center lg:hidden">
              <Link href="/" className="inline-flex items-center gap-3 text-xl font-bold">
                <span className="grid h-11 w-11 place-items-center rounded-box bg-primary text-primary-content">
                  <ImageIcon className="h-6 w-6" />
                </span>
                Cloudinary Showcase
              </Link>
            </div>

            <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-xl sm:p-6">
              <SignUp
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                fallbackRedirectUrl="/home"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    cardBox: "w-full shadow-none",
                    card: "w-full bg-transparent shadow-none p-0",
                    headerTitle: "text-2xl font-bold text-base-content",
                    headerSubtitle: "text-base-content/60",
                    socialButtonsBlockButton:
                      "btn btn-outline border-base-300 text-base-content hover:bg-base-200",
                    formButtonPrimary: "btn btn-primary w-full normal-case",
                    formFieldInput:
                      "input input-bordered w-full bg-base-100 text-base-content",
                    formFieldLabel: "label-text font-medium text-base-content",
                    footerActionText: "text-base-content/60",
                    footerActionLink: "link link-primary font-semibold",
                    dividerLine: "bg-base-300",
                    dividerText: "text-base-content/50",
                  },
                }}
              />
            </div>
          </div>
        </section>

        <section className="hidden bg-base-100 px-10 py-8 lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3 text-xl font-bold">
            <span className="grid h-11 w-11 place-items-center rounded-box bg-primary text-primary-content">
              <ImageIcon className="h-6 w-6" />
            </span>
            Cloudinary Showcase
          </Link>

          <div className="flex flex-1 items-center justify-center">
            <div className="max-w-xl">
              <div className="badge badge-secondary badge-lg mb-6">Create your workspace</div>
              <h1 className="text-5xl font-bold leading-tight text-base-content">
                Turn raw uploads into polished media for every channel.
              </h1>
              <p className="mt-5 text-lg leading-8 text-base-content/70">
                Start with a focused dashboard for video uploads, compression
                insights, Cloudinary previews, and social image formats.
              </p>

              <div className="mt-10 grid grid-cols-3 gap-4">
                <div className="rounded-box border border-base-300 bg-base-200 p-5">
                  <UploadCloudIcon className="mb-5 h-7 w-7 text-primary" />
                  <div className="text-sm font-semibold">Upload</div>
                </div>
                <div className="rounded-box border border-base-300 bg-base-200 p-5">
                  <LayersIcon className="mb-5 h-7 w-7 text-secondary" />
                  <div className="text-sm font-semibold">Transform</div>
                </div>
                <div className="rounded-box border border-base-300 bg-base-200 p-5">
                  <Share2Icon className="mb-5 h-7 w-7 text-accent" />
                  <div className="text-sm font-semibold">Share</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
