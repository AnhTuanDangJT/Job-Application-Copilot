import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { rateLimiters } from "@/lib/rateLimit";
import { errors } from "@/lib/errors";
import { saveUserFile } from "@/lib/fileStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for images

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiters.api(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Authentication
    const auth = requireAuth(req);
    if (!auth) {
      return errors.unauthorized("Authentication required");
    }

    // Parse form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (error) {
      console.error("FormData parsing error:", error);
      return errors.validation("Failed to parse form data. Please ensure the request is sent as multipart/form-data.");
    }

    // Get file from form data
    const file = formData.get("image") as File | null;
    
    if (!file) {
      return errors.validation("No image provided");
    }

    // Validate file size
    if (file.size === 0) {
      return errors.validation("Image is empty");
    }

    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return errors.validation(`Image size (${fileSizeMB}MB) exceeds 10MB limit`);
    }

    // Validate file type (images only)
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const isValidType = allowedImageTypes.includes(file.type) || allowedExtensions.includes(fileExtension);
    
    if (!isValidType) {
      return errors.validation(`Invalid file type. Only image files (JPEG, PNG, GIF, WebP) are allowed.`);
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (!buffer || buffer.length === 0) {
      return errors.validation("Invalid image buffer");
    }

    // Save image file
    const storagePath = await saveUserFile(auth.sub, "images", file.name, buffer);
    
    // Return the URL path that can be used to access the image
    // The path should be relative to the API route: /api/mentor-communication/images/
    // Remove the "uploads/" prefix and use the remaining path
    const pathAfterUploads = storagePath.replace(/^uploads\//, "");
    const imageUrl = `/api/mentor-communication/images/${pathAfterUploads}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Image upload error:", error instanceof Error ? error.message : "Unknown error");
    return errors.internal("An error occurred while uploading image");
  }
}

