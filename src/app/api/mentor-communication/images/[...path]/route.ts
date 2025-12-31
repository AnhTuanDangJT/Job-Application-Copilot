import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { errors } from "@/lib/errors";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Authentication
    const auth = requireAuth(req);
    if (!auth) {
      return errors.unauthorized("Authentication required");
    }

    const { path: pathArray } = await params;
    const imagePath = pathArray.join("/");

    // Security: Prevent path traversal
    if (imagePath.includes("..") || imagePath.startsWith("/") || imagePath.includes("\\")) {
      return errors.validation("Invalid image path");
    }

    // Construct full path - imagePath already contains userId/images/filename
    const fullPath = path.join(process.cwd(), "uploads", imagePath);

    // Verify file exists and is within uploads directory
    if (!fullPath.startsWith(path.join(process.cwd(), "uploads"))) {
      return errors.validation("Invalid image path");
    }

    try {
      const imageBuffer = await fs.readFile(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      
      // Determine content type
      const contentTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
      };

      const contentType = contentTypes[ext] || "image/jpeg";

      return new NextResponse(imageBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (fileError) {
      return errors.notFound("Image not found");
    }
  } catch (error) {
    console.error("Image serve error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while serving image");
  }
}

