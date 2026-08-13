import { SignIn } from "@clerk/nextjs";
import { ImageIcon, Share2Icon, SparklesIcon, UploadCloudIcon } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen bg-base-200">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-base-100 px-10 py-8 lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3 text-xl font-bold">
            <span className="grid h-11 w-11 place-items-center rounded-box bg-primary text-primary-content">
              <ImageIcon className="h-6 w-6" />
            </span>
            Cloudinary Showcase
          </Link>

          <div className="flex flex-1 items-center">
            <div className="max-w-xl">
              <div className="badge badge-primary badge-lg mb-6">Media workspace</div>
              <h1 className="text-5xl font-bold leading-tight text-base-content">
                Build, compress, and prepare creative assets faster.
              </h1>
              <p className="mt-5 text-lg leading-8 text-base-content/70">
                Sign in to manage uploaded videos, generate social-ready images,
                and keep your Cloudinary workflow in one focused dashboard.
              </p>

              <div className="mt-10 grid gap-4">
                <div className="flex items-center gap-4 rounded-box border border-base-300 bg-base-200 p-4">
                  <UploadCloudIcon className="h-6 w-6 text-primary" />
                  <span className="font-medium">Upload and optimize videos</span>
                </div>
                <div className="flex items-center gap-4 rounded-box border border-base-300 bg-base-200 p-4">
                  <Share2Icon className="h-6 w-6 text-secondary" />
                  <span className="font-medium">Create platform-specific social assets</span>
                </div>
                <div className="flex items-center gap-4 rounded-box border border-base-300 bg-base-200 p-4">
                  <SparklesIcon className="h-6 w-6 text-accent" />
                  <span className="font-medium">Preview transformations before download</span>
                </div>
              </div>
            </div>
          </div>
        </section>

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
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
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
      </div>
    </main>
  );
}
